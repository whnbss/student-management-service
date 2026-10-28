// 学生账号管理（仅教师）：开通、批量开通、重置密码为手机号、停用/启用、改名
import type { FastifyInstance } from 'fastify'
import { db, nowISO, remainingHours } from '../db'
import { hashPassword } from '../crypto'

// 学生账号默认用户名：学生姓名；重名自动追加手机尾 4 位（再重试则追加序号）
function dedupeUsername(base: string, phone: string): string {
  const exists = (u: string) => !!db.prepare('SELECT id FROM accounts WHERE username = ?').get(u)
  if (!exists(base)) return base
  const tail = (phone || '').slice(-4)
  if (tail && !exists(base + tail)) return base + tail
  let i = 2
  while (exists(`${base}${i}`)) i++
  return `${base}${i}`
}

export default async function accountRoutes(app: FastifyInstance) {
  // 列表：全部账号 + 尚未开通账号的学生（一次性返回，前端一个卡片全搞定）
  app.get('/api/accounts', async () => {
    const accounts = db.prepare(`
      SELECT a.id, a.role, a.student_id, a.username, a.phone, a.status, a.must_change_pwd, a.last_login, a.created_at,
             st.name AS student_name
      FROM accounts a LEFT JOIN students st ON st.id = a.student_id
      ORDER BY a.role, a.id ASC`).all() as any[]
    const openable = db.prepare(`
      SELECT id, name, phone FROM students
      WHERE id NOT IN (SELECT student_id FROM accounts WHERE student_id IS NOT NULL)
      ORDER BY created_at DESC`).all() as any[]
    return {
      ok: true,
      accounts: accounts.map((a) => ({ ...a, remaining_hours: a.student_id ? remainingHours(a.student_id) : undefined })),
      openable_students: openable.map((s) => ({ ...s, remaining_hours: remainingHours(s.id) })),
    }
  })

  // 开通单个学生账号：username 默认学生姓名，初始密码默认手机号（未填手机号则必须显式给密码）
  app.post('/api/accounts', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: number; username?: string; password?: string }
    const sid = Number(b.student_id)
    if (!sid) { reply.code(400).send({ error: '缺少学生' }); return }
    const st = db.prepare('SELECT * FROM students WHERE id = ?').get(sid) as any
    if (!st) { reply.code(404).send({ error: '学生不存在' }); return }
    if (db.prepare('SELECT id FROM accounts WHERE student_id = ?').get(sid)) {
      reply.code(409).send({ error: '该学生已有账号' }); return
    }
    const username = (b.username || st.name).trim()
    if (!username) { reply.code(400).send({ error: '用户名不能为空' }); return }
    if (db.prepare('SELECT id FROM accounts WHERE username = ?').get(username)) {
      reply.code(409).send({ error: '用户名已存在，请换一个' }); return
    }
    const phone = (st.phone || '').trim()
    const pwd = (b.password || phone).trim()
    if (!pwd) { reply.code(400).send({ error: '该学生未填手机号，无法生成初始密码；请先在学生档案补手机号或指定初始密码' }); return }
    if (pwd.length < 6) { reply.code(400).send({ error: '初始密码至少 6 位（手机号不足 6 位时请指定密码）' }); return }
    const { hash, salt } = hashPassword(pwd)
    const r = db.prepare(`INSERT INTO accounts(role, student_id, username, pwd_hash, pwd_salt, phone, status, must_change_pwd, created_at)
      VALUES('student', ?, ?, ?, ?, ?, 'active', 1, ?)`).run(sid, username, hash, salt, phone, nowISO())
    return { ok: true, id: r.lastInsertRowid, username }
  })

  // 批量开通：给定学生 id 列表（缺省 = 所有未开通且有手机号的学生）
  app.post('/api/accounts/batch-open', async (req) => {
    const b = (req.body || {}) as { student_ids?: number[] }
    let targets: any[]
    if (Array.isArray(b.student_ids) && b.student_ids.length) {
      const ph = b.student_ids.map(() => '?').join(',')
      targets = db.prepare(`SELECT * FROM students WHERE id IN (${ph}) AND id NOT IN (SELECT student_id FROM accounts WHERE student_id IS NOT NULL)`).all(...b.student_ids) as any[]
    } else {
      targets = db.prepare(`SELECT * FROM students WHERE phone != '' AND id NOT IN (SELECT student_id FROM accounts WHERE student_id IS NOT NULL)`).all() as any[]
    }
    const results: Array<{ student_id: number; username?: string; error?: string }> = []
    for (const st of targets) {
      const username = dedupeUsername(st.name, st.phone || '')
      const pwd = (st.phone || '').trim()
      if (!pwd || pwd.length < 6) { results.push({ student_id: st.id, error: '无手机号或手机号不足 6 位' }); continue }
      const { hash, salt } = hashPassword(pwd)
      db.prepare(`INSERT INTO accounts(role, student_id, username, pwd_hash, pwd_salt, phone, status, must_change_pwd, created_at)
        VALUES('student', ?, ?, ?, ?, ?, 'active', 1, ?)`).run(st.id, username, hash, salt, st.phone, nowISO())
      results.push({ student_id: st.id, username })
    }
    return { ok: true, results }
  })

  // 更新：停用/启用、改用户名、教师手动重置密码
  app.put('/api/accounts/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any
    if (!acc) { reply.code(404).send({ error: '账号不存在' }); return }
    const b = (req.body || {}) as { status?: string; username?: string; password?: string }
    if (b.status !== undefined) {
      if (!['active', 'suspended'].includes(b.status)) { reply.code(400).send({ error: '非法状态' }); return }
      db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(b.status, id)
    }
    if (b.username !== undefined) {
      const u = String(b.username).trim()
      if (!u) { reply.code(400).send({ error: '用户名不能为空' }); return }
      const dup = db.prepare('SELECT id FROM accounts WHERE username = ? AND id != ?').get(u, id)
      if (dup) { reply.code(409).send({ error: '用户名已存在' }); return }
      db.prepare('UPDATE accounts SET username = ? WHERE id = ?').run(u, id)
    }
    if (b.password !== undefined) {
      const pwd = String(b.password)
      if (pwd.length < 6) { reply.code(400).send({ error: '密码至少 6 位' }); return }
      const { hash, salt } = hashPassword(pwd)
      db.prepare('UPDATE accounts SET pwd_hash = ?, pwd_salt = ?, must_change_pwd = 1 WHERE id = ?').run(hash, salt, id)
    }
    return { ok: true }
  })

  // 重置密码为该学生手机号（快捷操作）
  app.post('/api/accounts/:id/reset-password', async (req, reply) => {
    const { id } = req.params as { id: string }
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any
    if (!acc) { reply.code(404).send({ error: '账号不存在' }); return }
    const phone = (acc.phone || (acc.student_id ? (db.prepare('SELECT phone FROM students WHERE id = ?').get(acc.student_id) as any)?.phone : '') || '').trim()
    if (!phone || phone.length < 6) { reply.code(400).send({ error: '该学生未填手机号（或不足 6 位），无法重置为手机号' }); return }
    const { hash, salt } = hashPassword(phone)
    db.prepare('UPDATE accounts SET pwd_hash = ?, pwd_salt = ?, must_change_pwd = 1 WHERE id = ?').run(hash, salt, id)
    return { ok: true, password: phone }
  })

  // 删除学生账号（学生档案删除时级联）
  app.delete('/api/accounts/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any
    if (!acc) { reply.code(404).send({ error: '账号不存在' }); return }
    if (acc.role === 'teacher') { reply.code(400).send({ error: '不能删除教师账号' }); return }
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { ok: true }
  })
}
