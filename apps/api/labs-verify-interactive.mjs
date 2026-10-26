// 交互抽查：播放动画 / 切预设 / 数据面板联动（3 个代表性课件）
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
function send(method, params = {}) {
  return new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
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
// 读取数据面板
const dataText = () => evaluate(`document.body.innerText.split('\\n').filter(l => l.includes('=')).slice(0, 30).join(' | ')`)
// 点按钮（按文本）
const clickBtn = async (label) => evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(${JSON.stringify(label)}))
  if (!b) return '未找到按钮: ' + ${JSON.stringify(label)}
  b.click(); return 'ok'
})()`)

// 1) 库仑定律：切「距离减半 力×4」预设，数据面板应显示 r=6
await open('coulomb-law')
await clickBtn('距离减半')
await sleep(600)
console.log('库仑预设后:', (await dataText()).slice(0, 200))

// 2) 速度选择器：切「太快」预设 + 播放，等待吸收判定
await open('selector-cyclotron')
await clickBtn('太快')
await sleep(400)
await clickBtn('播放')
await sleep(5000)
console.log('选择器太快播放后:', (await dataText()).slice(0, 300))

// 3) 楞次定律：自动插拔播放，感应电流方向应出现
await open('lenz-law')
await clickBtn('播放')
await sleep(4000)
console.log('楞次自动演示:', (await dataText()).slice(0, 300))

ws.close()
process.exit(0)
