// 一次性脚本：验收 #77 催办 P1-126 —— 2g 观察族逐题甄别后，对实锤「题干↔figure 场景不符/答案泄露」的 46 题逐题重画配图
//   （题库质量维护，零物理改动）。甄别口径与全量清单见 docs/P1-126-2g观察族甄别清单.md。
//   约束（沿用 P1-118/P1-125 判例）：只改 figure 字段，stem/answer/solution/pitfall 零改动；
//   每题旧图特征断言（防盲替换）+ 内容一致幂等跳过 + 写库回读断言；新图禁 NaN/undefined、单 svg 根、
//   图内中文标签必须与题干共享字符（2b 口径自检）、图内数字必须可从题干溯源（零答案泄露）；
//   待判方向零泄露：#874 电流方向不画箭头、#143/#879 感应电流方向不画箭头、待求速度不画 v。
// 用法：node scripts/fix-accept77.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const get = db.prepare('SELECT id, stem, answer, solution, pitfall, figure FROM questions WHERE id=?')
const cnt = (s, sub) => s.split(sub).length - 1
const assert = (ok, msg) => {
  if (!ok) throw new Error(`断言失败：${msg}`)
}
const FONT = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const SVG_HEAD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/>'

// ---------- 绘图基元（与既有好图同一视觉语言：#334155 主线 / #ef4444 红 v·F / #2563eb 蓝 E·v₀ / #4f46e5 场） ----------
const txt = (x, y, s, fill = '#334155', size = 13, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT}>${s}</text>`
const arrow = (x1, y1, x2, y2, color = '#ef4444', w = 2.5) => {
  const L = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L
  const bx = +(x2 - 9 * ux).toFixed(1), by = +(y2 - 9 * uy).toFixed(1)
  const px = +(-uy).toFixed(3), py = +ux.toFixed(3)
  return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/><polygon points="${x2},${y2} ${(bx + 4.05 * px).toFixed(2)},${(by + 4.05 * py).toFixed(2)} ${(bx - 4.05 * px).toFixed(2)},${(by - 4.05 * py).toFixed(2)}" fill="${color}"/>`
}
const cross = (cx, cy, color = '#4f46e5') =>
  `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${color}" stroke-width="1.5"/><line x1="${cx - 5}" y1="${cy - 5}" x2="${cx + 5}" y2="${cy + 5}" stroke="${color}" stroke-width="1.5"/><line x1="${cx - 5}" y1="${cy + 5}" x2="${cx + 5}" y2="${cy - 5}" stroke="${color}" stroke-width="1.5"/>`
const dot = (cx, cy, color = '#334155') => `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}"/>`
// ⊙：磁场垂直纸面向外（俯视竖直向上）的符号
const odot = (cx, cy, color = '#4f46e5') =>
  `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="${color}"/>`
const dimH = (x1, x2, y, label) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#64748b" stroke-width="1.2"/><line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/>` +
  txt((x1 + x2) / 2, y + 18, label, '#64748b', 13)
const dimV = (y1, y2, x, label) =>
  `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#64748b" stroke-width="1.2"/><line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" stroke="#64748b" stroke-width="1.2"/><line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}" stroke="#64748b" stroke-width="1.2"/>` +
  txt(x + 10, (y1 + y2) / 2 + 5, label, '#64748b', 13, 'start')
const ground = (y) =>
  `<line x1="40" y1="${y}" x2="360" y2="${y}" stroke="#334155" stroke-width="2"/>` +
  [70, 130, 190, 250, 310].map((x) => `<line x1="${x}" y1="${y + 12}" x2="${x + 12}" y2="${y}" stroke="#94a3b8" stroke-width="1.5"/>`).join('')
