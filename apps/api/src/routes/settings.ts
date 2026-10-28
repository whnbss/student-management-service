// 系统设置：修改登录密码（teacher 账号 scrypt）、系统信息（端口/AI 配置在 M2 引入）
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { db, getSetting, UPLOADS_DIR, DB_PATH, syncBackupPassword } from '../db'
import { hashPassword, verifyPassword } from '../crypto'

export default async function settingsRoutes(app: FastifyInstance) {
  // 系统信息：「关于」卡片展示（版本、端口、数据目录）
  app.get('/api/settings/system', async () => {
    let version = ''
    try {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'))
      version = String(pkg.version || '')
    } catch { /* 版本读取失败不阻塞 */ }
    // 局域网 IPv4（给「分享链接」拼接手机可打开的地址用）
    let lan = '127.0.0.1'
    for (const list of Object.values(os.networkInterfaces())) {
      for (const it of list || []) {
        if (it.family === 'IPv4' && !it.internal) { lan = it.address; break }
      }
      if (lan !== '127.0.0.1') break
    }
    return {
      version,
      node: process.version,
      port: Number(getSetting('port')) || 3210,
      lan,
      data_dir: path.dirname(DB_PATH),
      uploads_dir: UPLOADS_DIR,
      platform: `${process.platform} ${process.arch}`,
    }
  })

  app.put('/api/settings/password', async (req, reply) => {
    const { old_password, new_password } = (req.body || {}) as { old_password?: string; new_password?: string }
    const teacher = db.prepare("SELECT * FROM accounts WHERE role = 'teacher' LIMIT 1").get() as any
    if (!teacher) { reply.code(500).send({ error: '教师账号不存在' }); return }
    if (!old_password || !verifyPassword(old_password, teacher.pwd_hash, teacher.pwd_salt)) {
      reply.code(400).send({ error: '原密码错误' }); return
    }
    if (!new_password || new_password.length < 6) {
      reply.code(400).send({ error: '新密码至少 6 位' }); return
    }
    const { hash, salt } = hashPassword(new_password)
    db.prepare('UPDATE accounts SET pwd_hash = ?, pwd_salt = ? WHERE id = ?').run(hash, salt, teacher.id)
    syncBackupPassword(new_password)
    return { ok: true }
  })
}
