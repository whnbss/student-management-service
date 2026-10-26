// 图片上传：multipart 接收，按 学生ID/日期/ 归档存到 data/uploads/
// 返回相对路径（/uploads/...），前端直接可访问（局域网 HTTP 下走 <img> 标签，不依赖 getUserMedia）
import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { UPLOADS_DIR, nowISO } from '../db'

export default async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  })

  // 静态托管上传目录（登录鉴权对非 /api 路径放行；路径含随机文件名，局域网内可接受）
  await app.register((await import('@fastify/static')).default, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
  })

  app.post('/api/upload', async (req, reply) => {
    const file = await req.file()
    if (!file) { reply.code(400).send({ error: '未收到文件' }); return }
    const studentId = (file.fields.student_id as any)?.value || '0'
    const date = (file.fields.date as any)?.value || nowISO().slice(0, 10)
    // 只允许图片类型
    if (!/^image\//.test(file.mimetype)) { reply.code(400).send({ error: '只支持图片文件' }); return }
    const dir = path.join(UPLOADS_DIR, String(studentId), date)
    fs.mkdirSync(dir, { recursive: true })
    const ext = path.extname(file.filename || '').toLowerCase() || '.jpg'
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'].includes(ext) ? ext : '.jpg'
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`
    const filepath = path.join(dir, name)
    await fs.promises.writeFile(filepath, await file.toBuffer())
    // 返回相对路径，前端拼接后端地址或直接走代理
    return { ok: true, path: `/uploads/${String(studentId)}/${date}/${name}` }
  })
}
