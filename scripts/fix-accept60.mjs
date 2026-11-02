// 一次性脚本：按验收 #60 催办修 #891（P1-104 配图图题不符 + P3-105 题干衔接矛盾）
// ① P1-104：原图只有「传送带直线 + 向左红箭头 + 顺时针文字」，缺 (2)(3) 问必需的圆弧轨道 BCD/
//    圆心 O/θ=60°/最低点 D/D 右侧弹簧，且红箭头向左与「顺时针转动」矛盾、未标 v₀。
//    重画：传送带（双轮+上表面向右红箭头=顺时针）+ 物块 m（v₀=2m/s 向右）+ B 端接圆弧轨道
//    BCD（圆心 O、O–B 与竖直夹 60°、最低点 D）+ D 右侧水平面 + 轻弹簧 + 竖直墙。
//    几何按题干严格绘制：R=100px 代表 0.5m；B 在圆的下半周（O–B 与竖直向下夹 60°），
//    B、D 高度差 = R(1−cos60°) = 50px ↔ 0.25m，与解析 h=R(1−cosθ)=0.25m 一致。
// ② P3-105：题干「恰好沿切线方向进入轨道」与几何矛盾（B 处切线与水平夹 60°，水平速度不共线），
//    改为「平滑滑上……（衔接处无能量损失）」——解析本就按平滑衔接（机械能守恒）求解，数值不变。
// 用法：node scripts/fix-accept60.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const FONT = "system-ui,'Microsoft YaHei',sans-serif"
const get = db.prepare('SELECT stem, figure FROM questions WHERE id=?')

const q = get.get(891)
if (!q) throw new Error('#891 不存在')

// 幂等保护：已修过则跳过
if (q.stem.includes('平滑滑上光滑圆弧轨道') && q.figure?.includes('>弹簧<')) {
  console.log('#891 已是修复后版本，跳过（幂等）')
  process.exit(0)
}

// ---------- 前置断言：旧行为锚点 ----------
if (!q.stem.includes('恰好沿光滑圆弧轨道 $BCD$ 的切线方向进入轨道')) {
  throw new Error('#891 题干未匹配到旧「切线方向进入轨道」锚点，中止')
}
if (!q.figure || !JSON.parse(q.figure).data.includes('传送带顺时针转动')) {
  throw new Error('#891 未匹配到旧配图锚点，中止')
}

// ---------- ① 新配图（手绘组合图，几何自检见断言） ----------
const hatch = (x) => `<line x1="${x}" y1="180" x2="${x + 10}" y2="170" stroke="#94a3b8" stroke-width="1.5"/>`
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 220" width="480" height="220" style="max-width:100%;height:auto">',
  '<rect x="0" y="0" width="480" height="220" fill="none"/>',
  // 地面 + 斜纹
  '<line x1="30" y1="170" x2="462" y2="170" stroke="#334155" stroke-width="2"/>',
  [44, 84, 124, 164, 204, 244, 284, 336, 404, 436].map(hatch).join(''),
  // 传送带（上下带线 + 两端转轮 + 支腿）
  '<line x1="38" y1="120" x2="295" y2="120" stroke="#334155" stroke-width="2"/>',
  '<line x1="38" y1="140" x2="295" y2="140" stroke="#334155" stroke-width="2"/>',
  '<circle cx="48" cy="130" r="10" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>',
  '<circle cx="285" cy="130" r="10" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>',
  '<line x1="70" y1="140" x2="70" y2="170" stroke="#334155" stroke-width="2"/>',
  '<line x1="255" y1="140" x2="255" y2="170" stroke="#334155" stroke-width="2"/>',
  // 传送带方向箭头（带体内，指向右 = 上表面向右 = 顺时针）
  '<line x1="200" y1="130" x2="238" y2="130" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>',
  '<polygon points="247,130 237,134.4 237,125.6" fill="#ef4444"/>',
  `<text x="218" y="158" font-size="13" fill="#ef4444" text-anchor="middle" font-family="${FONT}">顺时针</text>`,
  // 物块 m 与 v₀ 箭头
  '<rect x="60" y="96" width="40" height="24" rx="4" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>',
  `<text x="80" y="113" font-size="14" fill="#334155" text-anchor="middle" font-family="${FONT}">m</text>`,
  '<line x1="102" y1="108" x2="146" y2="108" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>',
  '<polygon points="155,108 145,112.4 145,103.6" fill="#3b82f6"/>',
  `<text x="126" y="92" font-size="13" fill="#3b82f6" text-anchor="middle" font-family="${FONT}">v₀=2m/s</text>`,
  // A / B 端点
  `<text x="34" y="112" font-size="14" fill="#334155" text-anchor="middle" font-family="${FONT}">A</text>`,
  `<text x="300" y="110" font-size="14" fill="#334155" text-anchor="middle" font-family="${FONT}">B</text>`,
  // 圆弧轨道 BCD：圆心 O(390,70)、R=100px；B(303.4,120) 在下半圆、O–B 与竖直夹 60°；D(390,170) 为最低点
  '<path d="M 303.4 120 A 100 100 0 0 0 390 170" fill="none" stroke="#334155" stroke-width="2.5"/>',
  '<line x1="390" y1="70" x2="303.4" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>',
  '<line x1="390" y1="70" x2="390" y2="170" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>',
  '<path d="M 390 94 A 24 24 0 0 1 369.2 82" fill="none" stroke="#64748b" stroke-width="1.5"/>',
  `<text x="364" y="102" font-size="13" fill="#64748b" text-anchor="end" font-family="${FONT}">60°</text>`,
  `<text x="398" y="66" font-size="14" fill="#334155" text-anchor="start" font-family="${FONT}">O</text>`,
  `<text x="396" y="126" font-size="13" fill="#64748b" text-anchor="start" font-family="${FONT}">R</text>`,
  `<text x="390" y="190" font-size="14" fill="#334155" text-anchor="middle" font-family="${FONT}">D</text>`,
  // D 右侧轻弹簧 + 竖直墙
  '<line x1="458" y1="140" x2="458" y2="170" stroke="#334155" stroke-width="2"/>',
  '<polyline points="398,156 406,146 414,166 422,146 430,166 438,146 446,166 454,156" fill="none" stroke="#334155" stroke-width="2"/>',
  `<text x="426" y="192" font-size="13" fill="#334155" text-anchor="middle" font-family="${FONT}">弹簧</text>`,
  '</svg>',
].join('')

