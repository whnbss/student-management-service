// B1 存量补图·第二遍（强制映射）：对第一遍 AI 返回 none 的情境题做强制重试——
// 提示模型给出题型 + 按情境关键词给出候选模板提示，只有纯概念辨析题才允许返回 none。
// 用法：npx tsx scripts/backfill-figures-force.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { specToSvg } from '../apps/web/src/lib/figure.ts'
import { FIGURE_TEMPLATES, sanitizeAiText, FIGURE_TEMPLATE_DOCS, requiresFigure } from '../packages/shared/src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))
const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value ?? null

function loadProvider() {
  const list = JSON.parse(getSetting('ai_providers') || '[]')
  const activeId = (getSetting('ai_active_provider') || '').trim()
  const usable = (p) => p.api_key && (p.text_model || p.vision_model)
  const p = list.find((x) => x.id === activeId && usable(x)) || list.find(usable)
  if (!p) throw new Error('没有可用的 AI 供应商（未配置 Key）')
  return p
}

function getDispatcher() {
  const uri = (getSetting('ai_proxy') || '').trim() || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
  if (!uri) return undefined
  const caCandidates = [process.env.NODE_EXTRA_CA_CERTS, path.join(ROOT, 'certs', 'corporate-ca.pem')].filter(Boolean)
  let ca
  for (const f of caCandidates) {
    try { if (fs.existsSync(f)) { ca = [fs.readFileSync(f, 'utf8')]; break } } catch { /* ignore */ }
  }
  return ca ? new ProxyAgent({ uri, requestTls: { ca } }) : new ProxyAgent({ uri })
}

