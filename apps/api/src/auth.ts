// 鉴权：除 /api/auth/login 外全部要求 Bearer token
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getSetting, getAuthToken } from './db'

export function registerAuth(app: FastifyInstance) {
  app.addHook('preHandler', (req: FastifyRequest, reply: FastifyReply, done) => {
    const url = req.url
    if (url.startsWith('/api/auth/login')) return done()
    // 只读分享链接（家长 H5 报告）：凭随机 token 访问，免登录
    if (url.startsWith('/api/public/')) return done()
    // 非 /api 路径为静态资源（生产模式托管前端），放行
    if (!url.startsWith('/api')) return done()
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token || token !== getAuthToken()) {
      reply.code(401).send({ error: '未登录或登录已失效' })
      return
    }
    done()
  })
}

export function checkPassword(input: string) {
  return input === getSetting('password')
}
