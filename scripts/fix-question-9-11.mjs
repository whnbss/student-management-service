// 一次性脚本：按用户确认的「推荐修正稿」修正题库 id=9 / id=11 两道题
// - 题 9：去掉矛盾的 α=53°（绳改为水平），钩码 3kg→2kg，使 T=μMg=20N=mg 自洽
// - 题 11：圆柱容器（两球不接触，弹力不存在）改为半球形碗经典原型（sinθ=r/(R−r)=0.5）
//   同步更新题干/答案/解析/易错点，并用新 bowl2balls 模板重绘配图
// - 配图为确定性模板渲染（不经 AI），数值与题干严格一致
// 用法：node scripts/fix-question-9-11.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../apps/web/src/lib/figure.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- 题 9：绳水平 + 钩码 2kg（自洽：T=μMg=20N=mg） ----------
const q9 = {
  stem: `质量 $M=5\\,\\mathrm{kg}$ 的物块放在水平桌面上，物块与桌面间动摩擦因数 $\\mu=0.4$。轻绳跨过桌沿的光滑定滑轮，一端水平连接物块，另一端竖直悬挂质量 $m=2\\,\\mathrm{kg}$ 的钩码。释放后物块恰好沿桌面匀速滑动。求绳的拉力大小及此时钩码的运动状态。（取 $g=10\\,\\mathrm{m/s^2}$）`,
  answer: `绳的拉力 $T=20\\,\\mathrm{N}$，钩码匀速下降`,
  solution: `物块恰好匀速滑动：对物块受力分析，竖直方向 $N=Mg=50\\,\\mathrm{N}$，水平方向绳拉力与滑动摩擦力平衡，$T=\\mu N=\\mu Mg=0.4\\times50=20\\,\\mathrm{N}$。
对钩码：钩码随绳匀速下降，由二力平衡 $T=mg=2\\times10=20\\,\\mathrm{N}$，与物块一侧求得的拉力一致，结果自洽。
故绳的拉力为 $20\\,\\mathrm{N}$，钩码恰好匀速下降。`,
  pitfall: `易把绳拉力直接当成钩码重力而跳过物块一侧的平衡条件；正确做法是两边分别列平衡式（物块侧 $T=\\mu Mg$、钩码侧 $T=mg$）并互相印证，本题数据下两者恰好相等。`,
  knowledge_points: JSON.stringify(['共点力平衡', '摩擦力']),
  figure_spec: { template: 'pulley', params: { label_m1: 'M=5kg', label_m2: 'm=2kg' } },
}

// ---------- 题 11：改为半球形碗经典原型（sinθ=r/(R−r)=0.5，θ=30°） ----------
const q11 = {
  stem: `两个相同的光滑小球（$m=1\\,\\mathrm{kg}$、$r=0.1\\,\\mathrm{m}$）放在内壁光滑的半球形碗中，碗半径 $R=0.3\\,\\mathrm{m}$，两球静止时球心连线水平且相互接触。求两球之间的弹力大小以及每个球对碗壁的压力大小。（取 $g=10\\,\\mathrm{m/s^2}$）`,
  answer: `两球之间的弹力 $\\dfrac{10}{\\sqrt{3}}\\,\\mathrm{N}\\approx 5.77\\,\\mathrm{N}$，每个球对碗壁的压力 $\\dfrac{20}{\\sqrt{3}}\\,\\mathrm{N}\\approx 11.5\\,\\mathrm{N}$`,
  solution: `两球位置对称，球心与碗心连线偏离竖直方向 $\\theta$，球心连线水平。几何关系（球心到碗心距离为 $R-r$）：$\\sin\\theta=\\dfrac{r}{R-r}=\\dfrac{0.1}{0.3-0.1}=0.5$，得 $\\theta=30^\\circ$。
对左球受力分析：重力 $mg$ 竖直向下、碗壁支持力 $N_1$ 沿半径指向碗心（与竖直方向夹角 $\\theta$）、右球弹力 $N_2$ 水平向左。
竖直方向平衡：$N_1\\cos\\theta=mg$，得 $N_1=\\dfrac{mg}{\\cos 30^\\circ}=\\dfrac{10}{\\sqrt3/2}=\\dfrac{20}{\\sqrt3}\\approx 11.5\\,\\mathrm{N}$。
水平方向平衡：$N_2=N_1\\sin\\theta=mg\\tan 30^\\circ=\\dfrac{10}{\\sqrt3}\\approx 5.77\\,\\mathrm{N}$。
由牛顿第三定律，每个球对碗壁的压力大小等于 $N_1\\approx 11.5\\,\\mathrm{N}$，方向沿半径指向碗外。`,
  pitfall: `易直接把 $\\sin\\theta$ 写成 $r/R$；正确几何是球心到碗心距离为 $R-r$，故 $\\sin\\theta=\\dfrac{r}{R-r}$。对碗壁的压力按牛顿第三定律等于碗壁支持力，方向沿半径指向碗外。`,
  knowledge_points: JSON.stringify(['共点力平衡', '几何关系']),
  figure_spec: { template: 'bowl2balls', params: { angle: 30, R: 0.3, r: 0.1, label1: 'm', label2: 'm' } },
}

const upd = db.prepare('UPDATE questions SET stem=?, answer=?, solution=?, pitfall=?, knowledge_points=?, figure=? WHERE id=?')

for (const [id, q] of [[9, q9], [11, q11]]) {
  const cur = db.prepare('SELECT id, stem, source FROM questions WHERE id = ?').get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  const svg = specToSvg(q.figure_spec)
  if (!svg) { console.log(`题 ${id} 配图渲染失败（模板 ${q.figure_spec.template}），中止以防脏数据`); process.exit(1) }
  const figure = JSON.stringify({ kind: 'svg', data: svg })
  if (DRY) {
    console.log(`[dry-run] 题 ${id}（source=${cur.source}，来源不动）：\n新题干：${q.stem}\n新答案：${q.answer}\n配图：${q.figure_spec.template} ${JSON.stringify(q.figure_spec.params)}（SVG ${svg.length} 字）\n`)
    continue
  }
  upd.run(q.stem, q.answer, q.solution, q.pitfall, q.knowledge_points, figure, id)
  console.log(`题 ${id} 已更新：题干/答案/解析/易错点/配图（${q.figure_spec.template}），source 保持 ${cur.source}`)
}
db.close()
