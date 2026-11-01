// P1-96（验收 #55 专项④补图时独立复算发现）：#294 答案缺 B——
// 船头垂直河岸：t=d/v₁=60/4=15s（恰为选项 B 的值，解析自己算出 15s 却写「B 错误」，
// 自相矛盾），偏移 x=v₂t=3×15=45m（C 也正确）；实际速度 √(4²+3²)=5m/s（A 错）、
// 渡河时间与水速无关（D 错）。原 answer=C 漏了 B，本题应为多选 BC。
// 修法：answer C→BC + 解析 B 行改「正确」+ 末尾补「故选 BC」；题干/选项/配图不动。
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')

const q = db.prepare('SELECT stem, answer, solution FROM questions WHERE id=294').get()
if (!q) { console.error('未找到 #294'); process.exit(1) }
if (q.answer === 'BC') { console.log('#294 已是修复后版本，跳过（幂等）'); db.close(); process.exit(0) }

// 独立复算：t=d/v₁=15s，x=v₂·t=45m，v=5m/s
const d = 60, v1 = 4, v2 = 3
const t = d / v1, x = v2 * t, v = Math.hypot(v1, v2)
if (t !== 15 || x !== 45 || v !== 5) { console.error(`复算失败：t=${t}, x=${x}, v=${v}`); process.exit(1) }
console.log('复算通过：t=15s（B ✓）、x=45m（C ✓）、v=5m/s（A ✗）、D ✗ → 答案应为 BC')

const NEW_SOLUTION = [
  '小船船头垂直河岸，实际速度是船速与水流速度的矢量和，两者互相垂直，故实际速度大小 $v=\\sqrt{v_1^2+v_2^2}=\\sqrt{4^2+3^2}\\,\\text{m/s}=5\\,\\text{m/s}$，A 错误。',
  '渡河时间由垂直河岸方向的分运动决定：$t=\\dfrac{d}{v_1}=\\dfrac{60}{4}\\,\\text{s}=15\\,\\text{s}$，B 正确。',
  '沿河岸方向偏移距离 $x=v_2 t=3\\times15\\,\\text{m}=45\\,\\text{m}$，C 正确。',
  '渡河时间只由河宽和垂直河岸的分速度决定，与水流速度无关，水流速度增大时渡河时间不变，D 错误。',
  '故选 BC（本题有两个正确选项）。',
].join('\n')

db.prepare('UPDATE questions SET answer=?, solution=? WHERE id=294').run('BC', NEW_SOLUTION)

const r = db.prepare('SELECT answer, solution FROM questions WHERE id=294').get()
if (r.answer !== 'BC' || !r.solution.includes('B 正确') || !r.solution.includes('故选 BC') || r.solution.includes('B 错误')) {
  console.error('回读断言失败'); process.exit(1)
}
console.log('#294 修复完成：answer C→BC，解析 B 行改正确+补故选 BC，题干/选项/配图未动')
db.close()
