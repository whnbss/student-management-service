// 一次性脚本：按验收 #67 催办修 P1-110——#713（等量异种电荷，计算 D3）两处缺陷。
// 缺陷①（数值）：第（2）问 r₂=√(0.40²+0.15²)≈0.427 m，单个电荷场强 kQ/r₂²=360/0.1825≈1.97×10³ N/C，
//   解析误写 1.97×10⁴（数量级错 10 倍），导致答案 E_P=2×1.97×10³×0.351≈1.4×10³ 误写为 1.4×10⁴。
//   独立复算：kQ/r₂²=1972.6 → 1.97×10³；E_P=2×1972.6×0.3511≈1385 → 1.4×10³ N/C。
//   修法：解析 1.97e4→1.97e3（3 处）、1.4e4→1.4e3（1 处）；答案 1.4e4→1.4e3（1 处）。
//   第（1）问 1.6×10⁴ / 3.2×10⁴ 数值正确（r₁=0.15 m，kQ/r₁²=1.6×10⁴，E_O=3.2×10⁴），保持不动。
// 缺陷②（图题不符）：原图渲染为单个「+q 点电荷场」放射线，而题面是 A(+)/B(−) 等量异种电荷。
//   重画：两电荷+连线+中垂线+O/P 点+虚线 AP/BP+E_A′/E_B′ 分矢量+E_P 合矢量（水平向右）+θ 角+d/h 尺寸标注。
//   图内只标符号与题干已知量（d=0.30 m、h=0.40 m），不出现任何答案数值（1.97/1.4×10³/3.2×10⁴ 等）。
// 用法：node scripts/fix-accept67.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const FONT = "system-ui,'Microsoft YaHei',sans-serif"
const get = db.prepare('SELECT id, stem, answer, solution, pitfall, qtype, figure FROM questions WHERE id=?')
const q = get.get(713)
if (!q) throw new Error('#713 不存在')

const E197_OLD = '1.97\\times10^{4}', E197_NEW = '1.97\\times10^{3}'
const E14_OLD = '1.4\\times10^{4}', E14_NEW = '1.4\\times10^{3}'

// 幂等保护：数值与新图均已生效则跳过
if (!process.argv.includes('--force') &&
  !q.solution.includes(E197_OLD) && !q.solution.includes(E14_OLD) && !q.answer.includes(E14_OLD) &&
  q.figure && q.figure.includes('>θ<')) {
  console.log('#713 已修正，跳过（幂等）')
  process.exit(0)
}

// ---------- 前置断言：锚点 ----------
if (q.qtype !== '计算') throw new Error('#713 题型应为「计算」，中止')
for (const s of ['Q_A=+4.0\\times10^{-8}', 'Q_B=-4.0\\times10^{-8}', 'd=0.30\\ \\text{m}', 'h=0.40\\ \\text{m}'])
  if (!q.stem.includes(s)) throw new Error(`#713 题干锚点缺失「${s}」，中止`)
const cnt = (s, sub) => s.split(sub).length - 1
// 待修数值必须恰好出现：解析 1.97e4×3、1.4e4×1；答案 1.4e4×1
if (cnt(q.solution, E197_OLD) !== 3) throw new Error(`#713 解析中 ${E197_OLD} 出现 ${cnt(q.solution, E197_OLD)} 次（预期 3），中止`)
if (cnt(q.solution, E14_OLD) !== 1) throw new Error(`#713 解析中 ${E14_OLD} 出现 ${cnt(q.solution, E14_OLD)} 次（预期 1），中止`)
if (cnt(q.answer, E14_OLD) !== 1) throw new Error(`#713 答案中 ${E14_OLD} 出现 ${cnt(q.answer, E14_OLD)} 次（预期 1），中止`)
// 第（1）问正确数值锚点（替换不应波及）
if (cnt(q.solution, '1.6\\times10^{4}') !== 2 || cnt(q.solution, '3.2\\times10^{4}') !== 1 || cnt(q.answer, '3.2\\times10^{4}') !== 1)
  throw new Error('#713 第（1）问数值锚点不匹配，中止')
