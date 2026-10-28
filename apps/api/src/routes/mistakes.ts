// 错题本：CRUD、重做计划（艾宾浩斯 1/3/7/15 天）、举一反三变式题
import type { FastifyInstance } from 'fastify'
import { db, nowISO } from '../db'
import { pickProvider, generateVariants } from '../ai'
import { REDO_INTERVALS, addDays, todayLocal } from '@workbench/shared'

export default async function mistakeRoutes(app: FastifyInstance) {
  // 列表：按学生/状态/知识点/关键词筛选；到期重做在前端置顶
  app.get('/api/mistakes', async (req) => {
    const q = req.query as { student_id?: string; status?: string; knowledge_point?: string; q?: string }
    let sql = `SELECT m.*, st.name AS student_name FROM mistakes m JOIN students st ON st.id = m.student_id WHERE 1=1`
    const args: any[] = []
    if (q.student_id) { sql += ' AND m.student_id = ?'; args.push(q.student_id) }
    if (q.status) { sql += ' AND m.mastery_status = ?'; args.push(q.status) }
    if (q.q) { sql += ' AND (m.stem LIKE ? OR m.wrong_solution LIKE ? OR m.knowledge_points LIKE ?)'; const like = `%${q.q}%`; args.push(like, like, like) }
    sql += ' ORDER BY m.created_at DESC'
    const rows = db.prepare(sql).all(...args) as any[]
    // 知识点过滤（JSON 数组 LIKE 兜底）
    const list = q.knowledge_point
      ? rows.filter((m) => (m.knowledge_points || '').includes(q.knowledge_point!))
      : rows
    return list
  })

  app.post('/api/mistakes', async (req, reply) => {
    const b = (req.body || {}) as any
    if (!b.student_id) { reply.code(400).send({ error: '缺少学生' }); return }
    if (!b.stem || !String(b.stem).trim()) { reply.code(400).send({ error: '题干必填' }); return }
    const today = todayLocal()
    const r = db.prepare(`INSERT INTO mistakes(
      student_id, image, stem, correct_solution, wrong_solution, error_type,
      knowledge_points, chapter, difficulty, mastery_status, redo_due, redo_stage, source, created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      b.student_id, b.image || '', String(b.stem).trim(), b.correct_solution || '', b.wrong_solution || '',
      b.error_type || '', JSON.stringify(Array.isArray(b.knowledge_points) ? b.knowledge_points : []),
      b.chapter || '', Math.min(5, Math.max(1, Number(b.difficulty) || 3)),
      '未掌握', addDays(today, REDO_INTERVALS[0]), 0, 'manual', nowISO()
    )
    return { ok: true, id: r.lastInsertRowid }
  })

  app.put('/api/mistakes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const cur = db.prepare('SELECT * FROM mistakes WHERE id = ?').get(id) as any
    if (!cur) { reply.code(404).send({ error: '错题不存在' }); return }
    const b = (req.body || {}) as any
    const fields = ['stem', 'correct_solution', 'wrong_solution', 'error_type', 'chapter', 'image'] as const
    const sets: string[] = []
    const args: any[] = []
    for (const f of fields) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); args.push(String(b[f])) }
    }
    if (b.knowledge_points !== undefined) {
      sets.push('knowledge_points = ?')
      args.push(JSON.stringify(Array.isArray(b.knowledge_points) ? b.knowledge_points : []))
    }
    if (b.difficulty !== undefined) { sets.push('difficulty = ?'); args.push(Math.min(5, Math.max(1, Number(b.difficulty) || 3))) }

    // 掌握状态流转：未掌握 →(重做完成)→ 已重做一次 →(再次重做完成)→ 已掌握
    if (b.redo_done === true) {
      const stage = Math.min(cur.redo_stage + 1, REDO_INTERVALS.length)
      const mastered = stage >= REDO_INTERVALS.length
      sets.push('redo_stage = ?', 'mastery_status = ?', 'redo_due = ?')
      args.push(stage, mastered ? '已掌握' : '已重做一次', mastered ? null : addDays(todayLocal(), REDO_INTERVALS[stage]))
    } else if (b.mastery_status !== undefined) {
      // 直接手动设置状态（如手动标已掌握）
      sets.push('mastery_status = ?', 'redo_due = ?')
      args.push(String(b.mastery_status), b.mastery_status === '已掌握' ? null : cur.redo_due)
    } else if (b.redo_due !== undefined) {
      // 教师手动调整重做日期
      sets.push('redo_due = ?')
      args.push(b.redo_due || null)
    }
    if (!sets.length) { reply.code(400).send({ error: '没有要更新的字段' }); return }
    args.push(id)
    db.prepare(`UPDATE mistakes SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    return { ok: true }
  })

  app.delete('/api/mistakes/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM mistakes WHERE id = ?').run(id)
    return { ok: true }
  })

  // 举一反三：AI 生成 2~3 道变式题，直接存入题库
  app.post('/api/mistakes/:id/variants', async (req, reply) => {
    const { id } = req.params as { id: string }
    const m = db.prepare('SELECT * FROM mistakes WHERE id = ?').get(id) as any
    if (!m) { reply.code(404).send({ error: '错题不存在' }); return }
    const provider = pickProvider('text')
    if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
    try {
      const { result: variants, usage } = await generateVariants(provider, {
        stem: m.stem,
        correct_solution: m.correct_solution,
        error_type: m.error_type,
        knowledge_points: JSON.parse(m.knowledge_points || '[]'),
        difficulty: m.difficulty,
      })
      const ins = db.prepare(`INSERT INTO questions(
        stem, answer, solution, pitfall, knowledge_points, difficulty, qtype, source, mistake_id, grade, created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      const ids: number[] = []
      for (const v of variants) {
        const r = ins.run(
          v.stem, v.answer, v.solution, v.pitfall, JSON.stringify(v.knowledge_points),
          v.difficulty, v.qtype, 'ai_generated', m.id, '', nowISO()
        )
        ids.push(Number(r.lastInsertRowid))
      }
      return { ok: true, ids, usage, questions: variants }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || '生成变式题失败' })
    }
  })

  // 某错题的变式题列表
  app.get('/api/mistakes/:id/variants', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare('SELECT * FROM questions WHERE mistake_id = ? ORDER BY id DESC').all(id)
  })
}
