// 一次性脚本：验收 #25 修复（P1 存量配图错配 + P2 #719 解析矛盾）
// 【P1 置空 figure】题干自包含、无图引用：#609（天体密度）/ #615（卫星变轨）/ #616（卫星变轨）/ #649（核结合能）/ #575（横波）
// 【P1 重画】#392（矩形线框+⊗磁场+转轴）/ #489（磁流体发电机：极板+⊗+等离子体入射）/ #692（线圈+转轴+B）
// 【宽化扫描新发现（bank-audit 规则升级后扫出，一并修复）】
// - #241（楞次定律）：模板残留「B/E（匀强场区）+q」，且箭头向上与题干「竖直向下」相反 → 重画俯视图（⊗+线框+拉出方向）
// - #571（板块模型）：图中箭头向左与题干「v0 向右」矛盾，标签「无外力」冗余 → 重画（光滑地面+板+块+v0 向右）
// - #498（频闪平抛）：图内「桌面」标签题干未提及 → 题干补「把斜槽固定在桌面边缘」
// 【#576 特殊处理】监督指令为置空，但题干显式引用「图甲/图乙」且 (2)(4) 问依赖图形 → 改为重画双图（波形+振动，仿 #691 先例）；
//   独立重解发现 (4) 问物理错误：x=5 m 质点与 x=1 m 相距一个波长，图甲中 x=1 m 处 t=0 位于波峰（原解析误写「平衡位置」），
//   振动方程应为 y=A·cos(2πt/T)，t=0.5 s 时 y=A·cos(5π/4)=−0.1√2≈−0.141 m（原答案 +0.141 m 符号错）→ 已重解重写
// 【P2 #719】题干「上极板接电源正极」，解析误写「因下极板接电源正极而带正电」→ 改「上极板接电源正极而带正电、下极板带负电」（E 向下结论不变）
// 防护同 fix-accept24：动态构建 SET、仅更新 patch 字段；支持 --dry-run
// 用法：node scripts/fix-accept25.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- SVG 辅助（与 fix-accept24-batch14.mjs 同一套） ----------
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
const crossGrid = (x0, y0, x1, y1, nx, ny) => {
  const out = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push(cross(x0 + ((x1 - x0) * i) / (nx - 1), y0 + ((y1 - y0) * j) / (ny - 1)))
  return out.join('')
}

// #392：匀强磁场（⊗）+ 矩形线框（绕左边转轴）
const fig392 = wrap((() => {
  let s = `<rect x="70" y="45" width="260" height="155" fill="#eef2ff" opacity="0.5" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="6 4"/>` + crossGrid(95, 70, 305, 175, 6, 3)
  s += `<rect x="150" y="85" width="110" height="80" fill="none" stroke="#334155" stroke-width="2.6"/>`
  // 转轴：线框左边缘（竖直虚线，两端出头）
  s += `<line x1="150" y1="70" x2="150" y2="180" stroke="#0f172a" stroke-width="2" stroke-dasharray="8 4"/>`
  s += text(150, 62, '转轴', '#0f172a', 13)
  s += text(268, 118, '矩形线框', '#334155', 13, 'start')
  s += text(200, 32, 'B（垂直纸面向里）', '#334155', 13)
  return s
})())

// #489：磁流体发电机（上下极板 + ⊗ 磁场 + 等离子体水平射入）
const fig489 = wrap((() => {
  let s = `<rect x="110" y="80" width="230" height="7" fill="#334155"/><rect x="110" y="173" width="230" height="7" fill="#334155"/>`
  s += text(340, 90, '上极板', '#334155', 13, 'start') + text(340, 187, '下极板', '#334155', 13, 'start')
  s += crossGrid(135, 108, 315, 152, 5, 2)
  s += text(322, 135, 'B（垂直纸面向里）', '#64748b', 12, 'start')
  s += arrow(40, 130, 100, 130, '#ef4444', 2.4) + text(66, 118, 'v', '#ef4444', 14)
  s += text(78, 152, '等离子体', '#ef4444', 12)
  // 极板引出接线（接外电路示意）
  s += `<line x1="225" y1="80" x2="225" y2="52" stroke="#334155" stroke-width="1.4"/><line x1="225" y1="180" x2="225" y2="208" stroke="#334155" stroke-width="1.4"/>` + text(225, 44, '电源两极', '#64748b', 11)
  return s
})())

