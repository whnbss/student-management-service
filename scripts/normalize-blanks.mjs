// 填空空位规范统一（验收 #28 建议②）：math 定界符外、长度 ≥2 的下划线串统一为 8 个下划线 ________
// 只改 stem/solution/pitfall 的 text 段；math 段（$…$/$$…$$/\[…\]）内不动；`_{\text{…}}` 单下划线不受影响
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')
const rows = db.prepare('SELECT id, stem, solution, pitfall FROM questions').all()
const MATH = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]/g
function normalize(s) {
  if (!s) return s
  let out = ''
  let last = 0
  let m
  MATH.lastIndex = 0
  while ((m = MATH.exec(s))) {
    out += s.slice(last, m.index).replace(/_{2,}/g, '________') + m[0]
    last = m.index + m[0].length
  }
  out += s.slice(last).replace(/_{2,}/g, '________')
  return out
}
let n = 0
const upd = db.prepare('UPDATE questions SET stem=?, solution=?, pitfall=? WHERE id=?')
const changed = []
for (const r of rows) {
  const ns = normalize(r.stem)
  const so = normalize(r.solution)
  const pi = normalize(r.pitfall)
  if (ns !== r.stem || so !== r.solution || pi !== r.pitfall) {
    upd.run(ns, so, pi, r.id)
    n++
    changed.push(r.id)
  }
}
console.log(`归一完成：${n} 题下划线空位统一为 8 个（ids: ${changed.join(',') || '无'}）`)
db.close()
