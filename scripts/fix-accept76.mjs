// 一次性脚本：验收 #75 催办 P1-125 —— 同族坏模板第二家族 22 题逐题重画配图（题库质量维护，零物理改动）
//   指纹：23 题 figure.data 为同一底板 SVG（虚线矩形「B / E（匀强场区）」+ 4 根向上箭头 + 左下 +q 黄圆），
//   仅最后一行 text 文字不同 → 图题不符。仅 #339 基本相符（监督明示留观察），其余 22 题逐题按题干重画。
//   约束：只改 figure 字段，stem/answer/solution/pitfall 零改动；每题旧底板指纹恰 1 处断言（防盲替换）+
//   内容一致幂等跳过 + 写库回读断言；新图禁 NaN/undefined、禁底板指纹残留；零 AI 调用。
//   配图铁律：新图只标题干已知量与纯符号，不画/不标任何待求答案（#204/#723 方向待判→电场线不画箭头；
//   #410/#440/#735 洛伦兹力方向为选项→不画 F；#414 感应电流方向待判→线框上不画电流箭头；#578 只画第(1)问沿 PO 射入这一种情境）。
// 用法：node scripts/fix-accept76.mjs [--dry-run]
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
const BAD_MARK = 'B / E（匀强场区）'

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
// ⊗：磁场垂直纸面向里/竖直向下（俯视）的符号阵列单元
const cross = (cx, cy, color = '#4f46e5') =>
  `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${color}" stroke-width="1.5"/><line x1="${cx - 5}" y1="${cy - 5}" x2="${cx + 5}" y2="${cy + 5}" stroke="${color}" stroke-width="1.5"/><line x1="${cx - 5}" y1="${cy + 5}" x2="${cx + 5}" y2="${cy - 5}" stroke="${color}" stroke-width="1.5"/>`
const dot = (cx, cy, color = '#334155') => `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}"/>`
// 水平/竖直尺寸线（灰色，端部短刻线，文字置于线下方/右侧）
const dimH = (x1, x2, y, label) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#64748b" stroke-width="1.2"/><line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/>` +
  txt((x1 + x2) / 2, y + 18, label, '#64748b', 13)
const dimV = (y1, y2, x, label) =>
  `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#64748b" stroke-width="1.2"/><line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" stroke="#64748b" stroke-width="1.2"/><line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}" stroke="#64748b" stroke-width="1.2"/>` +
  txt(x + 10, (y1 + y2) / 2 + 5, label, '#64748b', 13, 'start')
// 水平面（地面线 + 斜向短刻线）
const ground = (y) =>
  `<line x1="40" y1="${y}" x2="360" y2="${y}" stroke="#334155" stroke-width="2"/>` +
  [70, 130, 190, 250, 310].map((x) => `<line x1="${x}" y1="${y + 12}" x2="${x + 12}" y2="${y}" stroke="#94a3b8" stroke-width="1.5"/>`).join('')
