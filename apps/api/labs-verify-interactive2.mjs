// 交互抽查二：只读「实时数据」面板内容
import { createRequire } from 'module'
const require2 = createRequire('C:/Users/w00033994/AppData/Roaming/npm/node_modules/comagic-websearch/node_modules/')
const WebSocket = require2('ws')

const loginRes = await fetch('http://localhost:3210/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'admin123' }),
})
const token = (await loginRes.json()).token
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false })
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let msgId = 0
const pending = new Map()
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
})
const send = (m, p = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Runtime.enable')
await send('Page.enable')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.navigate', { url: 'http://localhost:5173/' })
await sleep(2500)
await evaluate(`localStorage.setItem('workbench-auth', JSON.stringify({ state: { token: ${JSON.stringify(token)} }, version: 0 })); 'ok'`)

async function open(id) {
  await send('Page.navigate', { url: `http://localhost:5173/labs/${id}` })
  await sleep(2200)
}
const dataPanel = () => evaluate(`(() => {
  const cards = [...document.querySelectorAll('.card')]
  const dc = cards.find(c => c.textContent.includes('实时数据'))
  if (!dc) return '面板未找到'
  return [...dc.querySelectorAll('dl > div')].map(d => d.textContent.trim()).join(' | ')
})()`)
const clickBtn = async (label) => evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(${JSON.stringify(label)}))
  if (!b) return '未找到: ' + ${JSON.stringify(label)}
  b.click(); return 'ok'
})()`)

// 选择器：太快预设 + 播放 5s → 应「被上板吸收」
await open('selector-cyclotron')
console.log('S太快预设:', await clickBtn('太快'))
console.log('S播放:', await clickBtn('播放'))
await sleep(5000)
console.log('选择器数据:', await dataPanel())

// 楞次：自动插拔 → 感应电流方向非空
await open('lenz-law')
console.log('L播放:', await clickBtn('播放'))
await sleep(4500)
console.log('楞次数据:', await dataPanel())

// 库仑：距离减半后 F×4
await open('coulomb-law')
console.log('C预设:', await clickBtn('距离减半'))
await sleep(500)
console.log('库仑数据:', await dataPanel())

ws.close()
process.exit(0)