// #692：线圈绕竖直转轴在水平磁场中转动（B 水平向右，线圈画成绕轴的斜置矩形）
const fig692 = wrap((() => {
  let s = ''
  // 磁场：水平向右的箭头一排
  for (const y of [78, 120, 162]) s += arrow(60, y, 340, y, '#4f46e5', 1.8)
  s += text(352, 124, 'B', '#4f46e5', 15)
  // 转轴：竖直虚线 OO'
  s += `<line x1="200" y1="40" x2="200" y2="212" stroke="#0f172a" stroke-width="2" stroke-dasharray="8 4"/>`
  s += text(200, 32, '转轴 OO′', '#0f172a', 13)
  // 线圈：绕轴的斜置平行四边形（透视示意）
  s += `<polygon points="200,60 252,84 252,176 200,152" fill="#c7d2fe" opacity="0.75" stroke="#334155" stroke-width="2.4"/>`
  s += `<line x1="200" y1="60" x2="200" y2="152" stroke="#334155" stroke-width="1.2" stroke-dasharray="4 3"/>`
  s += text(268, 122, '线圈', '#334155', 13, 'start')
  return s
})())

// #241：俯视图——磁场竖直向下（⊗）+ 矩形线框正被水平拉出
const fig241 = wrap((() => {
  let s = `<rect x="55" y="45" width="225" height="150" fill="#eef2ff" opacity="0.5" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="6 4"/>` + crossGrid(80, 68, 255, 172, 5, 3)
  // 线框：右半在磁场外（正被拉出）
  s += `<rect x="180" y="88" width="120" height="64" fill="none" stroke="#334155" stroke-width="2.6"/>`
  s += text(248, 82, '线框', '#334155', 13)
  s += arrow(305, 120, 352, 120, '#ef4444', 2.4) + text(326, 108, '拉出方向', '#ef4444', 12)
  s += text(150, 32, 'B（竖直向下，图中垂直纸面向里）', '#334155', 12)
  s += text(120, 216, '（从上往下看）', '#64748b', 12)
  return s
})())

// #571：光滑水平面上的木板 M + 左端物块 m 以 v0 向右
const fig571 = wrap((() => {
  let s = `<line x1="40" y1="176" x2="360" y2="176" stroke="#334155" stroke-width="2"/>`
  for (let x = 52; x < 360; x += 34) s += `<line x1="${x}" y1="186" x2="${x + 10}" y2="176" stroke="#94a3b8" stroke-width="1.4"/>`
  s += text(200, 204, '光滑水平面', '#64748b', 12)
  // 木板 M
  s += `<rect x="130" y="150" width="200" height="26" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` + text(255, 168, 'M', '#334155', 14)
  // 物块 m 在木板左端
  s += `<rect x="142" y="116" width="52" height="34" rx="3" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` + text(168, 138, 'm', '#334155', 14)
  // v0 向右
  s += arrow(200, 130, 252, 130, '#ef4444', 2.4) + text(226, 118, 'v₀', '#ef4444', 14)
  s += text(96, 143, '物块m', '#334155', 12, 'start')
  s += text(238, 196, '木板M', '#334155', 12)
  return s
})())

