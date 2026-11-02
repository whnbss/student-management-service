// 一次性脚本：按验收 #61 催办修 P2-107——#786（薄膜干涉，填空）应配图无图且不在豁免终稿 38 道。
// 画楔形薄膜等厚干涉示意图：
//   - 竖直肥皂膜在重力下上薄下厚：前表面竖直、后表面微倾（楔角夸张画法，顶点在上方相接）
//   - 单色光（λ=600nm，题干已给）垂直于膜面水平入射（三支箭头）
//   - 等厚干涉条纹为水平且等间距（线性楔：Δd 恒定 ⇒ 条纹间距恒定），画 5 条水平红条纹
//   - 底部标注膜厚 d；全程只标符号不标数值（Δd/d/λ），防答案泄露（答案 200；暗）
// 用法：node scripts/fix-accept61.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const FONT = "system-ui,'Microsoft YaHei',sans-serif"
const get = db.prepare('SELECT stem, answer, qtype, figure FROM questions WHERE id=?')

const q = get.get(786)
if (!q) throw new Error('#786 不存在')

// 幂等保护：已配过图则跳过
if (q.figure && q.figure.includes('>等厚干涉条纹<')) {
  console.log('#786 已配图，跳过（幂等）')
  process.exit(0)
}

// ---------- 前置断言：旧行为锚点 ----------
if (q.figure) throw new Error('#786 预期为无图状态（figure 应为空），中止')
if (q.qtype !== '填空') throw new Error('#786 题型应为「填空」，中止')
if (!q.stem.includes('楔形薄膜') || !q.stem.includes('上薄下厚')) throw new Error('#786 题干未匹配「楔形薄膜/上薄下厚」锚点，中止')
if (!q.stem.includes('600') || !q.stem.includes('n=1.50')) throw new Error('#786 题干未匹配 λ=600nm / n=1.50 锚点，中止')
if (q.answer !== '200；暗') throw new Error('#786 答案锚点不匹配，中止（本脚本只补图不动答案）')

// ---------- 楔形几何 ----------
// 前表面竖直线 x=110（y:30→210）；后表面从顶点 (110,30) 倾斜到 (150,210)
// 厚度 w(y) = (y-30)/180*40，线性上薄下厚；条纹水平等间距（y=60/90/120/150/180，间距 30）
const Y0 = 30, Y1 = 210, X0 = 110, W_MAX = 40
const w = (y) => ((y - Y0) / (Y1 - Y0)) * W_MAX
const fringeYs = [60, 90, 120, 150, 180]

const fringeLine = (y) =>
  `<line x1="${X0}" y1="${y}" x2="${(X0 + w(y)).toFixed(1)}" y2="${y}" stroke="#ef4444" stroke-width="2.5"/>`
const lightArrow = (y) =>
  `<line x1="38" y1="${y}" x2="94" y2="${y}" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>` +
  `<polygon points="103,${y} 92,${y + 4.4} 92,${y - 4.4}" fill="#f59e0b"/>`

const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" width="480" height="240" style="max-width:100%;height:auto">',
  '<rect x="0" y="0" width="480" height="240" fill="none"/>',
  // 楔形膜体（前表面竖直、后表面倾斜，上薄下厚）
  `<polygon points="${X0},${Y0} ${X0},${Y1} ${X0 + W_MAX},${Y1}" fill="#bfdbfe" fill-opacity="0.75"/>`,
  `<line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}" stroke="#334155" stroke-width="2.5"/>`,
  `<line x1="${X0}" y1="${Y0}" x2="${X0 + W_MAX}" y2="${Y1}" stroke="#334155" stroke-width="2.5"/>`,
  `<text x="150" y="46" font-size="13" fill="#334155" font-family="${FONT}">肥皂膜（上薄下厚）</text>`,
  // 单色光垂直于膜面水平入射（三支箭头）
  lightArrow(75),
  lightArrow(125),
  lightArrow(175),
  `<text x="30" y="60" font-size="13" fill="#b45309" font-family="${FONT}">单色光 λ</text>`,
  `<text x="30" y="196" font-size="12" fill="#b45309" font-family="${FONT}">垂直照射</text>`,
  // 水平等厚干涉条纹（等间距）
  ...fringeYs.map(fringeLine),
  `<text x="236" y="126" font-size="13" fill="#ef4444" font-family="${FONT}">等厚干涉条纹</text>`,
  `<line x1="232" y1="122" x2="${(X0 + w(120) + 4).toFixed(1)}" y2="120" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="4 3"/>`,
  // 底部膜厚 d 标注（双箭头）
  '<line x1="110" y1="224" x2="150" y2="224" stroke="#64748b" stroke-width="1.5"/>',
  '<polygon points="110,224 117,220.4 117,227.6" fill="#64748b"/>',
  '<polygon points="150,224 143,220.4 143,227.6" fill="#64748b"/>',
  `<text x="163" y="228" font-size="13" fill="#334155" font-family="${FONT}">膜厚 d</text>`,
  '</svg>',
].join('')

// ---------- 几何与内容断言 ----------
const asserts = [
  [!svg.includes('NaN') && !svg.includes('undefined'), '渲染含 NaN/undefined'],
  [q.answer === '200；暗', '答案应保持 200；暗 不变'],
  // 楔形上薄下厚：顶点相接（w(30)=0），底部最厚 w(210)=40
  [Math.abs(w(30)) < 1e-9 && Math.abs(w(210) - 40) < 1e-9, '楔形应顶点相接、底部 40px'],
  // 条纹水平等间距
  [fringeYs.every((y, i) => i === 0 || y - fringeYs[i - 1] === 30), '条纹应等间距'],
  [fringeYs.every((y) => svg.includes(`x1="110" y1="${y}"`)) && svg.includes(`x1="110" y1="${Y0}"`), '条纹/楔形表面锚点缺失'],
  // 每条条纹长度随深度线性增长（等厚条纹画法自洽）
  [fringeYs.every((y, i) => i === 0 || Math.abs(w(y) - w(fringeYs[i - 1]) - (40 * 30) / 180) < 1e-9), '相邻条纹长度增量应恒定（线性楔）'],
  [svg.includes('>等厚干涉条纹<'), '条纹标注缺失'],
  [svg.includes('>单色光 λ<') && svg.includes('>膜厚 d<'), 'λ / d 标注缺失'],
  [svg.includes('fill-opacity="0.75"'), '楔形膜体填充缺失'],
  // 不泄露答案：全图不得出现数值答案（200nm 数值/亮暗结论）
  [!svg.replace('http://www.w3.org/2000/svg', '').includes('200'), '图中出现 200 数值（疑似泄露答案）'],
  [!svg.includes('暗') && !svg.includes('亮条'), '图中出现亮暗结论（疑似泄露答案）'],
]
for (const [ok, msg] of asserts) if (!ok) throw new Error(`#786 断言失败：${msg}`)

// ---------- 写库 + 回读（只改 figure，不动 stem/answer/solution） ----------
const figJson = JSON.stringify({ kind: 'svg', data: svg })
if (!DRY) {
  db.prepare('UPDATE questions SET figure=? WHERE id=786').run(figJson)
  const back = get.get(786)
  if (back.answer !== '200；暗') throw new Error('#786 答案回读不一致')
  if (JSON.parse(back.figure).data !== svg) throw new Error('#786 配图回读不一致')
  console.log('#786 已写库并回读一致（仅 figure 字段）')
} else {
  console.log('#786 dry-run 断言全过，未写库')
}
