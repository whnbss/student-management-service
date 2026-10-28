// 诊断脚本（P2-17 前置核查）：区分库内「字面反斜杠+n」与「真实换行」
// 结论口径：字面 \n（后非字母）才是前端显示异常的来源；真实换行是正常存储
import Database from 'better-sqlite3'

const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id, stem, answer, solution, pitfall FROM questions ORDER BY id').all()
const BS = String.fromCharCode(92) // 反斜杠
const LIT = new RegExp(BS + BS + 'n(?![a-zA-Z])', 'g') // 字面 反斜杠+n，后非字母

let litTotal = 0
let realNlTotal = 0
const litIds = []
for (const r of rows) {
  for (const f of ['stem', 'answer', 'solution', 'pitfall']) {
    const s = String(r[f] ?? '')
    LIT.lastIndex = 0
    const lit = (s.match(LIT) || []).length
    if (lit) { litTotal += lit; litIds.push(`#${r.id}.${f}×${lit}`) }
    realNlTotal += (s.match(/\n/g) || []).length
  }
}
console.log('字面反斜杠+n（后非字母）:', litTotal, '处，涉及', litIds.length, '字段')
console.log(litIds.join(' '))
console.log('真实换行总数（正常存储）:', realNlTotal)
