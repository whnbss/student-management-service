// 探测网关更强模型的多模态支持（C2 求解阶段模型升级用）
import Database from 'better-sqlite3'
const db = new Database('data/app.db', { readonly: true })
const raw = db.prepare("SELECT value FROM settings WHERE key='ai_providers'").get()
const rows = raw ? JSON.parse(raw.value) : []
db.close()
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
for (const p of rows) {
  if (!p.api_key) continue
  for (const model of ['deepseek-v4-pro-saas', 'qwen3.7-plus']) {
    try {
      const r = await fetch(p.base_url.replace(/\/?$/, '/') + 'chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + p.api_key },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: '这张图是什么颜色？只答颜色' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + png } }] }],
          max_tokens: 20,
          thinking: { enabled: false },
        }),
      })
      const d = await r.json().catch(() => null)
      console.log(p.name, model, 'HTTP', r.status, d?.choices?.[0]?.message?.content?.slice(0, 30) || JSON.stringify(d?.error || d).slice(0, 140))
    } catch (e) {
      console.log(p.name, model, 'ERR', String(e.message).slice(0, 100))
    }
  }
}
