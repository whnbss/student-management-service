// 系统设置：修改登录密码、系统信息（端口/AI 配置在 M2 引入）
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { db, getSetting, setSetting, UPLOADS_DIR, DB_PATH } from '../db'

export default async function settingsRoutes(app: FastifyInstance) {
  // 系统信息：「关于」卡片展示（版本、端口、数据目录）
  app.get('/api/settings/system', async () => {
    let version = ''
    try {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'))
      version = String(pkg.version || '')
    } catch { /* 版本读取失败不阻塞 */ }
    return {
      version,
      node: process.version,
      port: Number(getSetting('port')) || 3210,
      data_dir: path.dirname(DB_PATH),
      uploads_dir: UPLOADS_DIR,
      platform: `${process.platform} ${process.arch}`,
    }
  })

  app.put('/api/settings/password', async (req, reply) => {
    const { old_password, new_password } = (req.body || {}) as { old_password?: string; new_password?: string }
    if (!old_password || old_password !== getSetting('password')) {
      reply.code(400).send({ error: '原密码错误' }); return
    }
    if (!new_password || new_password.length < 6) {
      reply.code(400).send({ error: '新密码至少 6 位' }); return
    }
    setSetting('password', new_password)
    return { ok: true }
  })
}