const rail = (y, x1, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#334155" stroke-width="2"/>`
const resistor = (x, yTop, yBot, w = 28) => {
  const yc1 = yTop + 18, yc2 = yBot - 18
  return (
    `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yc1}" stroke="#334155" stroke-width="2"/>` +
    `<rect x="${x - w / 2}" y="${yc1}" width="${w}" height="${yc2 - yc1}" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    `<line x1="${x}" y1="${yc2}" x2="${x}" y2="${yBot}" stroke="#334155" stroke-width="2"/>`
  )
}
// 定滑轮（圆 + 中心轴点）
const pulley = (cx, cy, r = 12) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#334155" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="#334155"/>`
// 轻弹簧（两端留直段，中段 n 个折返）
const spring = (x1, y1, x2, y2, n = 6, amp = 12, color = '#334155') => {
  const dx = x2 - x1, dy = y2 - y1
  const L = Math.hypot(dx, dy)
  const ux = dx / L, uy = dy / L, px = -uy, py = ux
  let d = `M ${x1} ${y1} L ${(x1 + ux * 8).toFixed(1)} ${(y1 + uy * 8).toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const t1 = 8 + (L - 16) * ((i + 0.25) / n)
    const t2 = 8 + (L - 16) * ((i + 0.75) / n)
    d += ` L ${(x1 + ux * t1 + px * amp).toFixed(1)} ${(y1 + uy * t1 + py * amp).toFixed(1)} L ${(x1 + ux * t2 - px * amp).toFixed(1)} ${(y1 + uy * t2 - py * amp).toFixed(1)}`
  }
  d += ` L ${(x2 - ux * 8).toFixed(1)} ${(y2 - uy * 8).toFixed(1)} L ${x2} ${y2}`
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`
}
// 电感线圈（水平 n 个上凸半圆，从 (x,y) 向右）
const inductorH = (x, y, n = 4, r = 12, color = '#334155') => {
  let d = `M ${x} ${y}`
  for (let i = 0; i < n; i++) d += ` A ${r} ${r} 0 0 1 ${x + 2 * r * (i + 1)} ${y}`
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`
}
// 电感线圈（竖直 n 个侧凸半圆，从 (x,y) 向下）
const inductorV = (x, y, n = 4, r = 8, color = '#334155') => {
  let d = `M ${x} ${y}`
  for (let i = 0; i < n; i++) d += ` A ${r} ${r} 0 0 1 ${x} ${y + 2 * r * (i + 1)}`
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`
}
// 电容（两块水平极板）
const capacitor = (x1, x2, yTop, yBot, color = '#334155') =>
  `<line x1="${x1}" y1="${yTop}" x2="${x2}" y2="${yTop}" stroke="${color}" stroke-width="3"/><line x1="${x1}" y1="${yBot}" x2="${x2}" y2="${yBot}" stroke="${color}" stroke-width="3"/>`
// 灯泡符号（圆 + 叉）
const lamp = (cx, cy, r = 14, color = '#334155') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="2"/><line x1="${cx - r * 0.6}" y1="${cy - r * 0.6}" x2="${cx + r * 0.6}" y2="${cy + r * 0.6}" stroke="${color}" stroke-width="1.8"/><line x1="${cx - r * 0.6}" y1="${cy + r * 0.6}" x2="${cx + r * 0.6}" y2="${cy - r * 0.6}" stroke="${color}" stroke-width="1.8"/>`
// 电池（竖直母线上的长短线）
const batteryV = (x, y, color = '#334155') =>
  `<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${color}" stroke-width="2.5"/><line x1="${x - 7}" y1="${y + 11}" x2="${x + 7}" y2="${y + 11}" stroke="${color}" stroke-width="4"/>`
// 开关（两个端点 + 斜闸刀）
const switchS = (x, y, color = '#334155') =>
  `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/><circle cx="${x + 30}" cy="${y}" r="3" fill="${color}"/><line x1="${x}" y1="${y}" x2="${x + 27}" y2="${y - 12}" stroke="${color}" stroke-width="2"/>`
// 结点（实心圆点）
const junction = (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="#334155"/>`
// 天花板（线 + 上方斜刻线）
const ceiling = (x1, x2, y) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#334155" stroke-width="2"/>` +
  [x1 + 15, x1 + 45, x1 + 75, x1 + 105].filter((x) => x < x2 - 5).map((x) => `<line x1="${x}" y1="${y}" x2="${x + 12}" y2="${y - 10}" stroke="#94a3b8" stroke-width="1.5"/>`).join('')
// 竖直气缸（左右壁 + 底 + 活塞 + 气体区），pistonY=活塞顶
const cylBase = (pistonY, gasLabel = '气体') => {
  const gasTop = pistonY + 14
  return (
    `<line x1="150" y1="60" x2="150" y2="200" stroke="#334155" stroke-width="2"/>` +
    `<line x1="250" y1="60" x2="250" y2="200" stroke="#334155" stroke-width="2"/>` +
    `<line x1="150" y1="200" x2="250" y2="200" stroke="#334155" stroke-width="3"/>` +
    `<rect x="152" y="${gasTop}" width="96" height="${Math.max(4, 198 - gasTop)}" fill="#dbeafe" opacity="0.6"/>` +
    `<rect x="144" y="${pistonY}" width="112" height="14" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>` +
    (gasLabel ? txt(200, (gasTop + 198) / 2 + 5, gasLabel, '#334155', 12) : '')
  )
}
// 斜面（顶点角度任意）：左底角 (x0,y0)，斜边升角 ang，右底角 x1
const incline = (x0, y0, x1, ang, fill = '#eef2ff') => {
  const apexX = x0 + (y0 - 46) / Math.tan((ang * Math.PI) / 180)
  return `<polygon points="${x0},${y0} ${apexX.toFixed(1)},46 ${x1},${y0}" fill="${fill}" stroke="#334155" stroke-width="2"/>`
}
// 斜面上的物块（旋转矩形，中心 (cx,cy)，斜边方向角 ang，边长 w/h）
const slopeBlock = (cx, cy, ang, w = 46, h = 30, fill = '#c7d2fe') => {
  const a = (-ang * Math.PI) / 180
  const ux = Math.cos(a), uy = Math.sin(a)
  const px = -uy, py = ux
  const p = [
    [cx - (w / 2) * ux - (h / 2) * px, cy - (w / 2) * uy - (h / 2) * py],
    [cx + (w / 2) * ux - (h / 2) * px, cy + (w / 2) * uy - (h / 2) * py],
    [cx + (w / 2) * ux + (h / 2) * px, cy + (w / 2) * uy + (h / 2) * py],
    [cx - (w / 2) * ux + (h / 2) * px, cy - (w / 2) * uy + (h / 2) * py],
  ]
  return `<polygon points="${p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')}" fill="${fill}" stroke="#334155" stroke-width="2"/>`
}
// 斜面底角弧线 + 角度标注
const slopeArc = (x0, y0, ang) => {
  const a = (ang * Math.PI) / 180
  const ex = x0 + 36 * Math.cos(a), ey = y0 - 36 * Math.sin(a)
  return `<path d="M ${x0 + 36} ${y0} A 36 36 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="#334155" stroke-width="1.5"/>` + txt(x0 + 52, y0 - 12, `${ang}°`, '#334155', 12)
}
// 俯视导轨组：两轨 + 左端电阻 + 导体棒
const railsTop = ({ rX = 90, rodX = 240, y1 = 80, y2 = 180, rodLabel = '', hasR = true, rLabel = 'R' }) => {
  let s = rail(y1, 50, 350) + rail(y2, 50, 350)
  if (hasR) s += resistor(rX, y1, y2) + txt(rX - 22, (y1 + y2) / 2 + 5, rLabel, '#334155', 14, 'end')
  s += `<line x1="${rodX}" y1="${y1 - 6}" x2="${rodX}" y2="${y2 + 6}" stroke="#334155" stroke-width="5"/>`
  if (rodLabel) s += txt(rodX, y1 - 14, rodLabel)
  s += txt(330, y2 + 22, '导轨', '#64748b', 12, 'end')
  return s
}

// ================= 逐题新图 =================

// ---------- #168 斜面（37°）+ 顶端定滑轮 + 悬挂钩码 M（求 M 范围，不画摩擦力方向） ----------
const IN37 = incline(60, 190, 300, 37)
const FIG_168 =
  SVG_HEAD + IN37 + ground(190) + slopeArc(60, 190, 37) +
  slopeBlock(162, 122, 37) + txt(150, 128, 'm') +
  pulley(252, 44) + txt(252, 26, '定滑轮') +
  `<line x1="182" y1="98" x2="245" y2="50" stroke="#334155" stroke-width="2"/>` +
  `<line x1="252" y1="56" x2="252" y2="112" stroke="#334155" stroke-width="2"/>` +
  `<rect x="234" y="112" width="36" height="42" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(252, 138, 'M') +
  '</svg>'

// ---------- 皮带传动模板：主动轮 A（小）—皮带—从动轮 B（大，同轴 C） ----------
const beltDrive = (labels) => {
  const [la, lb, lc, extra] = labels
  return (
    SVG_HEAD +
    `<circle cx="110" cy="120" r="30" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="280" cy="120" r="60" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="280" cy="120" r="14" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
    `<line x1="110" y1="90" x2="280" y2="60" stroke="#334155" stroke-width="2"/>` +
    `<line x1="110" y1="150" x2="280" y2="180" stroke="#334155" stroke-width="2"/>` +
    dot(110, 120) + dot(280, 120) +
    txt(110, 125, la) + txt(258, 125, lb) + txt(280, 125, lc) +
    (extra || '') +
    '</svg>'
  )
}
// #279 皮带传动 A-B-C（半径尺寸线）
const FIG_279 =
  beltDrive(['A', 'B', 'C',
    `<line x1="110" y1="120" x2="140" y2="120" stroke="#64748b" stroke-width="1.2"/>` + txt(122, 110, 'r_A', '#64748b', 12) +
    `<line x1="280" y1="120" x2="340" y2="120" stroke="#64748b" stroke-width="1.2"/>` + txt(310, 110, 'r_B', '#64748b', 12)])
// #627 同底异构：甲-乙-丙 + 边缘点 P/Q（转向未问不画箭头）
const FIG_627 =
  beltDrive(['甲', '乙', '丙',
    dot(294, 120) + txt(302, 110, 'P', '#334155', 13, 'start') +
    dot(340, 120) + txt(350, 126, 'Q', '#334155', 13, 'start')])

// ---------- #667 天花板-弹簧-甲-乙（θ 角）-定滑轮-丙（水平桌面） ----------
const FIG_667 =
  SVG_HEAD +
  ceiling(100, 260, 40) +
  spring(140, 40, 140, 92, 5, 10) + txt(120, 70, 'k', '#334155', 13, 'end') +
  `<circle cx="140" cy="108" r="11" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(140, 113, '甲', '#334155', 12) +
  `<line x1="140" y1="119" x2="140" y2="160" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 3"/>` +
  `<line x1="147" y1="116" x2="162" y2="161" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 140 138 A 22 22 0 0 1 150.5 135.9" fill="none" stroke="#334155" stroke-width="1.5"/>` + txt(154, 148, 'θ') +
  `<circle cx="168" cy="170" r="11" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(168, 175, '乙', '#334155', 12) +
  `<line x1="179" y1="170" x2="250" y2="170" stroke="#334155" stroke-width="2"/>` +
  pulley(262, 170) + txt(262, 148, '定滑轮') +
  `<line x1="274" y1="170" x2="292" y2="170" stroke="#334155" stroke-width="2"/>` +
  `<line x1="276" y1="182" x2="370" y2="182" stroke="#334155" stroke-width="2"/>` +
  [290, 316, 342].map((x) => `<line x1="${x}" y1="192" x2="${x + 10}" y2="182" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
  `<rect x="292" y="144" width="42" height="38" rx="3" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(313, 168, '丙', '#334155', 12) +
  '</svg>'

// ---------- #830 俯视导轨 + 导体棒 + 左端 R + 定滑轮 + 悬挂物块（B 竖直向下⊗；vm 待求不画 v） ----------
const FIG_830 =
  SVG_HEAD +
  rail(80, 50, 350) + rail(200, 50, 350) +
  resistor(90, 80, 200) + txt(68, 144, 'R', '#334155', 14, 'end') +
  `<line x1="240" y1="74" x2="240" y2="206" stroke="#334155" stroke-width="5"/>` + txt(240, 64, '导体棒') +
  cross(160, 112) + cross(310, 112) + cross(160, 170) + cross(310, 170) +
  txt(200, 42, 'B（竖直向下）', '#4f46e5') +
  `<line x1="232" y1="140" x2="132" y2="140" stroke="#334155" stroke-width="2"/>` +
  pulley(124, 140, 9) +
  `<line x1="124" y1="149" x2="124" y2="192" stroke="#334155" stroke-width="2"/>` +
  `<rect x="106" y="192" width="36" height="40" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` + txt(124, 216, '物块', '#334155', 12) +
  '</svg>'

// ---------- 斜面导轨（侧视）模板：斜面 + 两根平行导轨 + 导体棒 + 顶端 R ----------
const inclineRails = (ang, { bLabel, odots = false, arrows = false, rLabel = 'R', rodLabel = 'ab', mu = '' }) => {
  const a = (-ang * Math.PI) / 180
  const ux = Math.cos(a), uy = Math.sin(a) // 沿斜面向上
  const px = -uy, py = ux // 垂直斜面（指向左下）
  const p0 = { x: 110, y: 163 } // 导轨下端
  const seg = (t0, t1, off) => {
    const q0 = { x: p0.x + ux * t0 + px * off, y: p0.y + uy * t0 + py * off }
    const q1 = { x: p0.x + ux * t1 + px * off, y: p0.y + uy * t1 + py * off }
    return `<line x1="${q0.x.toFixed(1)}" y1="${q0.y.toFixed(1)}" x2="${q1.x.toFixed(1)}" y2="${q1.y.toFixed(1)}" stroke="#334155" stroke-width="2"/>`
  }
  let s = IN_BASE[ang] + ground(190) + slopeArc(60, 190, ang)
  s += seg(0, 150, -3) + seg(0, 150, 3) // 两根平行导轨
  // 导体棒（垂直导轨，中点 t=75）
  const c = { x: p0.x + ux * 75, y: p0.y + uy * 75 }
  const r1 = { x: c.x + px * 11, y: c.y + py * 11 }
  const r2 = { x: c.x - px * 11, y: c.y - py * 11 }
  s += `<line x1="${r1.x.toFixed(1)}" y1="${r1.y.toFixed(1)}" x2="${r2.x.toFixed(1)}" y2="${r2.y.toFixed(1)}" stroke="#334155" stroke-width="5"/>`
  s += txt(c.x + 20, c.y + 18, rodLabel, '#334155', 13)
  // 顶端电阻
  const rt = { x: p0.x + ux * 148 + px * -14, y: p0.y + uy * 148 + py * -14 }
  s += `<rect x="${(rt.x - 11).toFixed(1)}" y="${(rt.y - 11).toFixed(1)}" width="22" height="22" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(rt.x + 18, rt.y + 5, rLabel, '#334155', 13, 'start')
  // 磁场
  if (odots) s += odot(p0.x + ux * 40 + px * -30, p0.y + uy * 40 + py * -30) + odot(p0.x + ux * 90 + px * -30, p0.y + uy * 90 + py * -30) + odot(p0.x + ux * 128 + px * -30, p0.y + uy * 128 + py * -30)
  if (arrows) s += arrow(p0.x + ux * 40 + px * -26, p0.y + uy * 40 + py * -26, p0.x + ux * 40 + px * -26, p0.y + uy * 40 + py * -70, '#4f46e5', 2) + arrow(p0.x + ux * 95 + px * -26, p0.y + uy * 95 + py * -26, p0.x + ux * 95 + px * -26, p0.y + uy * 95 + py * -70, '#4f46e5', 2)
  s += txt(200, 36, bLabel, '#4f46e5') + txt(322, 196, '导轨', '#64748b', 12, 'end')
  if (mu) s += txt(140, 168, mu, '#64748b', 12)
  return s
}
// 各角度斜面底板缓存（含描边）
const IN_BASE = {}
for (const ang of [30, 37]) IN_BASE[ang] = incline(60, 190, 300, ang)

// #874 斜面导轨 + 棒静止 + B 竖直向上（电流方向待判 → 不画电流箭头）
const FIG_874 = SVG_HEAD + inclineRails(37, { bLabel: 'B（竖直向上）', arrows: true, mu: 'μ=0.5' }) + '</svg>'
// #140 斜面导轨 + 棒下滑 + B 垂直导轨平面向上（vm 待求 → 不画 v）
const FIG_140 = SVG_HEAD + inclineRails(30, { bLabel: 'B（垂直导轨平面向上）', odots: true }) + '</svg>'
// #828 同 #140 异构（导轨上端 R、棒 ab）
const FIG_828 = SVG_HEAD + inclineRails(30, { bLabel: 'B（垂直导轨平面向上）', odots: true }) + txt(232, 90, 'R', '#334155', 13) + '</svg>'

// ---------- #474 气垫导轨（30° 斜面）+ 滑块 + A/B 两个光电门 ----------
const FIG_474 =
  SVG_HEAD + IN_BASE[30] + ground(190) + slopeArc(60, 190, 30) +
  slopeBlock(150, 130, 30) + txt(150, 136, '滑块', '#334155', 12) +
  [[186, 110, 'A'], [222, 89, 'B']].map(([x, y, l]) => {
    // 光电门：垂直斜面的短双刻线 + 标签
    const pxN = -Math.sin((-30 * Math.PI) / 180), pyN = Math.cos((-30 * Math.PI) / 180)
    return `<line x1="${(x - 6 * pxN).toFixed(1)}" y1="${(y - 6 * pyN).toFixed(1)}" x2="${(x + 6 * pxN).toFixed(1)}" y2="${(y + 6 * pyN).toFixed(1)}" stroke="#ef4444" stroke-width="2.5"/>` + txt(x + 14, y + 4, l, '#ef4444', 13, 'start')
  }).join('') +
  txt(120, 60, '光电门', '#ef4444', 12) +
  txt(330, 208, '气垫导轨', '#64748b', 12, 'end') +
  '</svg>'

// ---------- #27 斜面（30°）+ 物块 + 沿斜面向上拉力 F ----------
const FIG_27 =
  SVG_HEAD + IN_BASE[30] + ground(190) + slopeArc(60, 190, 30) +
  slopeBlock(150, 130, 30) + txt(138, 136, 'm=2kg') +
  arrow(168, 112, 226, 79) + txt(206, 86, 'F') +
  txt(196, 168, 'μ=√3/3', '#64748b', 12) +
  '</svg>'

// ---------- #777 斜面（30°光滑）+ 甲 + 顶端定滑轮 + 悬挂乙 ----------
const FIG_777 =
  SVG_HEAD + IN_BASE[30] + ground(190) + slopeArc(60, 190, 30) +
  slopeBlock(140, 138, 30) + txt(128, 144, '甲') +
  pulley(272, 60) + txt(272, 42, '定滑轮') +
  `<line x1="166" y1="122" x2="265" y2="66" stroke="#334155" stroke-width="2"/>` +
  `<line x1="272" y1="72" x2="272" y2="120" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="272" cy="134" r="13" fill="#fde68a" stroke="#334155" stroke-width="2"/>` + txt(272, 139, '乙', '#334155', 12) +
  '</svg>'

// ---------- #29 竖直悬挂弹簧 + 物块（伸长量 x=0.2 m 为题干已知） ----------
const FIG_29 =
  SVG_HEAD +
  ceiling(150, 250, 40) +
  spring(200, 40, 200, 112, 6, 12) +
  `<rect x="178" y="112" width="44" height="42" rx="3" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(200, 138, 'm=1kg', '#334155', 12) +
  `<line x1="236" y1="112" x2="236" y2="154" stroke="#64748b" stroke-width="1.2"/><line x1="231" y1="112" x2="241" y2="112" stroke="#64748b" stroke-width="1.2"/><line x1="231" y1="154" x2="241" y2="154" stroke="#64748b" stroke-width="1.2"/>` +
  txt(244, 136, '伸长量 x=0.2 m', '#64748b', 12, 'start') +
  '</svg>'

// ---------- #384 水平弹簧一端固定 + F 拉伸（伸长量数值为待填项 → 不标 x 值） ----------
const FIG_384 =
  SVG_HEAD +
  `<line x1="70" y1="80" x2="70" y2="200" stroke="#334155" stroke-width="2"/>` +
  [96, 128, 160, 192].map((y) => `<line x1="70" y1="${y}" x2="58" y2="${y + 12}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
  spring(70, 160, 180, 160, 6, 12) +
  `<rect x="180" y="136" width="44" height="48" rx="3" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  arrow(224, 160, 292, 160) + txt(258, 146, 'F') +
  txt(124, 205, '伸长量 x', '#64748b', 12) +
  '</svg>'

// ---------- #187 水平地面 + 物块 + 水平向右拉力 F（原图箭头朝左与做正功矛盾） ----------
const FIG_187 =
  SVG_HEAD + ground(170) +
  `<rect x="150" y="124" width="90" height="46" rx="4" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(195, 152, 'm') +
  arrow(244, 147, 314, 147) + txt(280, 133, 'F') +
  '</svg>'

// ---------- #663 水平地面 + 物块 + 与水平成 37° 斜向上拉力 F（原图画成水平向左） ----------
const FIG_663 =
  SVG_HEAD + ground(170) +
  `<rect x="150" y="124" width="90" height="46" rx="4" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(200, 152, 'm') +
  arrow(196, 118, 262, 69) + txt(240, 84, 'F') +
  `<path d="M 268 147 A 72 72 0 0 0 253.4 103.6" fill="none" stroke="#334155" stroke-width="1.5"/>` + txt(284, 124, '37°', '#334155', 12) +
  '</svg>'

// ---------- 竖直气缸六题 ----------
// #483 活塞上方轻弹簧连固定支架
const FIG_483 =
  SVG_HEAD + ceiling(160, 240, 52) +
  spring(200, 52, 200, 130, 5, 10) + txt(216, 96, 'k', '#334155', 13, 'start') +
  cylBase(136) + txt(200, 147, 'm', '#334155', 12) +
  txt(262, 146, '活塞', '#334155', 12, 'start') +
  '</svg>'
// #581 竖直绝热气缸 + 电热丝缓慢加热
const FIG_581 =
  SVG_HEAD + cylBase(136) +
  `<path d="M 165 190 Q 172 182 180 190 T 196 190 T 212 190 T 228 190" fill="none" stroke="#ef4444" stroke-width="2"/>` +
  txt(200, 216, '电热丝', '#ef4444', 12) +
  txt(200, 50, '绝热气缸', '#64748b', 12) +
  '</svg>'
// #803 绝热气缸内理想气体（分子动理论）
const FIG_803 =
  SVG_HEAD + cylBase(120, '') + txt(200, 170, '理想气体', '#334155', 12) +
  txt(200, 50, '绝热气缸', '#64748b', 12) +
  '</svg>'
// #806 活塞压缩气体（画压缩方向箭头）
const FIG_806 =
  SVG_HEAD + cylBase(156, '') + txt(200, 190, '气体', '#334155', 11) +
  txt(266, 148, '活塞', '#334155', 12, 'start') +
  arrow(200, 108, 200, 148, '#ef4444', 2) + txt(216, 130, '压缩', '#ef4444', 12, 'start') +
  txt(200, 50, '气缸', '#64748b', 12) +
  '</svg>'
// #807 活塞上缓慢加细砂（等温压缩）
const FIG_807 =
  SVG_HEAD + cylBase(136) +
  txt(266, 146, '活塞', '#334155', 12, 'start') +
  [176, 186, 196, 206, 216].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 128 : 132}" r="2.5" fill="#94a3b8"/>`).join('') +
  txt(200, 116, '细砂', '#64748b', 12) +
  txt(200, 44, '大气压 p₀', '#64748b', 12) +
  '</svg>'
