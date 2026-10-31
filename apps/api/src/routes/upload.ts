// 图片/讲义上传：multipart 接收，按 学生ID/日期/ 归档存到 data/uploads/
// 返回相对路径（/uploads/...），前端直接可访问（局域网 HTTP 下走 <img> 标签，不依赖 getUserMedia）
// C4：老师讲义（docx/pdf 等）存 data/uploads/reports/<学生ID>/，走带鉴权的访问控制（见 auth.ts 钩子）
import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { UPLOADS_DIR, db, nowISO } from '../db'

// 讲义允许的扩展名（docx/pdf 为验收必须，另放开常见文档与图片格式）
const REPORT_EXTS = ['.docx', '.doc', '.pdf', '.pptx', '.xlsx', '.md', '.txt', '.png', '.jpg', '.jpeg', '.webp']

export default async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  })

  // 静态托管上传目录（登录鉴权对非 /api 路径放行；路径含随机文件名，局域网内可接受）
  // 注意：/uploads/reports/ 子树在 auth.ts 钩子里单独做登录与学生归属校验
  await app.register((await import('@fastify/static')).default, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
  })

  app.post('/api/upload', async (req, reply) => {
    // P2-73：字段顺序无关——req.parts() 遍历全部 part 先收集字段再取文件。
    // 旧实现 req.file() 只读第一个 part，其 fields 仅含文件**之前**的字段；前端先 append file
    // 时 student_id/folder 全部丢失，作业图被堆到 /uploads/0/（按学生清理链路断裂）
    let file: any = null
    const fields: Record<string, string> = {}
    for await (const part of req.parts()) {
      if ((part as any).type === 'file') {
        if (!file) file = part
      } else {
        fields[(part as any).fieldname] = String((part as any).value ?? '')
      }
    }
    if (!file) { reply.code(400).send({ error: '未收到文件' }); return }
    const folder = fields.folder || ''
    // 只允许图片类型
    if (!/^image\//.test(file.mimetype)) { reply.code(400).send({ error: '只支持图片文件' }); return }
    const ext = path.extname(file.filename || '').toLowerCase() || '.jpg'
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'].includes(ext) ? ext : '.jpg'
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`
    // folder=questions：题库配图（题目照片/扫描），统一存 data/uploads/questions/
    if (folder === 'questions') {
      const dir = path.join(UPLOADS_DIR, 'questions')
      fs.mkdirSync(dir, { recursive: true })
      await fs.promises.writeFile(path.join(dir, name), await file.toBuffer())
      return { ok: true, path: `/uploads/questions/${name}` }
    }
    // 默认：学生作业图片，按 学生ID/日期/ 归档
    const studentId = fields.student_id || '0'
    const date = fields.date || nowISO().slice(0, 10)
    const dir = path.join(UPLOADS_DIR, String(studentId), date)
    fs.mkdirSync(dir, { recursive: true })
    const filepath = path.join(dir, name)
    await fs.promises.writeFile(filepath, await file.toBuffer())
    // 返回相对路径，前端拼接后端地址或直接走代理
    return { ok: true, path: `/uploads/${String(studentId)}/${date}/${name}` }
  })

  // ---------- C4：老师讲义（阶段报告附件） ----------
  // 上传：POST /api/students/:id/report-files（multipart：file + title），存 data/uploads/reports/<学生ID>/
  app.post('/api/students/:id/report-files', async (req, reply) => {
    const { id } = req.params as { id: string }
    const sid = Number(id)
    const student = db.prepare('SELECT id, name FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    // P2-73：字段顺序无关（title 在 file 之后提交也能收到）
    let file: any = null
    const fields: Record<string, string> = {}
    for await (const part of req.parts()) {
      if ((part as any).type === 'file') {
        if (!file) file = part
      } else {
        fields[(part as any).fieldname] = String((part as any).value ?? '')
      }
    }
    if (!file) { reply.code(400).send({ error: '未收到文件' }); return }
    const ext = path.extname(file.filename || '').toLowerCase()
    if (!REPORT_EXTS.includes(ext)) {
      reply.code(400).send({ error: '只支持 ' + REPORT_EXTS.join(' / ') + ' 格式' }); return
    }
    const title = String(fields.title || path.basename(file.filename || '讲义', ext)).trim().slice(0, 100) || '未命名讲义'
    const dir = path.join(UPLOADS_DIR, 'reports', String(sid))
    fs.mkdirSync(dir, { recursive: true })
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    const buf = await file.toBuffer()
    await fs.promises.writeFile(path.join(dir, name), buf)
    const r = db.prepare(
      'INSERT INTO report_files(student_id, title, filename, path, mime, size, created_at) VALUES(?,?,?,?,?,?,?)'
    ).run(sid, title, String(file.filename || name).slice(0, 200), `/uploads/reports/${sid}/${name}`, String(file.mimetype || ''), buf.length, nowISO())
    return { ok: true, id: Number(r.lastInsertRowid), path: `/uploads/reports/${sid}/${name}` }
  })

  // 教师端列表：某学生的全部讲义
  app.get('/api/students/:id/report-files', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare(
      'SELECT id, student_id, title, filename, path, mime, size, created_at FROM report_files WHERE student_id = ? ORDER BY id DESC'
    ).all(id)
  })

  // 删除讲义（连文件一起删）
  app.delete('/api/report-files/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM report_files WHERE id = ?').get(id) as any
    if (!row) { reply.code(404).send({ error: '讲义不存在' }); return }
    const abs = path.join(UPLOADS_DIR, String(row.path || '').replace(/^\/uploads\//, ''))
    if (abs.startsWith(UPLOADS_DIR) && fs.existsSync(abs)) {
      await fs.promises.unlink(abs).catch(() => { /* 文件已不在则忽略 */ })
    }
    db.prepare('DELETE FROM report_files WHERE id = ?').run(id)
    return { ok: true }
  })
}
