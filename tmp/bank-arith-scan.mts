// 全库扫描：checkSolutionArithmetic 对 131 题存量跑一遍（回归：误杀率 + 漏网算术错）
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSolutionArithmetic } from '../packages/shared/src/index.ts'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'))
const rows = db.prepare('SELECT id, qtype, solution FROM questions ORDER BY id').all() as any[]
let bad = 0
for (const q of rows) {
  const issues = checkSolutionArithmetic(q.solution || '')
  if (issues.length) {
    bad++
    console.log(`#${q.id}（${q.qtype}）: ` + issues.map((i) => `${i.expr} 应=${i.expect} 库中=${i.got}`).join('；'))
  }
}
console.log(`===== 全库 ${rows.length} 题，机器复核报警 ${bad} 题 =====`)
