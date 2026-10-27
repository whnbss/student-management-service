// API 服务入口
import Fastify from 'fastify'
import cors from '@fastify/cors'
import os from 'node:os'
import { initAuth, getSetting } from './db'
import { registerAuth } from './auth'
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
import { statsRoutes } from './routes/stats'

const app = Fastify({ logger: false })

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

initAuth()

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
console.log('  如手机无法访问，请以管理员执行以下命令放行防火墙：')
console.log(`  netsh advfirewall firewall add rule name="TeachingWorkbench" dir=in action=allow protocol=TCP localport=${port}`)
console.log('========================================')
