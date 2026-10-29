// 一次性脚本：第十四批补题（id 705~744）独立重解自验发现的缺陷修正
// 【内容缺陷】
// - #710 解析用「平衡稳定性」判电性——物理错误：两同号固定电荷之间异号/同号试探电荷的线内平衡都不稳定
//   （移向任一侧时近端力增大、远端力减小，均背离平衡位置），且平衡条件约去 |q_B| 后与电性、电量均无关 →
//   重写为「电性与电量均不能唯一确定」；(2) 问补充「若 B 带负电」前提（方向依赖电性）
// - #713 (2) 问解析用 r2≈0.425（精确值 √0.1825≈0.4272）且「17280/4913×10⁴」算错（实为 3.5e4），
//   正确答案 E_P=2E'cosθ=2×1972.6×0.3511≈1385≈1.4×10⁴ N/C（原答案 1.7×10⁴ 错）→ 重解重写
// - #715 选择题缺选项（同上批 #614 类缺陷）→ 按解析补齐 A~D（D 与解析结论一致）
// - #727 选择题缺选项，且解析「故 C 正确」与「本题为单选题，正确选项为 A」自相矛盾 → 补选项（C 改错误值）、
//   解析改「故 C 错误」、坑点重写
// - #729 数据不自洽：y=U₂L²/(4U₁d)=100×0.01/20=0.05 m ≠ d/2=0.01 m，与「恰好从边缘飞出」矛盾
//   （解析却声称「恰为板间距的一半，自洽」）→ U₂ 100 V 改 20 V：y=0.01 m ✓；重解 (3)：tanθ=0.2、
//   y'=Dtanθ=0.06 m、Y=y+y'=0.07 m（原答案 0.31 m 作废）
// - #741 答案与解析矛盾：答案写 n₃:n₄=215:11，解析末尾试错文字推出 22:1（4840/220=22 精确）且解析正文
//   「=215/11」为约分错误，并残留大段试错过程文字 → 答案改 22:1、解析重写干净并保留 I₃=20 A 校验
// - #738 解析为整段 AI 试错残稿（自己发现「圆轨迹不能到达 x 轴」后反复改数据，答案字段与解析最终数据不一致），
//   且核心物理错误：磁场消失后小球受重力+洛伦兹力「做匀速圆周运动」不成立（重力做功会改变速率），
//   另 r=mv/(qB)=2e-6×5.7e4/(1e-9×0.5)≈2.3×10⁸ m，与 0.23 m 差 9 个数量级 → 整题重写（数据重设计，见下方注释）
// - #737 单边界磁场几何全错：圆心应在边界另一侧（场区外），磁场内轨迹圆心角为 2θ（θ 为速度与边界夹角），
//   时间 t=2mθ/(qB)（原写 2m(π−θ)/(qB)：θ→0 时 t→T，擦边入射却绕一整圈，非物理）；
//   临界条件应为轨迹最大深度 R(1−cosθ)≤d（原用「圆心到场边界距离 Rsinθ、d−Rsinθ≥R」把圆心放进了场区）→
//   重解重写 (1)(3) 与坑点
// - #724 答案「C」漏选：解析明确推出 φB>φA（B 正确）且 C 正确 → 答案改「BC」
// - #719 题设极性矛盾：下极板接正极 → 电场竖直向上，带负电微粒受力向下，无法与重力平衡（解析却写
//   「电场竖直向下」）→ 改上极板接正极，全题自洽（E 向下、负微粒受力向上）
// 【配图模板错误】（同 #698/#574 教训：模板渲染成「匀强场区+q」通用图）
// - #716（匀强电场中的空心金属球：场线画成竖直、球上带 +q 与速度箭头）/ #724（电场线+等势面：配成匀强场区图，
//   题意描述被塞进一个 text 元素）/ #725（等势面 10/6/4 V）/ #726（偏转电场）/ #729（加速+偏转+屏）/
//   #732（平行导线）/ #736（坐标系+有界磁场）/ #737（单边界）/ #742（导轨+棒+R）→ 全部重画
// - #734 图中「水平向右的安培力 F」箭头沿斜面 30° 方向画（非水平），且缺竖直向上的 B → 重画
// 防护同 fix-accept20.mjs：动态构建 SET、仅更新 patch 字段
// 用法：node scripts/fix-accept24-batch14.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- SVG 辅助 ----------
const FONT = `font-family="system-ui,'Microsoft YaHei',sans-serif"`
function arrow(x1, y1, x2, y2, color = '#ef4444', w = 2.4) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
  const px = -uy, py = ux, s = 4.5
  return `<line x1="${x1}" y1="${y1}" x2="${(x2 - ux * s * 1.4).toFixed(1)}" y2="${(y2 - uy * s * 1.4).toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/><polygon points="${x2},${y2} ${(x2 - ux * s * 2 + px * s).toFixed(1)},${(y2 - uy * s * 2 + py * s).toFixed(1)} ${(x2 - ux * s * 2 - px * s).toFixed(1)},${(y2 - uy * s * 2 - py * s).toFixed(1)}" fill="${color}"/>`
}
const dot = (x, y, r = 3.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#334155"/>`
const text = (x, y, s, color = '#334155', size = 13, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" ${FONT}>${s}</text>`
const wrap = (inner, w = 400, h = 240) => JSON.stringify({ kind: 'svg', data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="max-width:100%;height:auto"><rect x="0" y="0" width="${w}" height="${h}" fill="none"/>` + inner + `</svg>` })
// ⊗ 符号（磁场垂直纸面向里）
const cross = (x, y, r = 8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.4"/><line x1="${x - r * 0.6}" y1="${y - r * 0.6}" x2="${x + r * 0.6}" y2="${y + r * 0.6}" stroke="#64748b" stroke-width="1.4"/><line x1="${x - r * 0.6}" y1="${y + r * 0.6}" x2="${x + r * 0.6}" y2="${y - r * 0.6}" stroke="#64748b" stroke-width="1.4"/>`

// #716：水平向右匀强电场 + 空心金属球（外球壳+内空腔）
const fig716 = wrap(
  [85, 107, 129, 151, 173].map((y) => arrow(40, y, 356, y, '#4f46e5', 1.8)).join('') +
  `<circle cx="200" cy="129" r="50" fill="#e2e8f0" stroke="#334155" stroke-width="2"/><circle cx="200" cy="129" r="22" fill="#ffffff" stroke="#334155" stroke-width="1.6"/>` +
  `<line x1="238" y1="92" x2="268" y2="64" stroke="#94a3b8" stroke-width="1.2"/>` + text(272, 60, '空心金属球', '#334155', 13, 'start') +
  text(360, 78, 'E', '#4f46e5', 14)
)

// #724：电场线（实线，右侧会聚、由 B 指向 A、A 处较密）+ 等势面（虚线圆弧）+ C、D 同一等势面
const fig724 = wrap((() => {
  const cx = 336, cy = 125
  let s = `<circle cx="${cx}" cy="${cy}" r="7" fill="#fecaca" stroke="#ef4444" stroke-width="1.8"/>` + text(cx + 2, cy + 5, '+', '#ef4444', 14)
  // 射线长度按画布裁剪（x∈[20,380]、y∈[20,230]）
  const angs = [180, 152, 208, 124, 236, 96, 264, 68, 292]
  for (const a of angs) {
    const rad = (a * Math.PI) / 180
    const sc = Math.abs(Math.cos(rad)), ss = Math.abs(Math.sin(rad))
    const L = Math.min(300, sc > 0.01 ? (cx - 20) / sc : 300, ss > 0.01 ? Math.min((cy - 20) / ss, (230 - cy) / ss) : 300)
    const ex = cx + L * Math.cos(rad), ey = cy - L * Math.sin(rad)
    s += arrow(cx + 10 * Math.cos(rad), cy - 10 * Math.sin(rad), ex, ey, '#4f46e5', 1.7)
  }
  // 等势面：半径 150 的虚线圆弧（数学角 140°~220°）
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const a = (140 + (80 * i) / 24) * (Math.PI / 180)
    pts.push(`${(cx + 150 * Math.cos(a)).toFixed(1)},${(cy - 150 * Math.sin(a)).toFixed(1)}`)
  }
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#64748b" stroke-width="1.6" stroke-dasharray="7 5"/>`
  s += dot(250, 125) + text(250, 145, 'A') + dot(108, 125) + text(108, 145, 'B')
  const cp = [160, 200].map((a) => { const rad = (a * Math.PI) / 180; return [cx + 150 * Math.cos(rad), cy - 150 * Math.sin(rad)] })
  s += dot(cp[0][0], cp[0][1], 3) + text(cp[0][0] - 18, cp[0][1] - 6, 'C') + dot(cp[1][0], cp[1][1], 3) + text(cp[1][0] - 18, cp[1][1] + 18, 'D')
  s += text(150, 228, '实线：电场线　虚线：等势面', '#64748b', 12)
  return s
})())

// #725：三个平行等势面（10 V / 6 V / 4 V），A、B、C 分别位于其上
const fig725 = wrap(
  [[120, '10 V'], [200, '6 V'], [280, '4 V']].map(([x, v]) =>
    `<line x1="${x}" y1="55" x2="${x}" y2="190" stroke="#64748b" stroke-width="1.6" stroke-dasharray="7 5"/>` + text(x, 46, v, '#334155', 13)
  ).join('') +
  dot(120, 150) + text(104, 155, 'A') + dot(200, 92) + text(214, 88, 'B') + dot(280, 148) + text(296, 154, 'C')
)

// #726：平行板偏转电场（板长 L、间距 d、电压 U），粒子沿中线射入做类平抛
const fig726 = wrap((() => {
  let s = ''
  s += `<rect x="110" y="70" width="220" height="6" fill="#334155"/><rect x="110" y="174" width="220" height="6" fill="#334155"/>`
  // 板长 L 标注
  s += `<line x1="110" y1="56" x2="330" y2="56" stroke="#64748b" stroke-width="1.2"/><line x1="110" y1="50" x2="110" y2="62" stroke="#64748b" stroke-width="1.2"/><line x1="330" y1="50" x2="330" y2="62" stroke="#64748b" stroke-width="1.2"/>` + text(220, 48, 'L')
  // 间距 d 标注
  s += `<line x1="342" y1="73" x2="342" y2="177" stroke="#64748b" stroke-width="1.2"/><line x1="336" y1="73" x2="348" y2="73" stroke="#64748b" stroke-width="1.2"/><line x1="336" y1="177" x2="348" y2="177" stroke="#64748b" stroke-width="1.2"/>` + text(354, 130, 'd', '#334155', 13, 'start')
  // 电压 U：两板引出接线
  s += `<line x1="110" y1="73" x2="86" y2="73" stroke="#334155" stroke-width="1.4"/><line x1="110" y1="177" x2="86" y2="177" stroke="#334155" stroke-width="1.4"/><line x1="86" y1="73" x2="86" y2="98" stroke="#334155" stroke-width="1.4"/><line x1="86" y1="152" x2="86" y2="177" stroke="#334155" stroke-width="1.4"/><line x1="80" y1="98" x2="92" y2="98" stroke="#334155" stroke-width="1.4"/><line x1="80" y1="152" x2="92" y2="152" stroke="#334155" stroke-width="1.4"/><line x1="82" y1="106" x2="90" y2="114" stroke="#334155" stroke-width="1.2"/><line x1="90" y1="106" x2="82" y2="114" stroke="#334155" stroke-width="1.2"/>` + text(70, 130, 'U')
  // 中线与类平抛轨迹（向下偏）
  s += `<line x1="40" y1="125" x2="110" y2="125" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`
  const traj = []
  for (let i = 0; i <= 30; i++) {
    const x = 60 + (270 * i) / 30
    const y = 125 + 16 * Math.pow((x - 60) / 270, 2) * (x > 110 ? 1 : 0)
    traj.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  s += `<polyline points="${traj.join(' ')}" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="6 4"/>`
  s += arrow(60, 125, 104, 125, '#ef4444', 2.2) + text(70, 114, 'v₀', '#ef4444', 13)
  return s
})())

// #729：加速电场（U₁）+ 偏转电场（U₂，板长 L、间距 d）+ 荧光屏（距离 D、屏中心 O）
const fig729 = wrap((() => {
  let s = ''
  // 加速区：两块竖直板
  s += `<line x1="70" y1="95" x2="70" y2="145" stroke="#334155" stroke-width="4"/><line x1="96" y1="95" x2="96" y2="145" stroke="#334155" stroke-width="4"/>` + text(83, 166, 'U₁', '#334155', 13)
  // 电子入射
  s += dot(42, 120, 3) + arrow(42, 120, 66, 120, '#ef4444', 2) + text(40, 108, 'e', '#ef4444', 12)
  // 中线
  s += `<line x1="96" y1="120" x2="322" y2="120" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`
  // 偏转板
  s += `<rect x="150" y="92" width="100" height="5" fill="#334155"/><rect x="150" y="143" width="100" height="5" fill="#334155"/>` + text(200, 84, 'U₂', '#334155', 13)
  s += `<line x1="150" y1="62" x2="250" y2="62" stroke="#64748b" stroke-width="1.1"/><line x1="150" y1="56" x2="150" y2="68" stroke="#64748b" stroke-width="1.1"/><line x1="250" y1="56" x2="250" y2="68" stroke="#64748b" stroke-width="1.1"/>` + text(200, 52, 'L')
  s += `<line x1="138" y1="92" x2="138" y2="148" stroke="#64748b" stroke-width="1.1"/><line x1="132" y1="92" x2="144" y2="92" stroke="#64748b" stroke-width="1.1"/><line x1="132" y1="148" x2="144" y2="148" stroke="#64748b" stroke-width="1.1"/>` + text(126, 124, 'd', '#334155', 13, 'end')
  // 轨迹：中线 → 板内下偏 → 出板后直线打到屏
  s += `<line x1="96" y1="120" x2="150" y2="120" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="5 4"/>`
  const tr = []
  for (let i = 0; i <= 20; i++) {
    const x = 150 + (100 * i) / 20
    const y = 120 + 21 * Math.pow((x - 150) / 100, 2)
    tr.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  s += `<polyline points="${tr.join(' ')}" fill="none" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="5 4"/>`
  s += `<line x1="250" y1="141" x2="322" y2="156" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="5 4"/>`
  // 荧光屏
  s += `<line x1="322" y1="45" x2="322" y2="195" stroke="#334155" stroke-width="3"/>` + dot(322, 120, 3) + text(334, 116, 'O', '#334155', 13, 'start')
  s += `<line x1="250" y1="208" x2="322" y2="208" stroke="#64748b" stroke-width="1.1"/><line x1="250" y1="202" x2="250" y2="214" stroke="#64748b" stroke-width="1.1"/><line x1="322" y1="202" x2="322" y2="214" stroke="#64748b" stroke-width="1.1"/>` + text(286, 224, 'D')
  return s
})())

// #732：两平行长直导线 a、b，通同向电流，间距 d
const fig732 = wrap(
  `<line x1="150" y1="55" x2="150" y2="185" stroke="#334155" stroke-width="3"/><line x1="250" y1="55" x2="250" y2="185" stroke="#334155" stroke-width="3"/>` +
  arrow(150, 100, 150, 74, '#ef4444', 2.2) + arrow(250, 100, 250, 74, '#ef4444', 2.2) +
  text(150, 46, 'a') + text(250, 46, 'b') + text(130, 108, 'Ia', '#ef4444', 12, 'end') + text(270, 108, 'Ib', '#ef4444', 12, 'start') +
  `<line x1="150" y1="200" x2="250" y2="200" stroke="#64748b" stroke-width="1.2"/><line x1="150" y1="194" x2="150" y2="206" stroke="#64748b" stroke-width="1.2"/><line x1="250" y1="194" x2="250" y2="206" stroke="#64748b" stroke-width="1.2"/>` + text(200, 218, 'd')
)

// #736：xOy 坐标系 + 磁场区 0<x<2L（垂直纸面向里）+ A(−L,0)、P(0,0)、v₀
const fig736 = wrap((() => {
  let s = ''
  s += `<rect x="150" y="34" width="140" height="170" fill="#eef2ff" opacity="0.55"/>` + text(220, 50, '匀强磁场（垂直纸面向里）', '#64748b', 11)
  s += cross(185, 90) + cross(255, 120) + cross(195, 160) + cross(265, 180)
  s += `<line x1="290" y1="34" x2="290" y2="204" stroke="#94a3b8" stroke-width="1.3" stroke-dasharray="6 4"/>` + text(302, 220, '2L', '#64748b', 12)
  // 坐标轴
  s += `<line x1="40" y1="160" x2="356" y2="160" stroke="#334155" stroke-width="1.8"/><polygon points="356,160 347,156 347,164" fill="#334155"/>`
  s += `<line x1="150" y1="214" x2="150" y2="28" stroke="#334155" stroke-width="1.8"/><polygon points="150,28 146,37 154,37" fill="#334155"/>`
  s += text(364, 174, 'x') + text(162, 34, 'y')
  s += dot(105, 160) + text(97, 178, 'A') + dot(150, 160) + text(142, 178, 'P')
  s += arrow(105, 160, 144, 160, '#ef4444', 2.2) + text(118, 150, 'v₀', '#ef4444', 13)
  // 磁场中轨迹示意：圆心在 P 正上方，向右凸的半圆弧（P→右→上方）
  const tr = []
  for (let i = 0; i <= 20; i++) {
    const a = (90 - (180 * i) / 20) * (Math.PI / 180)
    tr.push(`${(150 + 36 * Math.cos(a)).toFixed(1)},${(124 + 36 * Math.sin(a)).toFixed(1)}`)
  }
  s += `<polyline points="${tr.join(' ')}" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5 4"/>`
  return s
})())

// #737：单边界（竖直直线）+ 右侧磁场 + P 入射（与边界成 θ）+ 弧线回到边界 Q
const fig737 = wrap((() => {
  let s = ''
  s += `<rect x="140" y="40" width="210" height="160" fill="#eef2ff" opacity="0.55"/>` + text(248, 58, '匀强磁场（垂直纸面向里）', '#64748b', 11)
  s += cross(200, 110) + cross(270, 150) + cross(300, 90) + cross(215, 178)
  s += `<line x1="140" y1="40" x2="140" y2="200" stroke="#334155" stroke-width="2.2"/>`
  s += dot(140, 150) + text(126, 166, 'P') + dot(140, 79, 3) + text(124, 74, 'Q')
  s += arrow(140, 150, 196, 94, '#ef4444', 2.2) + text(204, 92, 'v', '#ef4444', 13)
  // θ 角弧线（边界正方向到 v 方向）
  const th = []
  for (let i = 0; i <= 12; i++) {
    const a = (90 - (45 * i) / 12) * (Math.PI / 180)
    th.push(`${(140 + 30 * Math.cos(a)).toFixed(1)},${(150 - 30 * Math.sin(a)).toFixed(1)}`)
  }
  s += `<polyline points="${th.join(' ')}" fill="none" stroke="#64748b" stroke-width="1.3"/>` + text(160, 120, 'θ')
  // 轨迹：圆心在边界另一侧（左上方），弧向右凸、回到边界上方 Q
  const tr = []
  for (let i = 0; i <= 24; i++) {
    const a = (45 - (90 * i) / 24) * (Math.PI / 180)
    tr.push(`${(104.6 + 50 * Math.cos(a)).toFixed(1)},${(114.6 + 50 * Math.sin(a)).toFixed(1)}`)
  }
  s += `<polyline points="${tr.join(' ')}" fill="none" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="5 4"/>`
  return s
})())

// #742：水平导轨 + 金属棒 + 左端电阻 R + 竖直向下磁场（俯视 ⊗）+ 水平恒力 F
const fig742 = wrap((() => {
  let s = ''
  s += `<line x1="60" y1="85" x2="340" y2="85" stroke="#334155" stroke-width="2.4"/><line x1="60" y1="145" x2="340" y2="145" stroke="#334155" stroke-width="2.4"/>`
  s += `<line x1="90" y1="85" x2="90" y2="100" stroke="#334155" stroke-width="1.6"/><line x1="90" y1="130" x2="90" y2="145" stroke="#334155" stroke-width="1.6"/><rect x="78" y="100" width="24" height="30" fill="#ffffff" stroke="#334155" stroke-width="1.8"/>` + text(90, 166, 'R')
  s += `<line x1="200" y1="73" x2="200" y2="157" stroke="#334155" stroke-width="6" stroke-linecap="round"/>` + text(200, 64, '金属棒', '#334155', 12)
  s += cross(258, 100) + cross(296, 128) + cross(258, 156) + cross(160, 128) + cross(128, 100) + text(258, 88, 'B', '#64748b', 13)
  s += arrow(210, 115, 262, 115, '#ef4444', 2.4) + text(244, 106, 'F', '#ef4444', 14)
  s += `<line x1="354" y1="85" x2="354" y2="145" stroke="#64748b" stroke-width="1.2"/><line x1="348" y1="85" x2="360" y2="85" stroke="#64748b" stroke-width="1.2"/><line x1="348" y1="145" x2="360" y2="145" stroke="#64748b" stroke-width="1.2"/>` + text(366, 120, 'L', '#64748b', 13, 'start')
  return s
})())

// #734：倾斜导轨（30°，侧视）+ 金属棒（横截面圆，电流垂直纸面向里 ⊗）+ 竖直向上磁场（↑ 箭头）+ 水平向右安培力 F
const fig734 = wrap((() => {
  let s = ''
  // 斜面三角形（倾角 30°）+ 地面
  s += `<polygon points="60,190 267.8,70 300,190" fill="#eef2ff" stroke="#334155" stroke-width="2"/><line x1="40" y1="190" x2="330" y2="190" stroke="#334155" stroke-width="2"/>`
  for (let x = 50; x <= 310; x += 36) s += `<line x1="${x}" y1="200" x2="${x + 10}" y2="190" stroke="#94a3b8" stroke-width="1.3"/>`
  // 30° 角
  s += `<path d="M 96 190 A 36 36 0 0 0 91.2 172" fill="none" stroke="#ef4444" stroke-width="1.5"/>` + text(114, 180, '30°', '#ef4444', 13)
  // 金属棒横截面（侧视：棒垂直纸面，截面圆放在斜面上，电流向里 ⊗）
  s += `<circle cx="172" cy="118" r="8" fill="#c7d2fe" stroke="#334155" stroke-width="2"/><line x1="167.2" y1="113.2" x2="176.8" y2="122.8" stroke="#334155" stroke-width="1.4"/><line x1="167.2" y1="122.8" x2="176.8" y2="113.2" stroke="#334155" stroke-width="1.4"/>` + text(150, 112, '金属棒', '#334155', 12, 'end')
  // 磁场竖直向上（↑）
  s += arrow(110, 168, 110, 122, '#64748b', 1.6) + arrow(262, 172, 262, 126, '#64748b', 1.6) + arrow(320, 96, 320, 52, '#64748b', 1.6) + text(274, 118, 'B', '#64748b', 13)
  // 水平向右的安培力 F
  s += arrow(184, 118, 262, 118, '#ef4444', 2.6) + text(246, 108, 'F（水平向右）', '#ef4444', 12)
  s += text(180, 224, 'μ=0', '#334155', 12)
  return s
})())

// #738：坐标系 + 水平向右 E + 垂直纸面向里 B（⊗）+ v₀ 沿 45° 射入 + P 点
const fig738 = wrap((() => {
  let s = ''
  s += `<line x1="40" y1="180" x2="360" y2="180" stroke="#334155" stroke-width="1.8"/><polygon points="360,180 351,176 351,184" fill="#334155"/>`
  s += `<line x1="60" y1="216" x2="60" y2="34" stroke="#334155" stroke-width="1.8"/><polygon points="60,34 56,43 64,43" fill="#334155"/>`
  s += text(366, 194, 'x') + text(74, 38, 'y') + text(50, 196, 'O')
  // E 水平向右
  s += arrow(300, 200, 352, 200, '#4f46e5', 2) + text(282, 205, 'E', '#4f46e5', 13)
  // B 垂直纸面向里
  s += cross(150, 70) + cross(250, 90) + cross(200, 150) + cross(300, 140) + text(150, 52, 'B', '#64748b', 13)
  // v₀ 沿 45° 射入 + OP 虚线 + P 点
  s += arrow(60, 180, 110, 130, '#ef4444', 2.2) + text(96, 122, 'v₀', '#ef4444', 13)
  s += `<line x1="60" y1="180" x2="140" y2="100" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>`
  s += dot(140, 100) + text(152, 96, 'P')
  return s
})())

// ---------- 内容补丁 ----------

// #710 整题重写（见文件头注释）
const q710Stem = `光滑水平绝缘桌面上，三个带电小球 $A$、$B$、$C$ 沿同一直线排列，$A$、$C$ 固定不动，$B$ 位于 $A$、$C$ 之间且处于平衡状态（所受合力为零）。已知 $A$、$B$ 间距 $r_{AB}=0.20\\ \\text{m}$，$B$、$C$ 间距 $r_{BC}=0.30\\ \\text{m}$，$A$ 带电荷量 $q_A=+4.0\\times10^{-6}\\ \\text{C}$，$C$ 带电荷量 $q_C=+9.0\\times10^{-6}\\ \\text{C}$，静电力常量 $k=9.0\\times10^{9}\\ \\text{N}\\cdot\\text{m}^2/\\text{C}^2$。
（1）$B$ 的带电性质（正电/负电）能否由题设条件唯一确定？$B$ 的电荷量大小能否唯一确定？请分别说明理由；
（2）若已知 $B$ 带负电，且 $B$ 所受 $A$ 的库仑力大小为 $F=3.6\\ \\text{N}$，求 $B$ 的电荷量大小，并求此时 $A$、$C$ 对 $B$ 的库仑力方向。`
const q710Answer = `（1）均不能唯一确定：无论 $B$ 带正电还是负电，$A$、$C$ 对它的两个库仑力方向都相反，平衡只要求两力等大，即 $\\dfrac{q_A}{r_{AB}^2}=\\dfrac{q_C}{r_{BC}^2}$（代入数据两边均为 $1.0\\times10^{-4}\\ \\text{C/m}^2$，恰好成立），该条件与 $B$ 的电性、电荷量均无关；（2）$|q_B|=4.0\\times10^{-6}\\ \\text{C}$；$A$ 对 $B$ 的引力指向 $A$（向左），$C$ 对 $B$ 的引力指向 $C$（向右）。`
const q710Solution = `（1）$A$、$C$ 同带正电且分居 $B$ 两侧。若 $B$ 带正电，$A$、$C$ 对 $B$ 均为斥力，方向一左一右；若 $B$ 带负电，$A$、$C$ 对 $B$ 均为引力，方向同样一左一右。即无论 $B$ 带何种电荷，两个库仑力都可能方向相反，平衡条件只要求二者等大：
$$k\\frac{q_A|q_B|}{r_{AB}^2}=k\\frac{q_C|q_B|}{r_{BC}^2}$$
约去 $k|q_B|$ 得 $\\dfrac{q_A}{r_{AB}^2}=\\dfrac{q_C}{r_{BC}^2}$。代入数据：$\\dfrac{4.0\\times10^{-6}}{0.20^2}=1.0\\times10^{-4}\\ \\text{C/m}^2$，$\\dfrac{9.0\\times10^{-6}}{0.30^2}=1.0\\times10^{-4}\\ \\text{C/m}^2$，两边恰好相等，说明题给 $q_A$、$q_C$ 与间距满足平衡位置条件。该条件既不含 $B$ 的电性、也不含 $B$ 的电荷量，故 $B$ 的带电性质与电荷量大小都不能由题设条件唯一确定。
（2）$B$ 带负电，$A$、$C$ 均带正电，两处均为引力。由库仑定律 $F=k\\dfrac{q_A|q_B|}{r_{AB}^2}$ 得
$$|q_B|=\\dfrac{Fr_{AB}^2}{kq_A}=\\dfrac{3.6\\times0.04}{9.0\\times10^{9}\\times4.0\\times10^{-6}}\\ \\text{C}=4.0\\times10^{-6}\\ \\text{C}$$
检验 $C$ 对 $B$ 的库仑力：$F_{CB}=k\\dfrac{q_C|q_B|}{r_{BC}^2}=9.0\\times10^{9}\\times\\dfrac{9.0\\times10^{-6}\\times4.0\\times10^{-6}}{0.09}\\ \\text{N}=3.6\\ \\text{N}$，与 $F_{AB}$ 等大、方向相反，自洽。
方向：$A$ 对 $B$ 为引力，方向由 $B$ 指向 $A$（向左）；$C$ 对 $B$ 为引力，方向由 $B$ 指向 $C$（向右）。`
const q710Pitfall = `①平衡条件约去 $|q_B|$ 后只剩对 $q_A$、$q_C$ 与间距的约束，与 $B$ 的电性、电荷量都无关，不能由平衡条件"解出"$q_B$ 的电性或大小；②库仑力沿两电荷连线方向，同种电荷相斥、异种电荷相吸；③距离要平方，单位统一为米与库仑。`

// #713 重解重写（(2) 问数值修正）
const q713Answer = `（1）$E_O=3.2\\times10^{4}\\ \\text{N/C}$，方向由 $A$ 指向 $B$（沿连线指向负电荷一侧）；（2）$E_P\\approx1.4\\times10^{4}\\ \\text{N/C}$，方向平行于连线、由 $A$ 指向 $B$（与 $A\\to B$ 方向夹角为 $0^\\circ$）。`
const q713Solution = `（1）$O$ 为 $A$、$B$ 中点，到 $A$、$B$ 距离均为 $r_1=\\dfrac{d}{2}=0.15\\ \\text{m}$。
$A$ 处正电荷在 $O$ 点产生的场强 $E_A=k\\dfrac{Q_A}{r_1^2}=9.0\\times10^{9}\\times\\dfrac{4.0\\times10^{-8}}{(0.15)^2}\\ \\text{N/C}=1.6\\times10^{4}\\ \\text{N/C}$，方向由 $A$ 指向 $B$；
$B$ 处负电荷在 $O$ 点产生的场强 $E_B=k\\dfrac{|Q_B|}{r_1^2}=1.6\\times10^{4}\\ \\text{N/C}$，方向也由 $A$ 指向 $B$（负电荷的场强指向它自身）。
两者同向叠加：$E_O=E_A+E_B=3.2\\times10^{4}\\ \\text{N/C}$，方向由 $A$ 指向 $B$。
（2）$P$ 在中垂线上，$OP=h=0.40\\ \\text{m}$，到 $A$、$B$ 距离相等：$r_2=\\sqrt{h^2+\\left(\\dfrac{d}{2}\\right)^2}=\\sqrt{0.40^2+0.15^2}\\ \\text{m}=\\sqrt{0.1825}\\ \\text{m}\\approx0.427\\ \\text{m}$。
$E_A'=k\\dfrac{Q_A}{r_2^2}=9.0\\times10^{9}\\times\\dfrac{4.0\\times10^{-8}}{0.1825}\\ \\text{N/C}\\approx1.97\\times10^{4}\\ \\text{N/C}$，方向沿 $AP$ 连线背离 $A$；
$E_B'=k\\dfrac{|Q_B|}{r_2^2}\\approx1.97\\times10^{4}\\ \\text{N/C}$，方向沿 $BP$ 连线指向 $B$。
两矢量大小相等，与连线的夹角均为 $\\theta$，$\\cos\\theta=\\dfrac{d/2}{r_2}=\\dfrac{0.15}{0.427}\\approx0.351$。垂直于连线方向的分量等大反向、互相抵消，沿连线方向的分量同向（由 $A$ 指向 $B$）叠加：
$$E_P=2E_A'\\cos\\theta=2\\times1.97\\times10^{4}\\times0.351\\ \\text{N/C}\\approx1.4\\times10^{4}\\ \\text{N/C}$$
方向平行于连线、由 $A$ 指向 $B$，与 $A\\to B$ 方向夹角为 $0^\\circ$。`
const q713Pitfall = `（1）负电荷在 $O$ 点产生的场强方向指向负电荷本身，与正电荷产生的场强同向，不能相减；（2）$P$ 点两场强不在同一直线上，须分解到沿连线与垂直连线两个方向再合成，垂直分量抵消、沿连线分量相加；（3）距离要用 $r_2=\\sqrt{h^2+(d/2)^2}\\approx0.427\\ \\text{m}$，不能误用 $h$ 或 $d/2$。`

// #715 补选项（原题干缺选项）
const q715StemAppend = `
A. 金属球壳实体内部场强为零，空腔内场强不为零
B. 球壳外表面感应电荷的代数和不为零
C. 球壳外部空间的电场被完全屏蔽，场强处处为零
D. 金属球壳实体内部场强为零，空腔内场强可近似认为为零，但球壳外部区域仍有电场`

// #719 极性修正：上极板接正极（电场竖直向下，负微粒受力向上可与重力平衡）
const q719StemReplace = { from: '其中下极板接电源正极、上极板接电源负极', to: '其中上极板接电源正极、下极板接电源负极' }

// #724 答案补 B（解析已推出 φB>φA，即 B 正确）
const q724Answer = 'BC'

// #727 补选项 + 解析修正（C 改错误值，消除「故 C 正确」与单选矛盾）
const q727StemAppend = `
A. 匀强电场的电场强度大小为 $3.75\\times10^{3}\\ \\text{N/C}$
B. 匀强电场的电场强度大小为 $3.0\\times10^{3}\\ \\text{N/C}$
C. 细线的拉力大小为 $1.0\\times10^{-2}\\ \\text{N}$
D. 仅将电场方向反向（大小不变），小球重新静止时细线仍偏向原来一侧`
const q727Solution = `小球受重力 $mg$、电场力 $F_{\\text{电}}=qE$ 和细线拉力 $F_T$ 三个力作用而平衡。由于电场水平、重力竖直，电场力与重力的合力与细线拉力等大反向，即沿细线方向。
（1）由平衡条件得 $\\tan\\theta=\\dfrac{qE}{mg}$，故 $qE=mg\\tan\\theta=1.0\\times10^{-3}\\times10\\times\\dfrac{0.6}{0.8}=7.5\\times10^{-3}\\ \\text{N}$，得 $E=\\dfrac{7.5\\times10^{-3}}{2.0\\times10^{-6}}=3.75\\times10^{3}\\ \\text{N/C}$。故 A 正确，B 错误（B 的 $3.0\\times10^{3}\\ \\text{N/C}$ 对应误用 $\\sin\\theta$ 的结果）。
（2）细线拉力 $F_T=\\dfrac{mg}{\\cos\\theta}=\\dfrac{1.0\\times10^{-2}}{0.8}=1.25\\times10^{-2}\\ \\text{N}$，不等于重力 $1.0\\times10^{-2}\\ \\text{N}$，故 C 错误。
（3）电场反向时，电场力方向变为水平向左，小球将向另一侧偏转后重新平衡，由 $\\tan\\theta'=\\dfrac{qE}{mg}=\\dfrac{3}{4}$ 得 $\\theta'=37^\\circ$，但细线偏向竖直方向另一侧，平衡位置改变，故 D 错误。
本题为单选题，正确选项为 A。`
const q727Pitfall = `①求场强须用 $qE=mg\\tan\\theta$，误用 $\\sin\\theta$ 会得 $3.0\\times10^{3}\\ \\text{N/C}$ 而错选 B；②拉力 $F_T=\\dfrac{mg}{\\cos\\theta}=1.25\\times10^{-2}\\ \\text{N}$ 大于重力，误认为拉力等于重力会错选 C；③电场反向后平衡位置偏向另一侧（$\\theta$ 角大小不变、方向翻到对侧），不会停在原位置。`

// #729 U₂ 数据修正 + (3) 重解
const q729StemReplace = { from: '$U_2=100\\ \\text{V}$', to: '$U_2=20\\ \\text{V}$' }
const q729Answer = `（1）$9.4\\times10^{6}\\ \\text{m/s}$；（2）$1.0\\times10^{-2}\\ \\text{m}$；（3）$7.0\\times10^{-2}\\ \\text{m}$`
const q729Solution = `（1）电子在加速电场中由动能定理：$eU_1=\\frac12 mv_0^2$，解得 $v_0=\\sqrt{\\frac{2eU_1}{m}}=\\sqrt{\\frac{2\\times1.6\\times10^{-19}\\times250}{9.0\\times10^{-31}}}\\ \\text{m/s}\\approx9.4\\times10^{6}\\ \\text{m/s}$。
（2）偏转电场强度 $E=\\frac{U_2}{d}=\\frac{20}{0.020}\\ \\text{V/m}=1.0\\times10^{3}\\ \\text{V/m}$，电子在偏转电场中做类平抛运动，沿极板方向匀速：$t_1=\\frac{L}{v_0}$，垂直极板方向加速度 $a=\\frac{eE}{m}$，侧移 $y=\\frac12 at_1^2=\\frac{eU_2 L^2}{2mdv_0^2}$。由（1）$mv_0^2=2eU_1$，代入得 $y=\\frac{U_2 L^2}{4U_1 d}=\\frac{20\\times(0.10)^2}{4\\times250\\times0.020}\\ \\text{m}=1.0\\times10^{-2}\\ \\text{m}$，恰为板间距的一半（$d/2=0.010\\ \\text{m}$），与"恰好从边缘飞出"自洽。
（3）飞出偏转电场时垂直极板方向分速度 $v_y=at_1=\\frac{eU_2 L}{mdv_0}$，偏转角 $\\theta$ 满足 $\\tan\\theta=\\frac{v_y}{v_0}=\\frac{eU_2 L}{mdv_0^2}=\\frac{U_2 L}{2U_1 d}=\\frac{20\\times0.10}{2\\times250\\times0.020}=0.2$。出电场后做匀速直线运动，在屏上附加偏移 $y'=D\\tan\\theta=0.30\\times0.2\\ \\text{m}=0.06\\ \\text{m}$。屏上位置到 $O$ 的距离 $Y=y+y'=1.0\\times10^{-2}\\ \\text{m}+6.0\\times10^{-2}\\ \\text{m}=7.0\\times10^{-2}\\ \\text{m}$。`

// #737 单边界几何重解重写（圆心在边界另一侧，圆心角 2θ）
const q737Answer = `（1）$R=\\dfrac{mv}{qB}$，$t=\\dfrac{2m\\theta}{qB}$；（2）$L_{PQ}=\\dfrac{2mv\\sin\\theta}{qB}$；（3）当 $\\dfrac{qBd}{mv}\\ge2$ 时，任意 $\\theta\\in(0^\\circ,90^\\circ)$ 均不穿出右边界；当 $\\dfrac{qBd}{mv}<2$ 时，需 $\\cos\\theta\\ge1-\\dfrac{qBd}{mv}$（即 $\\theta\\le\\arccos\\left(1-\\dfrac{qBd}{mv}\\right)$）。$PQ$ 在 $\\theta$ 取允许范围内最大值时最大：若 $\\dfrac{qBd}{mv}\\ge2$，$\\theta=90^\\circ$，$L_{\\max}=\\dfrac{2mv}{qB}$；若 $\\dfrac{qBd}{mv}<2$，$L_{\\max}=2\\sqrt{d(2R-d)}$（$R=\\dfrac{mv}{qB}$）。`
const q737Solution = `（1）洛伦兹力提供向心力：$qvB=\\dfrac{mv^2}{R}$，解得 $R=\\dfrac{mv}{qB}$。粒子带正电、磁场垂直纸面向里，由左手定则，入射处洛伦兹力指向速度方向的左侧、偏向边界一侧，圆心位于边界另一侧（场区外）。设速度与边界成 $\\theta$ 角，由几何关系，圆心到边界的距离为 $R\\cos\\theta$，轨迹圆弧在磁场内的圆心角为 $2\\theta$（入射、出射速度与边界的夹角均为 $\\theta$，对称），故运动时间
$$t=\\dfrac{2\\theta}{2\\pi}\\cdot T=\\dfrac{2\\theta}{2\\pi}\\cdot\\dfrac{2\\pi m}{qB}=\\dfrac{2m\\theta}{qB}$$
（2）弦 $PQ$ 所对圆心角为 $2\\theta$，故 $$L_{PQ}=2R\\sin\\dfrac{2\\theta}{2}=2R\\sin\\theta=\\dfrac{2mv\\sin\\theta}{qB}$$
（3）轨迹圆弧深入磁场的最大深度（弧上离边界最远点到边界的距离）为 $R-R\\cos\\theta=R(1-\\cos\\theta)$（圆心到边界距离 $R\\cos\\theta$，圆最远点到圆心距离 $R$）。不穿出右边界要求
$$R(1-\\cos\\theta)\\le d\\ \\Longleftrightarrow\\ \\cos\\theta\\ge1-\\dfrac{d}{R}=1-\\dfrac{qBd}{mv}$$
当 $\\dfrac{qBd}{mv}\\ge2$ 时，$1-\\dfrac{qBd}{mv}\\le-1$，任意 $\\theta\\in(0^\\circ,90^\\circ)$ 均满足；当 $\\dfrac{qBd}{mv}<2$ 时，需 $\\theta\\le\\arccos\\left(1-\\dfrac{qBd}{mv}\\right)$。
由（2），$L_{PQ}=2R\\sin\\theta$ 在 $\\theta\\in(0^\\circ,90^\\circ)$ 内随 $\\theta$ 增大而增大，故 $\\theta$ 取允许范围内最大值时 $PQ$ 最大：若 $\\dfrac{qBd}{mv}\\ge2$，$\\theta=90^\\circ$，$L_{\\max}=2R=\\dfrac{2mv}{qB}$；若 $\\dfrac{qBd}{mv}<2$，$\\theta_{\\max}=\\arccos\\left(1-\\dfrac{qBd}{mv}\\right)$，$L_{\\max}=2R\\sin\\theta_{\\max}=2R\\sqrt{1-\\left(1-\\dfrac{d}{R}\\right)^2}=2\\sqrt{d(2R-d)}$，其中 $R=\\dfrac{mv}{qB}$。`
const q737Pitfall = `①单边界磁场中圆心在边界另一侧（场区外），粒子在磁场内的轨迹圆心角为 $2\\theta$（$\\theta$ 为速度与边界的夹角），不是 $2(\\pi-\\theta)$——擦边入射（$\\theta\\to0$）时粒子几乎不进入磁场，运动时间应趋于零；②弦长 $PQ=2R\\sin\\theta$，出射速度与边界的夹角也为 $\\theta$（对称）；③不穿出右边界的条件是轨迹最大深度 $R(1-\\cos\\theta)\\le d$，不要把圆心当成在场区内而写错；④$PQ$ 最大值须在允许的 $\\theta$ 范围内取，注意按 $\\dfrac{qBd}{mv}$ 与 $2$ 的大小分类讨论。`

// #738 整题重写（数据重设计，独立重解见解析）
// 设计：qE=mg=2.0e-5 N（E=2.0 N/C、q=1.0e-5 C、m=2.0e-6 kg），三力平衡 v0=√2mg/(qB)=2√2 m/s（B=1.0 T）；
// v0 沿 45° 斜向右上，t1=0.10 s → P(0.20, 0.20)；B 消失后 a=(10,−10)，t2=0.20 s 时
// x=0.2+2×0.2+½×10×0.04=0.80 m、y=0.2+2×0.2−½×10×0.04=0.40 m；v=(2+2, 2−2)=(4,0) → 4.0 m/s 水平向右（恰为竖直分速度减为零的时刻，自洽）
const q738Stem = `在竖直平面内建立直角坐标系 $xOy$，$x$ 轴水平向右，$y$ 轴竖直向上。空间中同时存在水平向右的匀强电场（场强 $E=2.0\\ \\text{N/C}$）和垂直纸面向里的匀强磁场（磁感应强度 $B=1.0\\ \\text{T}$）。一个质量 $m=2.0\\times10^{-6}\\ \\text{kg}$、电荷量 $q=+1.0\\times10^{-5}\\ \\text{C}$ 的带电小球从坐标原点 $O$ 以大小未知、方向与 $x$ 轴正方向成 $45^\\circ$ 角斜向右上方的初速度 $v_0$ 射入该复合场区域，恰好沿直线做匀速运动；当它到达 $P$ 点时磁场突然消失（电场保持不变），此后小球在竖直平面内继续运动。已知小球从 $O$ 到 $P$ 的运动时间 $t_1=0.10\\ \\text{s}$，取 $g=10\\ \\text{m/s}^2$，不计空气阻力。求：
（1）小球射入时的初速度大小 $v_0$；
（2）$P$ 点的坐标；
（3）磁场消失后经 $t_2=0.20\\ \\text{s}$，小球的位置坐标以及速度的大小和方向。`
const q738Answer = `（1）$v_0=2\\sqrt{2}\\ \\text{m/s}\\approx2.83\\ \\text{m/s}$；（2）$P(0.20\\ \\text{m},\\ 0.20\\ \\text{m})$；（3）位置 $(0.80\\ \\text{m},\\ 0.40\\ \\text{m})$，速度大小 $4.0\\ \\text{m/s}$、方向水平向右。`
const q738Solution = `（1）小球沿直线做匀速运动，合力为零。小球受竖直向下的重力 $mg=2.0\\times10^{-6}\\times10=2.0\\times10^{-5}\\ \\text{N}$、水平向右的电场力 $qE=1.0\\times10^{-5}\\times2.0=2.0\\times10^{-5}\\ \\text{N}$（二者合力沿右下方 $45^\\circ$、大小 $\\sqrt{(mg)^2+(qE)^2}=\\sqrt{2}\\,mg$），以及洛伦兹力 $qv_0B$。三力平衡要求洛伦兹力沿左上方 $45^\\circ$、大小 $\\sqrt{2}\\,mg$（与 $v_0$ 垂直，方向自洽）。故
$$qv_0B=\\sqrt{2}\\,mg\\ \\Rightarrow\\ v_0=\\dfrac{\\sqrt{2}\\,mg}{qB}=\\dfrac{\\sqrt{2}\\times2.0\\times10^{-5}}{1.0\\times10^{-5}\\times1.0}\\ \\text{m/s}=2\\sqrt{2}\\ \\text{m/s}\\approx2.83\\ \\text{m/s}$$
（2）匀速直线运动的位移大小 $OP=v_0t_1=2\\sqrt{2}\\times0.10=0.20\\sqrt{2}\\ \\text{m}$，其水平、竖直分量各为 $OP\\cos45^\\circ=0.20\\ \\text{m}$，故 $P(0.20\\ \\text{m},\\ 0.20\\ \\text{m})$。
（3）磁场消失后，小球只受重力与电场力两个恒力，合力恒定：$a_x=\\dfrac{qE}{m}=10\\ \\text{m/s}^2$（水平向右），$a_y=-g=-10\\ \\text{m/s}^2$（竖直向下）。$t_2$ 时刻：
速度分量 $v_x=v_0\\cos45^\\circ+a_xt_2=2+10\\times0.20=4.0\\ \\text{m/s}$；$v_y=v_0\\sin45^\\circ-gt_2=2-10\\times0.20=0$。故速度大小 $v=4.0\\ \\text{m/s}$、方向水平向右（$t_2$ 恰为竖直分速度减为零的时刻，自洽）。
位置分量 $x=x_P+v_{0x}t_2+\\dfrac12 a_xt_2^2=0.20+2\\times0.20+\\dfrac12\\times10\\times0.04=0.80\\ \\text{m}$；$y=y_P+v_{0y}t_2-\\dfrac12 gt_2^2=0.20+0.40-0.20=0.40\\ \\text{m}$。故位置 $(0.80\\ \\text{m},\\ 0.40\\ \\text{m})$。`
const q738Pitfall = `①三力平衡中洛伦兹力的大小 $qv_0B$ 与方向须由左手定则核对（正电荷、速度斜向右上、磁场垂直纸面向里 → 洛伦兹力指向左上方），不能只写大小；②磁场消失后小球受重力与电场力两个恒力，做匀变速曲线运动（类平抛型），误认为做圆周运动或自由落体均错；③速度与位置要沿 $x$、$y$ 分别列式，$g$ 只作用于 $y$ 方向；注意 $t_2=0.20\\ \\text{s}$ 时 $v_y$ 恰好减为零。`
const q738Kps = JSON.stringify(['综合专题：复合场综合（重力+电场+磁场）', '共点力平衡', '类平抛运动', '运动的合成与分解'])

// #741 答案改 22:1、解析重写（删除试错残稿，保留 4840/220=22 的精确约分与 I₃ 校验）
const q741Answer = `（1）$3.2\\ \\text{kW}$；（2）$n_3:n_4=22:1$；（3）$96.8\\ \\text{kW}$`
const q741Solution = `（1）升压变压器为理想变压器，输入功率等于输出功率，故输电线起始端电压 $U_2=5000\\ \\text{V}$，输送功率 $P=100\\ \\text{kW}=1.0\\times10^5\\ \\text{W}$。
输电线中的电流 $I=\\dfrac{P}{U_2}=\\dfrac{1.0\\times10^5}{5000}\\ \\text{A}=20\\ \\text{A}$。
输电线损耗功率 $P_{\\text{损}}=I^2 r=20^2\\times8\\ \\text{W}=3200\\ \\text{W}=3.2\\ \\text{kW}$。
（2）输电线上的电压损失 $\\Delta U=Ir=20\\times8\\ \\text{V}=160\\ \\text{V}$。
降压变压器原线圈电压 $U_3=U_2-\\Delta U=5000-160=4840\\ \\text{V}$。
用户端电压 $U_4=220\\ \\text{V}$，由理想变压器电压比 $\\dfrac{n_3}{n_4}=\\dfrac{U_3}{U_4}=\\dfrac{4840}{220}=22$，即 $n_3:n_4=22:1$。
（3）用户获得的总功率 $P_{\\text{用}}=P-P_{\\text{损}}=100\\ \\text{kW}-3.2\\ \\text{kW}=96.8\\ \\text{kW}$。
校验：降压变压器输出功率 $P_4=P_{\\text{用}}=96.8\\ \\text{kW}$，输出电流 $I_4=\\dfrac{P_4}{U_4}=\\dfrac{9.68\\times10^4}{220}\\ \\text{A}=440\\ \\text{A}$；由 $\\dfrac{I_3}{I_4}=\\dfrac{n_4}{n_3}=\\dfrac{1}{22}$ 得降压变压器原线圈电流 $I_3=440\\times\\dfrac{1}{22}\\ \\text{A}=20\\ \\text{A}$，与输电线电流一致，自洽。`

// ---------- 执行 ----------
const patches = [
  { id: 710, fields: { stem: q710Stem, answer: q710Answer, solution: q710Solution, pitfall: q710Pitfall, knowledge_points: JSON.stringify(['库仑定律', '共点力平衡']) } },
  { id: 713, fields: { answer: q713Answer, solution: q713Solution, pitfall: q713Pitfall } },
  { id: 715, fields: { stem: 'APPEND' + q715StemAppend } },
  { id: 716, fields: { figure: fig716 } },
  { id: 719, fields: { stem: 'REPLACE:' + q719StemReplace.from + '→' + q719StemReplace.to } },
  { id: 724, fields: { answer: q724Answer, figure: fig724 } },
  { id: 725, fields: { figure: fig725 } },
  { id: 726, fields: { figure: fig726 } },
  { id: 727, fields: { stem: 'APPEND' + q727StemAppend, solution: q727Solution, pitfall: q727Pitfall } },
  { id: 729, fields: { stem: 'REPLACE:' + q729StemReplace.from + '→' + q729StemReplace.to, answer: q729Answer, solution: q729Solution, figure: fig729 } },
  { id: 732, fields: { figure: fig732 } },
  { id: 734, fields: { figure: fig734 } },
  { id: 736, fields: { figure: fig736 } },
  { id: 737, fields: { answer: q737Answer, solution: q737Solution, pitfall: q737Pitfall, figure: fig737 } },
  { id: 738, fields: { stem: q738Stem, answer: q738Answer, solution: q738Solution, pitfall: q738Pitfall, figure: fig738, knowledge_points: q738Kps } },
  { id: 741, fields: { answer: q741Answer, solution: q741Solution } },
  { id: 742, fields: { figure: fig742 } },
]

// ---------- #713 原坑点校验：solution 里是否还有旧数值 1.7 ----------
if (DRY) {
  for (const p of patches) {
    const cur = db.prepare('SELECT stem, solution FROM questions WHERE id=@id').get({ id: p.id })
    if (!cur) { console.error('题不存在 #' + p.id); process.exit(1) }
    console.log(`#${p.id} dry-run：字段 ${Object.keys(p.fields).join('/')}`)
  }
  console.log('dry-run 通过，去掉 --dry-run 执行')
  process.exit(0)
}

for (const p of patches) {
  const sets = Object.keys(p.fields).map((k) => `${k}=@${k}`).join(', ')
  const params = { id: p.id }
  for (const [k, v] of Object.entries(p.fields)) {
    if (typeof v === 'string' && v.startsWith('REPLACE:')) {
      const [from, to] = v.slice(8).split('→')
      const cur = db.prepare(`SELECT ${k} AS v FROM questions WHERE id=@id`).get({ id: p.id })
      if (!cur || !String(cur.v).includes(from)) { console.error(`#${p.id}.${k} 未找到待替换原文，中止`); process.exit(1) }
      params[k] = String(cur.v).replace(from, to)
    } else if (typeof v === 'string' && v.startsWith('APPEND')) {
      const cur = db.prepare(`SELECT ${k} AS v FROM questions WHERE id=@id`).get({ id: p.id })
      params[k] = String(cur.v).trimEnd() + '\n' + v.slice(6).trimStart()
    } else params[k] = v
  }
  const r = db.prepare(`UPDATE questions SET ${sets} WHERE id=@id`).run(params)
  console.log(`#${p.id} 更新 ${r.changes} 行（字段：${Object.keys(p.fields).join('/')}）`)
}

// ---------- 回读自检 ----------
console.log('\n== 自检 ==')
const g = (id, f) => db.prepare(`SELECT ${f} AS v FROM questions WHERE id=?`).get(id).v
console.log('#710 无稳定性论证:', !String(g(710, 'solution')).includes('稳定'))
console.log('#713 E_P=1.4e4:', String(g(713, 'answer')).includes('1.4\\times10^{4}'))
console.log('#715 有选项:', String(g(715, 'stem')).includes('A. 金属球壳实体内部场强为零'))
console.log('#719 极性已换:', String(g(719, 'stem')).includes('上极板接电源正极'))
console.log('#724 答案 BC:', String(g(724, 'answer')) === 'BC')
console.log('#727 单选一致:', String(g(727, 'solution')).includes('故 C 错误') && !String(g(727, 'solution')).includes('故 C 正确'))
console.log('#729 U₂=20V:', String(g(729, 'stem')).includes('U_2=20') && String(g(729, 'answer')).includes('7.0\\times10^{-2}'))
console.log('#737 t=2mθ/qB:', String(g(737, 'solution')).includes('2m\\theta}{qB') || String(g(737, 'solution')).includes('2m\\theta'))
console.log('#738 无试错残稿:', !String(g(738, 'solution')).includes('自洽，但') && !String(g(738, 'answer')).includes('-0.40'))
console.log('#741 22:1:', String(g(741, 'answer')).includes('22:1') && !String(g(741, 'solution')).includes('215'))
