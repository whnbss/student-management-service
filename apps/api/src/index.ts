// API 服务入口
import Fastify from 'fastify'
import cors from '@fastify/cors'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { initAuth, getSetting } from './db'
import { registerAuth } from './auth'
import { scheduleBackups } from './backup'
import authRoutes from './routes/auth'
import studentRoutes from './routes/students'
import logRoutes from './routes/logs'
import todayRoutes from './routes/today'
import settingsRoutes from './routes/settings'
import uploadRoutes from './routes/upload'
import aiRoutes from './routes/ai'
import analysisRoutes from './routes/analysis'
import mistakeRoutes from './routes/mistakes'
import questionRoutes from './routes/questions'
import shareRoutes from './routes/share'
import accountRoutes from './routes/accounts'
import studentPortalRoutes from './routes/student'
import notificationRoutes from './routes/notifications'
import { statsRoutes } from './routes/stats'

// trustProxy：反代/隧道（Cloudflare Tunnel 等）场景下让 Fastify 按 X-Forwarded-For 解析真实客户端信息
const app = Fastify({ logger: false, trustProxy: true })

await app.register(cors, { origin: true })
registerAuth(app)

await app.register(authRoutes)
await app.register(studentRoutes)
await app.register(logRoutes)
await app.register(todayRoutes)
await app.register(settingsRoutes)
await app.register(uploadRoutes)
await app.register(aiRoutes)
await app.register(analysisRoutes)
await app.register(mistakeRoutes)
await app.register(questionRoutes)
await app.register(shareRoutes)
await app.register(accountRoutes)
await app.register(studentPortalRoutes)
await app.register(notificationRoutes)
await app.register(statsRoutes)

// 统一错误处理：返回 { error } 而非堆栈
app.setErrorHandler((err: any, req, reply) => {
  if (err.validation) {
    reply.code(400).send({ error: err.message })
    return
  }
  console.error(`[api] ${req.method} ${req.url} 出错:`, err.message)
  reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).send({ error: err.message || '服务器内部错误' })
})

// ---- 生产模式：单端口托管前端构建产物（apps/web/dist 存在时启用，dev 模式不受影响）----
const DIST_DIR = path.resolve(import.meta.dirname, '../../web/dist')
const DIST_INDEX = path.join(DIST_DIR, 'index.html')
let hostingFrontend = false
if (fs.existsSync(DIST_INDEX)) {
  // uploads 静态已在 uploadRoutes 内注册并占用了 reply 装饰，这里必须 decorateReply: false
  await app.register((await import('@fastify/static')).default, {
    root: DIST_DIR,
    prefix: '/',
    decorateReply: false,
  })
  hostingFrontend = true
}

// SPA 回退：非 /api、非 /uploads 的 GET 一律返回 index.html，支持 /student、/labs/xxx 深链接刷新不 404
app.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api')) {
    reply.code(404).send({ error: '接口不存在' })
    return
  }
  if (req.method === 'GET' && !req.url.startsWith('/uploads') && fs.existsSync(DIST_INDEX)) {
    reply.header('content-type', 'text/html; charset=utf-8').send(fs.readFileSync(DIST_INDEX))
    return
  }
  reply.code(404).send({ error: 'Not Found' })
})

initAuth()
scheduleBackups()

const port = Number(getSetting('port')) || 3210

// 获取局域网 IPv4 地址
function lanAddress(): string {
  const ifs = os.networkInterfaces()
  for (const list of Object.values(ifs)) {
    for (const it of list || []) {
      if (it.family === 'IPv4' && !it.internal) return it.address
    }
  }
  return '127.0.0.1'
}

await app.listen({ host: '0.0.0.0', port })

const lan = lanAddress()
console.log('========================================')
console.log('  教学管理工作台 服务已启动')
console.log(`  本机访问:   http://localhost:${port}`)
console.log(`  局域网访问: http://${lan}:${port}  （手机需与电脑同一 WiFi）`)
if (hostingFrontend) {
  console.log('  [生产模式] 前端页面已由本服务托管（单端口），以上地址即是完整系统入口')
} else {
  console.log('  [开发模式] 前端未构建，请访问 vite 开发地址（5173），或运行 scripts/start-prod.bat 构建后使用单端口模式')
}
console.log('  如手机无法访问，请以管理员执行以下命令放行防火墙：')
console.log(`  netsh advfirewall firewall add rule name="TeachingWorkbench" dir=in action=allow protocol=TCP localport=${port}`)
console.log('========================================')
