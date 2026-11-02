// 一次性脚本：按验收 #62 催办修 P2-108——#615（卫星变轨，计算 D3）配图图题不符。
// 原图缺陷：仅单个椭圆、地球画在椭圆几何中心（应为焦点）、错标「r=3m」（题干为 a=3R）、卫星悬在椭圆内部不在轨道上。
// 重画三轨道变轨图（比例尺 30px = 1R）：
//   - 轨道Ⅰ：内圆 r₁=2R=60px（实线）
//   - 轨道Ⅱ：椭圆 a=3R=90px，地球置左焦点（c=R=30px），近地点 2R / 远地点 4R
//   - 轨道Ⅲ：外圆 r₂=4R=120px（虚线）
//   - 卫星画在轨道Ⅰ加速点（=椭圆近地点），带「加速」箭头（沿切线方向）
//   - 标注 r₁ / a=3R / r₂ / 远地点（均在题干中已给出，不泄露 v/T/E/W 等答案）
// 用法：node scripts/fix-accept62.mjs [--dry-run]
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

const q = get.get(615)
if (!q) throw new Error('#615 不存在')

// 幂等保护：已重画（含「远地点」标注的三轨道图）则跳过（--force 可强制重写）
if (!process.argv.includes('--force') && q.figure && q.figure.includes('>远地点<')) {
  console.log('#615 已重画，跳过（幂等）')
  process.exit(0)
}

// ---------- 前置断言：旧行为锚点（确认当前是验收指出的错误图） ----------
if (!q.figure) throw new Error('#615 预期有旧配图，中止')
const oldFig = JSON.parse(q.figure)
if (!oldFig.data.includes('>地球<')) throw new Error('#615 旧图锚点缺失（无地球），中止')
if (q.qtype !== '计算') throw new Error('#615 题型应为「计算」，中止')
if (!q.stem.includes('r_1=2R') || !q.stem.includes('a=3R') || !q.stem.includes('r_2=4R'))
  throw new Error('#615 题干未匹配 r_1=2R / a=3R / r_2=4R 锚点，中止')
if (!q.answer.includes('E_1<E_2<E_3') || !q.answer.includes('W=\\dfrac{mgR}{12}'))
  throw new Error('#615 答案锚点不匹配，中止（本脚本只补图不动答案）')

// ---------- 三轨道几何（比例尺 R = 30px） ----------
// 地球（焦点）F=(150,150)；椭圆中心 O=(F.x+R, F.y)=(180,150)，c=R=30px
// r₁=2R=60px、a=3R=90px、r₂=4R=120px；b=√(a²−c²)=√7200≈84.85px
const R_PX = 30
const FX = 150, FY = 150            // 地球（左焦点）
const OX = FX + R_PX                // 椭圆中心 x = 180（≠地球 x，焦点不在中心）
const R1 = 2 * R_PX                 // 60
const R2 = 4 * R_PX                 // 120
const A = 3 * R_PX                  // 90
const C = R_PX                      // 30
const B = Math.sqrt(A * A - C * C)  // ≈84.85
const PERI_X = OX - A               // 近地点 x = 90（=轨道Ⅰ与椭圆左交点，加速点）
const APO_X = OX + A                // 远地点 x = 270（=轨道Ⅲ与椭圆右交点）

const satellite = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="7" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"/>`

const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 300" width="440" height="300" style="max-width:100%;height:auto">',
  '<rect x="0" y="0" width="440" height="290" fill="none"/>',
  // 轨道Ⅲ：外圆 r₂=4R（虚线）
  `<circle cx="${FX}" cy="${FY}" r="${R2}" fill="none" stroke="#9333ea" stroke-width="2" stroke-dasharray="7 5"/>`,
  // 轨道Ⅱ：转移椭圆 a=3R，地球在左焦点（中心 O 与地球错开 c=R）
  `<ellipse cx="${OX}" cy="${FY}" rx="${A}" ry="${B.toFixed(2)}" fill="none" stroke="#4f46e5" stroke-width="2" stroke-dasharray="6 4"/>`,
  // 轨道Ⅰ：内圆 r₁=2R（实线）
  `<circle cx="${FX}" cy="${FY}" r="${R1}" fill="none" stroke="#2563eb" stroke-width="2.2"/>`,
  // 地球（左焦点）
  `<circle cx="${FX}" cy="${FY}" r="16" fill="#fde68a" stroke="#334155" stroke-width="2"/>`,
  `<text x="${FX}" y="${FY + 5}" font-size="12" fill="#334155" text-anchor="middle" font-family="${FONT}">地球</text>`,
  // 卫星：画在轨道Ⅰ加速点（=椭圆近地点，在轨道上）
  satellite(PERI_X, FY),
  `<text x="78" y="${FY + 30}" font-size="12" fill="#7f1d1d" text-anchor="middle" font-family="${FONT}">卫星</text>`,
  // 加速箭头：沿切线方向（近地点处切线竖直）
  `<line x1="${PERI_X}" y1="${FY - 9}" x2="${PERI_X}" y2="${FY - 30}" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>`,
  `<polygon points="${PERI_X},${FY - 38} ${PERI_X - 4.6},${FY - 28} ${PERI_X + 4.6},${FY - 28}" fill="#ef4444"/>`,
  `<text x="82" y="${FY - 32}" font-size="12" fill="#ef4444" text-anchor="end" font-family="${FONT}">加速</text>`,
  // 半径/半长轴标注线
  `<line x1="${FX}" y1="${FY}" x2="${PERI_X}" y2="${FY}" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 3"/>`,
  `<line x1="${FX}" y1="${FY}" x2="${APO_X}" y2="${FY}" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 3"/>`,
  `<text x="120" y="${FY + 18}" font-size="13" fill="#334155" text-anchor="middle" font-family="${FONT}">r₁=2R</text>`,
  `<text x="240" y="${FY - 6}" font-size="13" fill="#334155" text-anchor="middle" font-family="${FONT}">r₂=4R</text>`,
  // 远地点标注（轨道Ⅱ远地点 = 轨道Ⅲ上的点）
  `<text x="${APO_X + 10}" y="${FY + 4}" font-size="12" fill="#4f46e5" font-family="${FONT}">远地点</text>`,
  // 三条轨道名称（含题干已给参数）
  `<text x="${FX}" y="${FY - R2 - 10}" font-size="12" fill="#9333ea" text-anchor="middle" font-family="${FONT}">轨道Ⅲ（r₂=4R）</text>`,
  `<text x="250" y="70" font-size="12" fill="#4f46e5" font-family="${FONT}">轨道Ⅱ（a=3R）</text>`,
  `<line x1="246" y1="74" x2="${(OX + A * Math.SQRT1_2).toFixed(1)}" y2="${(FY - B * Math.SQRT1_2).toFixed(1)}" stroke="#4f46e5" stroke-width="1" stroke-dasharray="3 3"/>`,
  `<text x="${FX}" y="${FY - 38}" font-size="12" fill="#2563eb" text-anchor="middle" font-family="${FONT}">轨道Ⅰ</text>`,
  '</svg>',
].join('')

