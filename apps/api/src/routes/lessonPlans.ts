// B5 智能教案：上传错题试卷照片（多张）→ AI 逐题诊断 → 生成结构化教案（可查看/打印/重新生成/删除）
// 数据模型：lesson_plans(student_id, exam_name, images, analysis_json(诊断), plan_json(教案), created_at)
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import fs from 'node:fs'
import { UPLOADS_DIR, db, nowISO } from '../db'
import { pickProvider, diagnosePaper, generateLessonPlan } from '../ai'
import { todayLocal } from '@workbench/shared'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
}

// 上传路径 → base64 data URL（与 analysis.ts 同一套安全读取）
function readImages(paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths.slice(0, 9)) {
    const rel = String(p).replace(/^\/uploads\//, '')
    const abs = path.join(UPLOADS_DIR, rel)
    if (!abs.startsWith(UPLOADS_DIR) || !fs.existsSync(abs)) continue
    const ext = path.extname(abs).toLowerCase()
    const buf = fs.readFileSync(abs)
    out.push(`data:${MIME[ext] || 'image/jpeg'};base64,${buf.toString('base64')}`)
  }
  return out
}

function rowOf(r: any) {
  let analysis: any = null
  let plan: any = null
  try { analysis = JSON.parse(r.analysis_json || '{}') } catch { /* 损坏跳过 */ }
  try { plan = JSON.parse(r.plan_json || '{}') } catch { /* 损坏跳过 */ }
  return {
    id: r.id,
    student_id: r.student_id,
    student_name: r.student_name,
    exam_name: r.exam_name,
    images: (() => { try { return JSON.parse(r.images || '[]') } catch { return [] } })(),
    analysis,
    plan,
    created_at: r.created_at,
  }
}

export default async function lessonPlanRoutes(app: FastifyInstance) {
  // 列表（含 plan 摘要，供历史查看）
  app.get('/api/lesson-plans', async () => {
    const rows = db.prepare(`
      SELECT lp.*, st.name AS student_name FROM lesson_plans lp
      LEFT JOIN students st ON st.id = lp.student_id
      ORDER BY lp.created_at DESC, lp.id DESC LIMIT 100`).all() as any[]
    return rows.map((r) => {
      const row = rowOf(r)
      return { ...row, plan: undefined, analysis: undefined, plan_summary: row.plan?.cover || null }
    })
  })

  app.get('/api/lesson-plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const r = db.prepare(`
      SELECT lp.*, st.name AS student_name FROM lesson_plans lp
      LEFT JOIN students st ON st.id = lp.student_id WHERE lp.id = ?`).get(id) as any
    if (!r) { reply.code(404).send({ error: '教案不存在' }); return }
    return { ok: true, plan: rowOf(r) }
  })

  // 生成：上传图片 → 视觉逐题诊断 → 文本生成教案 → 入库
  app.post('/api/lesson-plans', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: unknown; exam_name?: unknown; images?: unknown }
    const sid = Number(b.student_id)
    if (!sid) { reply.code(400).send({ error: '缺少学生' }); return }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    const images = Array.isArray(b.images) ? b.images.map(String).filter(Boolean) : []
    if (!images.length) { reply.code(400).send({ error: '请先上传试卷照片' }); return }
    const examName = String(b.exam_name || '').trim().slice(0, 100)
    const provider = pickProvider('vision')
    if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
    const dataUrls = readImages(images)
    if (!dataUrls.length) { reply.code(400).send({ error: '图片文件不存在或已失效' }); return }
    try {
      // 第一步：视觉逐题诊断
      const { result: diagnosis } = await diagnosePaper(provider, dataUrls, {
        grade: student.grade || '',
        examName,
      })
      // 第二步：文本生成教案（诊断结果可能很大，截断保护由 prompt 内 slice 完成）
      const { result: plan, usage } = await generateLessonPlan(provider, {
        diagnosis,
        grade: student.grade || '',
        today: todayLocal(),
      })
      const r = db.prepare(`INSERT INTO lesson_plans(student_id, exam_name, images, analysis_json, plan_json, created_at)
        VALUES(?,?,?,?,?,?)`).run(
        sid,
        examName || diagnosis.paper_name || '未命名试卷',
        JSON.stringify(images),
        JSON.stringify(diagnosis),
        JSON.stringify(plan),
        nowISO()
      )
      return { ok: true, id: Number(r.lastInsertRowid), plan, diagnosis, usage }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || '智能教案生成失败' })
    }
  })

  // 重新生成：用已存的诊断结果重跑第二步（换一次生成，便于不满意时重掷）
  app.post('/api/lesson-plans/:id/regenerate', async (req, reply) => {
    const { id } = req.params as { id: string }
    const r = db.prepare(`
      SELECT lp.*, st.grade AS student_grade FROM lesson_plans lp
      LEFT JOIN students st ON st.id = lp.student_id WHERE lp.id = ?`).get(id) as any
    if (!r) { reply.code(404).send({ error: '教案不存在' }); return }
    let diagnosis: any = null
    try { diagnosis = JSON.parse(r.analysis_json || '{}') } catch { /* 损坏 */ }
    if (!diagnosis?.items?.length) { reply.code(400).send({ error: '该教案缺少诊断结果，请删除后重新上传生成' }); return }
    const provider = pickProvider('text')
    if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
    try {
      const { result: plan, usage } = await generateLessonPlan(provider, {
        diagnosis,
        grade: r.student_grade || '',
        today: todayLocal(),
      })
      db.prepare('UPDATE lesson_plans SET plan_json = ? WHERE id = ?').run(JSON.stringify(plan), id)
      return { ok: true, plan, usage }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || '教案重新生成失败' })
    }
  })

  app.delete('/api/lesson-plans/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM lesson_plans WHERE id = ?').run(id)
    return { ok: true }
  })
}
