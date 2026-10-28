// 登录路由：账号 + 密码（scrypt 校验），签发角色化 token；带登录限速
import type { FastifyInstance } from 'fastify'
import { db, nowISO } from '../db'
import { issueToken, verifyPassword, rateLimitCheck, rateLimitFail, rateLimitSuccess } from '../crypto'

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const ip = req.ip || 'unknown'
    const limit = rateLimitCheck(ip)
    if (!limit.ok) {
      reply.code(429).send({ error: `尝试次数过多，账号已锁定，请约 ${limit.retry_minutes} 分钟后再试` })
      return
    }
    const { username, password } = (req.body || {}) as { username?: string; password?: string }
    if (!username || !password) {
      reply.code(400).send({ error: '请输入账号和密码' })
      return
    }
    const acc = db.prepare('SELECT * FROM accounts WHERE username = ?').get(String(username).trim()) as any
    if (!acc || !verifyPassword(password, acc.pwd_hash, acc.pwd_salt)) {
      rateLimitFail(ip)
      reply.code(401).send({ error: '账号或密码错误' })
      return
    }
    if (acc.status !== 'active') {
      reply.code(403).send({ error: '该账号已被停用，请联系老师' })
      return
    }
    rateLimitSuccess(ip)
    db.prepare('UPDATE accounts SET last_login = ? WHERE id = ?').run(nowISO(), acc.id)
    return {
      ok: true,
      token: issueToken({ id: acc.id, role: acc.role, student_id: acc.student_id ?? null }),
      role: acc.role,
      username: acc.username,
      must_change_pwd: !!acc.must_change_pwd,
    }
  })
  // 说明：登录态由前端 localStorage 恢复；学生端取自身信息用 /api/student/me，无独立的 /api/auth/me
}
