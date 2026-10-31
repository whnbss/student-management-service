// B5 智能教案：上传错题试卷照片（多张）→ AI 逐题诊断 → 生成结构化教案（可查看/打印/重新生成/删除）
// 数据模型：lesson_plans(student_id, exam_name, images, analysis_json(诊断), plan_json(教案), created_at)
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import fs from 'node:fs'
import { UPLOADS_DIR, db, nowISO } from '../db'
import { pickProvider, diagnosePaper, generateLessonPlan } from '../ai'
import { todayLocal } from '@workbench/shared'
import type { LessonDiagnosis, LessonDiagnosisItem } from '@workbench/shared'

// P1-72：把 C2 拍照批改结果（AiAnalysisResult）转换为教案诊断结构（LessonDiagnosis）。
// 教案与批改判定必须同源——批改判「错/部分对」的题就是讲义失分表，「对」的题作对照，
// 「无法识别（标准答案待确认）」的题如实标注请人工核对，绝不重新看图另判一套
function aiResultToDiagnosis(a: any, fallbackName: string): LessonDiagnosis {
  const items = (Array.isArray(a?.items) ? a.items : []).map((it: any): LessonDiagnosisItem | null => {
    const no = String(it?.no ?? '').trim()
    if (!no) return null
    const wrong = it?.verdict === '错' || it?.verdict === '部分对'
    const pending = it?.verdict === '无法识别' || it?.verdict === '未作答'
    return {
      no,
      qtype: (Array.isArray(it?.options) && it.options.length) ? '选择' : '非选择',
      stem: String(it?.stem || '').trim(),
      options: Array.isArray(it?.options) ? it.options.map(String) : [],
      context: String(it?.stem || '').replace(/\s+/g, ' ').slice(0, 60),
      kp: (Array.isArray(it?.knowledge_points) ? it.knowledge_points : []).map(String).join('、'),
      student_answer: String(it?.student_answer || '（卷面未见）'),
      correct_answer: String(it?.reference_answer || '').slice(0, 300),
      solution: String(it?.reference_answer || '').slice(0, 600),
      gap: wrong
        ? [String(it?.error_step || ''), it?.error_type ? `错因：${it.error_type}` : '', String(it?.comment || '')].filter(Boolean).join('；')
        : pending
          ? `判定：${it?.verdict}。${String(it?.comment || '识别不清/待确认，请人工核对卷面')}`
          : `判定：${it?.verdict}（作答正确，作对照用）`,
    }
  }).filter(Boolean) as LessonDiagnosisItem[]
  return {
    paper_name: fallbackName || String(a?.paper_meta?.type || '拍照批改试卷'),
    paper_note: a?.overall_comment ? `批改总评：${String(a.overall_comment).slice(0, 150)}` : '',
    items,
    note: ['本教案基于「拍作业」批改的逐题判定结果生成（与批改错题集同源）', ...(Array.isArray(a?.unrecognized) ? a.unrecognized : [])].filter(Boolean).join('；'),
  }
}

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

  // 生成：两条路径 ——
  //   A. 传 log_id：直接复用该条学情记录里 C2 拍照批改的逐题判定结果（P1-72：教案必须基于真实批改
  //      结果，不再独立看图重新诊断——独立诊断会漏判/误判，与批改错题集对不上）
  //   B. 只传图片：视觉逐题诊断（旧路径，用于没有批改记录的散卷）
  app.post('/api/lesson-plans', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: unknown; exam_name?: unknown; images?: unknown; log_id?: unknown }
    const sid = Number(b.student_id)
    if (!sid) { reply.code(400).send({ error: '缺少学生' }); return }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    const images = Array.isArray(b.images) ? b.images.map(String).filter(Boolean) : []
    const examName = String(b.exam_name || '').trim().slice(0, 100)

    // 路径 A：基于 C2 批改结果（log_id 必须属于该学生且带 ai_result）
    let diagnosis: LessonDiagnosis | null = null
    const logId = Number(b.log_id) || 0
    let usage: any = { prompt_tokens: 0, completion_tokens: 0, cost: 0 }
    if (logId) {
      const log = db.prepare('SELECT * FROM study_logs WHERE id = ? AND student_id = ?').get(logId, sid) as any
      if (!log) { reply.code(404).send({ error: '批改记录不存在或不属于该学生' }); return }
      let aiResult: any = null
      try { aiResult = JSON.parse(log.ai_result || 'null') } catch { /* 损坏按无批改处理 */ }
      if (!aiResult?.items?.length) { reply.code(400).send({ error: '该条记录没有拍照批改结果，无法据此生成教案（请先走「拍作业」批改，或不选批改记录直接传照片）' }); return }
      diagnosis = aiResultToDiagnosis(aiResult, examName || String(log.content || '').slice(0, 60))
      if (!diagnosis.items.length) { reply.code(400).send({ error: '批改结果中没有可用的逐题判定' }); return }
    } else {
      // 路径 B：视觉逐题诊断（需要图片）
      if (!images.length) { reply.code(400).send({ error: '请先上传试卷照片，或选择一条已有批改记录' }); return }
      const provider = pickProvider('vision')
      if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
      const dataUrls = readImages(images)
      if (!dataUrls.length) { reply.code(400).send({ error: '图片文件不存在或已失效' }); return }
      try {
        const r = await diagnosePaper(provider, dataUrls, { grade: student.grade || '', examName })
        diagnosis = r.result
        usage = r.usage
      } catch (e: any) {
        reply.code(502).send({ error: e.message || '试卷诊断失败' }); return
      }
    }

    // 第二步：文本生成教案（诊断结果可能很大，截断保护由 prompt 内 slice 完成）
    try {
      const provider2 = pickProvider('text') || pickProvider('vision')
      if (!provider2) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
      const { result: plan, usage: u2 } = await generateLessonPlan(provider2, {
        diagnosis: diagnosis!,
        grade: student.grade || '',
        today: todayLocal(),
      })
      usage.prompt_tokens += u2.prompt_tokens || 0
      usage.completion_tokens += u2.completion_tokens || 0
      usage.cost += u2.cost || 0
      const r = db.prepare(`INSERT INTO lesson_plans(student_id, exam_name, images, analysis_json, plan_json, created_at)
        VALUES(?,?,?,?,?,?)`).run(
        sid,
        examName || diagnosis!.paper_name || '未命名试卷',
        JSON.stringify(images),
        JSON.stringify(diagnosis),
        JSON.stringify(plan),
        nowISO()
      )
      return { ok: true, id: Number(r.lastInsertRowid), plan, diagnosis, usage, based_on_log: logId || undefined }
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
