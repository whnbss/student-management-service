// 一次性脚本：为题库中无图的原生题补配图（AI 出 figure_spec → 前端模板渲染 SVG → 写回 figure 列）
// 用法：node scripts/backfill-figures.mjs [--ids 1,2,3] [--dry-run]
// - 只处理 figure 为空的题目（或 --ids 指定的题目）
// - id=9 情境矛盾题：交给 AI 二审确认，仅输出题干修正对照（--fix-stem 才会写回），默认不动题干
// - 不修改题目 source（老题补图后来源标记不变）
import Database from 'better-sqlite3'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../apps/web/src/lib/figure.ts'
import { FIGURE_TEMPLATES, sanitizeAiText, FIGURE_TEMPLATE_DOCS, requiresFigure } from '../packages/shared/src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const args = process.argv.slice(2)
const argOf = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const DRY = args.includes('--dry-run')
const FIX_STEM = args.includes('--fix-stem')
const IDS = argOf('--ids') ? argOf('--ids').split(',').map(Number) : null

// ---------- 数据库与 AI 配置 ----------
const db = new Database(path.join(ROOT, 'data', 'app.db'))
const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value ?? null

function loadProvider() {
  const list = JSON.parse(getSetting('ai_providers') || '[]')
  const activeId = (getSetting('ai_active_provider') || '').trim()
  const usable = (p) => p.api_key && (p.text_model || p.vision_model)
  const p = list.find((x) => x.id === activeId && usable(x)) || list.find(usable)
  if (!p) throw new Error('没有可用的 AI 供应商（未配置 Key），请先在「我的 → AI 配置」填写')
  return p
}

// 公司内网代理 + 根证书（与后端 ai.ts 同一套逻辑）
function getDispatcher() {
  const uri = (getSetting('ai_proxy') || '').trim() || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
  if (!uri) return undefined
  const caCandidates = [
    process.env.NODE_EXTRA_CA_CERTS,
    path.join(ROOT, 'certs', 'corporate-ca.pem'),
  ].filter(Boolean)
  let ca
  for (const f of caCandidates) {
    try { if (fs.existsSync(f)) { ca = [fs.readFileSync(f, 'utf8')]; break } } catch { /* ignore */ }
  }
  return new ProxyAgent({ uri, requestTls: ca ? { ca } : undefined })
}

async function chat(provider, { system, user, temperature = 0.2 }) {
  const base = provider.base_url.replace(/\/+$/, '')
  const body = {
    model: provider.text_model || provider.vision_model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    thinking: { type: 'disabled' },
    stream: true,
    stream_options: { include_usage: true },
  }
  const doFetch = (url) => undiciFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
    body: JSON.stringify(body),
    dispatcher: getDispatcher(),
    signal: AbortSignal.timeout(120_000),
  })
  let url = `${base}/chat/completions`
  let res = await doFetch(url)
  if (res.status === 404 && !/\/v\d+$/.test(base)) {
    url = `${base}/v1/chat/completions`
    res = await doFetch(url)
  }
  if (!res.ok) throw new Error(`AI 接口错误(${res.status})：${(await res.text().catch(() => '')).slice(0, 200)}`)
  const ct = String(res.headers.get('content-type') || '')
  let content = ''
  if (ct.includes('text/event-stream')) {
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let raw = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      raw += dec.decode(value, { stream: true })
    }
    for (const line of raw.split('\n')) {
      const l = line.trim()
      if (!l.startsWith('data:') || l.includes('[DONE]')) continue
      try {
        const chunk = JSON.parse(l.slice(5))
        const d = chunk?.choices?.[0]?.delta
        if (typeof d?.content === 'string') content += d.content
      } catch { /* skip */ }
    }
  } else {
    const data = await res.json()
    content = data?.choices?.[0]?.message?.content || ''
  }
  if (!content.trim()) throw new Error('AI 返回内容为空')
  return content
}

function extractJson(text) {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const start = Math.min(...['{', '['].map((c) => { const i = t.indexOf(c); return i === -1 ? Infinity : i }))
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (start === Infinity || end === -1) throw new Error('未找到 JSON')
  return t.slice(start, end + 1)
}

// ---------- 配图 prompt ----------

const FIGURE_SYSTEM = `你是高中物理题目配图助手。给定题目的题干/答案/解析，请从下方模板列表中选一个最贴合题意的模板，并给出参数。
要求：
1. 模板只能从列表中选，参数名必须与模板说明一致；
2. 参数数值必须与题干给出的数值严格一致（角度/μ/R/r 等），严禁改动题干数值；
3. 图必须与题干情境完全一致（受力题配受力装置图、波动题配波形图、电磁题配场/导轨图），严禁套用无关模板；
4. 若题目情境与所有模板都不匹配，输出 {"template": "none", "params": {}}；
5. 严格输出 JSON 对象 {"template": "...", "params": {...}}，不要输出任何其他文字。

可用模板：
${FIGURE_TEMPLATE_DOCS}`

const REVIEW_SYSTEM = `你是高中物理命题审查专家。给定一道题的题干/答案/解析，请专门审查「情境与几何是否自洽」：
1. 若题干描述的装置/几何关系在物理上不可能成立（例如滑轮两侧绳的方向矛盾、角度与装置冲突），判定 contradiction=true 并给出修正后的完整题干（保持考查目标与数值不变，只修正几何描述使其自洽）；
2. 若题干表述存在明显歧义或容易误读（如「绳与水平方向夹角 α」未说明是滑轮哪一侧的绳、装置描述与角度关系不清楚），也给出更明确的修正题干，并在 reason 里注明是「表述歧义」；
3. 自洽且表述清晰时 contradiction=false、fixed_stem 留空。
严格输出 JSON：{"contradiction": true/false, "reason": "说明", "fixed_stem": "修正后的完整题干（无修正则为空字符串）"}`

