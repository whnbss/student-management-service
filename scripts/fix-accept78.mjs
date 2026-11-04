// 一次性脚本：验收 #78 催办 P1-126 backlog —— 甄别清单待下轮 30 题逐题重画配图（题库质量维护，零物理改动）。
//   清单：变压器/输电 8（#358 #522 #740 #741 #799 #880 #881 #882，补原/副线圈链路图）、转盘 2（#276 #630）、
//   板块/子弹/传送带/气垫/小车 7（#200 #201 #273 #446 #476 #570 #889）、图像/情境 9（#639 #680 #776 #877 #278 #632 #511 #657 #822）、
//   实验 3（#683 #625 #626）+ #797（竖直导轨误画斜面模板，本轮核实为坏图一并重画）。
//   约束（沿用 P1-118/P1-125/P1-126 判例）：只改 figure 字段，stem/answer/solution/pitfall 零改动；
//   每题旧图特征断言（防盲替换）+ 内容一致幂等跳过 + 写库回读断言；新图禁 NaN/undefined、单 svg 根、
//   图内中文标签必须与题干共享字符（2b 口径自检）、图内数字必须可从题干溯源（零答案泄露）；
//   待判方向零泄露：#797 速度/电流方向不画、#822 杆作用力不画、#877 感应电流方向与线圈对磁铁作用力不画、
//   #632 地面参考系轨迹（答案）不画、#446 小车反冲速度不画。
// 用法：node scripts/fix-accept78.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const EMIT = process.argv.includes('--emit') // 渲染预览：把 30 张新图输出 tmp/preview78.html 供目检，不写库
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
const dimH = (x1, x2, y, label) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#64748b" stroke-width="1.2"/><line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/>` +
  txt((x1 + x2) / 2, y + 18, label, '#64748b', 13)
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
const incline = (x0, y0, x1, ang, fill = '#eef2ff') => {
  const apexX = x0 + (y0 - 46) / Math.tan((ang * Math.PI) / 180)
  return `<polygon points="${x0},${y0} ${apexX.toFixed(1)},46 ${x1},${y0}" fill="${fill}" stroke="#334155" stroke-width="2"/>`
}
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
const slopeArc = (x0, y0, ang) => {
  const a = (ang * Math.PI) / 180
  const ex = x0 + 36 * Math.cos(a), ey = y0 - 36 * Math.sin(a)
  return `<path d="M ${x0 + 36} ${y0} A 36 36 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="#334155" stroke-width="1.5"/>` + txt(x0 + 52, y0 - 12, `${ang}°`, '#334155', 12)
}
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
const junction = (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="#334155"/>`
const ceiling = (x1, x2, y) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#334155" stroke-width="2"/>` +
  [x1 + 15, x1 + 45, x1 + 75, x1 + 105].filter((x) => x < x2 - 5).map((x) => `<line x1="${x}" y1="${y}" x2="${x + 12}" y2="${y - 10}" stroke="#94a3b8" stroke-width="1.5"/>`).join('')

// ---------- 本轮新增基元 ----------
const wire = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#334155" stroke-width="2"/>`
// 交流电源（圆 + 正弦曲线）
const acSource = (cx, cy, r = 16) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#334155" stroke-width="2"/><path d="M ${cx - r + 5} ${cy} Q ${cx - r / 2} ${cy - 8} ${cx} ${cy} T ${cx + r - 5} ${cy}" fill="none" stroke="#334155" stroke-width="1.8"/>`
// 竖直绕组线圈（n 个半圆，sweep=0 向左凸 / 1 向右凸）
const coilV = (x, yTop, yBot, n = 4, sweep = 1) => {
  const r = (yBot - yTop) / (2 * n)
  let d = `M ${x} ${yTop}`
  for (let i = 0; i < n; i++) d += ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${x} ${(yTop + 2 * r * (i + 1)).toFixed(1)}`
  return `<path d="${d}" fill="none" stroke="#334155" stroke-width="2"/>`
}
// 变压器主体：双线铁芯 + 左（原）右（副）线圈，返回片段与四端点
const xfmr = (cx, yTop, h) => {
  const yBot = yTop + h
  const core =
    `<line x1="${cx - 5}" y1="${yTop - 9}" x2="${cx - 5}" y2="${yBot + 9}" stroke="#334155" stroke-width="2"/>` +
    `<line x1="${cx + 5}" y1="${yTop - 9}" x2="${cx + 5}" y2="${yBot + 9}" stroke="#334155" stroke-width="2"/>`
  return {
    svg:
      core +
      coilV(cx - 16, yTop, yBot, 4, 0) + coilV(cx + 16, yTop, yBot, 4, 1),
    pTop: [cx - 16, yTop], pBot: [cx - 16, yBot], sTop: [cx + 16, yTop], sBot: [cx + 16, yBot],
  }
}
// 水平电阻（导线中间接矩形）
const resistorH = (x1, x2, y, w = 34) => {
  const xs = (x1 + x2) / 2 - w / 2
  return wire(x1, y, +xs.toFixed(1), y) + `<rect x="${xs.toFixed(1)}" y="${y - 8}" width="${w}" height="16" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + wire(+ (xs + w).toFixed(1), y, x2, y)
}
// 滑动变阻器（矩形 + 斜置滑杆箭头）
const rheostatH = (x1, x2, y) => resistorH(x1, x2, y) + arrow((x1 + x2) / 2 - 13, y - 22, (x1 + x2) / 2 + 5, y - 6, '#334155', 1.6)
// 紧凑竖直电阻（上下各留 10 直线段）
const resistorC = (x, yTop, yBot, w = 12) => {
  const yc1 = yTop + 10, yc2 = yBot - 10
  return wire(x, yTop, x, yc1) + `<rect x="${x - w / 2}" y="${yc1}" width="${w}" height="${yc2 - yc1}" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + wire(x, yc2, x, yBot)
}
// 电流表/电压表（圆 + 字符 + 可选中文标注）
const meter = (cx, cy, ch, label) =>
  `<circle cx="${cx}" cy="${cy}" r="11" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(cx, cy + 5, ch, '#334155', 12) + (label ? txt(cx, cy - 19, label, '#334155', 11) : '')
// 弧线箭头（a1→a2，sweep=1 顺时针；用于转动方向 ω / 传送带运行方向）
const arcArrow = (cx, cy, r, a1, a2, color = '#334155') => {
  const P = (a) => [+(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1), +(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)]
  const [x1, y1] = P(a1), [x2, y2] = P(a2)
  const dx = -Math.sin((a2 * Math.PI) / 180), dy = Math.cos((a2 * Math.PI) / 180)
  const tip = [+(x2 + 9 * dx).toFixed(1), +(y2 + 9 * dy).toFixed(1)]
  const px = -dy, py = dx
  const b1 = [+(x2 + 4.05 * px).toFixed(1), +(y2 + 4.05 * py).toFixed(1)]
  const b2 = [+(x2 - 4.05 * px).toFixed(1), +(y2 - 4.05 * py).toFixed(1)]
  return `<path d="M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2"/><polygon points="${tip[0]},${tip[1]} ${b1[0]},${b1[1]} ${b2[0]},${b2[1]}" fill="${color}"/>`
}

// ================= 逐题新图 =================

// ---------- 变压器四题公用：电源 + 原线圈 + 铁芯 + 副线圈 + 副边回路 ----------
// #522：副边 R₀ 与滑动变阻器 R 串联（副线圈电压恒定，R 变小）
const t522 = xfmr(112, 94, 52)
const FIG_522 =
  SVG_HEAD +
  acSource(46, 120, 16) + wire(46, 104, 46, 94) + wire(46, 94, 96, 94) + wire(46, 136, 46, 146) + wire(46, 146, 96, 146) +
  t522.svg +
  wire(128, 94, 312, 94) + wire(312, 94, 312, 192) + wire(128, 146, 152, 146) + wire(152, 146, 152, 192) + wire(152, 192, 312, 192) +
  resistorH(180, 222, 192) + rheostatH(246, 296, 192) +
  txt(46, 158, '电源', '#334155', 12) + txt(96, 84, '原线圈', '#334155', 11) + txt(146, 84, '副线圈', '#334155', 11) +
  txt(201, 216, 'R₀', '#334155', 12) + txt(271, 216, 'R', '#334155', 12) +
  '</svg>'

// #799：同一拓扑（R₀ 与 R 串联），几何整体错位防同底板
const t799 = xfmr(104, 90, 58)
const FIG_799 =
  SVG_HEAD +
  acSource(42, 119, 16) + wire(42, 103, 42, 90) + wire(42, 90, 88, 90) + wire(42, 135, 42, 148) + wire(42, 148, 88, 148) +
  t799.svg +
  wire(120, 90, 318, 90) + wire(318, 90, 318, 196) + wire(120, 148, 144, 148) + wire(144, 148, 144, 196) + wire(144, 196, 318, 196) +
  resistorH(184, 226, 196) + rheostatH(248, 300, 196) +
  txt(42, 164, '电源', '#334155', 12) + txt(88, 80, '原线圈', '#334155', 11) + txt(140, 80, '副线圈', '#334155', 11) +
  txt(205, 220, 'R₀', '#334155', 12) + txt(274, 220, 'R', '#334155', 12) +
  '</svg>'

// #740：副边纯电阻负载
const t740 = xfmr(110, 92, 56)
const FIG_740 =
  SVG_HEAD +
  acSource(44, 120, 16) + wire(44, 104, 44, 92) + wire(44, 92, 94, 92) + wire(44, 136, 44, 148) + wire(44, 148, 94, 148) +
  t740.svg +
  wire(126, 92, 314, 92) + wire(314, 92, 314, 190) + wire(126, 148, 154, 148) + wire(154, 148, 154, 190) + wire(154, 190, 314, 190) +
  resistorH(196, 268, 190) +
  txt(94, 82, '原线圈', '#334155', 11) + txt(144, 82, '副线圈', '#334155', 11) +
  txt(232, 172, '负载', '#334155', 12) +
  '</svg>'

// #880：原边串电流表 A，副边并电压表 V + 电阻 R
const t880 = xfmr(108, 92, 56)
const FIG_880 =
  SVG_HEAD +
  acSource(42, 120, 15) + wire(42, 105, 42, 92) + wire(42, 92, 59, 92) + meter(70, 92, 'A', '电流表') + wire(81, 92, 92, 92) +
  wire(42, 135, 42, 148) + wire(42, 148, 92, 148) +
  t880.svg +
  wire(124, 92, 310, 92) + wire(310, 92, 310, 148) + wire(310, 148, 124, 148) +
  junction(170, 92) + junction(170, 148) + wire(170, 92, 170, 109) + meter(170, 120, 'V', '电压表') + wire(170, 131, 170, 148) +
  resistorH(200, 262, 148) +
  txt(92, 166, '原线圈', '#334155', 11) + txt(146, 84, '副线圈', '#334155', 11) +
  txt(231, 174, 'R', '#334155', 12) + txt(42, 162, '电源', '#334155', 12) +
  '</svg>'

// ---------- 输电链路四题公用：发电机 → 升压变压器 → 输电线(R线) → 降压变压器 → 用户 ----------
// #358
const t358a = xfmr(102, 94, 52), t358b = xfmr(310, 94, 52)
const FIG_358 =
  SVG_HEAD +
  acSource(48, 120, 17) + wire(48, 103, 48, 94) + wire(48, 94, 86, 94) + wire(48, 137, 48, 146) + wire(48, 146, 86, 146) +
  t358a.svg +
  wire(118, 94, 196, 94) + resistorH(196, 252, 94) + wire(252, 94, 294, 94) + wire(118, 146, 294, 146) +
  t358b.svg +
  wire(326, 94, 360, 94) + wire(360, 94, 360, 96) + resistor(360, 96, 144) + wire(360, 144, 360, 146) + wire(326, 146, 360, 146) +
  txt(48, 158, '发电机', '#334155', 12) + txt(102, 80, '升压变压器', '#334155', 11) +
  txt(205, 124, '输电线', '#334155', 12) + txt(224, 80, 'R线', '#334155', 11) +
  txt(310, 80, '降压变压器', '#334155', 11) + txt(360, 166, '用户', '#334155', 12) +
  txt(86, 166, '原线圈', '#334155', 10) + txt(124, 166, '副线圈', '#334155', 10) +
  '</svg>'

// #741
const t741a = xfmr(98, 92, 54), t741b = xfmr(306, 92, 54)
const FIG_741 =
  SVG_HEAD +
  acSource(44, 118, 16) + wire(44, 102, 44, 92) + wire(44, 92, 82, 92) + wire(44, 134, 44, 146) + wire(44, 146, 82, 146) +
  t741a.svg +
  wire(114, 92, 190, 92) + resistorH(190, 246, 92) + wire(246, 92, 290, 92) + wire(114, 146, 290, 146) +
  t741b.svg +
  wire(322, 92, 356, 92) + wire(356, 92, 356, 96) + resistor(356, 96, 144) + wire(356, 144, 356, 146) + wire(322, 146, 356, 146) +
  txt(44, 156, '发电机', '#334155', 12) + txt(98, 78, '升压变压器', '#334155', 11) +
  txt(200, 122, '输电线', '#334155', 12) + txt(218, 78, 'R线', '#334155', 11) +
  txt(306, 78, '降压变压器', '#334155', 11) + txt(356, 166, '用户端', '#334155', 12) +
  txt(82, 166, '原线圈', '#334155', 10) + txt(120, 166, '副线圈', '#334155', 10) +
  '</svg>'

// #881：用户端为 R₀（用电器）与滑动变阻器 R 串联
const t881a = xfmr(96, 88, 52), t881b = xfmr(304, 96, 50)
const FIG_881 =
  SVG_HEAD +
  acSource(44, 114, 16) + wire(44, 98, 44, 88) + wire(44, 88, 80, 88) + wire(44, 130, 44, 140) + wire(44, 140, 80, 140) +
  t881a.svg +
  wire(112, 88, 190, 88) + resistorH(190, 250, 88) + wire(250, 88, 288, 88) + wire(112, 140, 288, 140) +
  t881b.svg +
  wire(320, 96, 368, 96) + wire(368, 96, 368, 104) + resistorC(368, 104, 144) + wire(368, 144, 368, 152) +
  resistorC(368, 152, 192) + arrow(392, 162, 378, 170, '#334155', 1.6) + wire(368, 192, 368, 200) +
  wire(368, 200, 320, 200) + wire(320, 200, 320, 146) +
  txt(44, 152, '发电机', '#334155', 12) + txt(96, 74, '升压变压器', '#334155', 11) +
  txt(200, 118, '输电线', '#334155', 12) + txt(220, 74, 'R线', '#334155', 11) +
  txt(304, 82, '降压变压器', '#334155', 11) +
  txt(384, 128, 'R₀', '#334155', 12, 'start') + txt(384, 178, 'R', '#334155', 12, 'start') +
  txt(344, 220, '用电器', '#334155', 11) +
  txt(80, 162, '原线圈', '#334155', 10) + txt(118, 162, '副线圈', '#334155', 10) +
  '</svg>'

// #882
const t882a = xfmr(104, 90, 56), t882b = xfmr(312, 90, 56)
const FIG_882 =
  SVG_HEAD +
  acSource(50, 118, 16) + wire(50, 102, 50, 90) + wire(50, 90, 88, 90) + wire(50, 134, 50, 146) + wire(50, 146, 88, 146) +
  t882a.svg +
  wire(120, 90, 192, 90) + resistorH(192, 248, 90) + wire(248, 90, 296, 90) + wire(120, 146, 296, 146) +
  t882b.svg +
  wire(328, 90, 362, 90) + wire(362, 90, 362, 100) + resistorC(362, 100, 140) + wire(362, 140, 362, 146) + wire(328, 146, 362, 146) +
  txt(50, 156, '发电机', '#334155', 12) + txt(104, 76, '升压变压器', '#334155', 11) +
  txt(204, 120, '输电线', '#334155', 12) + txt(220, 76, 'R线', '#334155', 11) +
  txt(312, 76, '降压变压器', '#334155', 11) + txt(362, 166, '用户', '#334155', 12) +
  txt(88, 166, '原线圈', '#334155', 10) + txt(126, 166, '副线圈', '#334155', 10) +
  '</svg>'

// ---------- 转盘两题：俯视圆盘 + 中心轴 + 物块 + ω 弧箭头 ----------
// #276：单物块
const FIG_276 =
  SVG_HEAD +
  `<circle cx="200" cy="122" r="72" fill="#eef2ff" stroke="#334155" stroke-width="2"/>` +
  arcArrow(200, 122, 88, -80, -10) + txt(272, 50, 'ω', '#334155', 14, 'start') +
  dot(200, 122) + txt(186, 112, '轴 O', '#334155', 12, 'end') +
  `<line x1="200" y1="122" x2="247" y2="104" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  `<rect x="234" y="95" width="26" height="18" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(220, 128, 'r', '#334155', 12) + txt(282, 90, '物块', '#334155', 12, 'start') +
  txt(200, 212, '圆盘', '#334155', 12) +
  '</svg>'

// #630：甲（r₁）乙（r₂）两物块
const FIG_630 =
  SVG_HEAD +
  `<circle cx="185" cy="122" r="76" fill="#eef2ff" stroke="#334155" stroke-width="2"/>` +
  arcArrow(185, 122, 90, -100, -20) + txt(280, 86, 'ω', '#334155', 14, 'start') +
  dot(185, 122) + txt(174, 116, 'O', '#334155', 13, 'end') +
  `<line x1="185" y1="122" x2="215" y2="101" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  `<rect x="203" y="92" width="24" height="17" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(215, 82, '甲', '#334155', 13) + txt(192, 108, 'r₁', '#334155', 12, 'end') +
  `<line x1="185" y1="122" x2="233" y2="150" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  `<rect x="221" y="141" width="24" height="17" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(255, 156, '乙', '#334155', 13, 'start') + txt(196, 148, 'r₂', '#334155', 12, 'end') +
  txt(185, 220, '转盘', '#334155', 12) +
  '</svg>'

// ---------- 板块/子弹/传送带/气垫/小车七题 ----------
// #200：木板 B 上物块 A，A 初速 v₀ 向右、B 初速 u₀ 向左
const FIG_200 =
  SVG_HEAD + ground(190) +
  `<rect x="100" y="148" width="220" height="28" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(170, 166, '木板 B', '#334155', 12) +
  `<rect x="240" y="124" width="44" height="24" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(262, 140, 'A', '#334155', 13) +
  arrow(236, 112, 286, 112) + txt(261, 100, 'v₀') +
  arrow(160, 138, 110, 138, '#2563eb') + txt(135, 126, 'u₀', '#2563eb') +
  '</svg>'

// #201：水平气垫导轨上滑块 A（运动）撞静止滑块 B，中置光电门
const FIG_201 =
  SVG_HEAD +
  rail(150, 60, 360) + rail(174, 60, 360) +
  `<rect x="116" y="116" width="20" height="8" fill="#334155"/>` +
  `<rect x="100" y="124" width="54" height="26" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(127, 142, 'A', '#334155', 13) +
  `<rect x="286" y="116" width="20" height="8" fill="#334155"/>` +
  `<rect x="270" y="124" width="54" height="26" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(297, 142, 'B', '#334155', 13) +
  `<line x1="222" y1="100" x2="222" y2="150" stroke="#334155" stroke-width="2"/>` +
  txt(222, 92, '光电门', '#334155', 12) +
  arrow(90, 104, 140, 104) + txt(115, 92, 'v', '#334155', 13) +
  txt(100, 200, '气垫导轨', '#334155', 12) +
  '</svg>'

// #273：水平传送带（两轮顺时针运行），物块无初速轻放 A 端
const FIG_273 =
  SVG_HEAD +
  `<circle cx="110" cy="150" r="20" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="300" cy="150" r="20" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  rail(130, 110, 300) + rail(170, 110, 300) +
  arcArrow(110, 150, 28, -120, -50) + arcArrow(300, 150, 28, -130, -60) +
  `<rect x="180" y="106" width="40" height="24" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(200, 122, '物块', '#334155', 11) +
  arrow(236, 120, 286, 120) + txt(261, 108, 'v', '#334155', 13) +
  txt(110, 192, 'A', '#334155', 13) + txt(300, 192, 'B', '#334155', 13) +
  txt(200, 214, '传送带', '#334155', 12) +
  '</svg>'

// #446：小车上发射装置水平向右射出小球（小车反冲方向待求不画）
const FIG_446 =
  SVG_HEAD + ground(190) +
  `<circle cx="140" cy="180" r="10" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="210" cy="180" r="10" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  `<rect x="110" y="138" width="130" height="36" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(160, 160, 'M', '#334155', 13) +
  `<rect x="218" y="126" width="42" height="12" fill="#94a3b8" stroke="#334155" stroke-width="1.5"/>` +
  txt(230, 112, '发射装置', '#334155', 11) +
  `<circle cx="292" cy="132" r="8" fill="#334155"/>` +
  txt(292, 118, 'm', '#334155', 13) +
  arrow(304, 132, 340, 132) + txt(322, 120, 'v') +
  '</svg>'

// #476：滑块 A（v₀）—轻弹簧 k—滑块 B，B 右方粗糙面长 L
const FIG_476 =
  SVG_HEAD + ground(190) +
  `<rect x="84" y="140" width="46" height="30" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(107, 159, 'A', '#334155', 13) +
  arrow(46, 155, 76, 155) + txt(61, 143, 'v₀') +
  spring(130, 155, 196, 155) + txt(163, 138, 'k', '#334155', 13) +
  `<rect x="196" y="140" width="46" height="30" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(219, 159, 'B', '#334155', 13) +
  [246, 258, 270, 282, 294, 306, 318, 330].map((x) => `<line x1="${x}" y1="190" x2="${x + 7}" y2="183" stroke="#64748b" stroke-width="1.5"/>`).join('') +
  txt(292, 176, '粗糙', '#334155', 12) +
  dimH(242, 342, 208, 'L') +
  '</svg>'

// #570：子弹以 v₀ 射入长木板左端（深度 d 待求不画；阻力 f 不画避免方向歧义）
const FIG_570 =
  SVG_HEAD + ground(190) +
  `<rect x="120" y="150" width="200" height="26" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(300, 168, 'M', '#334155', 13) +
  `<rect x="96" y="158" width="58" height="12" fill="#334155"/>` +
  txt(104, 148, 'm', '#334155', 13) +
  arrow(44, 164, 86, 164) + txt(65, 150, 'v₀') +
  dimH(120, 320, 214, 'L') +
  '</svg>'

// #889：打点计时器验证机械能守恒装置（重物拖纸带竖直下落，O/A/B/C 计数点）
const timerSetup = (timerX, tapeX, labelsSide) => {
  const timerTop = 34
  const box = `<rect x="${timerX - 32}" y="${timerTop}" width="64" height="30" rx="3" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` + txt(timerX, 54, '打点计时器', '#334155', 11)
  const tape = `<line x1="${tapeX}" y1="64" x2="${tapeX}" y2="196" stroke="#64748b" stroke-width="2"/>`
  const dotYs = [70, 84, 100, 118, 136, 158, 182]
  const dots = dotYs.map((y) => `<circle cx="${tapeX}" cy="${y}" r="2" fill="#334155"/>`).join('')
  const lbl = ['O', 'A', 'B', 'C']
  const lblYs = [70, 100, 136, 182]
  const labels = lblYs.map((y, i) => txt(tapeX + (labelsSide === 'right' ? 12 : -12), y + 4, lbl[i], '#334155', 12, labelsSide === 'right' ? 'start' : 'end')).join('')
  const weight = `<rect x="${tapeX - 16}" y="196" width="32" height="26" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` + txt(tapeX + (labelsSide === 'right' ? 26 : -26), 214, '重物 m', '#334155', 11, labelsSide === 'right' ? 'start' : 'end')
  return box + tape + dots + labels + weight
}
const FIG_889 = SVG_HEAD + timerSetup(200, 200, 'right') + txt(300, 120, '纸带', '#334155', 12, 'start') + '</svg>'
const FIG_683 = SVG_HEAD + timerSetup(160, 160, 'left') + txt(252, 120, '纸带', '#334155', 12, 'start') + '</svg>'

// ---------- 图像/情境九题 ----------
// #639：三段式 v-t 图（匀加速—匀速—匀减速）
const FIG_639 =
  SVG_HEAD +
  arrow(70, 52, 70, 38, '#334155', 1.8) + `<line x1="70" y1="38" x2="70" y2="200" stroke="#334155" stroke-width="2"/>` +
  `<line x1="70" y1="200" x2="360" y2="200" stroke="#334155" stroke-width="2"/>` + arrow(348, 200, 360, 200, '#334155', 1.8) +
  txt(52, 52, 'v', '#334155', 14) + txt(356, 218, 't', '#334155', 14) + txt(58, 216, 'O', '#334155', 13) +
  `<path d="M 70 200 L 150 84 L 270 84 L 350 200" fill="none" stroke="#2563eb" stroke-width="2.5"/>` +
  `<line x1="150" y1="84" x2="150" y2="200" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  `<line x1="270" y1="84" x2="270" y2="200" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  txt(150, 216, 't₁', '#334155', 12) + txt(270, 216, 't₂', '#334155', 12) +
  txt(210, 72, '最大速度', '#334155', 12) +
  '</svg>'

// #680：斜面顶端 A 水平抛出落至斜面 B 点（tanα=2tanθ 待验证不画 α）
const FIG_680 =
  SVG_HEAD +
  `<polygon points="90,55 270,190 90,190" fill="#eef2ff" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 240 190 A 30 30 0 0 0 246 172" fill="none" stroke="#334155" stroke-width="1.5"/>` + txt(214, 182, '37°', '#334155', 12) +
  `<circle cx="90" cy="49" r="7" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + txt(76, 44, 'A', '#334155', 13) +
  arrow(101, 49, 141, 49) + txt(121, 37, 'v₀') +
  `<path d="M 99 52 Q 160 60 210 145" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 4"/>` +
  txt(222, 152, 'B', '#334155', 13) +
  '</svg>'

// #776：斜面（μ₁）→ 水平面（μ₂）→ 竖直光滑半圆轨道，最高点 C
const FIG_776 =
  SVG_HEAD +
  `<polygon points="60,65 220,185 60,185" fill="#eef2ff" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 190 185 A 30 30 0 0 0 196 167" fill="none" stroke="#334155" stroke-width="1.5"/>` + txt(152, 178, '37°', '#334155', 12) +
  slopeBlock(120, 110, -37) + txt(96, 96, 'm', '#334155', 13) +
  `<line x1="220" y1="185" x2="320" y2="185" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="320" cy="135" r="50" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  `<path d="M 320 185 A 50 50 0 0 0 320 85" fill="none" stroke="#334155" stroke-width="2.5"/>` +
  txt(220, 205, 'A', '#334155', 13) + txt(334, 205, 'B', '#334155', 13) + txt(320, 72, 'C', '#334155', 13) +
  '</svg>'

// #877：条形磁铁 N 极向下正对水平桌面固定线圈缓慢下移（感应电流方向/作用力均待判不画）
const FIG_877 =
  SVG_HEAD +
  `<line x1="70" y1="168" x2="330" y2="168" stroke="#334155" stroke-width="2"/>` +
  [90, 130, 170, 210, 250, 290].map((x) => `<line x1="${x}" y1="180" x2="${x + 12}" y2="168" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
  `<ellipse cx="150" cy="160" rx="48" ry="11" fill="none" stroke="#334155" stroke-width="2"/>` +
  `<ellipse cx="150" cy="160" rx="38" ry="7" fill="none" stroke="#334155" stroke-width="1.5"/>` +
  txt(150, 194, '线圈', '#334155', 12) +
  `<rect x="136" y="60" width="28" height="64" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  txt(150, 116, 'N', '#334155', 14) + txt(150, 52, '磁铁', '#334155', 12) +
  arrow(150, 130, 150, 146) + txt(162, 142, '缓慢向下', '#ef4444', 12, 'start') +
  '</svg>'

// #278：水平弯道（俯视），汽车以 v 过半径 R 弯道
const FIG_278 =
  SVG_HEAD +
  `<path d="M 134 204 A 70 70 0 0 1 266 204" fill="none" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 95 190 A 112 112 0 0 1 305 190" fill="none" stroke="#334155" stroke-width="2"/>` +
  dot(200, 227) + txt(190, 234, 'O', '#334155', 13, 'end') +
  `<line x1="200" y1="227" x2="200" y2="137" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  txt(208, 188, 'R', '#334155', 13, 'start') +
  `<rect x="186" y="127" width="28" height="20" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(200, 114, '汽车', '#334155', 12) +
  arrow(218, 137, 254, 137) + txt(236, 125, 'v') +
  txt(330, 160, '弯道', '#334155', 12) +
  '</svg>'

// #632：匀速行驶车厢内乘客竖直向上跳起（地面系轨迹为答案不画）
const FIG_632 =
  SVG_HEAD +
  `<line x1="60" y1="182" x2="350" y2="182" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="130" cy="170" r="12" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="290" cy="170" r="12" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  `<rect x="90" y="96" width="240" height="64" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  `<rect x="116" y="108" width="36" height="22" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
  txt(150, 152, '车厢', '#334155', 13) +
  `<circle cx="230" cy="140" r="6" fill="#334155"/>` +
  `<line x1="230" y1="146" x2="230" y2="158" stroke="#334155" stroke-width="2"/>` +
  arrow(230, 132, 230, 106) + txt(242, 122, '竖直向上', '#ef4444', 12, 'start') +
  arrow(104, 84, 150, 84, '#2563eb') + txt(127, 72, 'v', '#2563eb', 13) +
  '</svg>'

// #511：与水平成 53° 斜向上抛出（落点/射高待求不标数值）
const FIG_511 =
  SVG_HEAD + ground(190) +
  `<circle cx="80" cy="182" r="6" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  arrow(87, 179, 117, 139) + txt(112, 128, 'v₀') +
  `<path d="M 106 182 A 26 26 0 0 0 95.6 161.2" fill="none" stroke="#334155" stroke-width="1.5"/>` +
  txt(116, 172, '53°', '#334155', 12, 'start') +
  `<path d="M 87 178 Q 202 24 317 178" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 4"/>` +
  txt(200, 214, '地面', '#334155', 12) +
  '</svg>'

// #657：消防水枪水平喷出水流冲击竖直墙面
const FIG_657 =
  SVG_HEAD +
  `<line x1="330" y1="56" x2="330" y2="204" stroke="#334155" stroke-width="2"/>` +
  [64, 80, 96, 112, 128, 144, 160, 176, 192].map((y) => `<line x1="330" y1="${y}" x2="342" y2="${y + 10}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
  txt(346, 124, '墙面', '#334155', 12, 'start') +
  `<rect x="66" y="138" width="34" height="18" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  txt(83, 128, '喷嘴', '#334155', 12) +
  `<line x1="100" y1="142" x2="330" y2="146" stroke="#2563eb" stroke-width="1.5" opacity="0.7"/>` +
  `<line x1="100" y1="147" x2="330" y2="147" stroke="#2563eb" stroke-width="1.5" opacity="0.7"/>` +
  `<line x1="100" y1="152" x2="330" y2="148" stroke="#2563eb" stroke-width="1.5" opacity="0.7"/>` +
  arrow(150, 112, 216, 112, '#2563eb') + txt(183, 100, 'v', '#2563eb', 13) +
  txt(220, 132, '水流', '#334155', 12) +
  '</svg>'

// #822：轻杆（一端转轴 O）连小球在竖直平面内圆周（杆作用力大小方向待求不画）
const FIG_822 =
  SVG_HEAD +
  `<circle cx="200" cy="120" r="70" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  dot(200, 120) + txt(212, 126, 'O', '#334155', 13, 'start') +
  txt(158, 124, '转轴', '#334155', 12, 'end') +
  `<line x1="200" y1="120" x2="200" y2="57" stroke="#334155" stroke-width="4"/>` +
  txt(214, 92, '轻杆', '#334155', 12, 'start') +
  `<circle cx="200" cy="50" r="9" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(222, 54, 'm', '#334155', 13, 'start') +
  '</svg>'

// ---------- 实验三题 + #797 ----------
// #625：轻绳系小球竖直平面圆周（最高点临界速度待求不画力/速度）
const FIG_625 =
  SVG_HEAD +
  ceiling(160, 240, 56) + dot(200, 56) + txt(216, 62, 'O', '#334155', 13, 'start') +
  `<circle cx="200" cy="56" r="92" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  txt(214, 104, '轻绳', '#334155', 12, 'start') +
  `<line x1="200" y1="56" x2="200" y2="140" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="200" cy="148" r="9" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(224, 152, 'm', '#334155', 13, 'start') +
  '</svg>'

// #626：同装置不同相位（题干给最高点拉力 F → 球画在最高点）
const FIG_626 =
  SVG_HEAD +
  ceiling(160, 240, 110) + dot(200, 110) + txt(216, 116, 'O', '#334155', 13, 'start') +
  `<circle cx="200" cy="110" r="76" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  `<line x1="200" y1="110" x2="200" y2="42" stroke="#334155" stroke-width="2"/>` +
  txt(214, 80, '轻绳', '#334155', 12, 'start') +
  `<circle cx="200" cy="34" r="9" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(224, 38, 'm', '#334155', 13, 'start') +
  '</svg>'

// #797：竖直平行导轨 + 棒 ab + 上端 R₁ 下端 R₂ + B 垂直导轨平面向里（速度/电流方向均待求不画）
const FIG_797 =
  SVG_HEAD +
  `<line x1="150" y1="40" x2="150" y2="206" stroke="#334155" stroke-width="2.5"/>` +
  `<line x1="270" y1="40" x2="270" y2="206" stroke="#334155" stroke-width="2.5"/>` +
  txt(284, 60, '导轨', '#334155', 12, 'start') +
  wire(150, 52, 182, 52) + wire(238, 52, 270, 52) + `<rect x="182" y="44" width="56" height="16" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(210, 36, 'R₁', '#334155', 13) +
  wire(150, 194, 182, 194) + wire(238, 194, 270, 194) + `<rect x="182" y="186" width="56" height="16" fill="#ffffff" stroke="#334155" stroke-width="2"/>` + txt(210, 220, 'R₂', '#334155', 13) +
  `<line x1="142" y1="120" x2="278" y2="120" stroke="#334155" stroke-width="5"/>` + txt(252, 110, 'ab', '#334155', 13) +
  cross(185, 90) + cross(235, 90) + cross(185, 150) + cross(235, 150) +
  txt(210, 178, 'B（垂直导轨平面向里）', '#4f46e5', 11) +
  '</svg>'

// ================= 替换执行 =================
const FIGS = [
  [358, FIG_358, '发电机→升压变压器→输电线(R线)→降压变压器→用户 链路图（补原/副线圈）', (o) => cnt(o, '电源 500') === 1 && cnt(o, 'r=10Ω') === 1],
  [522, FIG_522, '变压器+副边 R₀ 与滑动变阻器 R 串联', (o) => cnt(o, '电源 220') === 1 && cnt(o, 'r=0Ω') === 1 && cnt(o, '>20<') === 1],
  [740, FIG_740, '降压变压器+副边纯电阻负载', (o) => cnt(o, '电源 220') === 1 && cnt(o, 'r=0Ω') === 1 && cnt(o, '>22<') === 1],
  [741, FIG_741, '发电机→升压→输电线→降压→用户端 链路图', (o) => cnt(o, '电源 250') === 1 && cnt(o, 'r=8Ω') === 1 && cnt(o, '>220<') === 1],
  [799, FIG_799, '变压器+副边 R₀ 与滑动变阻器 R 串联（几何错位）', (o) => cnt(o, '电源 220') === 1 && cnt(o, 'r=0Ω') === 1 && cnt(o, '>10<') === 1],
  [880, FIG_880, '变压器+原边电流表 A+副边电压表 V 与电阻 R', (o) => cnt(o, '电源 220') === 1 && cnt(o, 'r=0Ω') === 1 && cnt(o, '>22<') === 1],
  [881, FIG_881, '输电链路+用户端 R₀ 与滑动变阻器 R 串联', (o) => cnt(o, '电源 250') === 1 && cnt(o, 'r=8Ω') === 1 && cnt(o, '>44<') === 1],
  [882, FIG_882, '输电链路图（发电机→升压→输电线→降压→用户）', (o) => cnt(o, '电源 E') === 1],
  [276, FIG_276, '俯视圆盘+中心轴+物块+r 距离+ω 弧箭头', (o) => cnt(o, '物块') === 1],
  [630, FIG_630, '俯视转盘+甲(r₁)乙(r₂)两物块+ω 弧箭头', (o) => cnt(o, '>m<') === 1],
  [200, FIG_200, '木板 B 上物块 A：A v₀ 向右、B u₀ 向左', (o) => cnt(o, 'A、B 板块') === 1],
  [201, FIG_201, '水平气垫导轨+滑块 A/B+光电门+A 运动箭头', (o) => cnt(o, '光电门测遮光时间') === 1],
  [273, FIG_273, '水平传送带两轮+物块+顺时针运行弧箭头+v', (o) => cnt(o, '顺时针运行') === 1],
  [446, FIG_446, '小车+发射装置+小球向右射出 v（反冲方向不画）', (o) => cnt(o, '向右射出') === 1],
  [476, FIG_476, '滑块 A(v₀)—弹簧 k—滑块 B+右方粗糙段 L', (o) => cnt(o, '粗糙段长 1.2 m') === 1],
  [570, FIG_570, '子弹 v₀ 射入长木板左端+板长 L（深度 d 不画）', (o) => cnt(o, '>m<') === 1],
  [889, FIG_889, '打点计时器+竖直纸带(O/A/B/C)+重物 m 装置图', (o) => cnt(o, '纸带（O、A、B、C 为计数点') === 1],
  [639, FIG_639, '三段式 v-t 图（匀加速—匀速—匀减速）+t₁/t₂ 虚线', (o) => cnt(o, 'v/(m·s⁻¹)') === 1],
  [680, FIG_680, '斜面(37°)顶端 A 水平抛出+虚线轨迹落至斜面 B', (o) => cnt(o, 'μ=0') === 1 && cnt(o, '37°') === 1],
  [776, FIG_776, '斜面(37°)→水平面→竖直半圆轨道 A/B/C 全链', (o) => cnt(o, 'μ=0.5') === 1 && cnt(o, '37°') === 1],
  [877, FIG_877, '条形磁铁 N 向下+水平桌面固定线圈+缓慢向下箭头', (o) => cnt(o, 'N极向下') === 1 && cnt(o, '闭合线圈（平面与磁场垂直）') === 1],
  [278, FIG_278, '俯视弯道双弧+汽车+v+半径 R 虚线', (o) => cnt(o, '20 m/s') === 1],
  [632, FIG_632, '匀速行驶车厢+乘客+竖直向上跳起箭头（轨迹不画）', (o) => cnt(o, 'h=1m') === 1 && cnt(o, '乘客') === 1],
  [511, FIG_511, '斜抛初速 v₀(53°)+虚线抛物线轨迹+地面', (o) => cnt(o, '桌面') === 1 && cnt(o, 'h=0m') === 1],
  [657, FIG_657, '水枪喷嘴+水平水流+竖直墙面（冲击）', (o) => cnt(o, '桌面') === 1 && cnt(o, 'h=0m') === 1],
  [822, FIG_822, '竖直圆周虚线+转轴 O+轻杆+最高点小球（作用力不画）', (o) => cnt(o, 'R=0.6m') === 1],
  [683, FIG_683, '打点计时器+竖直纸带+重物 装置图（左侧计数点标注）', (o) => cnt(o, '25°') === 1 && cnt(o, '>T<') === 1],
  [625, FIG_625, '轻绳系小球竖直圆周（球在最低点，虚线圆轨迹）', (o) => cnt(o, '25°') === 1 && cnt(o, '>T<') === 1],
  [626, FIG_626, '轻绳系小球竖直圆周（球在最高点，虚线圆轨迹）', (o) => cnt(o, '25°') === 1 && cnt(o, '>T<') === 1],
  [797, FIG_797, '竖直平行导轨+棒 ab+上 R₁ 下 R₂+B⊗（v/电流方向不画）', (o) => cnt(o, '90°') === 1 && cnt(o, '>m<') === 1],
]

assert(FIGS.length === 30, `应恰好 30 题，实得 ${FIGS.length}`)
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

if (EMIT) {
  const fs = await import('node:fs')
  const rowsHtml = FIGS.map(([id, svg, note]) => {
    const stem = String(get.get(id).stem || '').replace(/\\\$/g, '$').replace(/\$/g, '').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').slice(0, 60)
    return `<div style="margin:8px 0;padding:8px;border:1px solid #ccc"><div style="font:bold 13px sans-serif">#${id} ${note}</div><div style="color:#888;font-size:12px">${stem}</div>${svg}</div>`
  }).join('')
  fs.writeFileSync(path.join(ROOT, 'tmp', 'preview78.html'), '<!doctype html><meta charset="utf-8">' + rowsHtml)
  console.log(`已输出 tmp/preview78.html（${FIGS.length} 图）`)
  db.close()
  process.exit(0)
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
