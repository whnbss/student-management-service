// Cloudflare 临时隧道启动器（公司内网可用版）
// 背景：公司内网封锁直连出网，cloudflared 自身不走代理（quick tunnel 注册请求与 edge 7844 都连不通）。
// 本脚本做四件事：
//   1. 用走代理的 HTTPS 请求向 api.trycloudflare.com 注册临时隧道（等价于 curl -x proxy POST /tunnel）
//   2. 用返回的凭据构造 --token，spawn cloudflared（http2 协议）
//   3. 若直连 edge 7844 不通（公司内网），起本地 TCP 中继（127.0.0.1:7844 → 代理 CONNECT → edge），
//      并把 region*.v2.argotunnel.com 写入 hosts 指向 127.0.0.1（需管理员权限）
//   4. 打印公网 URL 并保持运行；Ctrl+C 退出时尽力还原 hosts
// 用法：node scripts/tunnel.mjs [本地端口=3210]
import net from 'node:net'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

const HOSTS_FILE = 'C:\\Windows\\System32\\drivers\\etc\\hosts'
const HOSTS_MARK = '# teaching-workbench cloudflared relay (auto)'
const EDGE_HOSTS = ['region1.v2.argotunnel.com', 'region2.v2.argotunnel.com']
const LOCAL_PORT = Number(process.argv[2]) || 3210
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || ''

function log(...a) { console.log('[tunnel]', ...a) }

// ---------- 1. 定位 / 下载 cloudflared ----------
function findCloudflared() {
  const local = path.join(os.homedir(), '.local', 'bin', 'cloudflared.exe')
  if (fs.existsSync(local)) return local
  try {
    const p = execSync('where cloudflared', { encoding: 'utf8' }).split(/\r?\n/)[0].trim()
    if (p) return p
  } catch { /* not in PATH */ }
  return null
}

async function downloadCloudflared(dest) {
  log('未找到 cloudflared，开始通过公司代理 SSO 下载（约 20MB）…')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  const ps = [
    '$ProgressPreference="SilentlyContinue";',
    `Invoke-WebRequest -Uri '${url}' -Proxy 'http://proxy.singapore.itsec.hihonor.com:8080' -ProxyUseDefaultCredentials -OutFile '${dest}'`,
  ].join(' ')
  execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: 'inherit' })
  if (!fs.existsSync(dest)) throw new Error('下载失败')
  log('下载完成：', dest)
}

// ---------- 2. 走代理注册临时隧道 ----------
async function createQuickTunnel() {
  const dispatcher = PROXY ? new ProxyAgent(PROXY) : undefined
  log('正在注册 trycloudflare 临时隧道…')
  const res = await undiciFetch('https://api.trycloudflare.com/tunnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    dispatcher,
  })
  const data = await res.json()
  const r = data?.result
  if (!data?.success || !r?.id || !r?.secret) throw new Error('注册临时隧道失败：' + JSON.stringify(data).slice(0, 200))
  const token = Buffer.from(JSON.stringify({ a: r.account_tag, t: r.id, s: r.secret })).toString('base64')
  return { token, url: `https://${r.hostname}` }
}

// ---------- 3. 直连探测 / 本地中继 + hosts ----------
function testDirectEdge() {
  return new Promise((resolve) => {
    const s = net.connect({ host: 'region1.v2.argotunnel.com', port: 7844, timeout: 5000 }, () => { s.destroy(); resolve(true) })
    s.on('timeout', () => { s.destroy(); resolve(false) })
    s.on('error', () => resolve(false))
  })
}

function currentTargets() {
  try {
    const txt = fs.readFileSync(HOSTS_FILE, 'utf8')
    return EDGE_HOSTS.filter((h) => new RegExp(`^\\s*127\\.0\\.0\\.1\\s+${h}\\s*$`, 'm').test(txt))
  } catch { return [] }
}

function writeHosts(add) {
  let txt = fs.readFileSync(HOSTS_FILE, 'utf8')
  if (add) {
    if (currentTargets().length === EDGE_HOSTS.length) return true
    txt += `\n${HOSTS_MARK}\n${EDGE_HOSTS.map((h) => `127.0.0.1 ${h}`).join('\n')}\n`
  } else {
    const esc = HOSTS_MARK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    txt = txt.replace(new RegExp(`\\n?${esc}\\n(?:127\\.0\\.0\\.1 [^\\n]+\\n?)+`, 'g'), '\n')
  }
  try {
    fs.writeFileSync(HOSTS_FILE, txt)
    return true
  } catch {
    return false
  }
}