// #904 底部阀门抽气 → 活塞上移（虚线为末态位置）→ 加热 → 压回
const FIG_904 =
  SVG_HEAD + cylBase(136) +
  txt(266, 146, '活塞', '#334155', 12, 'start') +
  `<rect x="144" y="104" width="112" height="14" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>` +
  `<rect x="142" y="182" width="10" height="12" fill="#334155"/>` +
  txt(150, 214, '阀门', '#334155', 12) +
  arrow(140, 188, 102, 188, '#64748b', 2) + txt(96, 208, '抽气', '#64748b', 12) +
  '</svg>'

// ---------- #696 竖直气缸 + 销钉固定活塞 + 活塞上重物（等容升温） ----------
const FIG_696 =
  SVG_HEAD + cylBase(136) +
  txt(266, 146, '活塞', '#334155', 12, 'start') +
  `<rect x="180" y="108" width="40" height="26" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` + txt(200, 126, 'm', '#334155', 12) +
  `<rect x="144" y="134" width="8" height="18" fill="#334155"/><rect x="248" y="134" width="8" height="18" fill="#334155"/>` +
  txt(134, 130, '销钉', '#334155', 12, 'end') +
  '</svg>'

// ---------- 俯视导轨六题（B 方向：竖直向上=⊙ / 竖直向下=⊗；待求量不画） ----------
// #456 单棒 ab，v₀ 已知可画；B 竖直向上
const FIG_456 =
  SVG_HEAD + railsTop({ rodX: 240, rodLabel: 'ab' }) +
  odot(150, 130) + odot(200, 100) + odot(310, 100) + odot(310, 160) +
  txt(200, 46, 'B（竖直向上）', '#4f46e5') +
  arrow(250, 130, 306, 130) + txt(278, 118, 'v₀') +
  '</svg>'