// 旧图必须是验收指出的「点电荷场」错误图
if (!q.figure) throw new Error('#713 预期有旧配图，中止')
const oldFig = JSON.parse(q.figure)
if (oldFig.kind !== 'svg') throw new Error('#713 旧配图应为 svg，中止')
if (!oldFig.data.includes('>点电荷场<') || !oldFig.data.includes('>+q<'))
  throw new Error('#713 旧图锚点缺失（非单个 +q 点电荷场图），中止')

// ---------- 数值修复（仅解析/答案，pitfall 的 r₂≈0.427 m 本就正确） ----------
const solution = q.solution.split(E197_OLD).join(E197_NEW).split(E14_OLD).join(E14_NEW)
const answer = q.answer.split(E14_OLD).join(E14_NEW)

// ---------- 重画配图：等量异种电荷 ----------
// 比例尺 500 px/m：d=0.30 m → 150px，h=0.40 m → 200px
const AX = 60, BX = 210, LY = 330        // A、B 在 y=330 水平线上，d=150px
const OX = (AX + BX) / 2                 // O=(135,330) 中点
const PY = LY - 200                      // P=(135,130)，OP=h=200px
const PX = OX
const r2px = Math.hypot(PX - AX, PY - LY)              // ≈213.6
const u1 = [(PX - AX) / r2px, (PY - LY) / r2px]        // A→P 方向单位向量（E_A′ 方向，背离 A）
const u2 = [(BX - PX) / r2px, (LY - PY) / r2px]        // P→B 方向单位向量（E_B′ 方向，指向 B）
const cosT = (PX - AX) / r2px                          // ≈0.351（cosθ=(d/2)/r₂）

