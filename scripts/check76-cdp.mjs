// check76-cdp: P1-125 复测——CDP 渲染抽查 3 题（线框 #413 / 导轨 #468 / 电势 #195）+ 圆形磁场 #578
// 断言：搜索命中→卡片含 svg 配图→配图容器无横向溢出→旧底板指纹文本清零；console 0 error 0 warning。
// 只读（自签 token），独立 Edge profile 用后即删。
import fs from 'node:fs'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import Database from 'better-sqlite3'

const CDP_PORT = 9234, BASE = 'http://127.0.0.1:3210'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const db = new Database('data/app.db', { readonly: true })
const secret = db.prepare("SELECT value FROM settings WHERE key='token_secret'").get()?.value
db.close()
const b64 = Buffer.from(JSON.stringify({ uid: 1, role: 'teacher', exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')
const TOKEN = b64 + '.' + crypto.createHmac('sha256', secret).update(b64).digest('base64url')
const AUTH = JSON.stringify({ state: { token: TOKEN, role: 'teacher', username: 'teacher', mustChangePwd: false }, version: 0 })

const prof = '.agent_context/tmp/check76-edgeprof'
fs.rmSync(prof, { recursive: true, force: true })
fs.mkdirSync(prof, { recursive: true })
const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${prof}`,
  '--no-first-run', '--disable-gpu', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' })
await sleep(3500)

const wsUrl = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).filter((t) => t.type === 'page')[0].webSocketDebuggerUrl
class Cdp {
  constructor(ws) { this.ws = new WebSocket(ws); this.id = 0; this.pending = new Map(); this.consoleMsgs = []
    this.opened = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej })
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result) }
      else if (m.method === 'Runtime.consoleAPICalled') { const t = m.params.type; if (t === 'error' || t === 'warning') this.consoleMsgs.push(t + ': ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200)) }
      else if (m.method === 'Runtime.exceptionThrown') this.consoleMsgs.push('exception: ' + (m.params.exceptionDetails?.exception?.description || '').slice(0, 200)) } }
  send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++this.id; this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })) }) }
  async eval(expr) {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('eval-timeout')), 20000))
    const work = this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then((r) => { if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || '').slice(0, 300)); return r.result.value })
    return Promise.race([work, timeout]) }
}
const c = new Cdp(wsUrl)
await c.opened
await c.send('Runtime.enable'); await c.send('Page.enable')
await c.send('Page.navigate', { url: BASE + '/' }); await sleep(2500)
await c.eval(String.raw`localStorage.setItem('workbench-auth', ${JSON.stringify(AUTH)}); 'ok'`)

let bad = 0
const check = async (kw, name, mustTexts, forbidTexts) => {
  await c.send('Page.navigate', { url: BASE + '/bank' }); await sleep(2000)
  await c.eval(`(async () => {
    const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('搜'));
    if (!inp) return 'no-input';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(kw)}); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 2500)); return 'typed'; })()`)
  await sleep(500)
  const r = await c.eval(`(() => {
    const figs = [...document.querySelectorAll('div')].filter((d) => d.querySelector('svg') && (d.className + '').includes('rounded-xl'));
    const svg = document.querySelectorAll('svg');
    const figTxt = figs.map((f) => f.textContent).join(' ');
    const overflow = figs.some((f) => f.scrollWidth > f.clientWidth + 1);
    return { nsvg: svg.length, nfig: figs.length, figTxt, overflow } })()`)
  const missT = mustTexts.filter((t) => !r.figTxt.includes(t))
  const hitBad = forbidTexts.filter((t) => r.figTxt.includes(t))
  const ok = r.nsvg > 0 && !r.overflow && missT.length === 0 && hitBad.length === 0
  if (!ok) bad++
  console.log(`${ok ? '✅' : '❌'} ${name}: svg=${r.nsvg} 溢出=${r.overflow} 缺文本=[${missT}] 禁词命中=[${hitBad}]`)
  try {
    const shot = await Promise.race([c.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, rej) => setTimeout(() => rej(new Error('shot-timeout')), 10000))])
    fs.writeFileSync(`.agent_context/tmp/check76-${name}.png`, Buffer.from(shot.data, 'base64'))
  } catch (e) { console.log('[shot-skip]', e.message) }
}
await check('感应电动势大小为', 'q413-线框', ['L', 'd'], ['B / E'])
await check('回路中感应电流', 'q468-导轨', ['导体棒（r）', 'R'], ['B / E'])
await check('AB 连线平行于电场线', 'q195-电势', ['A', 'B', 'C', '0.2 m'], ['B / E'])
await check('沿纸面内各个方向', 'q578-圆形磁场', ['P', 'O'], ['B / E'])

const errs = c.consoleMsgs.filter((m) => m.startsWith('error') || m.startsWith('exception'))
const warns = c.consoleMsgs.filter((m) => m.startsWith('warning'))
console.log(`console: error=${errs.length} warning=${warns.length}`)
if (errs.length || warns.length) { console.log(errs.concat(warns).slice(0, 5).join('\n')); bad++ }

edge.kill()
await sleep(800)
fs.rmSync(prof, { recursive: true, force: true })
console.log(bad === 0 ? '✅ CDP 抽查 3 类 4 题全过' : `❌ ${bad} 项失败`)
process.exit(bad ? 1 : 0)