// ---------- 几何与内容断言 ----------
const asserts = [
  [svg.includes('x1="200" y1="130" x2="238" y2="130"'), '传送带红箭头应指向右（顺时针）'],
  [!svg.includes('NaN'), '渲染含 NaN'],
  [svg.includes('>顺时针<') && svg.includes('>v₀=2m/s<'), '顺时针 / v₀ 标注缺失'],
  [svg.includes('M 303.4 120 A 100 100 0 0 0 390 170'), '圆弧轨道 BCD 缺失'],
  [svg.includes('>60°<') && svg.includes('>O<') && svg.includes('>D<'), 'O / 60° / D 标注缺失'],
  [svg.includes('>弹簧<'), 'D 右侧弹簧缺失'],
  [svg.includes('>A<') && svg.includes('>B<') && svg.includes('>m<'), 'A / B / m 标注缺失'],
  // 几何自检：|OB|=100（R）、B–D 高度差 = R(1−cos60°) = 50px
  [Math.abs(Math.hypot(390 - 303.4, 70 - 120) - 100) < 0.5, 'OB 长度应=100px（R）'],
  [Math.abs((170 - 120) - 100 * (1 - Math.cos(Math.PI / 3))) < 0.5, 'B–D 高度差应=R(1−cos60°)=50px'],
]
for (const [ok, msg] of asserts) if (!ok) throw new Error(`#891 断言失败：${msg}`)

// ---------- ② 题干修正（P3-105） ----------
const stemNew = q.stem.replace(
  '物块从 $B$ 端水平离开传送带后，恰好沿光滑圆弧轨道 $BCD$ 的切线方向进入轨道。',
  '物块从 $B$ 端水平离开传送带后，平滑滑上光滑圆弧轨道 $BCD$（衔接处无能量损失）。',
)
if (stemNew === q.stem) throw new Error('#891 题干替换未命中，中止')
if (stemNew.includes('切线方向进入轨道')) throw new Error('#891 旧衔接表述残留')
if (!stemNew.includes('平滑滑上光滑圆弧轨道 $BCD$（衔接处无能量损失）')) throw new Error('#891 新衔接表述缺失')
if (!stemNew.includes('最终恰好能返回到 $D$ 点')) throw new Error('#891 (3) 问「恰好返回」误伤')

// ---------- 写库 + 回读 ----------
const figJson = JSON.stringify({ kind: 'svg', data: svg })
if (!DRY) {
  db.prepare('UPDATE questions SET stem=?, figure=? WHERE id=891').run(stemNew, figJson)
  const back = get.get(891)
  if (!back.stem.includes('平滑滑上光滑圆弧轨道')) throw new Error('#891 题干回读不一致')
  const backSvg = JSON.parse(back.figure).data
  if (backSvg !== svg) throw new Error('#891 配图回读不一致')
  console.log('#891 已写库并回读一致（题干 + 配图）')
} else {
  console.log('#891 dry-run 断言全过，未写库')
}
console.log('done')
db.close()
