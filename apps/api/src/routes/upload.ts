// 图片/讲义上传：multipart 接收，按 学生ID/日期/ 归档存到 data/uploads/
// 返回相对路径（/uploads/...），前端直接可访问（局域网 HTTP 下走 <img> 标签，不依赖 getUserMedia）
// C4：老师讲义（docx/pdf 等）存 data/uploads/reports/<学生ID>/，走带鉴权的访问控制（见 auth.ts 钩子）
import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import type { MultipartFile } from '@fastify/multipart'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { UPLOADS_DIR, db, nowISO } from '../db'

// 讲义允许的扩展名（docx/pdf 为验收必须，另放开常见文档与图片格式）
const REPORT_EXTS = ['.docx', '.doc', '.pdf', '.pptx', '.xlsx', '.md', '.txt', '.png', '.jpg', '.jpeg', '.webp']

// ---------- E 批次：课次讲义（与 C4 阶段报告讲义共用 report_files 表与文件管线，kind 区分） ----------
// 白名单：docx / doc / pdf / pptx / ppt；单个 ≤30MB（超限 413）；魔数校验防「改扩展名伪装」
const HANDOUT_EXTS = ['.docx', '.doc', '.pdf', '.pptx', '.ppt']
const HANDOUT_MAX_BYTES = 30 * 1024 * 1024
const HANDOUT_MAX_COUNT = 5

// 魔数白名单：docx/pptx 是 ZIP 容器（PK\x03\x04），pdf 以 %PDF- 开头，doc/ppt 是老版 OLE 复合文档
function handoutMagicOk(ext: string, buf: Buffer): boolean {
  const head = buf.subarray(0, 8)
  if (ext === '.pdf') return head.subarray(0, 5).toString('latin1') === '%PDF-'
  if (ext === '.docx' || ext === '.pptx') return head.subarray(0, 4).toString('latin1') === 'PK\x03\x04'
  if (ext === '.doc' || ext === '.ppt') return head.toString('hex') === 'd0cf11e0a1b11ae1'
  return false
}

