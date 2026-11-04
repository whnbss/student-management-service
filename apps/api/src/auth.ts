// 鉴权：HMAC 角色化 token；教师可访问全部 /api/*，学生仅限 /api/student/* 与改密
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken, type TokenPayload } from './crypto'

// 挂到 req 上的用户信息（Fastify 类型声明在下方 module augmentation）
export interface AuthUser extends TokenPayload {}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

export function registerAuth(app: FastifyInstance) {
  app.addHook('preHandler', (req: FastifyRequest, reply: FastifyReply, done) => {
    const url = req.url
    if (url.startsWith('/api/auth/login')) return done()
    // 只读分享链接（家长 H5 报告）：凭随机 token 访问，免登录
    if (url.startsWith('/api/public/')) return done()
    // C4/E：讲义文件（/uploads/reports/ 与 /uploads/handouts/ 子树）含学生隐私，必须登录；
    // 学生角色只能访问自己学生 ID 目录下的文件，越权一律 403（未登录 401）
    if (url.startsWith('/uploads/reports/') || url.startsWith('/uploads/handouts/')) {
      const header = req.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : ''
      // 兼容浏览器直接点链接下载：<a href> 无法带 Authorization 头，允许 ?token= 查询参数
      const q = (req.query as { token?: string } | undefined)?.token
      const payload = verifyToken(token || q || '')
      if (!payload) {
        reply.code(401).send({ error: '未登录或登录已失效，请重新登录' })
        return
      }
      req.user = payload
      if (payload.role === 'student') {
        const seg = url.replace(/^\/uploads\/(reports|handouts)\//, '').split('/')[0]
        if (String(payload.student_id) !== decodeURIComponent(seg)) {
          reply.code(403).send({ error: '无权限访问该讲义' })
          return
        }
      }
      return done()
    }
    // 非 /api 路径为静态资源（生产模式托管前端），放行
    if (!url.startsWith('/api')) return done()

    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const payload = verifyToken(token)
    if (!payload) {
      reply.code(401).send({ error: '未登录或登录已失效，请重新登录' })
      return
    }
    req.user = payload

    // 角色守卫：学生 token 只能访问学生端接口（含自己改密）；其余一律 403。
    // E 批次例外：GET /api/handouts/:id/file 为「教师或本人学生」下载口，学生放行到路由层
    // 再做归属校验（他人 403 / 删除仍仅教师）
    if (payload.role === 'student' && !url.startsWith('/api/student/') && !(url.startsWith('/api/handouts/') && req.method === 'GET')) {
      reply.code(403).send({ error: '无权限访问该资源' })
      return
    }
    done()
  })
}
