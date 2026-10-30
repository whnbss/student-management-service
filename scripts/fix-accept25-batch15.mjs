// 一次性脚本：第十五批补题（id 745~786）独立重解自验发现的缺陷修正
// 【内容缺陷 9 处】
// - #753 「一节干电池 E=3V」不真实（干电池 1.5V）→ 改「某电池组」
// - #759 A 项与解析自算数据完全一致（方向向下、3e2→4e2）却判「A 错误」，A/C 双正确 → A 方向改「竖直向上」
// - #760 (2) 结论物理错误：r=R 磁发散的出射方向应平行于 P 点切线（垂直 PO），原答「沿 PO 方向」反了，
//   且解析残留自我怀疑试错文字（「随 α 变化？实际上…」）→ 用菱形法重写 (1)(2) 解析与 (2) 答案
// - #762 与 #760 同背景近似重复，且 (2) 答案 t_max=πm/(qB) 与解析 θ_max=π/2（→πm/(2qB)）矛盾、解析几何推导
//   ∠OPO'=90°−α 错误（应为 90°+α）、(3)「任意指定 Q 可达」在 r=R 时不成立 → 整题重写为「磁聚焦」数值压轴
// - #761 物理不可行：粒子在 y=-d 加速到 A(0,R)，加速区横穿整个磁场圆；且 A 点速度 +y 沿半径向外，进不了磁场；
//   (2) B=(1/R)√(2mU/3q) 与正确值 √(6mU/q)/R 差 3 倍、(3) 时间错 → 整题重写（加速后沿半径方向射入，∠AOC=60°）
// - #765 (3) 打在底片上的间距为直径差 2(R₂−R₁)≈6.3e-3 m，原答案 3.2e-3 m 漏乘 2 → 重解重写
// - #767 E 竖直向下 + B 垂直纸面向外对正电荷两力同向（不可能平衡），物理不可行 → B 改「垂直纸面向里」（其余自洽）
// - #769 A 项实为正确（电子受洛伦兹力向下聚到 N，N 负 M 正，φ_M>φ_N），与 C 冲突 → A 改「M 电势低于 N」并修解析
// - #770 (3) 解析为试错残稿（按 n 密度算出 1.92e4 W 与 EI 不一致后自弃改口 100W）→ 删题干冗余 n/q 数据、重写 (3)
// - #771 ①几何矛盾：「平行于绝缘壁」的磁场使洛伦兹力指向绝缘壁（发电机不成立）→ 改「竖直向下」；
//   ②电动势用错维度：极板间距为 b，E=Bvb=16 V（原 B·h·v=8 V）；③内阻算术错 r=0.025 Ω（原 0.00625）→ 全题重解
// - #785 波形未定义（P 点坡向无依据），且 (2) 上下坡法口诀用反（正确：上坡下、下坡上，P 应向上）、
//   (3) 波已覆盖 Q 点「传到 Q 需 1.5s」不成立 → 重写题干（波前在 x=4）+ (2)(3) 重解
// - #786 「平行平面、厚度均匀」薄膜不会出现等厚干涉条纹 → 改「重力作用下上薄下厚的楔形薄膜」
// 【配图】14 题为「匀强场区+q」通用模板残留：置空 9 题（#745/746/747/750/751/757/758 题干自包含不引用图、
//   #782/784 自包含）；重画 12 题（#759 分压电路+电容器 / #760 圆形磁发散 / #761 加速+圆形磁场 /
//   #762 磁聚焦 / #763 #764 #765 质谱仪 / #766 #767 速度选择器 / #769 霍尔元件 / #770 #771 磁流体 / #785 波形）
// 防护同 fix-accept25.mjs：动态构建 SET、仅更新 patch 字段；支持 --dry-run
// 用法：node scripts/fix-accept25-batch15.mjs [--dry-run]
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
const cross = (x, y, r = 8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.4"/><line x1="${x - r * 0.6}" y1="${y - r * 0.6}" x2="${x + r * 0.6}" y2="${y + r * 0.6}" stroke="#64748b" stroke-width="1.4"/><line x1="${x - r * 0.6}" y1="${y + r * 0.6}" x2="${x + r * 0.6}" y2="${y - r * 0.6}" stroke="#64748b" stroke-width="1.4"/>`
// ⊙ 符号（磁场垂直纸面向外）
const ring = (x, y, r = 8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="1.6" fill="#64748b"/>`
const grid = (x0, y0, x1, y1, nx, ny, f) => {
  const out = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push(f(x0 + ((x1 - x0) * i) / (nx - 1), y0 + ((y1 - y0) * j) / (ny - 1)))
  return out.join('')
}
// 电池符号（长线正极、短线负极，竖直放置于水平导线上）
const battery = (x, y) => `<line x1="${x - 10}" y1="${y - 14}" x2="${x - 10}" y2="${y + 14}" stroke="#334155" stroke-width="2"/><line x1="${x + 10}" y1="${y - 7}" x2="${x + 10}" y2="${y + 7}" stroke="#334155" stroke-width="4"/>`
// 电阻（矩形）
const resistor = (x, y, w = 44, h = 18, horizontal = true) =>
  horizontal ? `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#fff" stroke="#334155" stroke-width="1.8"/>`
    : `<rect x="${x - h / 2}" y="${y - w / 2}" width="${h}" height="${w}" fill="#fff" stroke="#334155" stroke-width="1.8"/>`
// 电容（两平行短线，水平放置）
const capacitor = (x, y) => `<line x1="${x - 16}" y1="${y - 7}" x2="${x + 16}" y2="${y - 7}" stroke="#334155" stroke-width="2.6"/><line x1="${x - 16}" y1="${y + 7}" x2="${x + 16}" y2="${y + 7}" stroke="#334155" stroke-width="2.6"/>`
const ground = (x, y) => `<line x1="${x - 12}" y1="${y}" x2="${x + 12}" y2="${y}" stroke="#334155" stroke-width="2"/><line x1="${x - 7}" y1="${y + 5}" x2="${x + 7}" y2="${y + 5}" stroke="#334155" stroke-width="1.8"/><line x1="${x - 3}" y1="${y + 10}" x2="${x + 3}" y2="${y + 10}" stroke="#334155" stroke-width="1.6"/>`

// ---- #759：分压电路 + 电容器（E,r → R₁ → 滑动变阻器 R₂ 滑片；电容器接 R₁ 右端节点与地） ----
const fig759 = wrap((() => {
  let s = ''
  // 主回路：左边电池，上边 R1，右边滑动变阻器 R2，下边回线
  s += `<line x1="90" y1="70" x2="90" y2="150" stroke="#334155" stroke-width="1.8"/>` // 左侧立线（穿电池）
  s += battery(90, 110) + text(64, 108, 'E', '#334155', 14) + text(64, 126, 'r', '#334155', 13)
  s += `<line x1="90" y1="70" x2="150" y2="70" stroke="#334155" stroke-width="1.8"/>` + resistor(172, 70) + text(172, 52, 'R₁', '#334155', 13)
  s += `<line x1="194" y1="70" x2="290" y2="70" stroke="#334155" stroke-width="1.8"/>`
  // 滑动变阻器 R2（竖直，右端）
  s += `<line x1="290" y1="70" x2="290" y2="150" stroke="#334155" stroke-width="1.8"/>` + resistor(290, 110, 52, 18, false) + text(316, 112, 'R₂', '#334155', 13)
  s += `<line x1="290" y1="150" x2="290" y2="185" stroke="#334155" stroke-width="1.8"/><line x1="90" y1="185" x2="290" y2="185" stroke="#334155" stroke-width="1.8"/><line x1="90" y1="150" x2="90" y2="185" stroke="#334155" stroke-width="1.8"/>`
  // 滑片箭头指向 R2
  s += arrow(252, 118, 272, 118, '#ef4444', 2) + text(238, 122, '滑片', '#ef4444', 12)
  // 电容器：从 R1 右端节点引出，接电容，下端接地
  s += dot(240, 70) + `<line x1="240" y1="70" x2="240" y2="34" stroke="#334155" stroke-width="1.8"/><line x1="240" y1="34" x2="330" y2="34" stroke="#334155" stroke-width="1.8"/>` + capacitor(352, 34)
  s += text(382, 38, 'C', '#334155', 14)
  s += `<line x1="368" y1="34" x2="368" y2="16" stroke="#334155" stroke-width="1.6"/>` // 上极板引线（保持简洁：电容竖排改横排，下引接地）
  // 电容下端接地
  s += `<line x1="352" y1="41" x2="352" y2="60" stroke="#334155" stroke-width="1.6"/>` + ground(352, 60) + text(330, 64, '接地', '#64748b', 11)
  return s
})(), 420, 210)

// ---- #760：圆形磁场磁发散（⊙ 向外，P 在右边界，多方向入射 + 出射平行切线） ----
const fig760 = wrap((() => {
  const O = [170, 120], R = 72
  let s = `<circle cx="${O[0]}" cy="${O[1]}" r="${R}" fill="#eef2ff" opacity="0.5" stroke="#334155" stroke-width="2"/>` + grid(O[0] - 45, O[1] - 45, O[0] + 45, O[1] + 45, 3, 3, ring)
  s += dot(O[0], O[1], 3) + text(O[0] + 14, O[1] - 10, 'O')
  const P = [O[0] + R, O[1]]
  s += `<circle cx="${P[0]}" cy="${P[1]}" r="4" fill="#ef4444"/>` + text(P[0] + 12, P[1] + 4, 'P', '#ef4444', 14)
  // 入射：沿 PO 及偏 ±35° 的三支箭头
  const angs = [180, 145, 215]
  for (const a of angs) {
    const rad = (a * Math.PI) / 180
    s += arrow(P[0], P[1], P[0] + 40 * Math.cos(rad), P[1] - 40 * Math.sin(rad), '#ef4444', 1.8)
  }
  // 出射：磁场圆上不同点的竖直平行箭头（平行于 P 点切线）
  s += arrow(120, 80, 120, 44, '#2563eb', 1.8) + arrow(150, 178, 150, 214, '#2563eb', 1.8) + arrow(215, 60, 215, 96, '#2563eb', 1.8)
  s += text(96, 34, '出射速度彼此平行', '#2563eb', 12, 'start')
  s += text(O[0], 214, 'B（垂直纸面向外）', '#334155', 13)
  return s
})())

// ---- #761：加速电场 + 圆形磁场（⊙ 向外，A 右边界沿半径射入，弧到 C，∠AOC=60°） ----
const fig761 = wrap((() => {
  const O = [190, 120], R = 62
  let s = `<circle cx="${O[0]}" cy="${O[1]}" r="${R}" fill="#eef2ff" opacity="0.5" stroke="#334155" stroke-width="2"/>` + grid(O[0] - 38, O[1] - 38, O[0] + 38, O[1] + 38, 3, 3, ring)
  s += dot(O[0], O[1], 3) + text(O[0] + 13, O[1] - 9, 'O')
  const A = [O[0] + R, O[1]], C = [O[0] + R * Math.cos(60 * Math.PI / 180), O[1] - R * Math.sin(60 * Math.PI / 180)]
  s += `<circle cx="${A[0]}" cy="${A[1]}" r="4" fill="#ef4444"/>` + text(A[0] + 13, A[1] + 4, 'A', '#ef4444', 14)
  s += `<circle cx="${C[0]}" cy="${C[1]}" r="4" fill="#ef4444"/>` + text(C[0] - 4, C[1] - 12, 'C', '#ef4444', 14)
  // 轨迹弧（A→C，圆心 O' 在 A 正上方 SVG-y 方向 r 处，圆心角 120°）
  const r = R / Math.sqrt(3), Ox = O[0] + R, Oy = O[1] - r
  const a1 = Math.atan2(A[1] - Oy, A[0] - Ox), a2 = a1 + (2 * Math.PI) / 3
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const a = a1 + ((a2 - a1) * i) / 24
    pts.push(`${(Ox + r * Math.cos(a)).toFixed(1)},${(Oy + r * Math.sin(a)).toFixed(1)}`)
  }
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-dasharray="6 4"/>`
  // 入射速度箭头（沿半径指向 O）
  s += arrow(A[0], A[1], A[0] - 36, A[1], '#ef4444', 2) + text(A[0] - 20, A[1] - 10, 'v', '#ef4444', 13)
  // 加速电场（右侧两竖直极板 + U）
  s += `<line x1="${A[0] + 46}" y1="92" x2="${A[0] + 46}" y2="148" stroke="#334155" stroke-width="2.6"/><line x1="${A[0] + 62}" y1="104" x2="${A[0] + 62}" y2="136" stroke="#334155" stroke-width="2.6"/>`
  s += text(A[0] + 54, 84, 'U', '#334155', 13)
  s += text(O[0], 214, 'B（垂直纸面向外）', '#334155', 13)
  return s
})())

// ---- #762：磁聚焦（⊗ 向里，左侧边界平行入射，汇聚于上边界点 Q） ----
const fig762 = wrap((() => {
  const O = [190, 130], R = 70
  let s = `<circle cx="${O[0]}" cy="${O[1]}" r="${R}" fill="#eef2ff" opacity="0.5" stroke="#334155" stroke-width="2"/>` + grid(O[0] - 42, O[1] - 42, O[0] + 42, O[1] + 42, 3, 3, cross)
  s += dot(O[0], O[1], 3) + text(O[0] + 13, O[1] + 16, 'O')
  const Q = [O[0], O[1] - R]
  s += `<circle cx="${Q[0]}" cy="${Q[1]}" r="4.5" fill="#ef4444"/>` + text(Q[0] + 14, Q[1] - 2, 'Q', '#ef4444', 14)
  // 三个入射点（左侧圆弧）+ 水平入射箭头 + 汇聚虚线弧
  for (const dy of [-44, 0, 44]) {
    const py = O[1] + dy
    const px = O[0] - Math.sqrt(R * R - dy * dy)
    s += dot(px, py, 3) + arrow(px - 26, py, px + 22, py, '#ef4444', 1.8)
    // 从入射点到 Q 的虚线弧（圆心在入射点正上方 R 处）
    const Ox = px, Oy = py - R
    const a1 = Math.atan2(py - Oy, px - Ox), a2 = Math.atan2(Q[1] - Oy, Q[0] - Ox)
    const pts = []
    for (let i = 0; i <= 20; i++) {
      const a = a1 + ((a2 - a1) * i) / 20
      pts.push(`${(Ox + R * Math.cos(a)).toFixed(1)},${(Oy + R * Math.sin(a)).toFixed(1)}`)
    }
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="5 4"/>`
  }
  s += text(O[0] - 6, 226, 'B（垂直纸面向里）', '#334155', 13)
  s += text(O[0] + 118, 34, '平行入射 → 汇聚于 Q', '#2563eb', 12, 'start')
  return s
})())