async function chat(provider, { system, user, temperature = 0.2 }) {
  const base = provider.base_url.replace(/\/+$/, '')
  const body = {
    model: provider.text_model || provider.vision_model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
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
  if (res.status === 404 && !/\/v\d+$/.test(base)) { url = `${base}/v1/chat/completions`; res = await doFetch(url) }
  if (!res.ok) throw new Error(`AI 接口错误(${res.status})`)
  const ct = String(res.headers.get('content-type') || '')
  let content = ''
  if (ct.includes('text/event-stream')) {
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let raw = ''
    while (true) { const { done, value } = await reader.read(); if (done) break; raw += dec.decode(value, { stream: true }) }
    for (const line of raw.split('\n')) {
      const l = line.trim()
      if (!l.startsWith('data:') || l.includes('[DONE]')) continue
      try { const d = JSON.parse(l.slice(5))?.choices?.[0]?.delta; if (typeof d?.content === 'string') content += d.content } catch { /* skip */ }
    }
  } else {
    content = (await res.json())?.choices?.[0]?.message?.content || ''
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
  return t.slice(start, end + 1)
}

// 情境关键词 → 候选模板提示（降低模型「想不出」的弃答率）
const HINTS = [
  [/x-t|v-t|a-t|图像|图线|图乙|图甲/, '坐标图像题 → graph_lines（填 xlabel/ylabel/各线起止值）'],
  [/等温|等压|等容|绝热|气体状态|p-V|玻意耳|查理|盖-吕萨克/, '气体状态变化 → pv_diagram（给状态点）或 gas_cylinder（气缸装置）'],
  [/碰撞|弹回|击回|反冲|动量守恒/, '碰撞/动量 → collision（两球速度箭头）或 two_blocks / block_on_block'],
  [/自由下落|竖直上抛|竖直下落|落回|上抛|下抛/, '竖直抛体 → freefall 或 projectile'],
  [/加速电场|偏转|平行板|电容器|极板/, '电场加速/偏转 → accel_plates 或 field_region(uniform) 或 equipotential'],
  [/第一宇宙速度|卫星|行星|双星|恒星|天体|轨道/, '天体 → orbit（圆/椭圆轨道）'],
  [/光电|遏止|逸出功|光电子/, '光电效应 → photoelectric'],
  [/线圈|磁通量|感应电动势|自感|变压器|匀速转动/, '线圈 → coil_flux（static/rotate）'],
  [/安培力|直导线|通电导线|洛伦兹/, '磁场力 → wire_bfield（wire/charge）'],
  [/导轨|导体棒|电磁感应.*导轨|切割磁感线/, '电磁感应导轨 → rail'],
  [/单摆|摆角|摆长/, '单摆 → pendulum'],
  [/机械波|波形|波长|横波|质点 P|简谐波/, '波形 → wave；振动图 → vibrate'],
  [/折射|反射|全反射|入射角/, '光路 → optics_refract'],
  [/刹车|匀减速|匀加速直线|平直公路|汽车|列车|动车/, '直线运动 → car_road 或 graph_lines'],
  [/弹簧|劲度系数|压缩量/, '弹簧 → spring 或 incline_spring'],
  [/斜面/, '斜面 → incline / incline_baffle / incline_spring'],
  [/传送带/, '传送带 → conveyor'],
  [/平抛/, '平抛 → projectile'],
  [/电路|电阻|电源|电动势|电流表|电压表|滑动变阻器/, '电路 → circuit 或 exp_circuit'],
]

const FIGURE_SYSTEM_FORCE = `你是高中物理题目配图助手。给定题目的题干/答案/解析与题型，请从下方模板列表中选一个最贴合题意的模板，并给出参数。
要求：
1. 模板只能从列表中选，参数名必须与模板说明一致；参数数值必须与题干给出的数值严格一致，严禁改动题干数值；
2. 这道题是${'「'}有具体物理情境${'」'}的题目（涉及计算/受力/运动/电路/场/实验装置），**必须**选出最接近题意的模板并给参数（示意图能反映装置/过程即可，允许合理简化），除非题目确实是不含任何情境与计算的纯概念辨析题，才可以输出 {"template": "none", "params": {}}；
3. 若题干是图像题（如 v-t 图像但没有配图），必须用 graph_lines 画出题干文字所描述的图线；
4. 严格输出 JSON 对象 {"template": "...", "params": {...}}，不要输出任何其他文字。

可用模板：
${FIGURE_TEMPLATE_DOCS}`

const provider = loadProvider()
console.log(`使用模型：${provider.name} / ${provider.text_model || provider.vision_model}`)

const all = db.prepare('SELECT * FROM questions ORDER BY id').all()
const targets = all.filter((q) => !q.figure && requiresFigure(q.stem, q.qtype))
console.log(`强制补图目标（${targets.length}）：${targets.map((q) => q.id).join(', ')}`)

const updateFigure = db.prepare('UPDATE questions SET figure = ? WHERE id = ?')
let ok = 0, none = 0, err = 0

for (const q of targets) {
  process.stdout.write(`题 ${q.id} ... `)
  const hints = HINTS.filter(([re]) => re.test(q.stem)).map(([, h]) => h).slice(0, 3)
  const user = `题型：${q.qtype}
【题干】${q.stem}
【答案】${(q.answer || '').slice(0, 300)}
【解析】${(q.solution || '').slice(0, 500)}
${hints.length ? `候选模板提示（仅供参考，仍以题意为准）：\n${hints.map((h) => '- ' + h).join('\n')}` : ''}
请输出配图 figure_spec JSON。`
  try {
    const out = JSON.parse(extractJson(await chat(provider, { system: FIGURE_SYSTEM_FORCE, user, temperature: 0.1 })))
    const tpl = String(out?.template || '').trim()
    const params = {}
    for (const [k, v] of Object.entries(out?.params || {})) {
      if (typeof v === 'number' && Number.isFinite(v)) params[k] = v
      else if (typeof v === 'string' && v.trim()) params[k] = v.trim().slice(0, 30)
    }
    const svg = FIGURE_TEMPLATES.includes(tpl) ? specToSvg({ template: tpl, params }) : ''
    if (tpl && svg) {
      if (!DRY) updateFigure.run(JSON.stringify({ kind: 'svg', data: svg }), q.id)
      console.log(`成功（模板=${tpl}）`)
      ok++
    } else {
      console.log(`none（${tpl || '无'}）`)
      none++
    }
  } catch (e) {
    console.log(`失败（${e.message}）`)
    err++
  }
}

const needIds = all.filter((q) => requiresFigure(q.stem, q.qtype))
const figured = needIds.filter((q) => String(db.prepare('SELECT figure FROM questions WHERE id = ?').get(q.id)?.figure || ''))
console.log(`\n===== 汇总：本次成功 ${ok}，none ${none}，失败 ${err}；全库涉计算/情境题 ${needIds.length}，已配图 ${figured.length}（覆盖率 ${((figured.length / needIds.length) * 100).toFixed(1)}%）=====`)
db.close()