// 本地 TCP 中继：127.0.0.1:7844 → 代理 CONNECT → edge（TLS ClientHello 可能超一个 MTU，必须缓冲到 CONNECT 应答后转发）
function startRelay(edgeHost) {
  const noScheme = PROXY.replace(/^https?:\/\//, '')
  // PROXY 为空时退回公司默认代理（与下方 SSO 下载用的是同一个），避免残留的错误内网域名（P3-33）
  const proxyHost = noScheme.split(':')[0] || 'proxy.singapore.itsec.hihonor.com'
  const proxyPort = Number(noScheme.split(':')[1]) || 8080
  const ALLOWED = new Set(EDGE_HOSTS)
  return net.createServer((client) => {
    let firstChunk = Buffer.alloc(0)
    const collect = (chunk) => { firstChunk = Buffer.concat([firstChunk, chunk]) }
    client.on('data', collect)
    client.once('data', () => {
      if (!ALLOWED.has(edgeHost)) { client.destroy(); return }
      const upstream = net.connect(proxyPort, proxyHost, () => {
        upstream.write(`CONNECT ${edgeHost}:7844 HTTP/1.1\r\nHost: ${edgeHost}:7844\r\n\r\n`)
      })
      let buf = Buffer.alloc(0)
      const onData = (d) => {
        buf = Buffer.concat([buf, d])
        const idx = buf.indexOf('\r\n\r\n')
        if (idx === -1) return
        upstream.removeListener('data', onData)
        client.removeListener('data', collect)
        const status = buf.slice(0, idx).toString().split('\r\n')[0]
        if (!/ 200 /.test(status)) { console.error('[relay] CONNECT 失败:', status); client.destroy(); upstream.destroy(); return }
        const rest = buf.slice(idx + 4)
        if (firstChunk.length) upstream.write(firstChunk)
        if (rest.length) client.write(rest)
        upstream.pipe(client)
        client.pipe(upstream)
      }
      upstream.on('data', onData)
      upstream.on('error', () => client.destroy())
      client.on('error', () => upstream.destroy())
    })
    client.on('error', () => { /* 忽略 */ })
  })
}

// ---------- 主流程 ----------
async function main() {
  let cf = findCloudflared()
  if (!cf) {
    cf = path.join(os.homedir(), '.local', 'bin', 'cloudflared.exe')
    await downloadCloudflared(cf)
  }
  log('cloudflared:', cf)

  const { token, url } = await createQuickTunnel()
  log('公网地址：', url)
  log('（临时域名，重启脚本会变；固定域名见 README「公网部署」章节）')

  const direct = await testDirectEdge()
  let relay = null
  if (direct) {
    log('检测到可直连 Cloudflare edge，无需本地中继')
  } else {
    log('直连 edge 7844 不通（公司内网），启用本地中继 + hosts 重定向')
    const ok = writeHosts(true)
    if (!ok) {
      console.error('[tunnel] ⚠️ 无法写入 hosts（需要管理员权限）。请以管理员身份重新运行，或手动在')
      console.error(`[tunnel] ${HOSTS_FILE} 末尾追加两行：`)
      for (const h of EDGE_HOSTS) console.error(`[tunnel]   127.0.0.1 ${h}`)
      console.error('[tunnel] 没有该重定向时，公司内网下隧道将连不上 Cloudflare edge。')
    }
    relay = startRelay('region1.v2.argotunnel.com')
    await new Promise((res) => relay.listen(7844, '127.0.0.1', () => { log('本地中继已监听 127.0.0.1:7844'); res() }))
  }

  const child = spawn(cf, ['tunnel', '--protocol', 'http2', '--url', `http://localhost:${LOCAL_PORT}`, 'run', '--token', token], { stdio: 'inherit' })
  child.on('exit', (code) => log(`cloudflared 退出（${code}），隧道已停止`))

  const cleanup = () => {
    try { child.kill() } catch { /* 忽略 */ }
    if (relay) { try { relay.close() } catch { /* 忽略 */ } }
    if (!direct) writeHosts(false)
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

main().catch((e) => {
  console.error('[tunnel] 启动失败：', e?.message || e)
  process.exit(1)
})