// ---- 质谱仪通用绘制：速度选择器（左）+ 直线边界偏转磁场（右），sems 返回轨迹弧 ----
function massSpec(fig, R1, R2, labels) {
  const O = fig
  let s = ''
  // 速度选择器：上下极板
  s += `<line x1="36" y1="70" x2="170" y2="70" stroke="#334155" stroke-width="3"/><line x1="36" y1="150" x2="170" y2="150" stroke="#334155" stroke-width="3"/>`
  // E 竖直向下箭头 + ⊗（B1 向里）
  for (const x of [70, 110, 150]) s += arrow(x, 86, x, 134, '#4f46e5', 1.6)
  s += text(103, 52, 'E', '#4f46e5', 14)
  s += cross(60, 110, 6) + cross(160, 110, 6) + text(30, 114, 'B₁', '#64748b', 12)
  // 入射速度
  s += arrow(178, 110, 214, 110, '#ef4444', 2) + text(196, 100, 'v', '#ef4444', 13)
  // 偏转磁场：直线边界（竖直）x=220，右侧磁场 ⊙/⊗
  s += `<line x1="220" y1="40" x2="220" y2="210" stroke="#0f172a" stroke-width="2"/>`
  s += labels.fieldCross ? grid(246, 66, 246, 66, 1, 1, cross) + cross(300, 80, 7) + cross(300, 150, 7) : ring(300, 80, 7) + ring(300, 150, 7) + ring(360, 115, 7)
  s += text(288, 30, labels.b2, '#334155', 12)
  s += dot(220, 110, 4) + text(210, 104, 'S', '#334155', 14, 'end')
  // 半圆轨迹（圆心在边界上 (220, 110±R)）
  const semic = (R, dir, cls) => {
    const cy = 110 + dir * R
    const a0 = dir > 0 ? -90 : 90
    const pts = []
    for (let i = 0; i <= 30; i++) {
      const a = (a0 + (180 * i) / 30) * (Math.PI / 180)
      pts.push(`${(220 + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`)
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6 4"/>`
  }
  s += semic(R1, 1, '')
  if (R2) s += semic(R2, 1, '')
  s += dot(220, 110 + R1, 4) + text(208, 114 + R1, labels.p1, '#334155', 13, 'end')
  if (R2) { s += dot(220, 110 + R2, 4) + text(208, 118 + R2, labels.p2, '#334155', 13, 'end') }
  s += text(120, 226, labels.note, '#64748b', 12)
  return s
}
const fig763 = wrap(massSpec(0, 40, 0, { fieldCross: true, b2: 'B₂（垂直纸面向外）', p1: 'P', note: '速度选择器 + 偏转磁场' }), 400, 240)
const fig764 = wrap(massSpec(0, 36, 54, { fieldCross: true, b2: 'B₂（垂直纸面向里）', p1: 'P₁', p2: 'P₂', note: '速度选择器 + 偏转磁场' }), 400, 240)
// #765：加速电场 + 磁场 + 底片（粒子向上射入，半圆打回底片）
const fig765 = wrap((() => {
  let s = ''
  // 加速电场：下两板（P 在下边界射入向上）
  s += `<line x1="60" y1="196" x2="200" y2="196" stroke="#334155" stroke-width="3"/><line x1="60" y1="166" x2="200" y2="166" stroke="#334155" stroke-width="3"/>`
  s += text(130, 158, '加速电压 U', '#334155', 12)
  s += arrow(130, 188, 130, 172, '#ef4444', 1.8)
  // 磁场区（⊗）上边界 y=60 即底片
  s += `<rect x="36" y="40" width="330" height="150" fill="#eef2ff" opacity="0.4" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="6 4"/>` + cross(80, 90, 7) + cross(140, 90, 7) + cross(200, 90, 7) + cross(260, 90, 7) + cross(320, 90, 7) + cross(110, 150, 7) + cross(250, 150, 7)
  s += text(300, 34, 'B（垂直纸面向里）', '#334155', 12)
  // 入射点 P（底片上）与两条半圆轨迹
  s += dot(130, 190, 4) + text(118, 194, 'P', '#ef4444', 14, 'end')
  const semic = (R, cx) => {
    const pts = []
    for (let i = 0; i <= 30; i++) {
      const a = (270 + (180 * i) / 30) * (Math.PI / 180)
      pts.push(`${(cx + R * Math.cos(a)).toFixed(1)},${(190 + R * Math.sin(a)).toFixed(1)}`)
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6 4"/>`
  }
  s += semic(52, 130) + semic(57, 130)
  s += dot(130 - 52, 190, 3) + text(130 - 52, 206, 'A', '#2563eb', 13) + dot(130 - 57, 190, 3) + text(130 - 57, 222, 'B', '#2563eb', 13)
  s += text(268, 206, '照相底片', '#64748b', 12)
  return s
})())

// ---- 速度选择器简图（#766/#767） ----
function selectorFig(bInto) {
  let s = `<line x1="90" y1="60" x2="310" y2="60" stroke="#334155" stroke-width="3"/><line x1="90" y1="170" x2="310" y2="170" stroke="#334155" stroke-width="3"/>`
  for (const x of [130, 200, 270]) s += arrow(x, 78, x, 152, '#4f46e5', 1.6)
  s += text(200, 48, 'E', '#4f46e5', 15)
  s += (bInto ? cross(110, 115, 7) + cross(310, 115, 7) : ring(110, 115, 7) + ring(310, 115, 7))
  s += text(200, 210, bInto ? 'B（垂直纸面向里）' : 'B（垂直纸面向外）', '#334155', 13)
  s += arrow(20, 115, 70, 115, '#ef4444', 2.2) + text(44, 103, 'v', '#ef4444', 14)
  s += text(60, 132, '带电粒子', '#ef4444', 12, 'start')
  return s
}
const fig766 = wrap(selectorFig(true), 400, 230)
const fig767 = wrap(selectorFig(true), 400, 230)

// ---- 霍尔元件（#769） ----
const fig769 = wrap((() => {
  let s = `<rect x="110" y="80" width="180" height="80" rx="4" fill="#c7d2fe" opacity="0.7" stroke="#334155" stroke-width="2"/>`
  s += text(200, 126, '半导体', '#334155', 13)
  // 电流 I 沿 +x
  s += arrow(40, 120, 100, 120, '#ef4444', 2.4) + text(64, 106, 'I', '#ef4444', 15)
  s += arrow(290, 120, 350, 120, '#ef4444', 2.4)
  // B 垂直纸面向里：⊗ 两枚
  s += cross(160, 104, 7) + cross(240, 138, 7) + text(200, 60, 'B（垂直纸面向里）', '#334155', 13)
  // M 上侧面、N 下侧面
  s += text(200, 76, 'M', '#334155', 14) + text(200, 182, 'N', '#334155', 14)
  s += `<line x1="310" y1="80" x2="310" y2="52" stroke="#334155" stroke-width="1.6"/><line x1="310" y1="160" x2="310" y2="196" stroke="#334155" stroke-width="1.6"/>`
  s += text(322, 56, 'U_H', '#334155', 12, 'start')
  return s
})(), 400, 220)

// ---- 磁流体发电机（#770） ----
const fig770 = wrap((() => {
  let s = `<rect x="120" y="70" width="200" height="8" fill="#334155"/><rect x="120" y="172" width="200" height="8" fill="#334155"/>`
  s += text(340, 80, '极板', '#334155', 13, 'start') + text(340, 186, '极板', '#334155', 13, 'start')
  s += cross(160, 100, 7) + cross(220, 100, 7) + cross(280, 100, 7) + cross(160, 150, 7) + cross(220, 150, 7) + cross(280, 150, 7)
  s += text(200, 46, 'B（垂直纸面向里）', '#334155', 13)
  s += arrow(30, 125, 100, 125, '#ef4444', 2.4) + text(64, 112, 'v', '#ef4444', 14) + text(56, 146, '等离子体', '#ef4444', 12)
  // 外电阻 R
  s += `<line x1="220" y1="70" x2="220" y2="40" stroke="#334155" stroke-width="1.6"/><line x1="220" y1="180" x2="220" y2="208" stroke="#334155" stroke-width="1.6"/><line x1="220" y1="40" x2="330" y2="40" stroke="#334155" stroke-width="1.6"/><line x1="220" y1="208" x2="330" y2="208" stroke="#334155" stroke-width="1.6"/>` + resistor(330, 124, 20, 40, false) + text(356, 128, 'R', '#334155', 14)
  s += `<line x1="330" y1="40" x2="330" y2="104" stroke="#334155" stroke-width="1.6"/><line x1="330" y1="144" x2="330" y2="208" stroke="#334155" stroke-width="1.6"/>`
  return s
})(), 420, 240)

// ---- 磁流体发电机横截面（#771：宽 b 高 h，左右极板，B 竖直向下，液流垂直纸面向里） ----
const fig771 = wrap((() => {
  let s = `<rect x="120" y="70" width="160" height="110" fill="#eef2ff" opacity="0.5" stroke="#334155" stroke-width="2"/>`
  // 左右极板（加粗）
  s += `<line x1="120" y1="70" x2="120" y2="180" stroke="#0f172a" stroke-width="5"/><line x1="280" y1="70" x2="280" y2="180" stroke="#0f172a" stroke-width="5"/>`
  s += text(96, 130, '极板', '#334155', 13, 'end') + text(304, 130, '极板', '#334155', 13, 'start')
  // B 竖直向下
  for (const x of [165, 235]) s += arrow(x, 90, x, 160, '#4f46e5', 1.6)
  s += text(200, 58, 'B（竖直向下）', '#334155', 13)
  // 液流垂直纸面向里
  s += cross(200, 125, 9) + text(200, 196, 'v（垂直纸面向里）', '#ef4444', 12)
  // 尺寸标注：宽 b（下）、高 h（右）
  s += `<line x1="120" y1="210" x2="280" y2="210" stroke="#64748b" stroke-width="1.2"/><line x1="120" y1="204" x2="120" y2="216" stroke="#64748b" stroke-width="1.2"/><line x1="280" y1="204" x2="280" y2="216" stroke="#64748b" stroke-width="1.2"/>` + text(200, 226, 'b', '#64748b', 13)
  s += `<line x1="296" y1="70" x2="296" y2="180" stroke="#64748b" stroke-width="1.2"/><line x1="290" y1="70" x2="302" y2="70" stroke="#64748b" stroke-width="1.2"/><line x1="290" y1="180" x2="302" y2="180" stroke="#64748b" stroke-width="1.2"/>` + text(312, 130, 'h', '#64748b', 13)
  return s
})(), 420, 240)

// ---- #785：波形（波前 x=4，P(2,0) 左峰右谷）+ Q(5,0) 未传到 ----
const fig785 = wrap((() => {
  const A = 34, x0 = 34, yMid = 118, sx = 30
  let s = `<line x1="${x0}" y1="40" x2="${x0}" y2="192" stroke="#334155" stroke-width="1.6"/><line x1="${x0}" y1="${yMid}" x2="${x0 + 6 * sx}" y2="${yMid}" stroke="#334155" stroke-width="1.6"/>`
  const wave = []
  for (let i = 0; i <= 60; i++) {
    const xm = (4 * i) / 60
    wave.push(`${(x0 + xm * sx).toFixed(1)},${(yMid - A * Math.sin((Math.PI / 2) * xm)).toFixed(1)}`)
  }
  s += `<polyline points="${wave.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.2"/>`
  // 波前（x=4）竖直虚线
  s += `<line x1="${x0 + 4 * sx}" y1="46" x2="${x0 + 4 * sx}" y2="190" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="6 4"/>` + text(x0 + 4 * sx, 38, '波前', '#64748b', 12)
  for (let xm = 1; xm <= 5; xm++) s += text(x0 + xm * sx, yMid + 15, String(xm), '#64748b', 11)
  s += dot(x0 + 2 * sx, yMid, 4) + text(x0 + 2 * sx + 2, yMid - 12, 'P', '#ef4444', 14)
  s += dot(x0 + 5 * sx, yMid, 4) + text(x0 + 5 * sx + 2, yMid - 12, 'Q', '#ef4444', 14)
  s += text(x0 + 6 * sx + 4, yMid + 4, 'x/m', '#334155', 12, 'start') + text(x0 - 5, 46, 'y/m', '#334155', 12, 'start')
  s += text(x0 + 88, 226, '虚线右侧波尚未传到', '#64748b', 12)
  return s
})(), 400, 236)

// ---------- 数值/文本新内容 ----------
// #760：(2) 答案与解析重写（菱形法）
const ANS760 = '(1) $90^\\circ$；(2) 所有粒子离开磁场时速度方向均相同，均平行于磁场边界在 $P$ 点处的切线方向（即垂直于 $PO$ 的方向，$O$ 为磁场圆心）'
const SOL760 = `(1) 粒子在磁场中做匀速圆周运动，洛伦兹力提供向心力：$qvB=\\dfrac{mv^2}{r}$，故 $r=\\dfrac{mv}{qB}=R$。设磁场圆心为 $O$、轨迹圆心为 $O'$。沿半径方向射入时，入射速度沿 $PO$ 指向 $O$，$O'$ 在过 $P$ 且垂直于 $PO$ 的直线上，$PO'=r=R$。轨迹圆与磁场圆交于 $P$、$Q$ 两点。四边形 $OPO'Q$ 中 $OP=OQ=R$（磁场圆半径）、$O'P=O'Q=r=R$（轨迹圆半径），四边相等，为菱形；又 $\\angle OPO'=90^\\circ$（$PO'\\perp PO$），故为正方形，轨迹圆心角 $\\angle PO'Q=90^\\circ$，偏转角为 $90^\\circ$。
(2) 对任意入射方向，四边形 $OPO'Q$ 仍四边均为 $R$，为菱形，故对边平行：$O'Q\\parallel OP$。出射速度垂直于轨迹半径 $O'Q$，故垂直于 $OP$，即沿磁场圆在 $P$ 点处的切线方向——与入射方向无关。所以所有粒子出射速度方向均相同，均平行于过 $P$ 点的切线（垂直于 $PO$ 方向）。`

// #762：整题重写（磁聚焦，数值压轴）
const STEM762 = `在 $xOy$ 平面内有一半径 $R=0.10\\ \\text{m}$ 的圆形匀强磁场区域（磁聚焦器），圆心在原点 $O$，磁感应强度 $B=0.20\\ \\text{T}$，方向垂直纸面向里。一束质量 $m=1.6\\times10^{-27}\\ \\text{kg}$、电荷量 $q=+1.6\\times10^{-19}\\ \\text{C}$ 的带电粒子（重力不计）从磁场边界左侧圆弧上不同位置沿 $x$ 轴正方向平行射入，速率均为 $v=2.0\\times10^{6}\\ \\text{m/s}$。（1）求粒子轨迹半径 $r$，并证明所有粒子都从磁场边界上同一点 $Q$ 射出，写出 $Q$ 点坐标；（2）求从最左端入射点 $P_0(-R,0)$ 射入的粒子在磁场中的运动时间 $t_0$；（3）若入射点限制在以 $-x$ 方向为中心、对称分布 $\\pm30^\\circ$ 的圆弧内（入射点方位角 $\\varphi\\in[150^\\circ,210^\\circ]$），求粒子在磁场中运动时间的最大值与最小值。`
const ANS762 = `（1）$r=0.10\\ \\text{m}=R$；所有粒子均从 $Q(0,0.10\\ \\text{m})$（磁场边界最高点）射出；（2）$t_0=\\dfrac{\\pi m}{2qB}\\approx7.9\\times10^{-8}\\ \\text{s}$；（3）$t_{\\max}=\\dfrac{2\\pi m}{3qB}\\approx1.05\\times10^{-7}\\ \\text{s}$，$t_{\\min}=\\dfrac{\\pi m}{3qB}\\approx5.2\\times10^{-8}\\ \\text{s}$`
const SOL762 = `（1）由洛伦兹力提供向心力 $qvB=\\dfrac{mv^2}{r}$ 得 $r=\\dfrac{mv}{qB}=\\dfrac{1.6\\times10^{-27}\\times2.0\\times10^{6}}{1.6\\times10^{-19}\\times0.20}\\ \\text{m}=0.10\\ \\text{m}=R$。
设入射点 $P=(R\\cos\\varphi,R\\sin\\varphi)$（左侧圆弧，$\\varphi\\in(90^\\circ,270^\\circ)$），速度沿 $+x$。磁场垂直纸面向里，正电荷所受洛伦兹力沿 $+y$，故轨迹圆心在入射点正上方 $R$ 处：$O'=(R\\cos\\varphi,R\\sin\\varphi+R)$（因 $PO'\\perp v$、$PO'=r=R$）。
两圆（磁场圆 $x^2+y^2=R^2$ 与轨迹圆 $(x-O'_x)^2+(y-O'_y)^2=R^2$）的公共弦满足 $\\vec X\\cdot\\vec{O'}=\\dfrac{|O'|^2}{2}$。验证 $Q_0=(0,R)$：$\\vec{Q_0}\\cdot\\vec{O'}=R(R\\sin\\varphi+R)=R^2(1+\\sin\\varphi)$；$\\dfrac{|O'|^2}{2}=\\dfrac{R^2\\cos^2\\varphi+R^2(1+\\sin\\varphi)^2}{2}=R^2(1+\\sin\\varphi)$，二者相等；且 $|Q_0O|=R$（在磁场边界上）、$|Q_0-O'|=|(-R\\cos\\varphi,-R\\sin\\varphi)|=R$（在轨迹圆上）。故对任意 $\\varphi$，$Q_0$ 都是两圆的另一交点，即所有粒子都从 $Q_0=(0,R)=(0,0.10\\ \\text{m})$ 射出。
（2）$P_0=(-R,0)$ 时 $O'=(-R,R)$。以 $O'$ 为参考：入射时 $\\vec{O'P_0}=(0,-R)$（方位 $-90^\\circ$），出射时 $\\vec{O'Q}=(R,0)$（方位 $0^\\circ$），沿逆时针转过 $90^\\circ$，圆心角 $90^\\circ$。周期 $T=\\dfrac{2\\pi m}{qB}=\\dfrac{2\\pi\\times1.6\\times10^{-27}}{3.2\\times10^{-20}}\\ \\text{s}=3.14\\times10^{-7}\\ \\text{s}$，故 $t_0=\\dfrac{T}{4}=\\dfrac{\\pi m}{2qB}\\approx7.9\\times10^{-8}\\ \\text{s}$。
（3）一般地，$\\vec{O'P}=(0,-R)$ 恒指向 $-y$，$\\vec{O'Q}=(-R\\cos\\varphi,-R\\sin\\varphi)$ 方位为 $\\varphi+180^\\circ$，故圆心角 $\\theta=(\\varphi+180^\\circ)-(-90^\\circ)-360^\\circ=\\varphi-90^\\circ$。$\\varphi\\in[150^\\circ,210^\\circ]$ 时 $\\theta\\in[60^\\circ,120^\\circ]$。$t=\\dfrac{\\theta}{2\\pi}T=\\dfrac{\\theta\\,m}{qB}$，故 $t_{\\max}=\\dfrac{2\\pi m}{3qB}\\approx1.05\\times10^{-7}\\ \\text{s}$（$\\varphi=210^\\circ$），$t_{\\min}=\\dfrac{\\pi m}{3qB}\\approx5.2\\times10^{-8}\\ \\text{s}$（$\\varphi=150^\\circ$）。`

// #761：整题重写（加速+圆形磁场，∠AOC=60°）
const STEM761 = `在 $xOy$ 平面内有一半径为 $R$ 的圆形匀强磁场区域，圆心在原点 $O$，磁感应强度大小为 $B$，方向垂直纸面向外。质量为 $m$、电荷量为 $+q$ 的粒子（初速度近似为零、重力不计）先经电压为 $U$ 的匀强电场加速，然后沿半径方向从磁场边界上的 $A$ 点射入磁场（速度指向圆心 $O$）。粒子从磁场边界上的 $C$ 点离开磁场，$OC$ 与 $OA$ 的夹角为 $60^\\circ$。求：（1）粒子进入磁场时的速度大小 $v$；（2）磁感应强度 $B$ 与 $U$、$R$、$m$、$q$ 的关系；（3）粒子在磁场中的运动时间 $t$。`
const ANS761 = `(1) $v=\\sqrt{\\dfrac{2qU}{m}}$；(2) $B=\\dfrac{1}{R}\\sqrt{\\dfrac{6mU}{q}}$；(3) $t=\\dfrac{2\\pi m}{3qB}=\\dfrac{2\\pi R}{3}\\sqrt{\\dfrac{m}{6qU}}$`
const SOL761 = `（1）粒子在电场中加速，由动能定理 $qU=\\dfrac{1}{2}mv^2$，得 $v=\\sqrt{\\dfrac{2qU}{m}}$。
（2）粒子沿半径方向（$AO$ 方向）射入，轨迹圆心 $O'$ 在过 $A$ 且垂直于 $AO$ 的直线上，$O'A=r$（轨迹半径）。设以 $O$ 为原点、$OA$ 方向为 $x$ 轴正向：$A=(R,0)$，$C=(R\\cos60^\\circ,R\\sin60^\\circ)=\\left(\\dfrac{R}{2},\\dfrac{\\sqrt3R}{2}\\right)$，$O'=(R,r)$（粒子向上偏转）。由 $O'C=r$：$\\left(\\dfrac{R}{2}-R\\right)^2+\\left(\\dfrac{\\sqrt3R}{2}-r\\right)^2=r^2$，展开得 $\\dfrac{R^2}{4}+\\dfrac{3R^2}{4}-\\sqrt3Rr+r^2=r^2$，即 $R^2=\\sqrt3Rr$，解得 $r=\\dfrac{R}{\\sqrt3}=\\dfrac{\\sqrt3}{3}R$。由 $r=\\dfrac{mv}{qB}$ 得 $B=\\dfrac{mv}{qr}=\\dfrac{m}{q}\\sqrt{\\dfrac{2qU}{m}}\\cdot\\dfrac{\\sqrt3}{R}=\\dfrac{1}{R}\\sqrt{\\dfrac{6mU}{q}}$。
（3）圆心角：$\\vec{O'A}=(0,-r)$（方位 $-90^\\circ$），$\\vec{O'C}=\\left(-\\dfrac{R}{2},\\dfrac{\\sqrt3R}{2}-r\\right)=\\left(-\\dfrac{R}{2},\\dfrac{\\sqrt3R}{6}\\right)$，$|\\vec{O'C}|=\\dfrac{R}{\\sqrt3}=r$ ✓。$\\cos\\theta=\\dfrac{\\vec{O'A}\\cdot\\vec{O'C}}{r^2}=\\dfrac{0\\times(-\\frac{R}{2})+(-\\frac{R}{\\sqrt3})\\times\\frac{\\sqrt3R}{6}}{R^2/3}=\\dfrac{-R^2/6}{R^2/3}=-\\dfrac{1}{2}$，$\\theta=120^\\circ=\\dfrac{2\\pi}{3}$。故 $t=\\dfrac{\\theta}{2\\pi}T=\\dfrac{\\theta m}{qB}=\\dfrac{2\\pi m}{3qB}$；代入（2）的 $B$ 得 $t=\\dfrac{2\\pi m}{3q}\\cdot\\dfrac{R}{\\sqrt{6mU/q}}=\\dfrac{2\\pi R}{3}\\sqrt{\\dfrac{m}{6qU}}$。`

// #765：(3) 重解（直径差）
const ANS765 = `（1）$v_1\\approx 6.2\\times10^{4}\\ \\text{m/s}$；（2）$R_1\\approx 6.4\\times10^{-2}\\ \\text{m}$；（3）$d\\approx 6.3\\times10^{-3}\\ \\text{m}$`
const SOL765 = `（1）离子在加速电场中，由动能定理 $qU=\\dfrac{1}{2}m_1v_1^2$，$m_1=20\\times1.66\\times10^{-27}\\ \\text{kg}=3.32\\times10^{-26}\\ \\text{kg}$，得 $v_1=\\sqrt{\\dfrac{2\\times1.6\\times10^{-19}\\times400}{3.32\\times10^{-26}}}\\approx6.2\\times10^{4}\\ \\text{m/s}$。
（2）离子在磁场中做匀速圆周运动，$qv_1B=\\dfrac{m_1v_1^2}{R_1}$，得 $R_1=\\dfrac{m_1v_1}{qB}=\\dfrac{3.32\\times10^{-26}\\times6.2\\times10^{4}}{1.6\\times10^{-19}\\times0.20}\\ \\text{m}\\approx6.4\\times10^{-2}\\ \\text{m}$。
（3）由 $R=\\dfrac{mv}{qB}=\\dfrac{\\sqrt{2mqU}}{qB}\\propto\\sqrt{m}$，故 $R_2=R_1\\sqrt{\\dfrac{m_2}{m_1}}=R_1\\sqrt{\\dfrac{22}{20}}$。两种离子从同一点 $P$ 沿同一方向垂直于底片射入磁场，打在底片上的位置到入射点的距离等于各自的直径 $2R$，故 $A$、$B$ 两点间距 $d=2R_2-2R_1=2R_1\\left(\\sqrt{\\dfrac{22}{20}}-1\\right)\\approx2\\times6.4\\times10^{-2}\\times0.0488\\ \\text{m}\\approx6.3\\times10^{-3}\\ \\text{m}$。`

// #770：(3) 重写（删 n/q 残稿）
const SOL770 = `（1）稳定时板间电场力与洛伦兹力平衡：$qE_{\\text{场}}=qvB$，故电动势 $E=Bdv=0.50\\times0.20\\times100\\ \\text{V}=10\\ \\text{V}$。
（2）由闭合电路欧姆定律 $I=\\dfrac{E}{R+r}=\\dfrac{10}{0.60+0.40}\\ \\text{A}=10\\ \\text{A}$。路端电压 $U=IR=10\\times0.60\\ \\text{V}=6.0\\ \\text{V}$。输出功率 $P_{\\text{出}}=UI=6.0\\times10\\ \\text{W}=60\\ \\text{W}$。
（3）稳定工作时，极板间电荷分离等效的"非静电力"把单位正电荷从负极板经等离子体搬回正极板做功 $E=Bdv=10\\ \\text{V}$，电路电流 $I=10\\ \\text{A}$，故等离子体向电路提供的电功率 $P_{\\text{电}}=EI=10\\times10\\ \\text{W}=100\\ \\text{W}$。输出功率 $P_{\\text{出}}=60\\ \\text{W}$，差值 $P_{\\text{电}}-P_{\\text{出}}=40\\ \\text{W}=I^2r=10^2\\times0.40\\ \\text{W}$，消耗在发电机等效内阻（等离子体等效电阻）上转化为内能。`

// #771：题干几何句修正 + 全题重解
const STEM771_OLD = `通道上下两壁为绝缘壁，左右两侧为金属极板，极板间加垂直流动方向、平行于绝缘壁的匀强磁场 $B=0.40\\ \\text{T}$。`
const STEM771_NEW = `通道上下两壁为绝缘壁，左右两侧为金属极板（间距为宽 $b$），匀强磁场 $B=0.40\\ \\text{T}$ 竖直向下（垂直于流动方向，也垂直于上下绝缘壁）。`
const ANS771 = `（1）$E=16\\ \\text{V}$，$r=0.025\\ \\Omega$；（2）$U\\approx15.2\\ \\text{V}$，$P_{\\text{出}}\\approx464\\ \\text{W}$，$P_{r}\\approx23.2\\ \\text{W}$；（3）$P_{\\text{机}}\\approx488\\ \\text{W}$，$P_{\\text{机}}=P_{\\text{出}}+P_{r}$`
const SOL771 = `（1）电荷随液体一起流动，受洛伦兹力向左右极板偏转，稳定时电场力与洛伦兹力平衡 $q\\dfrac{E_{\\text{场}}}{b}=qvB$，电动势 $E=Bvb=0.40\\times200\\times0.20\\ \\text{V}=16\\ \\text{V}$（极板间距为 $b$）。电流沿左右极板连线方向（宽 $b$ 方向），该方向上液体的等效内阻 $r=\\dfrac{1}{\\sigma}\\cdot\\dfrac{b}{hL}=\\dfrac{1}{80}\\times\\dfrac{0.20}{0.10\\times1.0}\\ \\Omega=0.025\\ \\Omega$。
（2）总电流 $I=\\dfrac{E}{R+r}=\\dfrac{16}{0.50+0.025}\\ \\text{A}\\approx30.5\\ \\text{A}$。路端电压 $U=IR\\approx30.5\\times0.50\\ \\text{V}\\approx15.2\\ \\text{V}$。输出功率 $P_{\\text{出}}=UI\\approx15.2\\times30.5\\ \\text{W}\\approx464\\ \\text{W}$（精确值 $\\dfrac{E^2R}{(R+r)^2}=\\dfrac{16^2\\times0.50}{0.525^2}\\approx464\\ \\text{W}$）。液体内部焦耳热功率 $P_r=I^2r\\approx30.5^2\\times0.025\\ \\text{W}\\approx23.2\\ \\text{W}$。
（3）液体中电流沿宽度方向流动，所受安培力 $F=BIb$，液体克服安培力做功的功率 $P_{\\text{机}}=Fv=BIbv$。由 $E=Bvb$ 得 $P_{\\text{机}}=IE\\approx30.5\\times16\\ \\text{W}\\approx488\\ \\text{W}$。另一方面 $P_{\\text{出}}+P_r=I^2(R+r)=IE\\approx488\\ \\text{W}$，故 $P_{\\text{机}}=P_{\\text{出}}+P_r$：液体克服安培力做功消耗的机械能全部转化为电能，其中一小部分在液体内阻上发热，其余输出给外电阻。`

// #785：题干/答案/解析重写
const STEM785 = `一列简谐横波沿 $x$ 轴正方向传播，波速 $v=2\\ \\text{m/s}$，振幅 $A=0.1\\ \\text{m}$，波长 $\\lambda=4\\ \\text{m}$。$t=0$ 时刻波恰好传到 $x=4\\ \\text{m}$ 处，此时 $0\\sim4\\ \\text{m}$ 间的波形如图所示，$P$ 点位于 $x=2\\ \\text{m}$ 处且恰处于平衡位置（其左侧邻近处为波峰、右侧邻近处为波谷），$Q$ 点位于 $x=5\\ \\text{m}$ 处（波尚未传到 $Q$）。（1）求波的周期 $T$；（2）判断 $t=0$ 时刻 $P$ 点的振动方向，并说明依据；（3）求波从 $t=0$ 时刻起传到 $Q$ 点所需的时间，以及 $Q$ 点第一次到达波峰的时刻。`
const ANS785 = `（1）$T=2\\ \\text{s}$；（2）$P$ 点向上振动；（3）波传到 $Q$ 需 $0.5\\ \\text{s}$，$Q$ 点第一次到达波峰的时刻为 $t=2.0\\ \\text{s}$`
const SOL785 = `（1）由 $v=\\dfrac{\\lambda}{T}$ 得 $T=\\dfrac{\\lambda}{v}=\\dfrac{4}{2}\\ \\text{s}=2\\ \\text{s}$。
（2）$x=2\\ \\text{m}$ 处左侧邻近为波峰、右侧邻近为波谷，沿传播方向（$+x$）看，$P$ 点处于"下坡"段。由"上下坡法"（顺着传播方向，上坡段质点向下振动、下坡段质点向上振动），$P$ 点向上振动。（平移法验证：波形向右平移一小段，$x=2\\ \\text{m}$ 处新波形位于原波形上方，故 $P$ 向上运动。）
（3）波前在 $x=4\\ \\text{m}$ 处，传到 $Q(x=5\\ \\text{m})$ 需 $t_1=\\dfrac{5-4}{2}\\ \\text{s}=0.5\\ \\text{s}$。$Q$ 的起振方向与波前处（$x=4\\ \\text{m}$）质点此时的振动方向相同：$x=4\\ \\text{m}$ 处左侧邻近为波谷，处于"上坡"段，质点向下振动，故 $Q$ 起振后先向下运动。从开始振动到第一次到达波峰需 $\\dfrac{3}{4}T=1.5\\ \\text{s}$，故 $Q$ 第一次到达波峰的时刻为 $t=0.5+1.5=2.0\\ \\text{s}$。`

// #786：题干楔形修正
const STEM786_OLD = `位于空气中的一平行平面肥皂薄膜，厚度均匀，用波长 $\\lambda=600\\ \\text{nm}$ 的单色光垂直照射，在膜上观察到等厚干涉条纹。`
const STEM786_NEW = `竖直放置的肥皂膜在重力作用下形成上薄下厚的楔形薄膜，用波长 $\\lambda=600\\ \\text{nm}$ 的单色光垂直于膜面照射，在膜上观察到水平的等厚干涉条纹。`

// ---------- patch 构建 ----------
const patches = [
  // 配图置空（题干自包含、不引用图）
  { id: 745, patch: { figure: '' } },
  { id: 746, patch: { figure: '' } },
  { id: 747, patch: { figure: '' } },
  { id: 750, patch: { figure: '' } },
  { id: 751, patch: { figure: '' } },
  { id: 757, patch: { figure: '' } },
  { id: 758, patch: { figure: '' } },
  { id: 782, patch: { figure: '' } },
  { id: 784, patch: { figure: '' } },
  // 配图重画
  { id: 759, patch: { figure: fig759 } },
  { id: 760, patch: { figure: fig760, answer: ANS760, solution: SOL760 } },
  { id: 761, patch: { figure: fig761, stem: STEM761, answer: ANS761, solution: SOL761 } },
  { id: 762, patch: { figure: fig762, stem: STEM762, answer: ANS762, solution: SOL762 } },
  { id: 763, patch: { figure: fig763 } },
  { id: 764, patch: { figure: fig764 } },
  { id: 765, patch: { figure: fig765, answer: ANS765, solution: SOL765 } },
  { id: 766, patch: { figure: fig766 } },
  { id: 767, patch: { figure: fig767, stem__replace: { from: '磁感应强度 $B=0.10\\,\\text{T}$，方向垂直纸面向外', to: '磁感应强度 $B=0.10\\,\\text{T}$，方向垂直纸面向里' } } },
  { id: 769, patch: { figure: fig769, stem__replace: { from: 'A. 侧面 $M$ 的电势高于侧面 $N$ 的电势', to: 'A. 侧面 $M$ 的电势低于侧面 $N$ 的电势' }, solution__replace: { from: '由左手定则，电子所受洛伦兹力方向指向侧面 $M$ 一侧（$y$ 正方向），故电子向 $M$ 侧偏转聚集，$M$ 侧带负电，$N$ 侧带正电，$M$ 的电势低于 $N$ 的电势，A 错误。', to: '电子带负电，由左手定则（或 $\\vec F=q\\vec v\\times\\vec B$）判断：电子所受洛伦兹力方向指向下侧面 $N$（$y$ 负方向），故电子向 $N$ 侧偏转聚集，$N$ 侧带负电，$M$ 侧带正电，$M$ 的电势高于 $N$ 的电势，A 错误。' } } },
  { id: 770, patch: { figure: fig770, stem__replace: { from: '等离子体中正、负离子数密度均为 $n=2.0\\times10^{20}\\ \\text{m}^{-3}$，每个离子电荷量 $q=1.6\\times10^{-19}\\ \\text{C}$。', to: '' }, solution: SOL770 } },
  { id: 771, patch: { figure: fig771, stem__replace: { from: STEM771_OLD, to: STEM771_NEW }, answer: ANS771, solution: SOL771 } },
  { id: 785, patch: { figure: fig785, stem: STEM785, answer: ANS785, solution: SOL785 } },
  { id: 786, patch: { stem__replace: { from: STEM786_OLD, to: STEM786_NEW } } },
  // 小修
  { id: 753, patch: { stem__replace: { from: '一节干电池的电动势为 $E=3\\ \\text{V}$', to: '某电池组的电动势为 $E=3\\ \\text{V}$' } } },
  { id: 759, patch: { stem__replace: { from: 'A. 电容器两极板间电场强度方向竖直向下，大小由 $3.0\\times10^{2}\\ \\text{V/m}$ 变为 $4.0\\times10^{2}\\ \\text{V/m}$', to: 'A. 电容器两极板间电场强度方向竖直向上，大小由 $3.0\\times10^{2}\\ \\text{V/m}$ 变为 $4.0\\times10^{2}\\ \\text{V/m}$' } } },
]

let applied = 0
const ONLY = process.argv.find((a) => a.startsWith('--only'))
const onlySet = ONLY && ONLY.includes('=') ? new Set(ONLY.split('=')[1].split(',').map(Number)) : null
for (const p of patches) {
  if (onlySet && !onlySet.has(p.id)) continue
  const row = db.prepare('SELECT * FROM questions WHERE id=?').get(p.id)
  if (!row) { console.error(`✗ #${p.id} 不存在`); process.exit(1) }
  const set = { id: p.id }
  const entries = Object.entries(p.patch).sort(([a], [b]) => (a.includes('__replace') ? -1 : 0) - (b.includes('__replace') ? -1 : 0))
  for (const [k, v] of entries) {
    if (k.endsWith('__replace')) {
      const col = k.replace('__replace', '')
      const cur = String(set[col] ?? row[col] ?? '')
      if (!cur.includes(p.patch[k].from)) { console.error(`✗ #${p.id}.${col} 未找到待替换片段`); console.error('  期望：' + p.patch[k].from.slice(0, 80)); process.exit(1) }
      set[col] = cur.replace(p.patch[k].from, p.patch[k].to)
    } else {
      set[k] = v
    }
  }
  if (DRY) { console.log(`[dry] #${p.id} → ${Object.keys(set).filter((k) => k !== 'id').join(', ')}`); continue }
  const cols = Object.keys(set).filter((k) => k !== 'id')
  db.prepare(`UPDATE questions SET ${cols.map((c) => `${c}=@${c}`).join(', ')} WHERE id=@id`).run(set)
  applied++
  console.log(`✓ #${p.id} 已更新：${cols.join(', ')}`)
}
console.log(DRY ? `[dry-run] 未写库，待更新 ${patches.length} 条` : `完成：更新 ${applied}/${patches.length} 条`)
