// 修复 #576 solution 的（4）段：移除 inline 补写造成的损坏尾部，重建正确的（4）段
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = new Database(path.join(ROOT, 'data', 'app.db'))

const SOL4 = '（4）$t=0$ 时刻 $x=5\\,\\text{m}$ 处质点与 $x=1\\,\\text{m}$ 处质点相距一个波长，振动状态相同。由图甲知 $t=0$ 时刻 $x=1\\,\\text{m}$ 处质点位于波峰，故 $x=5\\,\\text{m}$ 处质点此时也位于波峰，其振动方程为 $y=A\\cos\\dfrac{2\\pi}{T}t$。$t=0.5\\,\\text{s}$ 时 $y=A\\cos\\left(\\dfrac{2\\pi}{0.8}\\times0.5\\right)=A\\cos\\dfrac{5\\pi}{4}=-\\dfrac{\\sqrt{2}}{2}A=-0.1\\sqrt{2}\\,\\text{m}\\approx-0.141\\,\\text{m}$，即位移大小为 $0.141\\,\\text{m}$，方向沿 $y$ 轴负方向。'

const row = db.prepare('SELECT solution FROM questions WHERE id=576').get()
let cur = String(row.solution)
// 截断到（3）段末尾（「=0.2\,\text{s}。」之后的所有内容都丢弃，含损坏尾部）
const anchor = '第一次到达波峰所需时间为 $t=\\dfrac{T}{4}=\\dfrac{0.8}{4}\\,\\text{s}=0.2\\,\\text{s}$。'
const idx = cur.indexOf(anchor)
if (idx < 0) { console.error('未找到（3）段锚点'); process.exit(1) }
const rebuilt = cur.slice(0, idx + anchor.length) + '\n' + SOL4 + '\n'
db.prepare('UPDATE questions SET solution=? WHERE id=576').run(rebuilt)
const back = String(db.prepare('SELECT solution FROM questions WHERE id=576').get().solution)
console.log('--- 新（4）段 ---')
console.log(back.slice(back.indexOf('（4）')))
// 校验无制表符/回车损坏
const bad = /[\t\r]/.test(back) || back.includes(',\\text') === false
console.log('含tab/回车损坏:', /[\t\r]/.test(back))
