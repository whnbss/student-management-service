// 登录路由
import type { FastifyInstance } from 'fastify'
import { getAuthToken } from '../db'
import { checkPassword } from '../auth'

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const { password } = (req.body || {}) as { password?: string }
    if (!password || !checkPassword(password)) {
      reply.code(401).send({ error: '密码错误' })
      return
    }
    return { ok: true, token: getAuthToken() }
  })

  app.get('/api/auth/me', async () => ({ ok: true }))
}