// 箭头（起点微移避开圆点）
const arrow = (sx, sy, dx, dy, color, w) => {
  const len = Math.hypot(dx - sx, dy - sy)
  const ux = (dx - sx) / len, uy = (dy - sy) / len
  const hx = dx, hy = dy
  const bx = dx - 9 * ux, by = dy - 9 * uy
  const px = -uy, py = ux
  return [
    `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`,
    `<polygon points="${hx.toFixed(1)},${hy.toFixed(1)} ${(bx + 4.5 * px).toFixed(1)},${(by + 4.5 * py).toFixed(1)} ${(bx - 4.5 * px).toFixed(1)},${(by - 4.5 * py).toFixed(1)}" fill="${color}"/>`,
  ].join('')
}
// 下标符号文本（E + tspan 下标 + ′）
const subText = (x, y, main, sub, tail, color, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-size="14" fill="${color}" text-anchor="${anchor}" font-family="${FONT}" font-style="italic">${main}<tspan font-size="10" dy="3" font-style="normal">${sub}</tspan><tspan dy="-3">${tail}</tspan></text>`

const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 410" width="420" height="410" style="max-width:100%;height:auto">',
  '<rect x="0" y="0" width="420" height="410" fill="none"/>',
  // A–B 连线
  `<line x1="${AX}" y1="${LY}" x2="${BX}" y2="${LY}" stroke="#475569" stroke-width="2"/>`,
  // 中垂线（过 O、P，竖直虚线）
  `<line x1="${OX}" y1="98" x2="${OX}" y2="${LY + 14}" stroke="#64748b" stroke-width="1.3" stroke-dasharray="6 4"/>`,
  // 虚线 AP / BP（构造线）
  `<line x1="${AX}" y1="${LY}" x2="${PX}" y2="${PY}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>`,
  `<line x1="${BX}" y1="${LY}" x2="${PX}" y2="${PY}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>`,
  // P 点场强矢量：E_A′（沿 AP 背离 A）、E_B′（沿 P→B 指向 B）
  arrow(PX + 7 * u1[0], PY + 7 * u1[1], PX + 7 * u1[0] + 42 * u1[0], PY + 7 * u1[1] + 42 * u1[1], '#2563eb', 2.4),
  arrow(PX + 7 * u2[0], PY + 7 * u2[1], PX + 7 * u2[0] + 42 * u2[0], PY + 7 * u2[1] + 42 * u2[1], '#7c3aed', 2.4),
  // E_P 合矢量：水平向右（沿连线由 A 指向 B）
  arrow(PX + 6, PY, PX + 74, PY, '#ef4444', 3),
  // θ 角标记：E_A′ 与连线方向（水平）的夹角，r=34 圆弧
  `<path d="M ${(PX + 34).toFixed(1)} ${PY} A 34 34 0 0 0 ${(PX + 34 * cosT).toFixed(1)} ${(PY - 34 * Math.sqrt(1 - cosT * cosT)).toFixed(1)}" fill="none" stroke="#475569" stroke-width="1.3"/>`,
  `<text x="${(PX + 44 * Math.cos(0.3)).toFixed(1)}" y="${(PY - 44 * Math.sin(0.3) + 4).toFixed(1)}" font-size="13" fill="#475569" font-style="italic" font-family="${FONT}">θ</text>`,
  // 电荷：A（+，红）/ B（−，蓝）
  `<circle cx="${AX}" cy="${LY}" r="15" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>`,
  `<text x="${AX}" y="${LY + 5}" font-size="13" fill="#b91c1c" text-anchor="middle" font-weight="bold" font-family="${FONT}">A</text>`,
  `<circle cx="${BX}" cy="${LY}" r="15" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>`,
  `<text x="${BX}" y="${LY + 5}" font-size="13" fill="#1d4ed8" text-anchor="middle" font-weight="bold" font-family="${FONT}">B</text>`,
  // O / P 点与标注
  `<circle cx="${OX}" cy="${LY}" r="3" fill="#334155"/>`,
  `<text x="${OX}" y="${LY + 26}" font-size="13" fill="#334155" text-anchor="middle" font-family="${FONT}">O</text>`,
  `<circle cx="${PX}" cy="${PY}" r="3" fill="#334155"/>`,
  `<text x="${PX - 10}" y="${PY + 5}" font-size="13" fill="#334155" text-anchor="end" font-style="italic" font-family="${FONT}">P</text>`,
  // 矢量符号标注
  subText(PX + 16, PY - 48, 'E', 'A', '′', '#2563eb'),
  subText(PX + 16, PY + 56, 'E', 'B', '′', '#7c3aed'),
  subText(PX + 80, PY + 4, 'E', 'P', '', '#ef4444'),
  // h 尺寸标注（题干已知量，白底压在中垂线上）
  `<rect x="97" y="264" width="76" height="20" rx="3" fill="#ffffff" opacity="0.92"/>`,
  `<text x="135" y="278" font-size="12" fill="#334155" text-anchor="middle" font-family="${FONT}">h=0.40 m</text>`,
  // 电荷符号（+ / −）标注在电荷外侧
  `<text x="${AX - 24}" y="${LY + 5}" font-size="16" fill="#ef4444" text-anchor="middle" font-weight="bold" font-family="${FONT}">+</text>`,
  `<text x="${BX + 24}" y="${LY + 5}" font-size="16" fill="#2563eb" text-anchor="middle" font-weight="bold" font-family="${FONT}">−</text>`,
  // d 尺寸线（题干已知量）
  `<line x1="${AX}" y1="378" x2="${BX}" y2="378" stroke="#64748b" stroke-width="1.2"/>`,
  `<polygon points="${AX},378 ${AX + 8},374.5 ${AX + 8},381.5" fill="#64748b"/>`,
  `<polygon points="${BX},378 ${BX - 8},374.5 ${BX - 8},381.5" fill="#64748b"/>`,
  `<line x1="${AX}" y1="352" x2="${AX}" y2="382" stroke="#94a3b8" stroke-width="0.8"/>`,
  `<line x1="${BX}" y1="352" x2="${BX}" y2="382" stroke="#94a3b8" stroke-width="0.8"/>`,
  `<text x="135" y="398" font-size="12" fill="#334155" text-anchor="middle" font-family="${FONT}">d=0.30 m</text>`,
  '</svg>',
].join('')