// #576：双图——图甲 t=0 波形（y=A·sin(πx/2)，x=1 波峰、x=3 波谷、P 在 x=2）+ 图乙 P 的振动（y=A·sin(2πt/T)）
const fig576 = wrap((() => {
  const A = 34, x0 = 34, yMid = 110, sx = 26 // 1 m = sx px
  let s = ''
  // ---- 图甲：波形（x ∈ [0, 6]） ----
  s += `<line x1="${x0}" y1="34" x2="${x0}" y2="186" stroke="#334155" stroke-width="1.6"/><line x1="${x0}" y1="${yMid}" x2="${x0 + 6 * sx}" y2="${yMid}" stroke="#334155" stroke-width="1.6"/>`
  const wave = []
  for (let i = 0; i <= 72; i++) {
    const xm = (6 * i) / 72
    wave.push(`${(x0 + xm * sx).toFixed(1)},${(yMid - A * Math.sin((Math.PI / 2) * xm)).toFixed(1)}`)
  }
  s += `<polyline points="${wave.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.2"/>`
  s += dot(x0 + 1 * sx, yMid - A, 3.5) + text(x0 + 1 * sx, yMid - A - 8, '波峰', '#2563eb', 11)
  s += dot(x0 + 2 * sx, yMid, 4) + text(x0 + 2 * sx + 4, yMid + 18, 'P', '#ef4444', 13)
  for (let xm = 1; xm <= 5; xm++) s += text(x0 + xm * sx, yMid + 14, String(xm), '#64748b', 11)
  s += text(x0 + 6 * sx + 6, yMid + 4, 'x/m', '#334155', 12, 'start') + text(x0 - 6, 40, 'y/m', '#334155', 12, 'start')
  s += text(x0 + 78, 206, '图甲　t=0 波形图', '#334155', 13)
  // ---- 图乙：P 的振动（t ∈ [0, 1.2 s]） ----
  const tx0 = 240, tyMid = 110, st = 116 // 1 s = 116 px
  s += `<line x1="${tx0}" y1="34" x2="${tx0}" y2="186" stroke="#334155" stroke-width="1.6"/><line x1="${tx0}" y1="${tyMid}" x2="${tx0 + 1.2 * st}" y2="${tyMid}" stroke="#334155" stroke-width="1.6"/>`
  const vib = []
  for (let i = 0; i <= 72; i++) {
    const t = (1.2 * i) / 72
    vib.push(`${(tx0 + t * st).toFixed(1)},${(tyMid - A * Math.sin((2 * Math.PI / 0.8) * t)).toFixed(1)}`)
  }
  s += `<polyline points="${vib.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.2"/>`
  for (const t of [0.4, 0.8]) s += text(tx0 + t * st, tyMid + 14, String(t), '#64748b', 11)
  s += text(tx0 + 1.2 * st + 6, tyMid + 4, 't/s', '#334155', 12, 'start') + text(tx0 - 6, 40, 'y/m', '#334155', 12, 'start')
  s += text(tx0 + 74, 206, '图乙　P 的振动图', '#334155', 13)
  return s
})(), 480, 226)

// #498：题干补「桌面」（图内标签「桌面」此前题干未提及）
const stem498New = '某小组把斜槽固定在桌面边缘，用频闪照相法研究平抛运动：小球从斜槽末端水平抛出，频闪仪每隔 $T=0.10\\ \\text{s}$ 闪光一次'

// #576 (4) 问重解（原解析误判 x=1 m 处为平衡位置、振动方程与答案符号错）
const sol576P4 = '（4）$t=0$ 时刻 $x=5\\,\\text{m}$ 处质点与 $x=1\\,\\text{m}$ 处质点相距一个波长，振动状态相同。由图甲知 $t=0$ 时刻 $x=1\\,\\text{m}$ 处质点位于波峰，故 $x=5\\,\\text{m}$ 处质点此时也位于波峰，其振动方程为 $y=A\\cos\\dfrac{2\\pi}{T}t$。$t=0.5\\,\\text{s}$ 时 $y=A\\cos\\left(\\dfrac{2\\pi}{0.8}\\times0.5\\right)=A\\cos\\dfrac{5\\pi}{4}=-\\dfrac{\\sqrt{2}}{2}A=-0.1\\sqrt{2}\\,\\text{m}\\approx-0.141\\,\\text{m}$，即位移大小为 $0.141\\,\\text{m}$，方向沿 $y$ 轴负方向。'
const ans576New = '(1) $v=5\\,\\text{m/s}$；(2) 波沿 $x$ 轴正方向传播；(3) $t=0.2\\,\\text{s}$；(4) $y=-0.1\\sqrt{2}\\,\\text{m}\\approx-0.141\\,\\text{m}$（沿 $y$ 轴负方向）'

