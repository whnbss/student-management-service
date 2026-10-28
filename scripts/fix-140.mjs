// 一次性修复 #140：v_m=0.5/0.16=3.125，解析误断为 3 且第(2)问按 3 连算 → 全部改精确值
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'))
const q = db.prepare('SELECT answer, solution FROM questions WHERE id = 140').get()
const answer = '（1）$v_m=3.125\\ \\mathrm{m/s}$；（2）$P_R=2.5\\ \\mathrm{W}$'
const subs = [
  ['=\\dfrac{0.5}{0.16}=3\\ \\mathrm{m/s}', '=\\dfrac{0.5}{0.16}=3.125\\ \\mathrm{m/s}'],
  ['E=BLv_m=0.8\\times0.5\\times3=1.2\\ \\mathrm{V}', 'E=BLv_m=0.8\\times0.5\\times3.125=1.25\\ \\mathrm{V}'],
  ['I=\\dfrac{E}{R+r}=\\dfrac{1.2}{0.5}=2.4\\ \\mathrm{A}', 'I=\\dfrac{E}{R+r}=\\dfrac{1.25}{0.5}=2.5\\ \\mathrm{A}'],
  ['P_R=I^2R=2.4^2\\times0.4=2.304\\ \\mathrm{W}', 'P_R=I^2R=2.5^2\\times0.4=2.5\\ \\mathrm{W}'],
  ['P_R=\\dfrac{E^2R}{(R+r)^2}=\\dfrac{1.44\\times0.4}{0.25}=2.304\\ \\mathrm{W}', 'P_R=\\dfrac{E^2R}{(R+r)^2}=\\dfrac{1.5625\\times0.4}{0.25}=2.5\\ \\mathrm{W}'],
]
let sol = q.solution
for (const [from, to] of subs) {
  if (!sol.includes(from)) { console.error('✗ 未找到待替换片段: ' + from); process.exit(1) }
  sol = sol.replace(from, to)
}
db.prepare('UPDATE questions SET answer = ?, solution = ? WHERE id = 140').run(answer, sol)
const back = db.prepare('SELECT answer, solution FROM questions WHERE id = 140').get()
console.log('ANSWER:', back.answer)
console.log('SOLUTION:', back.solution)
