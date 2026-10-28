// 一次性修复 #273：总时间 2s+1s 应为 3s（解析/答案误写 2.5s）
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'))
const q = db.prepare('SELECT answer, solution FROM questions WHERE id = 273').get()
const answer = '(1) $t=3\\,\\mathrm{s}$；(2) $W=16\\,\\mathrm{J}$；(3) $Q=16\\,\\mathrm{J}$'
const from = '故总时间 $t=t_1+t_2=2\\,\\mathrm{s}+1\\,\\mathrm{s}=2.5\\,\\mathrm{s}$。'
const to = '故总时间 $t=t_1+t_2=2\\,\\mathrm{s}+1\\,\\mathrm{s}=3\\,\\mathrm{s}$。'
if (!q.solution.includes(from)) { console.error('✗ 未找到待替换片段'); process.exit(1) }
db.prepare('UPDATE questions SET answer = ?, solution = ? WHERE id = 273').run(answer, q.solution.replace(from, to))
const back = db.prepare('SELECT answer FROM questions WHERE id = 273').get()
console.log('ANSWER:', back.answer)
