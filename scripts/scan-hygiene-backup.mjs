// 负向测试：对修复前备份库跑同一口径，确认 bank-audit 新增两条硬校验确实能抓到缺陷
import Database from 'better-sqlite3'
const db = new Database('data/backups/app-pre-accept28.db', { readonly: true })
const rows = db.prepare('SELECT id,stem,solution FROM questions').all()
const CJK_SUB = /(?<!_)_(?![_{])[一-龥]/
const BARE_CMD = /\\(?:underline|hspace|dfrac|tfrac|frac|sqrt|times|cdot|approx|text|mathrm|pi|Delta|omega|alpha|beta|theta|mu|lambda)/
const MATH_BLOCK = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]/g
let c = 0, b = 0
const cIds = [], bIds = []
for (const r of rows) {
  const s = String(r.solution || '') + String(r.stem || '')
  if (CJK_SUB.test(s)) { c++; cIds.push(r.id) }
  let last = 0, m
  while ((m = MATH_BLOCK.exec(s))) { if (BARE_CMD.test(s.slice(last, m.index))) { b++; bIds.push(r.id) } last = m.index + m[0].length }
  if (BARE_CMD.test(s.slice(last))) { b++; bIds.push(r.id) }
  MATH_BLOCK.lastIndex = 0
}
console.log('修复前库：裸中文下标题数', c, cIds.join(','), '| math外裸LaTeX题数', b, bIds.join(','))
db.close()