// #457 双棒 a、b（a 有初速度 v₀，b 静止）；B 竖直向上；不画最终电流方向
const FIG_457 =
  SVG_HEAD + rail(80, 50, 350) + rail(180, 50, 350) +
  `<line x1="150" y1="74" x2="150" y2="186" stroke="#334155" stroke-width="5"/>` + txt(150, 64, 'a') +
  `<line x1="290" y1="74" x2="290" y2="186" stroke="#334155" stroke-width="5"/>` + txt(290, 64, 'b') +
  odot(110, 130) + odot(220, 100) + odot(340, 100) + odot(220, 160) +
  txt(220, 46, 'B（竖直向上）', '#4f46e5') +
  txt(330, 202, '导轨', '#64748b', 12, 'end') +
  arrow(158, 130, 210, 130) + txt(184, 118, 'v₀') +
  '</svg>'
// #469 单棒 ab，B 竖直向下⊗，R 左端，v₀ 向右
const FIG_469 =
  SVG_HEAD + railsTop({ rodX: 240, rodLabel: 'ab' }) +
  cross(150, 130) + cross(200, 100) + cross(310, 100) + cross(310, 160) +
  txt(200, 46, 'B（竖直向下）', '#4f46e5') +
  arrow(250, 130, 306, 130) + txt(278, 118, 'v₀') +
  '</svg>'