// ---------- patch 构建 ----------
const patches = [
  // P1：题干自包含、无图引用 → 置空 figure
  { id: 609, patch: { figure: '' } },
  { id: 615, patch: { figure: '' } },
  { id: 616, patch: { figure: '' } },
  { id: 649, patch: { figure: '' } },
  { id: 575, patch: { figure: '' } },
  // P1：重画
  { id: 392, patch: { figure: fig392 } },
  { id: 489, patch: { figure: fig489 } },
  { id: 692, patch: { figure: fig692 } },
  { id: 241, patch: { figure: fig241 } },
  { id: 571, patch: { figure: fig571 } },
  // #576：重画双图 + (4) 问重解
  { id: 576, patch: { figure: fig576, answer: ans576New, solution__append: sol576P4, solution__replace: { from: '（4）$t=0$ 时刻 $x=5\\,\\text{m}$ 处质点与 $x=1\\,\\text{m}$ 处质点相差一个波长，振动状态相同。由图甲知 $x=1\\,\\text{m}$ 处质点位于平衡位置；波沿 $x$ 轴正方向传播时该点处于上坡位置，质点向下运动，故 $x=5\\,\\text{m}$ 处质点的振动方程为 $y=-A\\sin\\dfrac{2\\pi}{T}t$。$t=0.5\\,\\text{s}$ 时 $y=-A\\sin\\left(\\dfrac{2\\pi}{0.8}\\times0.5\\right)=-A\\sin\\dfrac{5\\pi}{4}=A\\cdot\\dfrac{\\sqrt{2}}{2}$。由波形图振幅 $A=0.2\\,\\text{m}$，得 $y=0.1\\sqrt{2}\\,\\text{m}\\approx0.141\\,\\text{m}$。', to: '' } } },
  // #498：题干补「桌面」
  { id: 498, patch: { stem__replace: { from: '某小组用频闪照相法研究平抛运动：小球从斜槽末端水平抛出', to: stem498New } } },
  // P2：#719 解析前提句（题干为上极板接正极）
  { id: 719, patch: { solution__replace: { from: '因下极板接电源正极而带正电、上极板带负电', to: '因上极板接电源正极而带正电、下极板带负电' } } },
]

let applied = 0
for (const p of patches) {
  const row = db.prepare('SELECT * FROM questions WHERE id=?').get(p.id)
  if (!row) { console.error(`✗ #${p.id} 不存在`); process.exit(1) }
  const set = { id: p.id }
  // 先 replace 后 append（append 必须基于 replace 之后的值）
  const entries = Object.entries(p.patch).sort(([a], [b]) => (a.includes('__replace') ? -1 : 0) - (b.includes('__replace') ? -1 : 0))
  for (const [k, v] of entries) {
    if (k.endsWith('__replace')) {
      const col = k.replace('__replace', '')
      const from = p.patch[k].from, to = p.patch[k].to
      const cur = String(row[col] ?? '')
      if (!cur.includes(from)) { console.error(`✗ #${p.id}.${col} 未找到待替换片段（跳过该字段）`); console.error('  期望片段：' + from.slice(0, 80)); process.exit(1) }
      set[col] = cur.replace(from, to)
    } else if (k.endsWith('__append')) {
      const col = k.replace('__append', '')
      const cur = String(set[col] ?? row[col] ?? '')
      set[col] = cur.replace(/\n+$/, '') + '\n' + v + '\n'
    } else {
      set[k] = v
    }
  }
  if (DRY) { console.log(`[dry] #${p.id} → ${Object.keys(set).filter((k) => k !== 'id').join(', ')}`); continue }
  const cols = Object.keys(set).filter((k) => k !== 'id')
  db.prepare(`UPDATE questions SET ${cols.map((c) => `${c}=@${c}`).join(', ')} WHERE id=@id`).run(set)
  applied++
  console.log(`✓ #${p.id} 已更新：${Object.keys(set).filter((k) => k !== 'id').join(', ')}`)
}
console.log(DRY ? `[dry-run] 未写库，待更新 ${patches.length} 题` : `完成：更新 ${applied}/${patches.length} 题`)
