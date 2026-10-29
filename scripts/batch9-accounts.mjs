// 第九批五元账目脚本求和：解析 batch9 三份日志 + 三个计划文件 + 只读查库，输出账目闭合校验
// 只读脚本：不写库、不调 AI、不动配置
import fs from 'node:fs'
import Database from 'better-sqlite3'

const LOGS = ['logs-batch9.txt', 'logs-batch9-retry.txt', 'logs-batch9-retry2.txt']
const PLANS = ['scripts/batch9-plan.json', 'scripts/batch9-retry-plan.json', 'scripts/batch9-retry2-plan.json']
const NAMES = ['主批', '重试一', '重试二']
const nOf = (s) => (Number((s.match(/(\d+) 题/) || [])[1]) || 0)

let totalPlan = 0, totalReq = 0, totalCalls = 0, totalSaved = 0
const savedIds = []
let badAll = 0, figAll = 0, dupAll = 0, netAll = 0
for (let i = 0; i < LOGS.length; i++) {
  const plan = JSON.parse(fs.readFileSync(PLANS[i], 'utf-8'))
  let planN = 0
  for (const t of plan.topics) for (const g of t.groups) planN += g.n
  totalPlan += planN
  const lines = fs.readFileSync(LOGS[i], 'utf8').split(/\r?\n/)
  let calls = 0, req = 0, saved = 0, bad = 0, fig = 0, dup = 0, net = 0
  for (const l of lines) {
    const m = l.match(/^▶ .+· (\d+) 题）/)
    if (m) { calls++; req += Number(m[1]); continue }
    if (l.includes('✓ 入库') && l.includes('ids:')) {
      const n = nOf(l)
      const idsPart = l.slice(l.indexOf('ids:') + 4, l.lastIndexOf('）'))
      saved += n
      for (const x of idsPart.split(',')) if (x.trim()) savedIds.push(Number(x.trim()))
    }
    if (l.includes('二审未过，已弃用')) bad += nOf(l)
    if (l.includes('配图渲染失败，已弃用')) fig += nOf(l)
    if (l.includes('疑似重复，未入库')) dup++
    if (l.includes(': fetch failed')) net++
  }
  console.log(`${NAMES[i]}：计划 ${planN} 槽 / 生成调用 ${calls} 次请求 ${req} 题 / 入库 ${saved} / 弃用行 二审${bad}+缺图${fig}+重复${dup} / 网络失败 ${net} 次`)
  totalCalls += calls; totalReq += req; totalSaved += saved
  badAll += bad; figAll += fig; dupAll += dup; netAll += net
}
console.log('---')
console.log(`合计：计划 ${totalPlan} 槽 / 调用 ${totalCalls} 次 / 请求 ${totalReq} 题 / 过审入库 ${totalSaved}（id ${savedIds.join(',')}）`)
console.log(`弃置（日志汇总行求和）：二审未过 ${badAll} + 缺图 ${figAll} + 重复 ${dupAll} + 网络失败调用 ${netAll} 次`)
console.log(`独立口径：二审 ${badAll - figAll} + 缺图 ${figAll}（缺图题同时被计入「二审未过」行，属脚本 bad=drafts-good 口径的重复计数）`)
console.log(`闭合校验：请求 ${totalReq} = 生成草稿 ${totalSaved + badAll} + 网络失败未产题 ${totalReq - totalSaved - badAll}`)

// 只读查库：id 空洞与序号烧号
const db = new Database('data/app.db', { readonly: true })
const ids = db.prepare('SELECT id FROM questions ORDER BY id').all().map((r) => r.id)
const holes = []
for (let x = 440; x <= 489; x++) if (!ids.includes(x)) holes.push(x)
const seq = db.prepare("SELECT seq FROM sqlite_sequence WHERE name='questions'").get()
console.log(`库内 440~489 空洞 id：${holes.join(',')}`)
console.log(`questions 自增序列 seq=${seq.seq}，最大入库 id=${ids[ids.length - 1]}（${seq.seq - ids[ids.length - 1]} 个号已被烧、未复用）`)
console.log(`库内总数 ${ids.length}`)
db.close()
