// AI 配置：供应商 CRUD、网络代理、连通性测试、月度用量统计
import type { FastifyInstance } from 'fastify'
import { getProviders, saveProviders, testProvider, DEFAULT_PROVIDERS, friendlyAiError, getActiveProviderId, setActiveProviderId } from '../ai'
import { db, getSetting } from '../db'
import type { AiProvider } from '@workbench/shared'

function saveProxy(proxy: string) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('ai_proxy', String(proxy || '').trim())
}

export default async function aiRoutes(app: FastifyInstance) {
  app.get('/api/settings/ai', async () => {
    const providers = getProviders()
    return {
      providers,
      active_id: getActiveProviderId(),
      proxy: getSetting('ai_proxy') || '',
      privacy_notice: '调用外部智能分析时，作业图片会被传输至所选智能服务供应商的服务器。学生数据本身仅存本机。',
    }
  })

  app.put('/api/settings/ai', async (req, reply) => {
    const body = (req.body || {}) as { providers?: unknown; proxy?: unknown; active_id?: unknown }
    const list = body.providers
    if (!Array.isArray(list)) { reply.code(400).send({ error: 'providers 必须是数组' }); return }
    if (body.proxy !== undefined) saveProxy(String(body.proxy))
    // 用户自选当前使用的模型（供应商）；传了才更新，且必须是列表中存在的 id
    if (body.active_id !== undefined) {
      const id = String(body.active_id || '')
      if (id && !list.some((p: any) => String(p?.id) === id)) {
        reply.code(400).send({ error: '所选供应商不存在，请先保存供应商列表' }); return
      }
      setActiveProviderId(id)
    }
    const clean: AiProvider[] = list.map((p: any, i: number) => ({
      id: String(p?.id || `p${i}_${Date.now()}`),
      name: String(p?.name || '').trim() || `供应商${i + 1}`,
      base_url: String(p?.base_url || '').trim(),
      api_key: String(p?.api_key || '').trim(),
      vision_model: String(p?.vision_model || '').trim(),
      text_model: String(p?.text_model || '').trim(),
      input_price: Number(p?.input_price) || 0,
      output_price: Number(p?.output_price) || 0,
    }))
    saveProviders(clean)
    return { ok: true }
  })

  // 恢复默认推荐配置（同时清空「当前使用」选择，避免指向已不存在的供应商）
  app.post('/api/settings/ai/reset', async () => {
    saveProviders(DEFAULT_PROVIDERS)
    setActiveProviderId('')
    return { ok: true }
  })

  // 导出配置（供前端下载 ai-config.json；Key 是否导出由前端决定）
  app.get('/api/settings/ai/export', async () => {
    return {
      providers: getProviders(),
      proxy: getSetting('ai_proxy') || '',
      exported_at: new Date().toISOString(),
    }
  })

  // 导入配置：校验结构后整体保存（覆盖现有配置）
  app.post('/api/settings/ai/import', async (req, reply) => {
    const body = (req.body || {}) as { providers?: unknown; proxy?: unknown }
    if (!Array.isArray(body.providers)) { reply.code(400).send({ error: '配置文件格式不对：providers 必须是数组' }); return }
    if (body.providers.length > 20) { reply.code(400).send({ error: '供应商数量超过上限（20）' }); return }
    saveProxy(String(body.proxy || ''))
    const clean: AiProvider[] = body.providers.map((p: any, i: number) => ({
      id: String(p?.id || `p${i}_${Date.now()}`),
      name: String(p?.name || '').trim() || `供应商${i + 1}`,
      base_url: String(p?.base_url || '').trim(),
      api_key: String(p?.api_key || '').trim(),
      vision_model: String(p?.vision_model || '').trim(),
      text_model: String(p?.text_model || '').trim(),
      input_price: Number(p?.input_price) || 0,
      output_price: Number(p?.output_price) || 0,
    }))
    saveProviders(clean)
    // 导入后「当前使用」若指向不存在的供应商则清空
    const activeId = getActiveProviderId()
    if (activeId && !clean.some((p) => p.id === activeId)) setActiveProviderId('')
    return { ok: true }
  })

  // 连通性测试：优先直接用前端传来的完整 provider 配置（表单当前内容，未保存也能测）；
  // 不传 provider 时回退为按 provider_id 用已保存配置测试。kind: 'vision' | 'text'
  app.post('/api/settings/ai/test', async (req, reply) => {
    const { provider_id, kind, provider } = (req.body || {}) as {
      provider_id?: string; kind?: string; provider?: any
    }
    let target: AiProvider | undefined
    if (provider && typeof provider === 'object') {
      // 规范化前端表单传来的临时配置（可能与已保存内容不同）
      target = {
        id: String(provider.id || `temp_${Date.now()}`),
        name: String(provider.name || '').trim() || '临时供应商',
        base_url: String(provider.base_url || '').trim(),
        api_key: String(provider.api_key || '').trim(),
        vision_model: String(provider.vision_model || '').trim(),
        text_model: String(provider.text_model || '').trim(),
        input_price: Number(provider.input_price) || 0,
        output_price: Number(provider.output_price) || 0,
      }
    } else {
      target = getProviders().find((p) => p.id === provider_id)
      if (!target) { reply.code(404).send({ error: '供应商不存在' }); return }
    }
    // 视觉/文本模型互为回退：只填了其中一个也能测试
    const model = kind === 'text' ? provider.text_model || provider.vision_model : provider.vision_model || provider.text_model
    if (!model) { reply.code(400).send({ error: '未配置模型名' }); return }
    try {
      const r = await testProvider(provider, model)
      return { ok: true, reply: r.reply }
    } catch (e: any) {
      reply.code(502).send({ error: friendlyAiError(e) })
    }
  })

  // 月度用量统计：按月汇总 + 明细
  // 时区口径：ai_usage.created_at 存 UTC ISO（nowISO），这里统一换算成北京时间（UTC+8）——
  // 月份过滤按北京月的起止换回 UTC 区间查询，明细行返回北京本地时间字符串，前端直接展示
  const bjTime = (utcIso: string): string => {
    try {
      return new Date(utcIso).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T').slice(0, 16)
    } catch { return utcIso }
  }
  app.get('/api/settings/ai/usage', async (req) => {
    const now = new Date()
    const bjMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` // 北京时间当前月
    const month = ((req.query as any)?.month as string) || bjMonth
    // 北京月的起止时刻 → UTC ISO（与库内 created_at 同格式可直接比较）
    const [y, m] = month.split('-').map(Number)
    const startUtc = new Date(`${month}-01T00:00:00+08:00`).toISOString()
    const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const endUtc = new Date(`${nextM}-01T00:00:00+08:00`).toISOString()
    const rows = (db
      .prepare(
        `SELECT id, provider_name, model, kind, prompt_tokens, completion_tokens, cost, created_at
         FROM ai_usage WHERE created_at >= ? AND created_at < ? ORDER BY id DESC LIMIT 200`
      )
      .all(startUtc, endUtc) as any[]).map((r) => ({ ...r, created_at: bjTime(r.created_at) }))
    const summary = db
      .prepare(
        `SELECT model, COUNT(*) AS calls, SUM(prompt_tokens) AS prompt_tokens,
                SUM(completion_tokens) AS completion_tokens, SUM(cost) AS cost
         FROM ai_usage WHERE created_at >= ? AND created_at < ? GROUP BY model`
      )
      .all(startUtc, endUtc)
    return { month, summary, rows }
  })
}