// ---------- 几何与内容断言 ----------
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
const asserts = [
  [!svg.includes('NaN') && !svg.includes('undefined'), '渲染含 NaN/undefined'],
  // 焦点修正：地球不在椭圆几何中心（验收指出的概念性错误）
  [Math.abs(FX - OX) === C && C === R_PX, `地球应在焦点：|地球x−椭圆中心x|=${Math.abs(FX - OX)} 应= c=R=${R_PX}px`],
  // 近地点在轨道Ⅰ上：地心距 = 2R
  [Math.abs(dist(FX, FY, PERI_X, FY) - R1) < 0.01, `近地点地心距 ${dist(FX, FY, PERI_X, FY)} 应= r₁=${R1}px`],
  // 远地点在轨道Ⅲ上：地心距 = 4R
  [Math.abs(dist(FX, FY, APO_X, FY) - R2) < 0.01, `远地点地心距 ${dist(FX, FY, APO_X, FY)} 应= r₂=${R2}px`],
  // 椭圆 b 与 a、c 自洽
  [Math.abs(B * B - (A * A - C * C)) < 1e-9, '椭圆 ry 与 a²−c² 不自洽'],
  // 卫星画在轨道Ⅰ加速点（近地点），不在椭圆内部悬空
  [svg.includes(`cx="${PERI_X}" cy="${FY}" r="7"`), '卫星应画在近地点（轨道Ⅰ加速点）'],
  // 标注齐全：三轨道 / r₁ / r₂ / a=3R / 远地点 / 加速 / 卫星
  [['>轨道Ⅰ<', '>轨道Ⅱ（a=3R）<', '>轨道Ⅲ（r₂=4R）<', '>r₁=2R<', '>r₂=4R<', '>远地点<', '>加速<', '>卫星<']
    .every((t) => svg.includes(t)), '标注缺失：轨道/r₁/r₂/远地点/加速/卫星'],
  // 不得再出现旧图错标「r=3m」（m 是卫星质量符号，量纲冲突）
  [!svg.includes('r=3m'), '仍含旧错标 r=3m'],
  // 不泄露答案：图中不得出现 v/T/E/W 的公式或结论（√、π、E₁ 等）
  [!/[√π]/.test(svg), '图中出现公式符号（疑似泄露答案）'],
  [!svg.includes('E₁') && !svg.includes('E_1') && !svg.includes('W='), '图中出现能量/功结论（疑似泄露答案）'],
  // 答案保持不变
  [q.answer.includes('E_1<E_2<E_3') && q.answer.includes('mgR}{12'), '答案应保持不变'],
]
for (const [ok, msg] of asserts) if (!ok) throw new Error(`#615 断言失败：${msg}`)

// ---------- 写库 + 回读（只改 figure，不动 stem/answer/solution） ----------
const figJson = JSON.stringify({ kind: 'svg', data: svg })
if (!DRY) {
  db.prepare('UPDATE questions SET figure=? WHERE id=615').run(figJson)
  const back = get.get(615)
  if (back.answer !== q.answer) throw new Error('#615 答案回读不一致')
  if (JSON.parse(back.figure).data !== svg) throw new Error('#615 配图回读不一致')
  console.log('#615 已写库并回读一致（仅 figure 字段）')
} else {
  console.log('#615 dry-run 断言全过，未写库')
}
