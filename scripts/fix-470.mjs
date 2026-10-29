// P3 自查修复：#470 answer 字段与解析不一致（解析正确 a=50/x=1.6/Q=3.6，answer 误为 10/0.8/0.36），
// 并删除解析中 AI 生成残留的「更正：…」过程性文字。通过正式 API 入库，拒绝空值。
import Database from 'better-sqlite3'

const BASE = 'http://localhost:3210'
const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'teacher', password: 'admin123' }),
}).then((r) => r.json())
if (!login.token) { console.error('登录失败', login); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token }

const db = new Database('data/app.db', { readonly: true })
const cur = db.prepare('SELECT answer, solution FROM questions WHERE id = 470').get()
db.close()
if (!cur) { console.error('#470 不存在'); process.exit(1) }

const newAnswer = cur.answer
  .split('a_{\\text{max}}=10').join('a_{\\text{max}}=50')
  .split('x_1=0.8').join('x_1=1.6')
  .split('Q_R=0.36').join('Q_R=3.6')
// 删除「更正：...。」残留句（定位「。更正：」到其后第一个「$。」之间）
const idx = cur.solution.indexOf('。更正：')
let newSolution = cur.solution
if (idx >= 0) {
  const end = cur.solution.indexOf('$。', idx)
  if (end >= 0) newSolution = cur.solution.slice(0, idx) + '。' + cur.solution.slice(end + 2)
}

if (newAnswer === cur.answer) { console.error('answer 无变化：替换目标未命中'); process.exit(1) }
// 更正痕迹可能在先前运行中已删除（幂等），不再要求 solution 必须变化
for (const [k, v] of [['answer', newAnswer], ['solution', newSolution]]) {
  if (!String(v || '').trim()) { console.error(k + ' 为空，拒绝执行'); process.exit(1) }
}

const r = await fetch(BASE + '/api/questions/470', {
  method: 'PUT', headers: H, body: JSON.stringify({ answer: newAnswer, solution: newSolution }),
}).then((res) => res.json())
if (!r.ok) { console.error('PUT 失败', JSON.stringify(r)); process.exit(1) }

const db2 = new Database('data/app.db', { readonly: true })
const after = db2.prepare('SELECT answer, solution FROM questions WHERE id = 470').get()
db2.close()
console.log('a_max=50:', after.answer.includes('50'), '/ x1=1.6:', after.answer.includes('1.6'), '/ Q_R=3.6:', after.answer.includes('3.6'))
console.log('更正痕迹残留:', after.solution.includes('更正：') ? '有 ⚠' : '无 ✓')
console.log('解析仍含正确值: a=50:', after.solution.includes('=50'), 'x1=1.6:', after.solution.includes('1.6'), 'Q_R=3.6:', after.solution.includes('3.6'))