// #470 单棒（金属棒），B 竖直向下⊗，R 左端，v₀ 向右（异构：棒在右、R 左）
const FIG_470 =
  SVG_HEAD + railsTop({ rX: 320, rodX: 130, rodLabel: '金属棒' }) +
  cross(200, 105) + cross(250, 80) + cross(215, 170) + cross(90, 130) +
  txt(220, 46, 'B（竖直向下）', '#4f46e5') +
  arrow(140, 130, 196, 130) + txt(168, 118, 'v₀') +
  '</svg>'
// #796 恒力 F 拉棒（F 已知可画；vm 待求不画 v）；B 竖直向下⊗
const FIG_796 =
  SVG_HEAD + railsTop({ rodX: 200, rodLabel: '导体棒' }) +
  cross(130, 130) + cross(280, 100) + cross(130, 180) + cross(320, 160) +
  txt(220, 46, 'B（竖直向下）', '#4f46e5') +
  arrow(210, 140, 266, 140) + txt(238, 128, 'F') +
  '</svg>'
// #875 恒力 F=0.3N 拉棒 2s 后撤去；B 竖直向下⊗（i-t 图像为选项，不画电流方向）
const FIG_875 =
  SVG_HEAD + railsTop({ rodX: 200, rodLabel: '导体棒' }) +
  cross(130, 130) + cross(280, 100) + cross(130, 180) + cross(320, 160) +
  txt(220, 46, 'B（竖直向下）', '#4f46e5') +
  arrow(210, 140, 266, 140) + txt(238, 128, 'F') +
  '</svg>'

