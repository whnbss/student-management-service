// 只读分享链接（P2）：家长报告生成随机 token 的 H5 只读页，带有效期
// 生成走登录鉴权；查看走 /api/public/（免登录，凭 token）
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { db, nowISO } from '../db'
import { sanitizeAiText } from '@workbench/shared'
import type { ParentReport } from '@workbench/shared'

// 有效期可选档（小时）
const EXPIRES_CHOICES = [24, 72, 24 * 7, 24 * 30]

// 报告结构校验：五字段齐全且类型正确才允许分享，防止把脏数据发出去
function validReport(r: unknown): r is ParentReport {
  if (!r || typeof r !== 'object') return false
  const p = r as Record<string, unknown>
  return (
    typeof p.summary === 'string' &&
    Array.isArray(p.glow) && p.glow.every((x) => typeof x === 'string') &&
    Array.isArray(p.grow) && p.grow.every((x) => typeof x === 'string') &&
    Array.isArray(p.plan) && p.plan.every((x) => typeof x === 'string') &&
    typeof p.payment_hint === 'string'
  )
}

export default async function shareRoutes(app: FastifyInstance) {
  // ---------- 生成分享链接（登录） ----------
  app.post('/api/reports/share', async (req, reply) => {
    const b = (req.body || {}) as {
      student_id?: unknown; report?: unknown; range?: { from?: unknown; to?: unknown }; expires_hours?: unknown
    }
    const sid = Number(b.student_id)
    if (!sid) { reply.code(400).send({ error: '缺少学生' }); return }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    if (!validReport(b.report)) { reply.code(400).send({ error: '报告内容不完整，无法分享' }); return }
    const hours = EXPIRES_CHOICES.includes(Number(b.expires_hours)) ? Number(b.expires_hours) : 72
    const from = String(b.range?.from || '').slice(0, 10)
    const to = String(b.range?.to || '').slice(0, 10)
    const expires_at = new Date(Date.now() + hours * 3600000).toISOString()
    const token = crypto.randomBytes(16).toString('hex')
    const payload = JSON.stringify({
      student_name: student.name,
      grade: student.grade || '',
      range: { from, to },
      report: {
        summary: sanitizeAiText(b.report!.summary),
        glow: b.report!.glow.map((s) => sanitizeAiText(s)),
        grow: b.report!.grow.map((s) => sanitizeAiText(s)),
        plan: b.report!.plan.map((s) => sanitizeAiText(s)),
        payment_hint: sanitizeAiText(b.report!.payment_hint),
      },
    })
    // 同一学生旧的同档报告链接不清理：各自独立有效期，过期自动失效
    db.prepare('INSERT INTO shares(token, kind, student_id, title, payload, expires_at, created_at) VALUES(?,?,?,?,?,?,?)')
      .run(token, 'parent_report', sid, `${student.name} · 物理学习阶段报告`, payload, expires_at, nowISO())
    return { ok: true, token, expires_at }
  })

  // ---------- 公开只读查看（免登录，凭 token；过期返回 410） ----------
  app.get('/api/public/share/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const row = db.prepare('SELECT * FROM shares WHERE token = ?').get(token) as any
    if (!row) { reply.code(404).send({ error: '分享链接不存在或已被删除' }); return }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      reply.code(410).send({ error: '分享链接已过期，请联系老师重新生成' })
      return
    }
    try {
      return { ok: true, title: row.title, expires_at: row.expires_at, ...JSON.parse(row.payload) }
    } catch {
      reply.code(500).send({ error: '分享内容损坏' })
    }
  })

  // ---------- 我的分享链接列表（登录，便于管理/手动失效） ----------
  app.get('/api/reports/share', async (req) => {
    const q = req.query as { student_id?: string }
    const rows = db
      .prepare('SELECT id, token, student_id, title, expires_at, created_at FROM shares WHERE (? IS NULL OR student_id = ?) ORDER BY id DESC LIMIT 50')
      .all(q.student_id || null, q.student_id || null) as any[]
    const now = Date.now()
    return {
      ok: true,
      shares: rows.map((r) => ({ ...r, expired: new Date(r.expires_at).getTime() < now })),
    }
  })

  // ---------- 删除（撤销）分享链接 ----------
  app.delete('/api/reports/share/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM shares WHERE id = ?').run(id)
    return { ok: true }
  })
}
