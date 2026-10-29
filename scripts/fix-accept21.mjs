// 一次性脚本：验收 #21 P3-40 修复——四道被误标 D5 的常规计算题降档
// 依据（独立评估）：#640 平均加速度概念题（D2）/ #639 动车多阶段运动学（D3）/ #649 比结合能常规计算（D2）/ #650 裂变能量计算（D3）
// 「压轴=跨章综合/多对象/临界图像叠加」；这四题均为单对象单章常规计算，不构成压轴
// 防护同 fix-accept20.mjs：动态构建 SET，仅更新 patch 提供的字段
// 用法：node scripts/fix-accept21.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// [id, 新难度]：#640 平均加速度概念题→D2；#639 动车多阶段运动学→D3；#649 比结合能常规计算→D2；#650 裂变能量计算→D3
const updates = [
  [640, 2],
  [639, 3],
  [649, 2],
  [650, 3],
]

const get = db.prepare('SELECT id, difficulty, qtype FROM questions WHERE id = ?')

for (const [id, diff] of updates) {
  const cur = get.get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  console.log(`题 ${id}（${cur.qtype}）：D${cur.difficulty} → D${diff}${DRY ? ' [dry-run]' : ''}`)
  if (!DRY) db.prepare('UPDATE questions SET difficulty = ? WHERE id = ?').run(diff, id)
}
// 复查汇总
const rows = db.prepare('SELECT id, difficulty FROM questions WHERE id IN (639,640,649,650) ORDER BY id').all()
console.log('复查：', rows.map(r => `#${r.id}=D${r.difficulty}`).join(' '))
console.log(`完成${DRY ? ' [dry-run]' : ''}`)