// ---------- #424 / #824 汽车恒加速启动（原图标注 15 m/s 泄露匀加速末速 → 删除，只留已知量） ----------
const carFig = (mLabel, fLabel) =>
  SVG_HEAD + ground(170) +
  `<rect x="140" y="130" width="120" height="26" rx="6" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 155 130 Q 175 108 215 130" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="165" cy="162" r="9" fill="#ffffff" stroke="#334155" stroke-width="2"/><circle cx="235" cy="162" r="9" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  txt(200, 100, mLabel) +
  arrow(272, 146, 322, 146) + txt(297, 132, 'a') +
  txt(200, 214, fLabel, '#64748b', 12) +
  '</svg>'
const FIG_424 = carFig('m=2×10³ kg', '阻力 f=2×10³ N 恒定')
const FIG_824 = carFig('m=2.0×10³ kg', '阻力 f=2.0×10³ N 恒定')

// ---------- #748 小灯泡伏安特性曲线（过原点、斜率递减的曲线 + (U₀,I₀) 点与切线；原图为直线） ----------
const FIG_748 =
  SVG_HEAD +
  arrow(60, 205, 60, 50, '#334155', 2) + arrow(50, 195, 370, 195, '#334155', 2) +
  txt(352, 214, 'U/V', '#334155', 12, 'end') + txt(76, 58, 'I/A', '#334155', 12, 'start') +
  `<path d="M 60 195 Q 100 90 340 60" fill="none" stroke="#334155" stroke-width="2.5"/>` +
  txt(305, 152, '伏安特性曲线', '#334155', 12) +
  dot(150, 109) + txt(150, 96, '(U₀, I₀)', '#334155', 12) +
  `<line x1="66" y1="146" x2="248" y2="73" stroke="#64748b" stroke-width="1.2" stroke-dasharray="5 4"/>` +
  txt(238, 64, '切线', '#64748b', 11) +
  '</svg>'

// ---------- 分压接法电路模板（变阻器全阻值跨电源、滑片引出负载支路；A 与负载串联、V 并联负载） ----------
const fenya = (srcLabel, loadKind, loadLabel) => {
  let load = ''
  let y1 = 140, y2 = 174
  if (loadKind === 'box') load = `<rect x="193" y="${y1}" width="24" height="${y2 - y1}" fill="#ffffff" stroke="#334155" stroke-width="2"/>`
  if (loadKind === 'lamp') load = lamp(205, 157, 14)
  if (loadKind === 'diode') {
    load =
      `<polygon points="196,148 196,166 214,157" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
      `<line x1="214" y1="146" x2="214" y2="168" stroke="#334155" stroke-width="2.5"/>`
  }
  return (
    SVG_HEAD +
    `<polyline points="90,60 90,190" fill="none" stroke="#334155" stroke-width="2"/>` +
    batteryV(90, 116) + txt(64, 126, srcLabel, '#334155', 12, 'end') +
    `<line x1="90" y1="60" x2="140" y2="60" stroke="#334155" stroke-width="2"/>` +
    `<rect x="140" y="54" width="130" height="12" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    arrow(205, 84, 205, 68, '#334155', 2) +
    `<line x1="270" y1="60" x2="330" y2="60" stroke="#334155" stroke-width="2"/>` +
    `<line x1="330" y1="60" x2="330" y2="190" stroke="#334155" stroke-width="2"/>` +
    `<line x1="90" y1="190" x2="330" y2="190" stroke="#334155" stroke-width="2"/>` +
    `<line x1="205" y1="60" x2="205" y2="96" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="205" cy="110" r="14" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(205, 115, 'A') +
    `<line x1="205" y1="124" x2="205" y2="${y1}" stroke="#334155" stroke-width="2"/>` +
    load + txt(155, 163, loadLabel, '#334155', 12, 'end') +
    `<line x1="205" y1="${y2}" x2="205" y2="190" stroke="#334155" stroke-width="2"/>` +
    junction(205, y1) + junction(205, y2) +
    `<line x1="205" y1="${y1}" x2="270" y2="${y1}" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="270" cy="157" r="14" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(270, 162, 'V') +
    `<line x1="270" y1="${y1}" x2="270" y2="143" stroke="#334155" stroke-width="2"/>` +
    `<line x1="270" y1="171" x2="270" y2="${y2}" stroke="#334155" stroke-width="2"/>` +
    `<line x1="270" y1="${y2}" x2="205" y2="${y2}" stroke="#334155" stroke-width="2"/>` +
    txt(200, 222, '分压接法', '#64748b', 12) +
    '</svg>'
  )
}
// ---------- #563 斜面（30°光滑）+ 带正电小球 + 水平向右匀强电场（E 方向为题干给定；N 待求不画） ----------
const FIG_563 =
  SVG_HEAD + IN_BASE[30] + ground(190) + slopeArc(60, 190, 30) +
  `<circle cx="160" cy="117" r="13" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(160, 92, '带正电小球', '#334155', 12) +
  arrow(252, 80, 330, 80, '#2563eb', 2) + arrow(252, 140, 330, 140, '#2563eb', 2) +
  txt(336, 114, 'E', '#2563eb', 14, 'start') +
  '</svg>'

// #565 小灯泡伏安特性（分压 + 电流表外接，均为题干明示 → 可画完整电路）
const FIG_565 = fenya('电源 6V', 'lamp', '小灯泡')
// #751 小灯泡伏安特性（分压 + 外接，题干明示 → 可画完整电路）
const FIG_751 = fenya('电源 6V', 'lamp', '小灯泡')

// 中性器材图（#568/#684/#745/#746/#749：题干问「应采用何种接法」→ 只列器材不画接线拓扑，防泄露答案接法）
const batteryH = (x, y, color = '#334155') =>
  `<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y + 14}" stroke="${color}" stroke-width="2.5"/><line x1="${x + 10}" y1="${y - 7}" x2="${x + 10}" y2="${y + 7}" stroke="${color}" stroke-width="4"/>`
const apparatusRow = (srcLabel, loadKind, loadLabel) => {
  let load = ''
  if (loadKind === 'box') load = `<rect x="262" y="108" width="24" height="24" fill="#ffffff" stroke="#334155" stroke-width="2"/>`
  if (loadKind === 'lamp') load = lamp(274, 120, 13)
  if (loadKind === 'diode') {
    load =
      `<polygon points="266,110 266,130 284,120" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
      `<line x1="284" y1="108" x2="284" y2="132" stroke="#334155" stroke-width="2.5"/>`
  }
  return (
    SVG_HEAD +
    `<line x1="40" y1="120" x2="60" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>` +
    batteryH(70, 120) + txt(75, 96, '电源', '#334155', 12) +
    `<line x1="80" y1="120" x2="110" y2="120" stroke="#334155" stroke-width="2"/>` +
    switchS(110, 120) + txt(122, 96, '开关', '#334155', 12) +
    `<line x1="140" y1="120" x2="150" y2="120" stroke="#334155" stroke-width="2"/>` +
    `<rect x="150" y="112" width="60" height="16" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    arrow(180, 94, 180, 110, '#334155', 2) +
    txt(180, 88, '滑动变阻器', '#334155', 12) +
    `<line x1="210" y1="120" x2="225" y2="120" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="238" cy="120" r="13" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(238, 125, 'A') +
    `<line x1="251" y1="120" x2="261" y2="120" stroke="#334155" stroke-width="2"/>` +
    load + txt(274, 94, loadLabel, '#334155', 12) +
    `<line x1="287" y1="120" x2="310" y2="120" stroke="#334155" stroke-width="2"/>` +
    `<line x1="310" y1="120" x2="330" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>` +
    `<circle cx="274" cy="176" r="13" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(274, 181, 'V') +
    `<line x1="260" y1="172" x2="250" y2="166" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<line x1="288" y1="172" x2="298" y2="166" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    '</svg>'
  )
}
// #568 电阻丝测阻（问接法 → 器材图）
const FIG_568 = apparatusRow('电源 6V', 'box', 'Rx')
// #684 电阻率实验（问接法 → 器材图）
const FIG_684 = apparatusRow('电源 3V', 'box', 'Rx')
// #745 小灯泡伏安特性（问接法 → 器材图）
const FIG_745 = apparatusRow('电源 4V', 'lamp', '小灯泡')
// #746 二极管伏安特性（问接法 → 器材图）
const FIG_746 = apparatusRow('电源 3V', 'diode', '二极管')
// #749 灯泡调压（问接法 → 器材图）
const FIG_749 = apparatusRow('电源 6V', 'lamp', '小灯泡')

// ---------- #143 探究感应电流方向实验：条形磁铁（N 极向下）+ 线圈 + 灵敏电流计 G（原图误为电源电路；不画感应电流方向） ----------
const FIG_143 =
  SVG_HEAD +
  `<rect x="126" y="26" width="28" height="58" rx="3" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  txt(140, 78, 'N', '#334155', 14) +
  arrow(184, 40, 184, 82) + txt(196, 64, '向下插入', '#ef4444', 12, 'start') +
  `<ellipse cx="140" cy="130" rx="18" ry="48" fill="none" stroke="#334155" stroke-width="2"/>` +
  `<ellipse cx="140" cy="130" rx="10" ry="48" fill="none" stroke="#334155" stroke-width="1.5"/>` +
  txt(120, 200, '线圈', '#334155', 12) +
  `<line x1="158" y1="112" x2="246" y2="112" stroke="#334155" stroke-width="2"/>` +
  `<line x1="158" y1="148" x2="246" y2="148" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="262" cy="130" r="18" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(262, 136, 'G', '#334155', 14) +
  `<line x1="246" y1="112" x2="256" y2="118" stroke="#334155" stroke-width="2"/>` +
  `<line x1="246" y1="148" x2="256" y2="142" stroke="#334155" stroke-width="2"/>` +
  txt(262, 168, '灵敏电流计', '#334155', 11) +
  '</svg>'

// ---------- #374 / #375 LC 回路（电容 C + 电感 L；原图误为电源+电阻电路） ----------
const lcLoop = (title) =>
  SVG_HEAD +
  capacitor(170, 230, 60, 74) +
  `<line x1="170" y1="60" x2="120" y2="60" stroke="#334155" stroke-width="2"/>` +
  `<line x1="120" y1="60" x2="120" y2="180" stroke="#334155" stroke-width="2"/>` +
  `<line x1="230" y1="74" x2="280" y2="74" stroke="#334155" stroke-width="2"/>` +
  `<line x1="280" y1="74" x2="280" y2="180" stroke="#334155" stroke-width="2"/>` +
  `<line x1="120" y1="180" x2="164" y2="180" stroke="#334155" stroke-width="2"/>` +
  inductorH(164, 180, 4, 10) +
  `<line x1="244" y1="180" x2="280" y2="180" stroke="#334155" stroke-width="2"/>` +
  txt(248, 56, 'C', '#334155', 14, 'start') + txt(204, 214, 'L', '#334155', 14) +
  txt(200, 36, title, '#64748b', 12) +
  '</svg>'
const FIG_374 = lcLoop('LC 振荡电路')
const FIG_375 = lcLoop('调谐电路')

// ---------- #879 自感实验：灯泡 A 与带铁芯线圈 L 并联（断电自感；不画感应电流方向） ----------
const FIG_879 =
  SVG_HEAD +
  `<line x1="70" y1="60" x2="70" y2="190" stroke="#334155" stroke-width="2"/>` +
  batteryV(70, 116) + txt(52, 126, '电源', '#334155', 12, 'end') +
  `<line x1="70" y1="60" x2="110" y2="60" stroke="#334155" stroke-width="2"/>` +
  switchS(110, 60) +
  `<line x1="140" y1="60" x2="330" y2="60" stroke="#334155" stroke-width="2"/>` +
  `<line x1="330" y1="60" x2="330" y2="190" stroke="#334155" stroke-width="2"/>` +
  `<line x1="70" y1="190" x2="330" y2="190" stroke="#334155" stroke-width="2"/>` +
  junction(200, 60) + junction(200, 190) +
  // L 支路（x=200，竖直线圈 + 双线铁芯）
  `<line x1="200" y1="60" x2="200" y2="80" stroke="#334155" stroke-width="2"/>` +
  inductorV(200, 80, 4, 8) +
  `<line x1="200" y1="144" x2="200" y2="190" stroke="#334155" stroke-width="2"/>` +
  `<line x1="212" y1="88" x2="212" y2="136" stroke="#64748b" stroke-width="1.5"/>` +
  `<line x1="218" y1="88" x2="218" y2="136" stroke="#64748b" stroke-width="1.5"/>` +
  txt(186, 116, 'L', '#334155', 14, 'end') +
  // A 支路（x=280，灯泡）
  `<line x1="280" y1="60" x2="280" y2="110" stroke="#334155" stroke-width="2"/>` +
  lamp(280, 124, 14) + txt(302, 128, 'A', '#334155', 13, 'start') +
  `<line x1="280" y1="138" x2="280" y2="190" stroke="#334155" stroke-width="2"/>` +
  txt(200, 222, 'A 与 L 并联', '#64748b', 12) +
  '</svg>'

// ---------- #857 表头改装双图（串联分压 / 并联分流；原图标注 2900Ω 泄露待填答案 → 删除数值） ----------
const meterLoop = (x0, title, parallel) => {
  const xL = x0, xR = x0 + 100
  let s =
    `<line x1="${xL}" y1="90" x2="${xR}" y2="90" stroke="#334155" stroke-width="2"/>` +
    `<line x1="${xL}" y1="170" x2="${xR}" y2="170" stroke="#334155" stroke-width="2"/>` +
    `<line x1="${xL}" y1="90" x2="${xL}" y2="170" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="${xL}" cy="130" r="14" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(xL, 135, 'G') +
    txt(x0 + 50, 64, title, '#334155', 12)
  if (!parallel) {
    s += `<rect x="${x0 + 30}" y="82" width="40" height="16" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(x0 + 50, 76, 'R', '#334155', 12) +
      `<line x1="${xR}" y1="90" x2="${xR}" y2="170" stroke="#334155" stroke-width="2"/>`
  } else {
    // 并联：右侧母线只画两段，中间接入分流电阻
    s += `<rect x="${xR - 8}" y="110" width="16" height="40" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(xR + 16, 134, 'R', '#334155', 12, 'start') +
      junction(xR, 90) + junction(xR, 170) +
      `<line x1="${xR}" y1="90" x2="${xR}" y2="110" stroke="#334155" stroke-width="2"/>` +
      `<line x1="${xR}" y1="150" x2="${xR}" y2="170" stroke="#334155" stroke-width="2"/>`
  }
  return s
}
const FIG_857 =
  SVG_HEAD + meterLoop(70, '改装电压表（串联）', false) + meterLoop(230, '改装电流表（并联）', true) + '</svg>'

// ---------- #820 子弹射入木块（原图缺子弹/v₀；板块底板误用） ----------
const FIG_820 =
  SVG_HEAD + ground(190) +
  `<rect x="120" y="146" width="200" height="44" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(220, 172, '木块 M', '#334155', 13) +
  `<rect x="60" y="156" width="48" height="16" rx="2" fill="#334155"/>` +
  txt(84, 144, '子弹 m', '#334155', 12) +
  arrow(24, 164, 54, 164) + txt(38, 150, 'v₀') +
  '</svg>'

// ---------- #840 木板右端固定轻弹簧 + 物块 v₀ 滑上（原图缺弹簧与 v₀） ----------
const FIG_840 =
  SVG_HEAD + ground(180) +
  `<rect x="90" y="146" width="240" height="34" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(120, 168, 'M', '#334155', 13) +
  spring(236, 163, 300, 163, 5, 8) + txt(268, 140, '弹簧', '#334155', 12) +
  `<rect x="98" y="116" width="52" height="30" rx="3" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(124, 136, 'm', '#334155', 13) +
  arrow(52, 131, 92, 131) + txt(70, 118, 'v₀') +
  '</svg>'

// ---------- #675 探究 a-F 实验装置（原图误为「地面+物块」底板；克隆 #478 打点计时器装置图并替换槽码标签） ----------

// ================= 替换执行 =================
const BLOCK150 = '<rect x="150" y="124" width="90" height="46"'
const FIGS = [
  [168, FIG_168, '斜面(37°)+顶端定滑轮+悬挂钩码 M', (o) => cnt(o, '定滑轮') === 1 && !/斜面/.test(o)],
  [279, FIG_279, '皮带传动 A-B-C 三轮 + 半径标注', (o) => cnt(o, '定滑轮') === 1],
  [627, FIG_627, '皮带传动 甲-乙-丙 + 边缘点 P/Q', (o) => cnt(o, '定滑轮') === 1 || cnt(o, '>P<') >= 1],
  [667, FIG_667, '天花板-弹簧-甲-乙(θ)-定滑轮-丙 系统', (o) => cnt(o, '定滑轮') === 1],
  [830, FIG_830, '俯视导轨+棒+R+定滑轮+悬挂物块+B⊗', (o) => cnt(o, '定滑轮') === 1],
  [143, FIG_143, '磁铁(N向下)+线圈+灵敏电流计 G', (o) => cnt(o, '电源') >= 1],
  [374, FIG_374, 'LC 振荡回路（C+L）', (o) => cnt(o, '电源') >= 1],
  [375, FIG_375, 'LC 调谐回路（C+L）', (o) => cnt(o, '闭合线圈') >= 1],
  [580, null, '俯视导轨+棒+R+B⊗（去「0.8」泄露）', (o) => cnt(o, '电源') >= 1 && cnt(o, '0.8') >= 1],
  [857, FIG_857, '表头改装双图（去「2900」泄露）', (o) => cnt(o, '2900') >= 1],
  [879, FIG_879, '灯 A 与线圈 L 并联自感电路', (o) => cnt(o, '电源') >= 1],
  [874, FIG_874, '斜面导轨侧视+棒 ab+B 竖直向上（不画电流方向）', (o) => (cnt(o, 'μ=0.5') === 1 && !/导轨/.test(o)) || cnt(o, 'B（竖直向上）') >= 1],
  [27, FIG_27, '斜面(30°)+物块+沿斜面向上 F', (o) => (cnt(o, '>F<') === 0 && cnt(o, 'μ=0.577') === 1) || cnt(o, 'μ=√3/3') >= 1],
  [140, FIG_140, '斜面导轨侧视+棒+B 垂直导轨平面向上⊙', (o) => cnt(o, 'μ=0') === 1 || cnt(o, 'B（垂直导轨平面向上）') >= 1],
  [828, FIG_828, '竖直平面斜面导轨侧视+棒 ab+B⊙（v/电流方向均待求不画）', (o) => (cnt(o, 'μ=0') === 1 && cnt(o, '无') >= 1) || cnt(o, 'B（垂直导轨平面向上）') >= 1],
  [474, FIG_474, '斜面气垫导轨+滑块+A/B 光电门', (o) => cnt(o, 'μ=0') === 1 || cnt(o, '光电门') >= 1],
  [777, FIG_777, '斜面(30°光滑)+甲+顶端定滑轮+乙', (o) => cnt(o, 'μ=0') === 1],
  [29, FIG_29, '竖直悬挂弹簧+物块（原图误为水平放置）', (o) => cnt(o, 'M 70 160 L 84 146') === 1],
  [384, FIG_384, '水平弹簧+F 拉伸（去「x=0.03m」泄露）', (o) => cnt(o, 'M 70 160 L 84 146') === 1 && cnt(o, '0.03') >= 1],
  [187, FIG_187, '水平地面+物块+F 向右（原箭头朝左）', (o) => cnt(o, '<polygon points="90,146') === 1],
  [663, FIG_663, 'F 与水平成 37° 斜向上（原箭头水平向左）', (o) => cnt(o, '<polygon points="90,146') === 1],
  [483, FIG_483, '竖直气缸+活塞上方弹簧连支架', (o) => cnt(o, '温度计') === 1],
  [581, FIG_581, '竖直绝热气缸+电热丝', (o) => cnt(o, '温度计') === 1],
  [803, FIG_803, '竖直绝热气缸+理想气体', (o) => cnt(o, '温度计') === 1 || cnt(o, '理想气体') >= 1],
  [806, FIG_806, '竖直气缸+压缩箭头', (o) => cnt(o, '温度计') === 1 || cnt(o, '压缩') >= 1],
  [807, FIG_807, '竖直气缸+活塞上加细砂', (o) => cnt(o, '温度计') === 1 || cnt(o, '细砂') >= 1],
  [904, FIG_904, '竖直气缸+底部阀门抽气+末态虚线', (o) => cnt(o, '温度计') === 1 || cnt(o, '抽气') >= 1],
  [696, FIG_696, '竖直气缸+销钉固定活塞+重物', (o) => cnt(o, '销钉') >= 1],
  [456, FIG_456, '俯视导轨+棒 ab+B⊙+v₀', (o) => cnt(o, BLOCK150) === 1 || cnt(o, '>ab<') >= 1],
  [457, FIG_457, '俯视导轨+双棒 a/b+B⊙+v₀', (o) => cnt(o, BLOCK150) === 1 || (cnt(o, '>a<') >= 1 && cnt(o, '>b<') >= 1)],
  [469, FIG_469, '俯视导轨+棒 ab+R+B⊗+v₀', (o) => cnt(o, BLOCK150) === 1 || cnt(o, '>ab<') >= 1],
  [470, FIG_470, '俯视导轨+金属棒+R 右置+B⊗+v₀', (o) => cnt(o, BLOCK150) === 1 || cnt(o, '金属棒') >= 1],
  [796, FIG_796, '俯视导轨+棒+F+B⊗（vm 待求不画 v）', (o) => cnt(o, BLOCK150) === 1 || cnt(o, '导体棒') >= 1],
  [875, FIG_875, '俯视导轨+棒+F+B⊗（i-t 为选项不画电流）', (o) => cnt(o, BLOCK150) === 1 || cnt(o, '导体棒') >= 1],
  [424, FIG_424, '汽车启动（去「15 m/s」泄露）', (o) => cnt(o, '15 m/s') >= 1],
  [824, FIG_824, '汽车启动（去「15 m/s」泄露）', (o) => cnt(o, '15 m/s') >= 1],
  [748, FIG_748, '伏安特性曲线（曲线+切线，原为直线）', (o) => cnt(o, '伏安特性曲线') >= 1],
  [563, FIG_563, '斜面(30°光滑)+带电小球+水平向右 E（原 E 画成沿斜面向上）', (o) => cnt(o, '带正电小球') >= 1 && cnt(o, '>E<') >= 1],
  [565, FIG_565, '小灯泡伏安特性 分压电路', (o) => cnt(o, '电源') >= 1],
  [568, FIG_568, '电阻丝测阻 器材图（原图标「分压接法」泄答案且画成限流）', (o) => cnt(o, '分压接法') >= 1 && cnt(o, '<rect x="150" y="55" width="110" height="10"') === 1],
  [684, FIG_684, '电阻率实验 器材图（同上）', (o) => cnt(o, '分压接法') >= 1 && cnt(o, '<rect x="150" y="55" width="110" height="10"') === 1],
  [745, FIG_745, '小灯泡伏安特性 器材图（同上）', (o) => cnt(o, '分压接法') >= 1 && cnt(o, '<rect x="150" y="55" width="110" height="10"') === 1],
  [746, FIG_746, '二极管伏安特性 器材图（同上）', (o) => cnt(o, '分压接法') >= 1 && cnt(o, '<rect x="150" y="55" width="110" height="10"') === 1],
  [749, FIG_749, '灯泡调压 器材图（同上）', (o) => cnt(o, '分压接法') >= 1 && cnt(o, '<rect x="150" y="55" width="110" height="10"') === 1],
  [751, FIG_751, '小灯泡伏安特性 分压电路', (o) => cnt(o, '分压接法') >= 1],
  [820, FIG_820, '子弹射入木块（补子弹+v₀）', (o) => cnt(o, '<rect x="90" y="146" width="220" height="34"') === 1],
  [840, FIG_840, '木板+右端弹簧+物块 v₀', (o) => cnt(o, '<rect x="90" y="146" width="220" height="34"') === 1],
]

// #580 的 FIG_580 在上方引用前未定义（保持清单顺序），在此补建
const FIG_580_DEF =
  SVG_HEAD + rail(80, 50, 350) + rail(180, 50, 350) +
  resistor(90, 80, 180) + txt(68, 134, 'R', '#334155', 14, 'end') +
  `<line x1="240" y1="74" x2="240" y2="186" stroke="#334155" stroke-width="5"/>` + txt(240, 64, '金属棒') +
  cross(150, 130) + cross(310, 110) + cross(150, 170) +
  txt(200, 46, 'B（竖直向下）', '#4f46e5') +
  arrow(250, 130, 306, 130) + txt(278, 118, 'v₀') +
  '</svg>'

// 修正 FIGS 中 #580 的引用（定义顺序问题：直接替换数组元素）
const idx580 = FIGS.findIndex((f) => f[0] === 580)
FIGS[idx580][1] = FIG_580_DEF

// #675：克隆 #478 的打点计时器装置图，把槽码标签 m 替换为砂桶
const q478 = get.get(478)
assert(q478 && cnt(q478.figure, '打点计时器') >= 1, '#478 应为打点计时器装置图（克隆源）')
let svg675 = String(JSON.parse(q478.figure).data)
const before675 = cnt(svg675, '>m<')
assert(before675 === 1, `#478 图内 >m< 应恰 1 处，实得 ${before675}`)
svg675 = svg675.replace('>m<', '>砂桶<')
FIGS.push([675, svg675, '打点计时器装置（小车+定滑轮+砂桶）', (o) => cnt(o, BLOCK150) === 1])

// #674 同 #675：克隆 #478 装置图，槽码标签换钩码（原「桌面-定滑轮」底板缺打点计时器/长木板）
const svg674 = String(JSON.parse(q478.figure).data).replace('>m<', '>钩码<')
FIGS.push([674, svg674, '打点计时器装置（小车+定滑轮+钩码）', (o) => cnt(o, '定滑轮') >= 1 && !/打点计时器/.test(o)])

assert(FIGS.length === 49, `应恰好 49 题，实得 ${FIGS.length}`)
const seen = new Set()
for (const [id] of FIGS) {
  assert(!seen.has(id), `题号重复：${id}`)
  seen.add(id)
}

// 新图自检函数：无 NaN/undefined、单 svg 根、图内中文标签与题干共享字符（2b 口径）、图内数字可从题干溯源
function checkNewSvg(id, svg, stem) {
  assert(cnt(svg, 'NaN') === 0 && cnt(svg, 'undefined') === 0, `#${id} 新图含 NaN/undefined`)
  assert((svg.match(/<svg/g) || []).length === 1 && svg.startsWith(SVG_HEAD) && svg.endsWith('</svg>'), `#${id} 新图 svg 结构不合法`)
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ')
  for (const m of texts.matchAll(/[一-龥]{2,}/g)) {
    const t = m[0]
    assert([...t].some((ch) => stem.includes(ch)), `#${id} 图内中文标签「${t}」与题干无共享字符（2b 口径）`)
  }
  for (const m of texts.matchAll(/\d+(?:\.\d+)?/g)) {
    assert(stem.includes(m[0]), `#${id} 图内数字「${m[0]}」未在题干出现（泄露防线）`)
  }
}

for (const [id, svg, note, oldCheck] of FIGS) {
  const q = get.get(id)
  assert(q, `#${id} 不存在`)
  const figNew = JSON.stringify({ kind: 'svg', data: svg })
  if (q.figure === figNew) {
    console.log(`#${id} figure 已是新图，幂等跳过`)
    continue
  }
  const old = JSON.parse(q.figure)
  assert(old.kind === 'svg', `#${id} figure 应为 svg kind`)
  assert(oldCheck(String(old.data)), `#${id} 旧图特征断言未过（防盲替换）`)
  checkNewSvg(id, svg, String(q.stem))
  if (!DRY) {
    db.prepare('UPDATE questions SET figure=? WHERE id=?').run(figNew, id)
    const r = get.get(id)
    assert(r.figure === figNew, `#${id} figure 回读失败`)
    assert(r.stem === q.stem && r.answer === q.answer && r.solution === q.solution && r.pitfall === q.pitfall, `#${id} stem/answer/solution/pitfall 必须零改动`)
    console.log(`#${id} 已重画：${note}`)
  } else {
    console.log(`[dry-run] #${id} 校验全过，未写入（${note}）`)
  }
}

db.close()
console.log(DRY ? 'dry-run 结束' : 'fix-accept77 完成')
