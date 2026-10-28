// 教师端同步通知：学生「我已重做」等事件；30s 轮询拉取
import type { FastifyInstance } from 'fastify'
import { db } from '../db'

export default async function notificationRoutes(app: FastifyInstance) {
  // 列表（最新 30 条）+ 未读数
  app.get('/api/notifications', async () => {
    const items = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 30').all()
    const unread = (db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE read = 0').get() as any).c
    return { ok: true, items, unread }
  })

  // 标记单条已读
  app.post('/api/notifications/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string }
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id)
    return { ok: true }
  })

  // 全部已读
  app.post('/api/notifications/read-all', async () => {
    db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run()
    return { ok: true }
  })

  // 删除单条通知
  app.delete('/api/notifications/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id)
    return { ok: true }
  })

  // 清空全部通知
  app.delete('/api/notifications', async () => {
    db.prepare('DELETE FROM notifications').run()
    return { ok: true }
  })
}
