// 学情日志：时间线 CRUD（M2 扩展：图片 + AI 分析结果落库 + 错题抽取）
import type { FastifyInstance } from 'fastify'
import { db, nowISO } from '../db'
import { REDO_INTERVALS } from '@workbench/shared'

// 从确认后的 AI 分析结果抽取错题入库（含艾宾浩斯重做计划：1/3/7/15 天）
// onlyNos：教师勾选确认入库的题号；不传则默认全部错/部分对题目入库
export function extractMistakes(studentId: number, logId: number, analysis: any, onlyNos?: number[]) {
  const items = Array.isArray(analysis?.items) ? analysis.items : []
  const bad = items.filter(
    (it: any) =>
      (it.verdict === '错' || it.verdict === '部分对') &&
      (!Array.isArray(onlyNos) || onlyNos.length === 0 || onlyNos.includes(Number(it.no)))
  )
  const today = nowISO().slice(0, 10)
  const due = new Date(Date.now() + REDO_INTERVALS[0] * 86400000).toISOString().slice(0, 10)
  const ins = db.prepare(`INSERT INTO mistakes(
    student_id, log_id, stem, correct_solution, wrong_solution, error_type,
    knowledge_points, chapter, difficulty, mastery_status, redo_due, redo_stage, source, created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const it of bad) {
    ins.run(
      studentId, logId,
      String(it.comment || `第 ${it.no} 题做错`), // 题干初稿来自 AI 评语，教师可在错题本中补全
      '', '',
      String(it.error_type || '其他'),
      JSON.stringify(Array.isArray(it.knowledge_points) ? it.knowledge_points : []),
      '', 3, '未掌握', due, 0, 'ai_analysis', nowISO()
    )
  }
  return bad.length
}

export default async function logRoutes(app: FastifyInstance) {
  app.get('/api/students/:id/logs', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare('SELECT * FROM study_logs WHERE student_id = ? ORDER BY date DESC, id DESC').all(id)
  })

  app.post('/api/students/:id/logs', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = (req.body || {}) as {
      date?: string; type?: string; content?: string; next_class_key?: string
      images?: string[]; ai_result?: any; create_mistakes?: boolean; mistake_nos?: number[]
    }
    if (!b.content || !b.content.trim()) { reply.code(400).send({ error: '记录内容必填' }); return }
    const type = ['上课', '作业', '考试', '其他'].includes(b.type || '') ? b.type! : '其他'
    const aiJson = b.ai_result ? JSON.stringify(b.ai_result) : null
    const r = db.prepare(
      `INSERT INTO study_logs(student_id, date, type, content, images, ai_result, ai_generated, next_class_key, created_at)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).run(
      id, b.date || nowISO().slice(0, 10), type, b.content.trim(),
      JSON.stringify(Array.isArray(b.images) ? b.images : []),
      aiJson, b.ai_result ? 1 : 0, b.next_class_key || '', nowISO()
    )
    const logId = Number(r.lastInsertRowid)
    // AI 分析结果确认入库时，抽取错/部分对题目进错题本（教师可在错题本中编辑）
    let mistakeCount = 0
    if (b.ai_result && b.create_mistakes !== false) {
      mistakeCount = extractMistakes(Number(id), logId, b.ai_result, b.mistake_nos)
    }
    return { ok: true, id: logId, mistakes_created: mistakeCount }
  })

  app.delete('/api/logs/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM study_logs WHERE id = ?').run(id)
    return { ok: true }
  })
}
