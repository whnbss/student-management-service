// AI 分析流水线：上传图片路径 → 读文件转 base64 → 视觉模型分析 → 返回结构化初稿（不落库）
// 教师在编辑页逐项确认后，由 POST /api/students/:id/logs 落库（含 images + ai_result + 错题抽取）
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import fs from 'node:fs'
import { UPLOADS_DIR, db, getSetting } from '../db'
import { getProviders, pickProvider, analyzePaper } from '../ai'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
}

export default async function analysisRoutes(app: FastifyInstance) {
  app.post('/api/analyze', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: number; images?: string[] }
    if (!b.student_id || !Array.isArray(b.images) || b.images.length === 0) {
      reply.code(400).send({ error: '缺少学生或图片' }); return
    }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(b.student_id) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }

    // 读取图片为 base64 data URL
    const dataUrls: string[] = []
    for (const p of b.images.slice(0, 9)) {
      const rel = String(p).replace(/^\/uploads\//, '')
      const abs = path.join(UPLOADS_DIR, rel)
      if (!abs.startsWith(UPLOADS_DIR) || !fs.existsSync(abs)) continue
      const ext = path.extname(abs).toLowerCase()
      const buf = fs.readFileSync(abs)
      dataUrls.push(`data:${MIME[ext] || 'image/jpeg'};base64,${buf.toString('base64')}`)
    }
    if (!dataUrls.length) { reply.code(400).send({ error: '图片文件不存在或已失效' }); return }

    // 使用设置页选中的「当前模型」；未选或所选不可用时回退到第一个填了 Key 且有模型可用的供应商
    // （视觉模型优先，未填视觉模型则回退文本模型，多模态文本模型均可）
    const providers = getProviders()
    const provider = pickProvider('vision')
    if (!provider) {
      const hasKey = providers.some((p) => p.api_key)
      reply.code(400).send({
        error: hasKey
          ? '拍照分析需要一家「填了 API Key 和模型」的供应商（视觉模型或支持多模态输入的文本模型均可，如 qwen-vl-max / GLM-4V）。请到「我的 → AI 配置」完善后重试'
          : '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写',
      })
      return
    }
    try {
      const { result: analysis, usage } = await analyzePaper(provider, dataUrls, {
        name: student.name,
        grade: student.grade || '',
        textbook: student.textbook || getSetting('default_textbook') || '人教版',
      })
      return { ok: true, analysis, usage, provider: provider.name }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || 'AI 分析失败' })
    }
  })
}
