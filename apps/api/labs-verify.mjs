// 无头浏览器验证：12 个新课件逐页加载，收集 JS 报错（CDP over WebSocket）
import { createRequire } from 'module'

const require2 = createRequire('C:/Users/w00033994/AppData/Roaming/npm/node_modules/comagic-websearch/node_modules/')
const WebSocket = require2('ws')

const IDS = [
  'coulomb-law', 'efield-lines', 'potential-equip', 'e-deflection', 'capacitor-plates',
  'circuit-ohm', 'emf-internal', 'ampere-force', 'lorentz-circle', 'selector-cyclotron',
  'combined-fields', 'lenz-law',
]

// 1. 取 token
const loginRes = await fetch('http://localhost:3210/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin123' }),
})
const loginJson = await loginRes.json()
if (!loginJson.token) {
  console.error('登录失败:', JSON.stringify(loginJson))
  process.exit(1)
}
const token = loginJson.token

// 2. 连 CDP
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
if (!page) {
  console.error('未找到页面 target')
  process.exit(1)
}
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false })
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })

let msgId = 0
const pending = new Map()
const consoleErrors = new Map() // url → string[]
const exceptions = new Map()
let curUrl = ''

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)
    // React Router future-flag 提示忽略
    if (text.includes('future flag') || text.includes('v7_startTransition') || text.includes('React Router')) return
    if (!consoleErrors.has(curUrl)) consoleErrors.set(curUrl, [])
    consoleErrors.get(curUrl).push(`[${msg.params.type}] ${text}`)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    const text = (d.exception?.description || d.text || '').slice(0, 300)
    if (!exceptions.has(curUrl)) exceptions.set(curUrl, [])
    exceptions.get(curUrl).push(text)
  }
})

function send(method, params = {}) {
  return new Promise((res) => {
    const id = ++msgId
    pending.set(id, res)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}

await send('Runtime.enable')
await send('Page.enable')

// 3. 先到根路径种 token
curUrl = 'root'
await send('Page.navigate', { url: 'http://localhost:5173/' })
await new Promise((r) => setTimeout(r, 2500))
await evaluate(`localStorage.setItem('workbench-auth', JSON.stringify({ state: { token: ${JSON.stringify(token)} }, version: 0 })); 'ok'`)

// 4. 逐个课件访问
const results = []
for (const id of IDS) {
  const url = `http://localhost:5173/labs/${id}`
  curUrl = id
  consoleErrors.delete(id)
  exceptions.delete(id)
  await send('Page.navigate', { url })
  await new Promise((r) => setTimeout(r, 2600))
  const info = await evaluate(`(() => {
    const h1 = document.querySelector('h1,h2')?.textContent || ''
    const svgs = document.querySelectorAll('svg').length
    const texts = document.body.innerText.slice(0, 400)
    const inList = document.body.innerText.includes('实时数据') || document.body.innerText.includes('典型情景')
    return { h1, svgs, inList, sample: texts.replace(/\\n/g, ' | ').slice(0, 220) }
  })()`)
  const errs = [...(consoleErrors.get(id) || []), ...(exceptions.get(id) || [])]
  results.push({ id, ok: errs.length === 0 && info?.inList, info, errs })
  console.log(`${errs.length === 0 && info?.inList ? '✓' : '✗'} ${id}: svgs=${info?.svgs} h1=${info?.h1}${errs.length ? ' 错误: ' + errs.join(' ; ') : ''}`)
}

ws.close()
const bad = results.filter((r) => !r.ok)
console.log(bad.length === 0 ? `\n全部 ${IDS.length} 个课件页面加载无 JS 报错` : `\n${bad.length} 个课件存在问题`)
process.exit(0)