async function genFigureSpec(provider, q) {
  const user = `题目数据：
【题干】${q.stem}
【答案】${q.answer}
【解析】${(q.solution || '').slice(0, 600)}
请输出配图 figure_spec JSON。`
  const out = JSON.parse(extractJson(await chat(provider, { system: FIGURE_SYSTEM, user, temperature: 0.1 })))
  const tpl = String(out?.template || '').trim()
  if (!FIGURE_TEMPLATES.includes(tpl)) return { spec: null, tpl }
  const params = {}
  for (const [k, v] of Object.entries(out?.params || {})) {
    if (typeof v === 'number' && Number.isFinite(v)) params[k] = v
    else if (typeof v === 'string' && v.trim()) params[k] = v.trim().slice(0, 30)
  }
  return { spec: { template: tpl, params }, tpl }
}

async function reviewContradiction(provider, q) {
  const user = `【题干】${q.stem}
【解析】${(q.solution || '').slice(0, 600)}
请审查情境与几何自洽性并按约定 JSON 输出。`
  return JSON.parse(extractJson(await chat(provider, { system: REVIEW_SYSTEM, user, temperature: 0.1 })))
}

// ---------- 主流程 ----------
const provider = loadProvider()
console.log(`使用模型：${provider.name} / ${provider.text_model || provider.vision_model}`)

const all = db.prepare('SELECT * FROM questions ORDER BY id').all()
// B1 配图铁律的存量补图口径：无图 且 requiresFigure（计算/实验题型或题干含情境线索）才补；
// 纯概念判断题（单位制/物理学史/无情境辨析）豁免——口径与出题终稿机器校验完全一致
const targets = IDS
  ? all.filter((q) => IDS.includes(q.id))
  : all.filter((q) => !q.figure && requiresFigure(q.stem, q.qtype))
const exempt = all.filter((q) => !q.figure && !requiresFigure(q.stem, q.qtype))
console.log(`待补图题目（${targets.length}）：${targets.map((q) => q.id).join(', ')}`)
console.log(`概念题豁免（${exempt.length}）：${exempt.map((q) => q.id).join(', ')}`)

const updateFigure = db.prepare('UPDATE questions SET figure = ? WHERE id = ?')
const results = []

for (const q of targets) {
  process.stdout.write(`题 ${q.id} ... `)
  try {
    let { spec, tpl } = await genFigureSpec(provider, q)
    let svg = spec ? specToSvg(spec) : ''
    // 模板渲染为空（模板存在但渲染异常）时重试一次
    if (spec && !svg) {
      const retry = await genFigureSpec(provider, q)
      if (retry.spec) { spec = retry.spec; tpl = retry.tpl; svg = specToSvg(spec) }
    }
    if (!spec || !svg) {
      console.log(`失败（模板=${tpl || '无'}，AI 未给出可渲染的配图）`)
      results.push({ id: q.id, tpl: tpl || '—', ok: false })
      continue
    }
    if (!DRY) updateFigure.run(JSON.stringify({ kind: 'svg', data: svg }), q.id)
    console.log(`成功（模板=${tpl}，params=${JSON.stringify(spec.params)}${DRY ? '，dry-run 未写入' : ''}）`)
    results.push({ id: q.id, tpl, ok: true, params: spec.params })
  } catch (e) {
    console.log(`失败（${e.message}）`)
    results.push({ id: q.id, tpl: '—', ok: false, err: e.message })
  }
}

// id=9 情境矛盾审查（只出对照，不写题干；--fix-stem 才写回）
const q9 = all.find((q) => q.id === 9)
let review9 = null
if (q9) {
  console.log('\n题 9 情境自洽性审查 ...')
  try {
    review9 = await reviewContradiction(provider, q9)
    if (review9?.fixed_stem) review9.fixed_stem = sanitizeAiText(String(review9.fixed_stem))
  } catch (e) {
    review9 = { error: e.message }
  }
}

console.log('\n===== 结果汇总 =====')
for (const r of results) console.log(JSON.stringify(r))
// B1 验收口径：涉计算/情境题（requiresFigure）的补图覆盖率
{
  const needIds = all.filter((q) => requiresFigure(q.stem, q.qtype)).map((q) => q.id)
  const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id))
  const stillEmpty = needIds.filter((id) => !okIds.has(id) && !String(db.prepare('SELECT figure FROM questions WHERE id = ?').get(id)?.figure || ''))
  const covered = needIds.length - stillEmpty.length
  const rate = needIds.length ? ((covered / needIds.length) * 100).toFixed(1) : '100.0'
  console.log(`\n涉计算/情境题共 ${needIds.length} 题，已配图 ${covered} 题，覆盖率 ${rate}%（目标 ≥90%）`)
  if (Number(rate) < 90) console.log('未覆盖：' + stillEmpty.join(', '))
}
if (review9) {
  console.log('\n===== 题 9 审查 =====')
  console.log(JSON.stringify(review9, null, 2))
  if (review9?.contradiction && review9?.fixed_stem && FIX_STEM && !DRY) {
    db.prepare('UPDATE questions SET stem = ? WHERE id = 9').run(review9.fixed_stem)
    console.log('（已按 --fix-stem 写回题 9 题干）')
  } else {
    console.log('（题 9 题干未修改，等待用户确认）')
  }
}
db.close()