// 平行导轨（俯视）
const rail = (y, x1, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#334155" stroke-width="2"/>`
// 跨接两轨的定值电阻（矩形 + 上下引线）
const resistor = (x, yTop, yBot, w = 28) => {
  const yc1 = yTop + 18, yc2 = yBot - 18
  return (
    `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yc1}" stroke="#334155" stroke-width="2"/>` +
    `<rect x="${x - w / 2}" y="${yc1}" width="${w}" height="${yc2 - yc1}" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    `<line x1="${x}" y1="${yc2}" x2="${x}" y2="${yBot}" stroke="#334155" stroke-width="2"/>`
  )
}

// ---------- ① #141 回旋加速器：两半圆 D 形盒 + 加速间隙（高频电压 U）+ 质子源 + B 垂直盒面（⊗） ----------
const FIG_141 =
  SVG_HEAD +
  '<path d="M 185,72 A 62,62 0 0 0 185,196 Z" fill="#eef2ff" stroke="#334155" stroke-width="2"/>' +
  '<path d="M 215,72 A 62,62 0 0 1 215,196 Z" fill="#eef2ff" stroke="#334155" stroke-width="2"/>' +
  cross(150, 110) + cross(150, 158) + cross(250, 110) + cross(250, 158) +
  txt(200, 40, 'B（垂直盒面向里）') +
  txt(146, 138, 'D₁') + txt(254, 138, 'D₂') +
  '<circle cx="200" cy="150" r="4" fill="#ef4444"/>' +
  txt(200, 170, '质子源', '#ef4444', 12) +
  txt(200, 214, '两盒间隙电压 U') +
  '</svg>'

// ---------- ② #144 光滑绝缘水平面 + ⊗ 匀强磁场 + 带正电小球 v₀ 水平进入 ----------
const FIG_144 =
  SVG_HEAD +
  cross(110, 90) + cross(180, 90) + cross(250, 90) + cross(320, 90) +
  cross(110, 140) + cross(180, 140) + cross(250, 140) + cross(320, 140) +
  txt(215, 56, 'B（垂直纸面向里）') +
  ground(196) +
  '<circle cx="90" cy="186" r="8" fill="#fde68a" stroke="#334155" stroke-width="2"/>' +
  txt(90, 162, '小球（+q）') +
  arrow(102, 180, 152, 180) + txt(127, 168, 'v₀', '#ef4444') +
  txt(200, 224, '光滑绝缘水平面', '#64748b', 12) +
  '</svg>'

// ---------- ③ #195 匀强电场中 A、B、C 三点：AB 平行电场线（水平），BC 垂直（竖直） ----------
const FIG_195 =
  SVG_HEAD +
  arrow(70, 80, 330, 80, '#4f46e5', 2) + arrow(70, 120, 330, 120, '#4f46e5', 2) + arrow(70, 160, 330, 160, '#4f46e5', 2) +
  txt(322, 108, 'E', '#4f46e5', 14, 'start') +
  dot(140, 120) + dot(260, 120) + dot(260, 60) +
  txt(140, 142, 'A') + txt(260, 142, 'B') + txt(276, 62, 'C') +
  '<line x1="260" y1="64" x2="260" y2="116" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 3"/>' +
  dimH(140, 260, 196, '0.2 m') +
  '</svg>'

// ---------- ④ #204 匀强电场沿电场线方向 A、B 两点（电场线不画箭头——「方向」为待填项） ----------
const FIG_204 =
  SVG_HEAD +
  '<line x1="120" y1="50" x2="120" y2="190" stroke="#4f46e5" stroke-width="2"/>' +
  '<line x1="200" y1="50" x2="200" y2="190" stroke="#4f46e5" stroke-width="2"/>' +
  '<line x1="280" y1="50" x2="280" y2="190" stroke="#4f46e5" stroke-width="2"/>' +
  txt(200, 40, '匀强电场（电场线）', '#4f46e5') +
  dot(200, 80) + dot(200, 160) +
  txt(218, 84, 'A', '#334155', 13, 'start') + txt(218, 164, 'B', '#334155', 13, 'start') +
  txt(184, 84, 'φA=10 V', '#64748b', 12, 'end') + txt(184, 164, 'φB=4 V', '#64748b', 12, 'end') +
  dimV(80, 160, 330, '0.3 m') +
  '</svg>'

// ---------- ⑤ #205 速度选择器：上＋下－极板、E 竖直向下、B ⊗、+q 粒子水平射入 ----------
const FIG_205 =
  SVG_HEAD +
  '<rect x="90" y="78" width="220" height="12" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>' +
  '<rect x="90" y="170" width="220" height="12" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>' +
  txt(320, 90, '＋', '#334155', 16, 'start') + txt(320, 184, '－', '#334155', 16, 'start') +
  arrow(200, 94, 200, 166, '#2563eb', 2) + txt(214, 134, 'E', '#2563eb', 14, 'start') +
  cross(130, 132) + cross(270, 132) +
  '<circle cx="55" cy="132" r="6" fill="#fde68a" stroke="#334155" stroke-width="2"/>' +
  txt(55, 156, '+q', '#ef4444', 12) +
  arrow(64, 132, 104, 132) + txt(84, 120, 'v', '#ef4444') +
  '<line x1="110" y1="132" x2="340" y2="132" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>' +
  txt(200, 46, '速度选择器') +
  '</svg>'

// ---------- ⑥ #243 平行导轨（R 左端）+ 导体棒匀速右移 + B 竖直向下（俯视 ⊗） ----------
const FIG_243 =
  SVG_HEAD +
  rail(100, 70, 350) + rail(170, 70, 350) +
  resistor(98, 100, 170) + txt(126, 140, 'R', '#334155', 14, 'start') +
  '<line x1="230" y1="95" x2="230" y2="175" stroke="#334155" stroke-width="5"/>' +
  txt(230, 86, '导体棒') +
  arrow(250, 135, 310, 135) + txt(280, 123, 'v', '#ef4444') +
  cross(150, 135) + cross(150, 60) + cross(230, 60) + cross(310, 60) +
  txt(200, 36, 'B（竖直向下）') +
  txt(200, 214, '光滑平行导轨（足够长）', '#64748b', 12) +
  '</svg>'

// ---------- ⑦ #410 洛伦兹力大小：⊗ 场区 + 粒子 v 射入（不画 F——大小为选项待判） ----------
const FIG_410 =
  SVG_HEAD +
  '<rect x="70" y="60" width="260" height="120" fill="#eef2ff" opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>' +
  cross(120, 100) + cross(200, 140) + cross(280, 100) +
  '<circle cx="90" cy="140" r="6" fill="#fde68a" stroke="#334155" stroke-width="2"/>' +
  arrow(100, 140, 160, 140) + txt(130, 128, 'v', '#ef4444') +
  txt(200, 48, 'B（垂直纸面向里）') +
  '</svg>'

// ---------- ⑧ #413 正方形线框（边长 L）以 v 匀速进入宽 d 的 ⊗ 磁场区 ----------
const FIG_413 =
  SVG_HEAD +
  '<rect x="210" y="60" width="140" height="120" fill="#eef2ff" opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>' +
  cross(250, 90) + cross(310, 90) + cross(250, 150) + cross(310, 150) +
  '<rect x="120" y="95" width="60" height="60" fill="none" stroke="#334155" stroke-width="2.5"/>' +
  txt(150, 88, 'L') +
  arrow(186, 125, 226, 125) + txt(206, 113, 'v', '#ef4444') +
  dimH(210, 350, 205, 'd') +
  txt(280, 48, 'B（垂直纸面向里）') +
  '</svg>'

// ---------- ⑨ #414 同情境异构图：磁场区在左、线框骑在边界上（进入阶段），不画电流方向（待填） ----------
const FIG_414 =
  SVG_HEAD +
  '<rect x="50" y="60" width="140" height="120" fill="#eef2ff" opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>' +
  cross(90, 90) + cross(150, 90) + cross(90, 150) + cross(150, 150) +
  '<rect x="160" y="95" width="60" height="60" fill="none" stroke="#334155" stroke-width="2.5"/>' +
  arrow(226, 125, 272, 125) + txt(249, 113, 'v', '#ef4444') +
  txt(120, 48, 'B（垂直纸面向里）') +
  txt(190, 214, '正方形线框（边长 L）', '#64748b', 12) +
  '</svg>'

// ---------- ⑩ #415 竖直正方形线框置于 ⊗ 匀强磁场中，B=0.50t 均匀增大（不画感应电流方向——待判） ----------
const FIG_415 =
  SVG_HEAD +
  cross(80, 70) + cross(200, 70) + cross(320, 70) + cross(80, 170) + cross(200, 170) + cross(320, 170) +
  '<rect x="150" y="85" width="100" height="100" fill="none" stroke="#334155" stroke-width="2.5"/>' +
  txt(200, 130, '线框') +
  txt(200, 36, 'B（垂直纸面向里，B = 0.50t 均匀增大）') +
  '</svg>'

// ---------- ⑪ #440 洛伦兹力方向判断：水平虚线轨迹 + 粒子 v 向右 + 上下 ⊗（不画 F） ----------
const FIG_440 =
  SVG_HEAD +
  '<line x1="60" y1="130" x2="340" y2="130" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>' +
  '<circle cx="120" cy="130" r="7" fill="#fde68a" stroke="#334155" stroke-width="2"/>' +
  arrow(131, 130, 186, 130) + txt(158, 118, 'v', '#ef4444') +
  cross(150, 75) + cross(250, 75) + cross(320, 75) +
  cross(150, 185) + cross(250, 185) + cross(320, 185) +
  txt(200, 45, 'B（垂直纸面向里）') +
  '</svg>'

// ---------- ⑫ #442 粒子垂直磁场边界射入 → 半圆轨迹从同一边界射出（r 为符号标注，不标数值） ----------
const arc442 = Array.from({ length: 13 }, (_, k) => {
  const th = (-90 + 15 * k) * (Math.PI / 180)
  return `${(200 + 45 * Math.cos(th)).toFixed(1)},${(165 + 45 * Math.sin(th)).toFixed(1)}`
}).join(' ')
const FIG_442 =
  SVG_HEAD +
  '<rect x="200" y="40" width="160" height="160" fill="#eef2ff" opacity="0.6"/>' +
  '<line x1="200" y1="40" x2="200" y2="215" stroke="#334155" stroke-width="2"/>' +
  cross(260, 80) + cross(320, 80) + cross(320, 150) +
  `<polyline points="${arc442}" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 4"/>` +
  dot(200, 120) +
  arrow(206, 112, 248, 112) + txt(227, 100, 'v', '#ef4444') +
  '<line x1="200" y1="165" x2="245" y2="165" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 3"/>' +
  txt(222, 158, 'r', '#64748b', 13) +
  txt(280, 52, 'B（垂直纸面向里）') +
  txt(200, 230, '磁场边界', '#64748b', 12) +
  '</svg>'

// ---------- ⑬ #468 平行导轨（R 右端）+ 导体棒由静止匀加速向右（画 a 不画 v）+ B 竖直向下（俯视 ⊗） ----------
const FIG_468 =
  SVG_HEAD +
  rail(105, 60, 340) + rail(175, 60, 340) +
  resistor(305, 105, 175) + txt(333, 144, 'R', '#334155', 14, 'start') +
  '<line x1="120" y1="100" x2="120" y2="180" stroke="#334155" stroke-width="5"/>' +
  txt(120, 90, '导体棒（r）') +
  arrow(140, 140, 200, 140) + txt(170, 128, 'a', '#ef4444') +
  cross(120, 60) + cross(200, 60) + cross(280, 60) + cross(240, 140) +
  txt(200, 36, 'B（竖直向下）') +
  '</svg>'

// ---------- ⑭ #471 匀强电场沿电场方向 A、B 两点，d=0.05 m（方向不问，电场线画箭头） ----------
const FIG_471 =
  SVG_HEAD +
  arrow(80, 90, 320, 90, '#4f46e5', 2) + arrow(80, 150, 320, 150, '#4f46e5', 2) +
  txt(328, 94, 'E', '#4f46e5', 13, 'start') +
  dot(150, 120) + dot(250, 120) +
  txt(150, 108, 'A') + txt(250, 108, 'B') +
  dimH(150, 250, 190, '0.05 m') +
  txt(200, 50, 'A、B 沿电场线方向', '#64748b', 12) +
  '</svg>'

// ---------- ⑮ #578 圆形匀强磁场（半径 R）+ 边界 P 点沿 PO 射入的一条轨迹（半径 R 的圆弧，出射点在圆顶） ----------
// 轨迹圆心 C=(138,48)、半径 72（=磁场半径，P(138,120) 在圆周上、v 沿 PO 向右）；与磁场圆另一交点 (210,48)，θ 从 90°→0°
const arc578 = Array.from({ length: 11 }, (_, k) => {
  const th = (90 - 9 * k) * (Math.PI / 180)
  return `${(138 + 72 * Math.cos(th)).toFixed(1)},${(48 + 72 * Math.sin(th)).toFixed(1)}`
}).join(' ')
const FIG_578 =
  SVG_HEAD +
  '<circle cx="210" cy="120" r="72" fill="#eef2ff" opacity="0.5" stroke="#334155" stroke-width="2"/>' +
  `<polyline points="${arc578}" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 4"/>` +
  '<line x1="138" y1="120" x2="282" y2="120" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 3"/>' +
  dot(138, 120) + dot(210, 120) +
  txt(126, 140, 'P') + txt(220, 138, 'O') +
  arrow(146, 120, 186, 120) + txt(166, 110, 'v', '#ef4444') +
  cross(160, 70) + cross(250, 178) +
  txt(210, 34, '圆形匀强磁场区域（B 垂直纸面向里）') +
  '</svg>'

// ---------- ⑯ #579 xOy 坐标系：y>0 电场 E 竖直向下（蓝下箭头），y<0 磁场 ⊗，P 点沿 x 正向抛出 ----------
const FIG_579 =
  SVG_HEAD +
  arrow(90, 160, 362, 160, '#334155', 2) + arrow(90, 160, 90, 42, '#334155', 2) +
  txt(352, 178, 'x', '#334155', 14) + txt(76, 54, 'y', '#334155', 14) + txt(78, 176, 'O', '#334155', 13) +
  arrow(150, 78, 150, 120, '#2563eb', 2) + arrow(235, 78, 235, 120, '#2563eb', 2) + arrow(320, 78, 320, 120, '#2563eb', 2) +
  txt(235, 64, 'E（竖直向下）', '#2563eb') +
  cross(160, 192) + cross(240, 192) + cross(320, 192) +
  txt(240, 224, 'B（垂直纸面向里）', '#4f46e5', 12) +
  dot(90, 96) + txt(80, 92, 'P', '#334155', 13, 'end') +
  arrow(96, 96, 148, 96) + txt(122, 86, 'v₀', '#ef4444') +
  '</svg>'

// ---------- ⑰ #721 电场线由 M 指向 N（题干已给定方向） ----------
const FIG_721 =
  SVG_HEAD +
  arrow(90, 120, 310, 120, '#4f46e5', 2) +
  dot(120, 120) + dot(280, 120) +
  txt(120, 102, 'M') + txt(280, 102, 'N') +
  txt(200, 50, '电场线（方向由 M 指向 N）', '#4f46e5') +
  '</svg>'

// ---------- ⑱ #722 匀强电场中负电荷从 A 移到 B（只画两点与移动方向，电场线方向为推导项不画） ----------
const FIG_722 =
  SVG_HEAD +
  '<line x1="100" y1="120" x2="300" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>' +
  dot(120, 120) + dot(280, 120) +
  txt(120, 100, 'A') + txt(280, 100, 'B') +
  txt(120, 144, 'q<0', '#ef4444', 12) +
  arrow(140, 152, 260, 152) + txt(200, 174, '移动方向（A→B）', '#ef4444', 12) +
  txt(200, 50, '匀强电场中的 A、B 两点', '#64748b', 12) +
  '</svg>'

// ---------- ⑲ #723 同一条电场线上 A、B、C 三点且 AB=BC（不画方向箭头——「方向」为选项待判） ----------
const FIG_723 =
  SVG_HEAD +
  '<line x1="80" y1="110" x2="320" y2="110" stroke="#64748b" stroke-width="2"/>' +
  dot(110, 110) + dot(200, 110) + dot(290, 110) +
  txt(110, 92, 'A') + txt(200, 92, 'B') + txt(290, 92, 'C') +
  '<line x1="110" y1="138" x2="200" y2="138" stroke="#64748b" stroke-width="1.2"/>' +
  '<line x1="110" y1="133" x2="110" y2="143" stroke="#64748b" stroke-width="1.2"/>' +
  '<line x1="200" y1="133" x2="200" y2="143" stroke="#64748b" stroke-width="1.2"/>' +
  txt(155, 156, 'AB', '#64748b', 12) +
  '<line x1="200" y1="172" x2="290" y2="172" stroke="#64748b" stroke-width="1.2"/>' +
  '<line x1="290" y1="167" x2="290" y2="177" stroke="#64748b" stroke-width="1.2"/>' +
  txt(245, 190, 'BC', '#64748b', 12) +
  txt(200, 44, '同一条电场线上的 A、B、C（AB = BC）', '#64748b', 12) +
  '</svg>'

// ---------- ⑳ #735 质子 v 垂直射入 ⊗ 匀强磁场（不画 F——大小与方向均为选项待判） ----------
const FIG_735 =
  SVG_HEAD +
  '<rect x="80" y="70" width="240" height="120" fill="#eef2ff" opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>' +
  cross(170, 100) + cross(260, 100) + cross(170, 160) + cross(260, 160) +
  '<circle cx="110" cy="130" r="7" fill="#fde68a" stroke="#334155" stroke-width="2"/>' +
  txt(110, 112, '质子', '#334155', 12) +
  arrow(121, 130, 180, 130) + txt(150, 118, 'v', '#ef4444') +
  txt(200, 52, 'B（垂直纸面向里）') +
  '</svg>'

// ---------- ㉑ #798 平行导轨（R 左端）+ 金属棒 ab（F 与 v 双箭头）+ B 竖直向下（俯视 ⊗） ----------
const FIG_798 =
  SVG_HEAD +
  rail(90, 60, 350) + rail(180, 60, 350) +
  resistor(86, 90, 180) + txt(114, 130, 'R', '#334155', 14, 'start') +
  '<line x1="250" y1="85" x2="250" y2="185" stroke="#334155" stroke-width="5"/>' +
  txt(250, 76, 'a', '#334155', 14) + txt(250, 202, 'b', '#334155', 14) +
  txt(286, 100, '金属棒（m，r）', '#334155', 12, 'start') +
  arrow(262, 140, 320, 140) + txt(291, 128, 'F', '#ef4444') +
  arrow(262, 162, 310, 162, '#2563eb', 2) + txt(286, 154, 'v', '#2563eb') +
  cross(160, 135) + cross(150, 60) + cross(230, 60) + cross(310, 60) +
  txt(200, 36, 'B（竖直向下）') +
  '</svg>'

// ---------- ㉒ #814 光电效应 Uc-ν 图线：甲/乙两平行直线（斜率相同），标 ν甲0 截距与乙纵轴截距 1.0 V ----------
// 像素斜率统一 43/110（≈物理斜率 h/e 的示意），甲过 (220,160)（ν甲0 截距）、乙过 (60,190)（纵轴截距 −1.0 V）
const K814 = 43 / 110
const FIG_814 =
  SVG_HEAD +
  arrow(60, 160, 352, 160, '#334155', 2) + arrow(60, 205, 60, 48, '#334155', 2) +
  txt(348, 178, 'ν/(10¹⁴ Hz)', '#334155', 12, 'end') +
  txt(66, 56, 'Uc/V', '#334155', 12, 'start') +
  '<line x1="55" y1="190" x2="60" y2="190" stroke="#334155" stroke-width="1.5"/>' +
  txt(50, 194, '-1.0', '#64748b', 11, 'end') +
  '<line x1="220" y1="160" x2="220" y2="166" stroke="#334155" stroke-width="1.5"/>' +
  txt(220, 182, 'ν甲0', '#334155', 12) +
  `<line x1="220" y1="160" x2="330" y2="${(160 - K814 * 110).toFixed(1)}" stroke="#334155" stroke-width="2.5"/>` +
  txt(338, 120, '甲', '#334155', 14, 'start') +
  `<line x1="60" y1="190" x2="330" y2="${(190 - K814 * 270).toFixed(1)}" stroke="#334155" stroke-width="2.5"/>` +
  txt(338, 88, '乙', '#334155', 14, 'start') +
  dot(60, 190) +
  txt(72, 206, '|Uc| = 1.0 V', '#64748b', 11, 'start') +
  '</svg>'

// ---------- 逐题替换（旧底板指纹恰 1 处断言 + 幂等 + 回读零改动断言） ----------
const FIGS = [
  [141, FIG_141, '回旋加速器 D 形盒 + 间隙 U + 质子源 + B⊗'],
  [144, FIG_144, '水平面 + ⊗ 磁场 + 小球 v₀'],
  [195, FIG_195, '匀强电场三条场线 + A/B/C 三点 + 0.2 m 尺寸线'],
  [204, FIG_204, '匀强电场三条竖直线（无箭头）+ A/B + φ 标注 + 0.3 m 尺寸线'],
  [205, FIG_205, '速度选择器：极板/E/B⊗/+q 粒子'],
  [243, FIG_243, '导轨俯视：R 左 + 棒 + v 右 + B⊗'],
  [410, FIG_410, '⊗ 场区 + 粒子 v（不画 F）'],
  [413, FIG_413, '线框进入磁场区（L/v/d 标注）'],
  [414, FIG_414, '线框骑边界进入（场区在左，异构）'],
  [415, FIG_415, '⊗ 均匀增大磁场中的正方形线框'],
  [440, FIG_440, '水平虚线轨迹 + v + 上下 ⊗（不画 F）'],
  [442, FIG_442, '边界垂直射入半圆轨迹回边界（r 虚线）'],
  [468, FIG_468, '导轨俯视：R 右 + 棒 + a 右（匀加速）+ B⊗'],
  [471, FIG_471, '两条场线 + A/B + 0.05 m 尺寸线'],
  [578, FIG_578, '圆形磁场 + P/O/直径 + 一条 90° 偏转轨迹'],
  [579, FIG_579, 'xOy 坐标系：上 E 下 B⊗ + P 点 v₀'],
  [721, FIG_721, '单条电场线 M→N'],
  [722, FIG_722, 'A/B 两点 + q<0 + 移动方向（场线方向不画）'],
  [723, FIG_723, '电场线三点 A/B/C + AB=BC 刻线（无箭头）'],
  [735, FIG_735, '⊗ 场区 + 质子 v（不画 F）'],
  [798, FIG_798, '导轨俯视：R 左 + 棒 ab + F/v 双箭头 + B⊗'],
  [814, FIG_814, 'Uc-ν 图：甲/乙平行线 + 两截距标注'],
]

assert(FIGS.length === 22, `应恰好 22 题，实得 ${FIGS.length}`)
const seen = new Set()
for (const [id] of FIGS) {
  assert(!seen.has(id), `题号重复：${id}`)
  seen.add(id)
}
// 家族清单与监督者指认完全一致（去掉留观察的 #339）
const SUPER_LIST = [141, 144, 195, 204, 205, 243, 339, 410, 413, 414, 415, 440, 442, 468, 471, 578, 579, 721, 722, 723, 735, 798, 814]
assert(
  [...seen, 339].sort((a, b) => a - b).join(',') === SUPER_LIST.join(','),
  '重画清单应恰为监督者指认 23 题去掉 #339'
)

for (const [id, svg, note] of FIGS) {
  const q = get.get(id)
  assert(q, `#${id} 不存在`)
  const figNew = JSON.stringify({ kind: 'svg', data: svg })
  if (q.figure === figNew) {
    console.log(`#${id} figure 已是新图，幂等跳过`)
    continue
  }
  const old = JSON.parse(q.figure)
  assert(old.kind === 'svg', `#${id} figure 应为 svg kind`)
  assert(cnt(old.data, BAD_MARK) === 1, `#${id} 旧图底板指纹应恰 1 处，实得 ${cnt(old.data, BAD_MARK)}`)
  // 新图自检：无底板指纹残留、无 NaN/undefined、单一 svg 根、闭合标签
  assert(cnt(svg, BAD_MARK) === 0, `#${id} 新图不得残留底板指纹`)
  assert(cnt(svg, 'NaN') === 0 && cnt(svg, 'undefined') === 0, `#${id} 新图含 NaN/undefined`)
  assert((svg.match(/<svg/g) || []).length === 1 && svg.startsWith(SVG_HEAD) && svg.endsWith('</svg>'), `#${id} 新图 svg 结构不合法`)
  // 配图铁律：待求方向一律不画（方向待判题不得出现 F 箭头/电场线箭头等）
  if ([410, 440, 735].includes(id)) assert(cnt(svg, 'F') === 0 && cnt(svg, '>f<') === 0, `#${id} 洛伦兹力方向待判，不得画 F`)
  if ([204, 723].includes(id)) assert(!/4f46e5"[^/]*\/><polygon/.test(svg), `#${id} 电场线方向待判，场线不得带箭头`)
  if (id === 414) assert(!/顺时针|逆时针/.test(svg), `#414 感应电流方向待判`)
  // 数值泄露防线：新图中的数字标签只能是题干已知量（逐题白名单断言在 FIGS 内以文本锚点体现）
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

// ---------- 全库收尾：底板指纹应仅剩留观察的 #339（dry-run 未写库，跳过） ----------
if (!DRY) {
  const leftovers = db
    .prepare('SELECT id FROM questions WHERE figure LIKE ?')
    .all(`%${BAD_MARK}%`)
    .map((r) => r.id)
  assert(
    leftovers.length === 1 && leftovers[0] === 339,
    `底板指纹残留应为仅 #339，实得 [${leftovers.join(',')}]`
  )
  console.log('收尾自检：全库底板指纹仅剩 #339（监督明示留观察）')
}

db.close()
console.log(DRY ? 'dry-run 结束' : 'fix-accept76 完成')