// ---------- 断言 ----------
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
const asserts = [
  // 数值修复：新值在位、旧值清零、第（1）问数值未动
  [cnt(solution, E197_NEW) === 3 && cnt(solution, E14_NEW) === 1, '解析新数值数量不对'],
  [cnt(answer, E14_NEW) === 1, '答案新数值数量不对'],
  [!solution.includes(E197_OLD) && !solution.includes(E14_OLD) && !answer.includes(E14_OLD), '旧错误数值仍残留'],
  [cnt(solution, '1.6\\times10^{4}') === 2 && cnt(solution, '3.2\\times10^{4}') === 1 && cnt(answer, '3.2\\times10^{4}') === 1, '第（1）问正确数值被波及'],
  [cnt(solution, '0.351') === 2 && cnt(solution, '0.427') === 2, 'cosθ/r₂ 中间量应保持'],
  // 独立复算校验新数值
  [Math.abs(9.0e9 * 4.0e-8 / 0.1825 - 1972.6) < 1, 'E′ 独立复算≠1972.6'],
  [Math.abs(2 * 9.0e9 * 4.0e-8 / 0.1825 * (0.15 / Math.sqrt(0.1825)) - 1385.3) < 1, 'E_P 独立复算≠1385'],
  // 图几何：O 为中点、P 在中垂线上、PA=PB、h/d 比例正确
  [OX === (AX + BX) / 2 && PX === OX, 'O 应为中点且 P 在中垂线上'],
  [Math.abs(dist(PX, PY, AX, LY) - dist(PX, PY, BX, LY)) < 1e-9, 'PA≠PB'],
  [Math.abs(LY - PY - 200) < 1e-9, 'h 应=200px（0.40m×500px/m）'],
  [Math.abs(BX - AX - 150) < 1e-9, 'd 应=150px（0.30m×500px/m）'],
  [Math.abs(cosT - 0.351) < 0.001, `cosθ=${cosT.toFixed(4)} 应≈0.351`],
  // 图内容：标注齐全、旧图清除、无答案数值泄露
  [svg.includes('>A<') && svg.includes('>B<') && svg.includes('>O<') && svg.includes('>P<'), 'A/B/O/P 标注缺失'],
  [svg.includes('>θ<') && svg.includes('>h=0.40 m<') && svg.includes('>d=0.30 m<'), 'θ/h/d 标注缺失'],
  [svg.includes('>+<') && svg.includes('>−<'), '电荷符号 +/− 缺失'],
  [/E<tspan font-size="10" dy="3" font-style="normal">A<\/tspan>/.test(svg) && /E<tspan font-size="10" dy="3" font-style="normal">B<\/tspan>/.test(svg) && /E<tspan font-size="10" dy="3" font-style="normal">P<\/tspan>/.test(svg), 'E_A′/E_B′/E_P 符号缺失'],
  [!svg.includes('>点电荷场<') && !svg.includes('>+q<'), '旧图「点电荷场」残留'],
  [!svg.includes('NaN') && !svg.includes('undefined'), '渲染含 NaN/undefined'],
  // 防答案泄露：图内不得出现任何场强数值（1.97/1.4/3.2×10ⁿ）
  [!/1\.97/.test(svg) && !/1\.4×10/.test(svg) && !/3\.2/.test(svg) && !/10\^\{-?\d/.test(svg) && !/×10/.test(svg.replace('>d=0.30 m<', '').replace('>h=0.40 m<', '')), '图中出现场强数值（疑似泄露答案）'],
  // E_P 合矢量必须水平向右（方向=连线 A→B）：箭头尖端在 (PX+74, PY) 且与 P 同高
  [svg.includes(`points="${(PX + 74).toFixed(1)},${PY}.0 `) && svg.includes(`y2="${PY}.0"`), 'E_P 应为水平向右箭头'],
  // pitfall 不变且其 r₂≈0.427 表述与修复一致
  [q.pitfall.includes('0.427'), 'pitfall r₂ 中间量锚点缺失'],
]
for (const [ok, msg] of asserts) if (!ok) throw new Error(`#713 断言失败：${msg}`)

// ---------- 写库 + 回读（只改 solution/answer/figure，stem/pitfall 不动） ----------
const figJson = JSON.stringify({ kind: 'svg', data: svg })
if (!DRY) {
  db.prepare('UPDATE questions SET solution=?, answer=?, figure=? WHERE id=713').run(solution, answer, figJson)
  const back = get.get(713)
  if (back.stem !== q.stem) throw new Error('#713 题干不应变化')
  if (back.pitfall !== q.pitfall) throw new Error('#713 pitfall 不应变化')
  if (back.solution !== solution || back.answer !== answer) throw new Error('#713 解析/答案回读不一致')
  if (JSON.parse(back.figure).data !== svg) throw new Error('#713 配图回读不一致')
  console.log('#713 已写库并回读一致（solution/answer/figure 三字段）：1.97e4→1.97e3×3、1.4e4→1.4e3×2（解析+答案）、配图重画为等量异种电荷场')
} else {
  console.log('#713 dry-run 断言全过，未写库')
}