export default async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    // E 批次：讲义单文件 ≤30MB——插件上限放宽到 35MB（超限抛 413），业务层的 30MB 校验先行给出友好提示
    limits: { fileSize: 35 * 1024 * 1024, files: 10 },
  })

  // 静态托管上传目录（登录鉴权对非 /api 路径放行；路径含随机文件名，局域网内可接受）
  // 注意：/uploads/reports/ 子树在 auth.ts 钩子里单独做登录与学生归属校验
  await app.register((await import('@fastify/static')).default, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
  })

  app.post('/api/upload', async (req, reply) => {
    // P2-73：字段顺序无关——req.parts() 遍历全部 part，文件流在遍历中即消费（toBuffer 挂起流），
    // 字段可能出现在文件之后，遍历结束后再决定归档位置。
    // 旧实现 req.file() 只读第一个 part，其 fields 仅含文件**之前**的字段；前端先 append file
    // 时 student_id/folder 全部丢失，作业图被堆到 /uploads/0/（按学生清理链路断裂）
    let file: MultipartFile | null = null
    let fileBuf: Buffer | null = null
    const fields: Record<string, string> = {}
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        if (!file) {
          file = part
          fileBuf = await part.toBuffer()
        }
      } else {
        fields[part.fieldname] = String((part as any).value ?? '')
      }
    }
    if (!file || !fileBuf) { reply.code(400).send({ error: '未收到文件' }); return }
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
      await fs.promises.writeFile(path.join(dir, name), fileBuf)
      return { ok: true, path: `/uploads/questions/${name}` }
    }
    // 默认：学生作业图片，按 学生ID/日期/ 归档
    const studentId = fields.student_id || '0'
    const date = fields.date || nowISO().slice(0, 10)
    const dir = path.join(UPLOADS_DIR, String(studentId), date)
    fs.mkdirSync(dir, { recursive: true })
    const filepath = path.join(dir, name)
    await fs.promises.writeFile(filepath, fileBuf)
    // 返回相对路径，前端拼接后端地址或直接走代理
    return { ok: true, path: `/uploads/${String(studentId)}/${date}/${name}` }
  })

  // ---------- D1：删除单个已上传图片（放弃分析时清理本次上传的文件） ----------
  // 仅允许删除 /uploads/ 树内、不含 .. 的路径；文件不存在静默成功（幂等）
  app.delete('/api/upload', async (req) => {
    const q = req.query as { path?: string }
    const p = String(q.path || '')
    if (!p.startsWith('/uploads/') || p.includes('..')) return { ok: false, error: '非法路径' }
    const abs = path.join(UPLOADS_DIR, p.replace(/^\/uploads\//, ''))
    if (!abs.startsWith(UPLOADS_DIR)) return { ok: false, error: '非法路径' }
    await fs.promises.unlink(abs).catch(() => { /* 文件已不在则忽略 */ })
    return { ok: true }
  })

  // ---------- C4：老师讲义（阶段报告附件） ----------
  // 上传：POST /api/students/:id/report-files（multipart：file + title），存 data/uploads/reports/<学生ID>/
  app.post('/api/students/:id/report-files', async (req, reply) => {
    const { id } = req.params as { id: string }
    const sid = Number(id)
    const student = db.prepare('SELECT id, name FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    // P2-73：字段顺序无关（title 在 file 之后提交也能收到；文件流在遍历中即消费防挂起）
    let file: MultipartFile | null = null
    let fileBuf: Buffer | null = null
    const fields: Record<string, string> = {}
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        if (!file) {
          file = part
          fileBuf = await part.toBuffer()
        }
      } else {
        fields[part.fieldname] = String((part as any).value ?? '')
      }
    }
    if (!file || !fileBuf) { reply.code(400).send({ error: '未收到文件' }); return }
    const ext = path.extname(file.filename || '').toLowerCase()
    if (!REPORT_EXTS.includes(ext)) {
      reply.code(400).send({ error: '只支持 ' + REPORT_EXTS.join(' / ') + ' 格式' }); return
    }
    const title = String(fields.title || path.basename(file.filename || '讲义', ext)).trim().slice(0, 100) || '未命名讲义'
    const dir = path.join(UPLOADS_DIR, 'reports', String(sid))
    fs.mkdirSync(dir, { recursive: true })
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    await fs.promises.writeFile(path.join(dir, name), fileBuf)
    const r = db.prepare(
      'INSERT INTO report_files(student_id, title, filename, path, mime, size, created_at) VALUES(?,?,?,?,?,?,?)'
    ).run(sid, title, String(file.filename || name).slice(0, 200), `/uploads/reports/${sid}/${name}`, String(file.mimetype || ''), fileBuf.length, nowISO())
    return { ok: true, id: Number(r.lastInsertRowid), path: `/uploads/reports/${sid}/${name}` }
  })

  // 教师端列表：某学生的全部讲义（C4 报告附件，kind='report'；课次讲义走 /api/students/:id/handouts）
  app.get('/api/students/:id/report-files', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare(
      "SELECT id, student_id, title, filename, path, mime, size, created_at FROM report_files WHERE student_id = ? AND kind = 'report' ORDER BY id DESC"
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

  // ---------- E 批次：课次讲义（kind='handout'，复用 report_files 表与文件删除/下载管线） ----------
  // 上传：POST /api/students/:id/handouts（multipart，可一次多文件 ≤5 个，单个 ≤30MB；仅教师 token——
  // /api/students/* 路径学生角色在 auth.ts 守卫处即被 403）。可带 log_id 直接关联学情日志。
  app.post('/api/students/:id/handouts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const sid = Number(id)
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    // P2-73 同口径：字段顺序无关，遍历全部 part（文件流在遍历中即消费防挂起）；支持一次多文件
    const files: Array<{ part: MultipartFile; buf: Buffer }> = []
    const fields: Record<string, string> = {}
    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          files.push({ part, buf: await part.toBuffer() })
        } else {
          fields[part.fieldname] = String((part as any).value ?? '')
        }
      }
    } catch (e: any) {
      // @fastify/multipart 单文件超过插件上限（35MB）时抛错——统一转成友好 413
      reply.code(413).send({ error: '单个文件不能超过 30MB' })
      return
    }
    if (!files.length) { reply.code(400).send({ error: '未收到文件' }); return }
    if (files.length > HANDOUT_MAX_COUNT) { reply.code(400).send({ error: `一次最多上传 ${HANDOUT_MAX_COUNT} 个文件` }); return }
    // 可选：直接关联到某条学情日志（须属于该生）
    let logId: number | null = null
    if (fields.log_id) {
      const log = db.prepare('SELECT id FROM study_logs WHERE id = ? AND student_id = ?').get(Number(fields.log_id), sid) as any
      if (!log) { reply.code(400).send({ error: '关联的学情日志不存在' }); return }
      logId = Number(fields.log_id)
    }
    const dir = path.join(UPLOADS_DIR, 'handouts', String(sid))
    fs.mkdirSync(dir, { recursive: true })
    const ins = db.prepare(
      "INSERT INTO report_files(student_id, log_id, title, filename, path, mime, size, ext, kind, created_at) VALUES(?,?,?,?,?,?,?,?, 'handout', ?)"
    )
    const created: Array<{ id: number; filename: string }> = []
    for (const { part, buf } of files) {
      const rawName = String(part.filename || '讲义')
      const ext = path.extname(rawName).toLowerCase()
      if (!HANDOUT_EXTS.includes(ext)) {
        reply.code(400).send({ error: `「${rawName}」格式不支持，只支持 ${HANDOUT_EXTS.join(' / ')}` }); return
      }
      if (buf.length > HANDOUT_MAX_BYTES) {
        reply.code(413).send({ error: `「${rawName}」超过 30MB 上限` }); return
      }
      // 魔数校验：内容与扩展名不符（如 exe 改名 docx）直接拒绝
      if (!handoutMagicOk(ext, buf)) {
        reply.code(400).send({ error: `「${rawName}」文件内容与扩展名不符，已拒绝` }); return
      }
      const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
      await fs.promises.writeFile(path.join(dir, name), buf)
      const title = (rawName.slice(0, rawName.length - ext.length) || '讲义').slice(0, 100)
      const r = ins.run(sid, logId, title, rawName.slice(0, 200), `/uploads/handouts/${sid}/${name}`, String(part.mimetype || ''), buf.length, ext, nowISO())
      created.push({ id: Number(r.lastInsertRowid), filename: rawName })
    }
    return { ok: true, items: created, ids: created.map((c) => c.id) }
  })

  // 教师端列表：某学生全部课次讲义（含随日志上传 + 独立上传），附带关联日志日期
  app.get('/api/students/:id/handouts', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare(`
      SELECT f.id, f.student_id, f.log_id, f.kind, f.title, f.filename, f.path, f.mime, f.ext, f.size, f.created_at, l.date AS log_date
      FROM report_files f LEFT JOIN study_logs l ON l.id = f.log_id
      WHERE f.student_id = ? AND f.kind = 'handout'
      ORDER BY f.id DESC`).all(id)
  })

  // 下载：教师或本人学生；Content-Disposition attachment + RFC 5987 filename*（中文名不乱码）
  app.get('/api/handouts/:id/file', async (req, reply) => {
    const { id } = req.params as { id: string }
    const row = db.prepare('SELECT * FROM report_files WHERE id = ?').get(id) as any
    if (!row) { reply.code(404).send({ error: '讲义不存在' }); return }
    // 学生 token 只能下载自己的（教师放行；未登录 401 已由 auth.ts 守卫处理）
    if (req.user?.role === 'student' && Number(req.user.student_id) !== Number(row.student_id)) {
      reply.code(403).send({ error: '无权限访问该讲义' })
      return
    }
    const abs = path.join(UPLOADS_DIR, String(row.path || '').replace(/^\/uploads\//, ''))
    if (!abs.startsWith(UPLOADS_DIR) || !fs.existsSync(abs)) { reply.code(404).send({ error: '讲义文件不存在' }); return }
    // RFC 5987：filename* 承载原始中文文件名；filename 提供 ASCII 回退（老客户端）
    const encoded = encodeURIComponent(row.filename || `handout${row.ext}`)
    reply.header('Content-Disposition', `attachment; filename="handout${row.ext}"; filename*=UTF-8''${encoded}`)
    reply.type(row.mime || 'application/octet-stream')
    return reply.send(fs.createReadStream(abs))
  })

  // 删除课次讲义（仅教师——/api/handouts/* 非学生路径，学生 token 在 auth.ts 守卫即 403）：删库 + 删磁盘文件
  app.delete('/api/handouts/:id', async (req, reply) => {
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
