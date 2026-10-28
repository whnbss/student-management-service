// 学生管理：档案 CRUD + 课时包 + 缴费流水 + 课表 + 签到 + 课时结算（package/per_lesson）
import type { FastifyInstance } from 'fastify'
import { db, nowISO, remainingHours, billingModeOf, suspendStudentAccountIfDepleted, restoreStudentAccountIfRenewed } from '../db'

interface StudentBody {
  name?: string
  grade?: string
  school?: string
  textbook?: string
  phone?: string
  parent_wechat?: string
  avatar?: string
  note?: string
  status?: string
  billing_mode?: string
  lesson_price?: number
}

function studentWithHours(id: number) {
  const s = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as any
  if (!s) return null
  return { ...s, remaining_hours: remainingHours(id) }
}

export default async function studentRoutes(app: FastifyInstance) {
  // ---- 学生 CRUD ----
  app.get('/api/students', async (req) => {
    const { query = '', grade = '', status = '' } = req.query as Record<string, string>
    let sql = 'SELECT * FROM students WHERE 1=1'
    const args: any[] = []
    if (query) {
      sql += ' AND (name LIKE ? OR school LIKE ? OR phone LIKE ? OR note LIKE ?)'
      args.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`)
    }
    if (grade) { sql += ' AND grade = ?'; args.push(grade) }
    if (status) { sql += ' AND status = ?'; args.push(status) }
    sql += ' ORDER BY created_at DESC'
    const list = db.prepare(sql).all(...args) as any[]
    return list.map((s) => ({ ...s, remaining_hours: remainingHours(s.id) }))
  })

  app.post('/api/students', async (req, reply) => {
    const b = (req.body || {}) as StudentBody
    if (!b.name || !b.name.trim()) { reply.code(400).send({ error: '姓名必填' }); return }
    const billing = b.billing_mode === 'per_lesson' ? 'per_lesson' : 'package'
    const r = db.prepare(`INSERT INTO students(name, grade, school, textbook, phone, parent_wechat, avatar, note, status, billing_mode, lesson_price, created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(b.name.trim(), b.grade || '', b.school || '', b.textbook || '', b.phone || '', b.parent_wechat || '', b.avatar || '', b.note || '', b.status || '在读', billing, Number(b.lesson_price) || 0, nowISO())
    return { ok: true, id: r.lastInsertRowid, student: studentWithHours(Number(r.lastInsertRowid)) }
  })

  app.get('/api/students/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const s = studentWithHours(Number(id))
    if (!s) { reply.code(404).send({ error: '学生不存在' }); return }
    return s
  })

  app.put('/api/students/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = (req.body || {}) as StudentBody
    const fields = ['name', 'grade', 'school', 'textbook', 'phone', 'parent_wechat', 'avatar', 'note', 'status', 'lesson_price']
    const sets: string[] = []
    const args: any[] = []
    for (const f of fields) {
      if ((b as any)[f] !== undefined) { sets.push(`${f} = ?`); args.push((b as any)[f]) }
    }
    if (b.billing_mode !== undefined) {
      const billing = b.billing_mode === 'per_lesson' ? 'per_lesson' : 'package'
      sets.push('billing_mode = ?'); args.push(billing)
    }
    if (!sets.length) { reply.code(400).send({ error: '无要更新的字段' }); return }
    args.push(id)
    db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    // 显式切换结算模式时的账号状态同步：
    // 切回 package 且有余额 → 恢复被「课时耗尽」停用的账号；切回 package 且余额 0 → 立即停用（登录被拒）
    if (b.billing_mode !== undefined && billingModeOf(Number(id)) === 'package') {
      if (!restoreStudentAccountIfRenewed(Number(id))) {
        suspendStudentAccountIfDepleted(Number(id))
      }
    }
    return { ok: true, student: studentWithHours(Number(id)) }
  })

  app.delete('/api/students/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    // 级联清理通知：该生错题引发的重做通知（ref_id = 错题 id）随错题一并删除
    const mkIds = (db.prepare('SELECT id FROM mistakes WHERE student_id = ?').all(id) as any[]).map((m) => m.id)
    for (const mid of mkIds) {
      db.prepare('DELETE FROM notifications WHERE ref_id = ?').run(mid)
    }
    db.prepare('DELETE FROM students WHERE id = ?').run(id)
    return { ok: true }
  })

  // ---- 课时包 ----
  app.get('/api/students/:id/packages', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare('SELECT * FROM hour_packages WHERE student_id = ? ORDER BY purchase_date DESC, id DESC').all(id)
  })

  app.post('/api/students/:id/packages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = (req.body || {}) as { hours?: number; amount?: number; purchase_date?: string; note?: string }
    if (!b.hours || b.hours <= 0) { reply.code(400).send({ error: '课时数必须大于 0' }); return }
    // 同时写一条缴费流水（金额 > 0 时）
    const createAt = nowISO()
    const r = db.prepare(`INSERT INTO hour_packages(student_id, hours, amount, purchase_date, note, created_at) VALUES(?,?,?,?,?,?)`)
      .run(id, b.hours, b.amount || 0, b.purchase_date || createAt.slice(0, 10), b.note || '', createAt)
    if ((b.amount || 0) > 0) {
      db.prepare(`INSERT INTO payments(student_id, amount, method, paid_at, package_id, note, created_at) VALUES(?,?,?,?,?,?,?)`)
        .run(id, b.amount, '课时包', b.purchase_date || createAt.slice(0, 10), r.lastInsertRowid, '购买课时包', createAt)
    }
    // 续费加课时后余额 > 0：自动恢复因「课时耗尽」被停用的学生账号
    const account_restored = restoreStudentAccountIfRenewed(Number(id))
    return { ok: true, id: r.lastInsertRowid, remaining_hours: remainingHours(Number(id)), account_restored, billing_mode: billingModeOf(Number(id)) }
  })

  app.delete('/api/students/:id/packages/:pid', async (req) => {
    const { pid } = req.params as { pid: string }
    db.prepare('DELETE FROM hour_packages WHERE id = ?').run(pid)
    return { ok: true }
  })

  // ---- 缴费流水 ----
  app.get('/api/students/:id/payments', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare('SELECT * FROM payments WHERE student_id = ? ORDER BY paid_at DESC, id DESC').all(id)
  })

  app.post('/api/students/:id/payments', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = (req.body || {}) as { amount?: number; method?: string; paid_at?: string; note?: string }
    if (b.amount === undefined || isNaN(b.amount)) { reply.code(400).send({ error: '金额必填' }); return }
    const createAt = nowISO()
    const r = db.prepare(`INSERT INTO payments(student_id, amount, method, paid_at, note, created_at) VALUES(?,?,?,?,?,?)`)
      .run(id, b.amount, b.method || '', b.paid_at || createAt.slice(0, 10), b.note || '', createAt)
    return { ok: true, id: r.lastInsertRowid }
  })

  // ---- 每周固定课表 ----
  app.get('/api/students/:id/schedules', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare('SELECT * FROM schedules WHERE student_id = ? ORDER BY weekday, start_time').all(id)
  })

  app.post('/api/students/:id/schedules', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = (req.body || {}) as { weekday?: number; start_time?: string; end_time?: string; note?: string }
    if (b.weekday === undefined || !b.start_time || !b.end_time) { reply.code(400).send({ error: '星期与时间必填' }); return }
    const r = db.prepare(`INSERT INTO schedules(student_id, weekday, start_time, end_time, note, created_at) VALUES(?,?,?,?,?,?)`)
      .run(id, b.weekday, b.start_time, b.end_time, b.note || '', nowISO())
    return { ok: true, id: r.lastInsertRowid }
  })

  app.delete('/api/students/:id/schedules/:sid', async (req) => {
    const { sid } = req.params as { sid: string }
    db.prepare('DELETE FROM schedules WHERE id = ?').run(sid)
    return { ok: true }
  })

  // ---- 签到：package 到课扣 1 课时（耗尽自动停用学生账号）；per_lesson 到课生成按次结算记录 ----
  app.post('/api/attendance', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: number; date?: string; status?: string; schedule_id?: number; note?: string }
    if (!b.student_id || !b.date || !b.status) { reply.code(400).send({ error: '学生、日期、状态必填' }); return }
    if (!['到课', '请假', '缺勤'].includes(b.status)) { reply.code(400).send({ error: '非法状态' }); return }
    // 同一学生同一天同节课只能签到一次
    const dup = db.prepare('SELECT id FROM attendance WHERE student_id = ? AND date = ? AND schedule_id IS ?')
      .get(b.student_id, b.date, b.schedule_id ?? null) as { id: number } | undefined
    if (dup) { reply.code(409).send({ error: '该课已有签到记录' }); return }
    const mode = billingModeOf(b.student_id)
    // 到课扣次只发生在 package 模式；per_lesson 不扣课时（避免污染剩余课时），只记结算
    const deducted = b.status === '到课' && mode === 'package' ? 1 : 0
    const r = db.prepare(`INSERT INTO attendance(student_id, date, status, schedule_id, deducted, note, created_at) VALUES(?,?,?,?,?,?,?)`)
      .run(b.student_id, b.date, b.status, b.schedule_id ?? null, deducted, b.note || '', nowISO())
    // 一课一结算：到课即写一条结算记录（金额取学生档案的单次课费用）
    let settlement_id: number | null = null
    let settlement_amount = 0
    if (b.status === '到课' && mode === 'per_lesson') {
      const st = db.prepare('SELECT lesson_price FROM students WHERE id = ?').get(b.student_id) as { lesson_price?: number }
      settlement_amount = Number(st?.lesson_price) || 0
      settlement_id = Number(db.prepare(`INSERT INTO settlements(student_id, date, amount, note, created_at) VALUES(?,?,?,?,?)`)
        .run(b.student_id, b.date, settlement_amount, '按次结算', nowISO()).lastInsertRowid)
    }
    // 充值课时模式：扣完自动停用该生学生账号（登录被拒，提示联系老师续费）
    const account_suspended = b.status === '到课' ? suspendStudentAccountIfDepleted(b.student_id) : false
    return {
      ok: true,
      id: r.lastInsertRowid,
      deducted,
      remaining_hours: remainingHours(b.student_id),
      billing_mode: mode,
      settlement_id,
      settlement_amount,
      account_suspended,
    }
  })

  // ---- 一课一结算：结算记录（可按月过滤，用于导月度账单） ----
  app.get('/api/students/:id/settlements', async (req) => {
    const { id } = req.params as { id: string }
    const { month = '' } = req.query as Record<string, string>
    let sql = 'SELECT * FROM settlements WHERE student_id = ?'
    const args: any[] = [id]
    if (/^\d{4}-\d{2}$/.test(month)) { sql += ' AND date LIKE ?'; args.push(`${month}-%`) }
    sql += ' ORDER BY date DESC, id DESC'
    const items = db.prepare(sql).all(...args) as any[]
    const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0)
    return { items, total, billing_mode: billingModeOf(Number(id)) }
  })

  app.get('/api/attendance', async (req) => {
    const { student_id, date } = req.query as Record<string, string>
    let sql = 'SELECT * FROM attendance WHERE 1=1'
    const args: any[] = []
    if (student_id) { sql += ' AND student_id = ?'; args.push(student_id) }
    if (date) { sql += ' AND date = ?'; args.push(date) }
    sql += ' ORDER BY date DESC, id DESC'
    return db.prepare(sql).all(...args)
  })
}
