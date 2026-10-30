// 题目配图：AI 只输出 figure_spec（模板名 + 参数），前端按模板渲染成风格统一的 SVG
// 数据模型：question.figure = '{"kind":"svg","data":"<svg …>"}' 或 '{"kind":"img","data":"/uploads/questions/x.png"}'
import type { FigureSpec } from './index'

// 统一配色（与 labs 矢量配色一致；深色模式下由外层容器补底色）
const INK = '#334155' // 主线条/文字
const ACCENT = '#4f46e5' // 强调（indigo）
const RED = '#ef4444'

const FONT = 'font-family="system-ui,\'Microsoft YaHei\',sans-serif"'

const num = (v: unknown, d: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
const str = (v: unknown, d = ''): string => (v === undefined || v === null ? d : String(v))
// 角度标注：数值显示「37°」；字符串（如题干用符号 "α"）原样显示
const angleLabel = (v: unknown, fallback: number): string => {
  const n = Number(v)
  if (Number.isFinite(n) && String(v).trim() !== '') return `${n}°`
  const s = str(v).trim()
  return s && !Number.isFinite(n) ? s : `${fallback}°`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto">` +
  `<rect x="0" y="0" width="400" height="240" fill="none"/>${inner}</svg>`

const txt = (x: number, y: number, s: string, size = 14, fill = INK, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT}>${esc(s)}</text>`

// 箭头（带端部三角）
function arrow(x1: number, y1: number, x2: number, y2: number, color = ACCENT, w = 2.5): string {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const h = 9
  const ax = x2 - h * Math.cos(ang)
  const ay = y2 - h * Math.sin(ang)
  const p1 = `${ax + h * 0.45 * Math.sin(ang)},${ay - h * 0.45 * Math.cos(ang)}`
  const p2 = `${ax - h * 0.45 * Math.sin(ang)},${ay + h * 0.45 * Math.cos(ang)}`
  return `<line x1="${x1}" y1="${y1}" x2="${ax}" y2="${ay}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<polygon points="${x2},${y2} ${p1} ${p2}" fill="${color}"/>`
}

// ---------- 10 个模板 ----------

// 斜面滑块：angle 度数、mu、label、force 可选（沿斜面向上的拉力，如 "F=10N"）
function tIncline(p: FigureSpec['params']): string {
  const angle = Math.min(80, Math.max(5, num(p.angle, 30)))
  const label = str(p.label, 'm')
  const mu = p.mu !== undefined ? `μ=${p.mu}` : ''
  const force = str(p.force)
  const rad = (angle * Math.PI) / 180
  const ox = 60, oy = 190 // 直角顶点
  const len = 240
  const tx = ox + len * Math.cos(rad), ty = oy - len * Math.sin(rad)
  // 滑块沿斜面
  const bx = ox + len * 0.55 * Math.cos(rad), by = oy - len * 0.55 * Math.sin(rad)
  const s = Math.sin(rad), c = Math.cos(rad)
  const bw = 34, bh = 22
  const bx1 = bx - bw / 2 * c, by1 = by + bw / 2 * s
  const bx2 = bx + bw / 2 * c, by2 = by - bw / 2 * s
  const inner =
    `<polygon points="${ox},${oy} ${tx},${ty} ${ox + len},${oy}" fill="#eef2ff" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${ox - 20}" y1="${oy}" x2="${ox + len + 20}" y2="${oy}" stroke="${INK}" stroke-width="2"/>` +
    // 地面斜纹
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${ox - 14 + i * 36}" y1="${oy + 10}" x2="${ox - 4 + i * 36}" y2="${oy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 滑块（旋转矩形）
    `<polygon points="${bx1},${by1} ${bx2},${by2} ${bx2 - bh * s},${by2 - bh * c} ${bx1 - bh * s},${by1 - bh * c}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx - bh * s, by - bh * c - 4, label, 14) +
    txt(ox + 40, oy - 12, angleLabel(p.angle, angle), 14, RED) +
    (mu ? txt(ox + len * 0.5, oy + 32, mu, 13) : '') +
    `<path d="M ${ox + 36} ${oy} A 36 36 0 0 0 ${ox + 36 * Math.cos(rad)} ${oy - 36 * Math.sin(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    // 沿斜面向上的拉力箭头（force 可选）
    (force
      ? arrow(bx + bw * 0.7 * c, by - bh * c - 8 * s + bw * 0.7 * s, bx + bw * 0.7 * c + 58 * c, by - bh * c - 8 * s + bw * 0.7 * s - 58 * s, RED, 3) +
        txt(bx + bw * 0.7 * c + 34 * c + 14, by - bh * c - 8 * s + bw * 0.7 * s - 34 * s - 8, force, 14, RED)
      : '')
  return wrap(inner)
}

// 水平地面滑块：label、force（如 "F=10N"，可选）
function tFlatblock(p: FigureSpec['params']): string {
  const label = str(p.label, 'm')
  const force = str(p.force)
  const gy = 170
  const inner =
    `<line x1="40" y1="${gy}" x2="360" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${52 + i * 38}" y1="${gy + 10}" x2="${62 + i * 38}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<rect x="150" y="${gy - 46}" width="90" height="46" rx="4" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(195, gy - 16, label, 15) +
    (force ? arrow(140, gy - 24, 90, gy - 24, RED, 3) + txt(100, gy - 38, force, 14, RED) : '')
  return wrap(inner)
}

// 定滑轮连接体：桌面 m1 + 定滑轮 + 悬挂 m2（angle_desk 可选桌面倾角，默认 0 水平）
function tPulley(p: FigureSpec['params']): string {
  const l1 = str(p.label_m1, 'm₁')
  const l2 = str(p.label_m2, 'm₂')
  const gy = 150
  const px = 300 // 滑轮位置
  const inner =
    `<line x1="50" y1="${gy}" x2="310" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${62 + i * 36}" y1="${gy + 10}" x2="${72 + i * 36}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<rect x="120" y="${gy - 44}" width="86" height="44" rx="4" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(163, gy - 15, l1, 15) +
    // 滑轮
    `<circle cx="${px}" cy="${gy}" r="18" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${px}" cy="${gy}" r="3" fill="${INK}"/>` +
    // 绳：滑块右缘 → 滑轮顶 → 垂下
    `<line x1="206" y1="${gy - 22}" x2="${px}" y2="${gy - 18}" stroke="${INK}" stroke-width="1.8"/>` +
    `<line x1="${px + 18}" y1="${gy}" x2="${px + 18}" y2="${gy + 78}" stroke="${INK}" stroke-width="1.8"/>` +
    `<rect x="${px - 8}" y="${gy + 78}" width="52" height="40" rx="4" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(px + 18, gy + 104, l2, 15) +
    txt(px, gy - 30, '定滑轮', 12, '#64748b')
  return wrap(inner)
}

// 悬挂小球：angle 绳与竖直夹角、label、second_rope 可选第二根绳角度
function tHang(p: FigureSpec['params']): string {
  const angle = Math.min(80, Math.max(0, num(p.angle, 25)))
  const label = str(p.label, 'm')
  const second = p.second_rope !== undefined ? Math.min(80, Math.max(0, num(p.second_rope, NaN))) : NaN
  const ox = 200, oy = 40 // 悬点
  const L = 130
  const rad = (angle * Math.PI) / 180
  const bx = ox + L * Math.sin(rad), by = oy + L * Math.cos(rad)
  let ropes = `<line x1="${ox}" y1="${oy}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>`
  let labels = ''
  if (Number.isFinite(second)) {
    const rad2 = (-second * Math.PI) / 180
    const cx = ox + L * Math.sin(rad2), cy = oy + L * Math.cos(rad2)
    ropes += `<line x1="${ox}" y1="${oy}" x2="${cx}" y2="${cy}" stroke="${INK}" stroke-width="2"/>`
    labels += txt(cx + (cx < ox ? -26 : 26), cy - 8, `T₂`, 14, '#10b981')
  } else {
    labels += txt(bx + (bx >= ox ? 30 : -30), by - 8, `T`, 14, '#10b981')
  }
  const inner =
    `<line x1="80" y1="${oy}" x2="320" y2="${oy}" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${92 + i * 30}" y1="${oy}" x2="${82 + i * 30}" y2="${oy - 8}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    ropes +
    `<circle cx="${bx}" cy="${by}" r="22" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + 5, label, 13) +
    labels +
    (angle > 0 ? txt(ox, oy + 40, angleLabel(p.angle, angle), 13, RED) : '')
  return wrap(inner)
}

// 简单电路：emf 电源、r 内阻、R 外阻
function tCircuit(p: FigureSpec['params']): string {
  const emf = str(p.emf, 'E')
  const r = p.r !== undefined ? `r=${p.r}Ω` : ''
  const R = str(p.R, 'R')
  const inner =
    `<rect x="60" y="60" width="280" height="140" fill="none" stroke="${INK}" stroke-width="2"/>` +
    // 电源（长短线）
    `<line x1="185" y1="200" x2="215" y2="200" stroke="${INK}" stroke-width="4"/><line x1="172" y1="200" x2="183" y2="200" stroke="${INK}" stroke-width="2"/><line x1="217" y1="200" x2="228" y2="200" stroke="${INK}" stroke-width="2"/>` +
    txt(200, 226, `电源 ${emf}`, 13) +
    (r ? txt(200, 44, r, 12, '#64748b') : '') +
    // 外阻（矩形）
    `<rect x="268" y="104" width="24" height="52" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(300, 134, R, 14) +
    // 电流方向箭头
    arrow(120, 60, 160, 60, ACCENT, 2)
  return wrap(inner)
}

// 平抛：h 桌高（m）、label
function tProjectile(p: FigureSpec['params']): string {
  const h = num(p.h, 1.25)
  const label = str(p.label, 'v₀')
  const gy = 190
  const tableH = 60 + Math.min(90, h * 60)
  const topY = gy - tableH
  const inner =
    `<rect x="40" y="${topY}" width="120" height="${gy - topY}" fill="#eef2ff" stroke="${INK}" stroke-width="2"/>` +
    (str(p.place) ? txt(100, topY + (gy - topY) / 2 + 5, str(p.place), 13, '#64748b') : '') +
    `<line x1="30" y1="${gy}" x2="370" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    // 小球 + 初速度
    `<circle cx="160" cy="${topY - 12}" r="10" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    arrow(172, topY - 12, 215, topY - 12, RED, 3) +
    txt(196, topY - 24, label, 14, RED) +
    // 轨迹虚线
    `<path d="M 160 ${topY - 12} Q 230 ${topY + 30} 300 ${gy}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 5"/>` +
    // 高度标注
    `<line x1="160" y1="${topY}" x2="160" y2="${gy}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
    txt(140, (topY + gy) / 2, `h=${h}m`, 13)
  return wrap(inner)
}

// 容器两球：默认「圆柱形容器底部两等大球并排（球心连线水平）」；带 liquid 参数时画液体+两球
function tContainer2balls(p: FigureSpec['params']): string {
  const l1 = str(p.label1, 'A')
  const l2 = str(p.label2, 'B')
  const liquid = str(p.liquid)
  if (liquid) {
    // 兼容旧用法：液体中两球（浮力类）
    const inner =
      `<path d="M 120 50 L 120 200 L 280 200 L 280 50" fill="none" stroke="${INK}" stroke-width="3"/>` +
      `<rect x="122" y="110" width="156" height="88" fill="#dbeafe" opacity="0.7"/>` + txt(288, 160, liquid, 13, '#2563eb', 'start') +
      `<circle cx="170" cy="150" r="26" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
      txt(170, 155, l1, 14) +
      `<circle cx="235" cy="165" r="18" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
      txt(235, 170, l2, 13) +
      `<line x1="100" y1="200" x2="300" y2="200" stroke="${INK}" stroke-width="3"/>`
    return wrap(inner)
  }
  // 圆柱形容器 + 两等大球并排贴底（共点力平衡「圆柱容器双球」经典情境）
  const R = num(p.R, NaN) // 容器半径（m，仅作标注）
  const r = num(p.r, NaN) // 球半径（m，仅作标注）
  const bw = 46 // 球绘制半径 px
  const baseY = 190, leftX = 92, rightX = 308
  const cx1 = 200 - bw, cx2 = 200 + bw // 两球相切于中线
  const ballY = baseY - bw
  const annR = Number.isFinite(R) ? `R=${R}m` : ''
  const annr = Number.isFinite(r) ? `r=${r}m` : ''
  const inner =
    // 容器：U 形（开口向上）
    `<path d="M ${leftX} 50 L ${leftX} ${baseY} L ${rightX} ${baseY} L ${rightX} 50" fill="none" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${leftX - 22}" y1="${baseY}" x2="${rightX + 22}" y2="${baseY}" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${leftX - 12}" y1="${baseY + 10}" x2="${leftX - 2}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.5"/>` +
    `<line x1="${rightX + 2}" y1="${baseY}" x2="${rightX + 12}" y2="${baseY + 10}" stroke="#94a3b8" stroke-width="1.5"/>` +
    // 两等大球并排（相切）
    `<circle cx="${cx1}" cy="${ballY}" r="${bw}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${cx2}" cy="${ballY}" r="${bw}" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(cx1, ballY + 5, l1, 15) +
    txt(cx2, ballY + 5, l2, 15) +
    // 球心连线（水平虚线）
    `<line x1="${cx1}" y1="${ballY}" x2="${cx2}" y2="${ballY}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>` +
    (annR ? txt(leftX - 4, 40, annR, 13, '#64748b', 'start') : '') +
    (annr ? txt(rightX + 4, 40, annr, 13, '#64748b', 'end') : '')
  return wrap(inner)
}

// 弹簧连滑块：label、x 压缩量（m）
function tSpring(p: FigureSpec['params']): string {
  const label = str(p.label, 'm')
  const x = str(p.x, '')
  const gy = 160
  // 墙
  const wall = `<line x1="70" y1="80" x2="70" y2="200" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3, 4, 5].map((i) => `<line x1="70" y1="${90 + i * 22}" x2="58" y2="${102 + i * 22}" stroke="#94a3b8" stroke-width="1.5"/>`).join('')
  // 弹簧锯齿
  let zig = `M 70 ${gy} `
  for (let i = 1; i <= 8; i++) zig += `L ${70 + i * 14} ${gy + (i % 2 ? -14 : 14)} `
  zig += `L ${70 + 9 * 14} ${gy}`
  const bx = 70 + 9 * 14
  const inner =
    wall +
    `<path d="${zig}" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="${bx}" y="${gy - 24}" width="76" height="48" rx="4" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx + 38, gy + 6, label, 15) +
    (x ? txt(200, gy + 48, `压缩量 x=${x}m`, 13) : '') +
    `<line x1="40" y1="${gy + 24}" x2="360" y2="${gy + 24}" stroke="#cbd5e1" stroke-width="2"/>`
  return wrap(inner)
}

// 拱桥/凹桥：kind=convex|concave、R 半径（m）、label
function tBridge(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'convex') === 'concave' ? 'concave' : 'convex'
  const R = num(p.R, 20)
  const label = str(p.label, 'm')
  const baseY = 190
  const path = kind === 'convex'
    ? `M 40 ${baseY} Q 200 60 360 ${baseY}`
    : `M 40 ${baseY - 90} Q 200 ${baseY + 40} 360 ${baseY - 90}`
  const carX = 200
  const carY = kind === 'convex' ? 129 : 165 // 顶/底附近
  const inner =
    `<path d="${path}" fill="none" stroke="${INK}" stroke-width="3"/>` +
    (kind === 'concave' ? `<rect x="0" y="${baseY + 42}" width="400" height="20" fill="#e2e8f0"/>` : '') +
    // 车（小矩形+轮）
    `<rect x="${carX - 24}" y="${carY - 18}" width="48" height="14" rx="3" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${carX - 13}" cy="${carY - 2}" r="4.5" fill="${INK}"/><circle cx="${carX + 13}" cy="${carY - 2}" r="4.5" fill="${INK}"/>` +
    txt(carX, carY - 26, label, 13) +
    txt(316, kind === 'convex' ? 110 : 150, `R=${R}m`, 13, '#64748b') +
    arrow(232, carY - 10, 268, carY - 10, RED, 2.5) +
    txt(252, carY - 18, 'v', 13, RED)
  return wrap(inner)
}

// 匀强场区/点电荷：kind=uniform|point、charge（+q/-q）、label
function tFieldRegion(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'uniform') === 'point' ? 'point' : 'uniform'
  const charge = str(p.charge, '+q')
  const label = str(p.label, 'v')
  let inner = ''
  if (kind === 'uniform') {
    // 匀强场区：虚线框 + 竖直箭头阵列
    inner =
      `<rect x="90" y="50" width="220" height="150" fill="#eef2ff" opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>` +
      [0, 1, 2, 3].map((i) => arrow(130 + i * 47, 185, 130 + i * 47, 70, ACCENT, 2)).join('') +
      txt(200, 40, 'B / E（匀强场区）', 13, '#64748b') +
      // 入射粒子
      `<circle cx="50" cy="125" r="9" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
      txt(50, 155, charge, 13, RED) +
      arrow(62, 125, 105, 125, RED, 2.5) +
      txt(84, 115, label, 13, RED)
  } else {
    // 点电荷 + 放射电场线
    const lines = [0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => {
        const rad = (a * Math.PI) / 180
        return `<line x1="${216 + 26 * Math.cos(rad)}" y1="${125 + 26 * Math.sin(rad)}" x2="${216 + 80 * Math.cos(rad)}" y2="${125 + 80 * Math.sin(rad)}" stroke="#94a3b8" stroke-width="1.5"/>`
      })
      .join('')
    inner =
      lines +
      `<circle cx="216" cy="125" r="20" fill="#fecaca" stroke="${RED}" stroke-width="2"/>` +
      txt(216, 131, charge, 14, RED) +
      txt(216, 230, '点电荷场', 13, '#64748b')
  }
  return wrap(inner)
}

// 半球形碗 + 绳系碗沿 A 点 + 球在碗内壁：angle 球与碗心连线偏离竖直方向的角（度）、R 半径（m）
function tBowl(p: FigureSpec['params']): string {
  const angle = Math.min(80, Math.max(0, num(p.angle, 30)))
  const R = num(p.R, NaN)
  const label = str(p.label, 'm')
  const cx = 200, cy = 62 // 球心（碗心）
  const Rr = 112 // 绘制半径
  const br = 20 // 小球绘制半径
  const rad = (angle * Math.PI) / 180
  // 小球在碗内壁：球心沿碗心方向偏 (Rr - br)，与竖直向下方向夹角 angle
  const bx = cx + (Rr - br) * Math.sin(rad), by = cy + (Rr - br) * Math.cos(rad)
  const ax = cx + Rr, ay = cy // 碗沿 A 点（右缘）
  const inner =
    // 地面
    `<line x1="60" y1="${cy}" x2="340" y2="${cy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${72 + i * 34}" y1="${cy + 10}" x2="${82 + i * 34}" y2="${cy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 半球碗（下半圆）
    `<path d="M ${cx - Rr} ${cy} A ${Rr} ${Rr} 0 0 0 ${cx + Rr} ${cy}" fill="#eef2ff" stroke="${INK}" stroke-width="2.5"/>` +
    // 绳：碗沿 A → 小球
    `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${ax}" cy="${ay}" r="3.5" fill="${INK}"/>` +
    txt(ax + 12, ay - 8, 'A', 14) +
    `<circle cx="${bx}" cy="${by}" r="${br}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + 5, label, 14) +
    // 角度弧（与竖直方向）
    `<path d="M ${cx} ${cy + 52} A 52 52 0 0 1 ${cx + 52 * Math.sin(rad)} ${cy + 52 * Math.cos(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    txt(cx + 66, cy + 62, angleLabel(p.angle, angle), 13, RED) +
    (Number.isFinite(R) ? txt(cx, cy + Rr + 40, `R=${R}m`, 13, '#64748b') : txt(cx, cy + Rr + 40, '半球形碗（光滑）', 13, '#64748b'))
  return wrap(inner)
}

// 半球形碗内两等大球：球心连线水平且相互接触（共点力平衡经典情境）
// 几何自洽绘制：sinθ = r/(R−r)，θ 为球心与碗心连线偏离竖直方向的角；球绘制半径按比例推导
function tBowl2balls(p: FigureSpec['params']): string {
  const angle = Math.min(75, Math.max(5, num(p.angle, 30)))
  const R = num(p.R, NaN)
  const r = num(p.r, NaN)
  const l1 = str(p.label1, 'm')
  const l2 = str(p.label2, 'm')
  const cx = 200, cy = 70 // 碗心
  const Rr = 92 // 碗绘制半径
  const rad = (angle * Math.PI) / 180
  // 由 sinθ = br/(Rr−br) 反推球绘制半径，保证球既贴碗壁又相互接触
  const br = (Rr * Math.sin(rad)) / (1 + Math.sin(rad))
  const d = Rr - br // 球心到碗心距离
  const bx1 = cx - d * Math.sin(rad), bx2 = cx + d * Math.sin(rad)
  const by = cy + d * Math.cos(rad) // 两球心等高（球心连线水平）
  const inner =
    // 半球碗（下半圆，碗沿在 cy）
    `<path d="M ${cx - Rr} ${cy} A ${Rr} ${Rr} 0 0 0 ${cx + Rr} ${cy}" fill="#eef2ff" stroke="${INK}" stroke-width="2.5"/>` +
    // 地面与斜纹
    `<line x1="70" y1="${cy + 4}" x2="330" y2="${cy + 4}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${82 + i * 36}" y1="${cy + 14}" x2="${92 + i * 36}" y2="${cy + 4}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 两球（球心连线水平、相切于竖直轴）
    `<circle cx="${bx1}" cy="${by}" r="${br}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${bx2}" cy="${by}" r="${br}" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(bx1, by + 5, l1, 14) +
    txt(bx2, by + 5, l2, 14) +
    // 球心连线（水平虚线）+ 球心标记
    `<line x1="${bx1}" y1="${by}" x2="${bx2}" y2="${by}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>` +
    `<circle cx="${bx1}" cy="${by}" r="2" fill="${INK}"/><circle cx="${bx2}" cy="${by}" r="2" fill="${INK}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="2" fill="${INK}"/>` +
    txt(cx + 8, cy - 6, 'O', 13, '#64748b', 'start') +
    // 角度弧（球心-碗心连线与竖直方向）
    `<path d="M ${cx} ${cy + 44} A 44 44 0 0 1 ${cx + 44 * Math.sin(rad)} ${cy + 44 * Math.cos(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    txt(cx + 60, cy + 56, angleLabel(p.angle, angle), 13, RED) +
    // 半径标注（碗心 → 左球心虚线延伸省略，仅标数值）
    (Number.isFinite(R) && Number.isFinite(r)
      ? txt(cx, cy + Rr + 34, `R=${R}m（碗）· r=${r}m（球）`, 13, '#64748b')
      : txt(cx, cy + Rr + 34, '半球形碗（光滑）', 13, '#64748b'))
  return wrap(inner)
}

// 斜面 + 竖直挡板 + 小球：angle 斜面倾角（度）、label
function tInclineBaffle(p: FigureSpec['params']): string {
  const angle = Math.min(70, Math.max(10, num(p.angle, 30)))
  const label = str(p.label, 'm')
  const rad = (angle * Math.PI) / 180
  const gy = 185
  const apexX = 90, apexY = gy - 150 // 斜面顶（左上）
  const footX = apexX + 150 / Math.tan(rad) // 坡脚（斜面与地面交点）
  const s = Math.sin(rad), c = Math.cos(rad)
  // 小球在斜面下段、紧贴竖直挡板：挡板 x = 球心 x + br
  const br = 22
  const bx = Math.min(footX - 14, footX - 34), by = gy - br + (footX - bx) * Math.tan(rad) // 贴在斜面上
  const nbx = bx - br * s, nby = by - br * c // 球心（沿斜面法向上移 br）
  const baffleX = nbx + br
  const inner =
    // 斜面三角形
    `<polygon points="${apexX},${apexY} ${footX},${gy} ${apexX},${gy}" fill="#eef2ff" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="40" y1="${gy}" x2="360" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${52 + i * 44}" y1="${gy + 10}" x2="${62 + i * 44}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 竖直挡板（球右侧）
    `<rect x="${baffleX}" y="${gy - 120}" width="10" height="120" fill="#e2e8f0" stroke="${INK}" stroke-width="2"/>` +
    // 小球（贴斜面）
    `<circle cx="${nbx}" cy="${nby}" r="${br}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(nbx, nby + 5, label, 14) +
    // 角度弧
    `<path d="M ${footX - 40} ${gy} A 40 40 0 0 0 ${footX - 40 * c} ${gy - 40 * s}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    txt(footX - 74, gy - 14, angleLabel(p.angle, angle), 14, RED) +
    txt(apexX + 70, apexY - 12, '竖直挡板', 12, '#64748b')
  return wrap(inner)
}

// 圆环 + 天花板 O 点 + 绳吊小球在环上：angle 小球相对环最高点的方位角（度）、R 半径（m）、d O 到环心距（m）
function tRingBall(p: FigureSpec['params']): string {
  const angle = Math.min(170, Math.max(5, num(p.angle, 40)))
  const R = num(p.R, NaN)
  const label = str(p.label, 'm')
  const cx = 200, cy = 150
  const Rr = 88
  const oY = 34 // 天花板 O 点（环最高点正上方）
  const rad = (angle * Math.PI) / 180
  // 小球在环上：从最高点顺时针转 angle
  const bx = cx + Rr * Math.sin(rad), by = cy - Rr * Math.cos(rad)
  const inner =
    // 天花板
    `<line x1="120" y1="${oY - 12}" x2="280" y2="${oY - 12}" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3, 4, 5].map((i) => `<line x1="${128 + i * 30}" y1="${oY - 12}" x2="${120 + i * 30}" y2="${oY - 2}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // O 点与环心连线（虚线，标注 d）
    `<line x1="${cx}" y1="${oY}" x2="${cx}" y2="${cy}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
    txt(cx + 6, (oY + cy) / 2, 'd', 13, '#64748b', 'start') +
    // 圆环
    `<circle cx="${cx}" cy="${cy}" r="${Rr}" fill="none" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${INK}"/>` +
    txt(cx + 8, cy - 6, "O'", 13, '#64748b', 'start') +
    `<circle cx="${cx}" cy="${oY}" r="3.5" fill="${INK}"/>` +
    txt(cx + 12, oY + 4, 'O', 14) +
    // 绳 O → 小球
    `<line x1="${cx}" y1="${oY}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${bx}" cy="${by}" r="16" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + 4, label, 12) +
    (Number.isFinite(R) ? txt(cx + Rr + 14, cy + 4, `R=${R}m`, 13, '#64748b', 'start') : txt(cx, cy + Rr + 22, '光滑圆环', 13, '#64748b'))
  return wrap(inner)
}

// 三绳结点 O：OA 水平向左、OB 与竖直方向夹角 θ 斜右上、OC 竖直向下挂重物：angle（度）、G 标注
function tThreeRopes(p: FigureSpec['params']): string {
  const angle = Math.min(80, Math.max(5, num(p.angle, 30)))
  const gLabel = str(p.G, 'G')
  const ox = 150, oy = 110
  const rad = (angle * Math.PI) / 180
  const bLen = 108
  const bx = ox + bLen * Math.sin(rad), by = oy - bLen * Math.cos(rad)
  const inner =
    // OA 水平向左（固定在左墙）
    `<line x1="40" y1="${oy}" x2="${ox}" y2="${oy}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="40" y1="${oy - 22}" x2="40" y2="${oy + 22}" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3].map((i) => `<line x1="40" y1="${oy - 16 + i * 10}" x2="30" y2="${oy - 8 + i * 10}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    txt(72, oy - 8, 'A', 13) +
    // OB 斜右上（固定在天花板）
    `<line x1="${ox}" y1="${oy}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${bx}" cy="${by}" r="3.5" fill="${INK}"/>` +
    txt(bx + 10, by - 4, 'B', 13) +
    // OC 竖直向下挂重物
    `<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy + 72}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="${ox - 26}" y="${oy + 72}" width="52" height="36" rx="3" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(ox, oy + 95, gLabel, 14) +
    // 结点 O
    `<circle cx="${ox}" cy="${oy}" r="4.5" fill="${RED}"/>` +
    txt(ox - 16, oy + 18, 'O', 14, RED) +
    // 角度弧（OB 与竖直方向）
    `<path d="M ${ox} ${oy - 46} A 46 46 0 0 1 ${ox + 46 * Math.sin(rad)} ${oy - 46 * Math.cos(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    txt(ox + 26, oy - 52, angleLabel(p.angle, angle), 13, RED)
  return wrap(inner)
}

// 直杆 + 铰链 + 水平绳：angle 杆与竖直方向（墙）夹角（度）、label 杆标注
function tRodHinge(p: FigureSpec['params']): string {
  const angle = Math.min(80, Math.max(10, num(p.angle, 30)))
  const label = str(p.label, '')
  const wx = 96 // 竖直墙 x
  const ay = 62 // 铰链 A 高度
  const rad = (angle * Math.PI) / 180
  const L = 150
  const bx = wx + L * Math.sin(rad), by = ay + L * Math.cos(rad)
  const inner =
    // 竖直墙
    `<line x1="${wx}" y1="30" x2="${wx}" y2="215" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${wx}" y1="${42 + i * 22}" x2="${wx - 10}" y2="${52 + i * 22}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 直杆 A → B
    `<line x1="${wx}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="${wx}" cy="${ay}" r="5.5" fill="#fff" stroke="${RED}" stroke-width="2.5"/>` +
    txt(wx - 20, ay + 4, 'A', 14, RED) +
    `<circle cx="${bx}" cy="${by}" r="3.5" fill="${INK}"/>` +
    txt(bx + 12, by + 4, 'B', 14) +
    // 水平绳 B → 墙上 C
    `<line x1="${wx}" y1="${by}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${wx}" cy="${by}" r="3.5" fill="${INK}"/>` +
    txt(wx - 20, by + 4, 'C', 14) +
    (label ? txt(bx + 44, by - 26, label, 13, '#64748b') : '') +
    // 角度弧（杆与竖直墙）
    `<path d="M ${wx} ${ay + 52} A 52 52 0 0 1 ${wx + 52 * Math.sin(rad)} ${ay + 52 * Math.cos(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    txt(wx + 24, ay + 70, angleLabel(p.angle, angle), 13, RED) +
    // 水平绳标注
    txt((wx + bx) / 2, by - 8, '水平绳', 12, '#64748b')
  return wrap(inner)
}

// ---------- B1 扩充模板：覆盖高中主要物理模型（16 个新增） ----------

// 传送带：angle 倾角（度，0=水平）、mu、v0 带速、label、direction=up|down（默认沿箭头方向向上/向右）
function tConveyor(p: FigureSpec['params']): string {
  const angle = Math.min(45, Math.max(0, num(p.angle, 0)))
  const mu = p.mu !== undefined ? `μ=${p.mu}` : ''
  const v0 = str(p.v0, 'v')
  const label = str(p.label, 'm')
  const down = str(p.direction) === 'down'
  const rad = (angle * Math.PI) / 180
  const sx = 70, sy = 185 // 传送带低端
  const len = 240
  const ex = sx + len * Math.cos(rad), ey = sy - len * Math.sin(rad)
  // 带面法向（上方）
  const nx = -Math.sin(rad), ny = -Math.cos(rad)
  const off = 14
  const l1x = sx + nx * off, l1y = sy + ny * off
  const l2x = ex + nx * off, l2y = ey + ny * off
  const dir = down ? -1 : 1
  // 物块（骑在上带面）
  const bx = sx + len * 0.55 * Math.cos(rad) + nx * off, by = sy - len * 0.55 * Math.sin(rad) + ny * off
  const s = Math.sin(rad), c = Math.cos(rad)
  const bw = 36, bh = 20
  const bpts = `${bx - bw / 2 * c + bh * nx},${by + bw / 2 * s + bh * ny} ${bx + bw / 2 * c + bh * nx},${by - bw / 2 * s + bh * ny} ${bx + bw / 2 * c},${by - bw / 2 * s} ${bx - bw / 2 * c},${by + bw / 2 * s}`
  const inner =
    // 传送带轮廓（两条平行线）+ 两端滚轮
    `<line x1="${l1x}" y1="${l1y}" x2="${l2x}" y2="${l2y}" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="${sx}" cy="${sy}" r="14" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${ex}" cy="${ey}" r="14" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${sx}" cy="${sy}" r="2.5" fill="${INK}"/><circle cx="${ex}" cy="${ey}" r="2.5" fill="${INK}"/>` +
    // 物块 + 带速箭头（沿带面）
    `<polygon points="${bpts}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + bh * 0.8, label, 14) +
    arrow(bx + 30 * c * dir, by - 10 * s * dir + ny * 24, bx + 30 * c * dir + 46 * c * dir, by - 10 * s * dir + 46 * -Math.sin(rad) * dir + ny * 24, RED, 3) +
    txt(bx + 30 * c * dir + 24 * c * dir + 10 * dir, by - 34 * s - 6, `v0=${v0}`, 13, RED) +
    (mu ? txt(sx + len * 0.35, sy + 34, mu, 13) : '') +
    (angle > 0 ? txt(sx + 40, sy - 6, angleLabel(p.angle, angle), 14, RED) : '') +
    (angle > 0 ? `<path d="M ${sx + 38} ${sy} A 38 38 0 0 0 ${sx + 38 * Math.cos(rad)} ${sy - 38 * Math.sin(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` : '')
  return wrap(inner)
}

// 板块模型：上物块叠放下物块（木板上表面）+ 可选拉力作用于下板
function tBlockOnBlock(p: FigureSpec['params']): string {
  const lt = str(p.label_top, 'm')
  const lb = str(p.label_bottom, 'M')
  const force = str(p.force)
  const gy = 180
  const inner =
    `<line x1="40" y1="${gy}" x2="360" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${52 + i * 38}" y1="${gy + 10}" x2="${62 + i * 38}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 下板（长）
    `<rect x="90" y="${gy - 34}" width="220" height="34" rx="3" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(200, gy - 12, lb, 14) +
    // 上物块
    `<rect x="150" y="${gy - 78}" width="70" height="44" rx="3" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(185, gy - 50, lt, 14) +
    (force ? arrow(320, gy - 17, 322 + 52, gy - 17, RED, 3) + txt(334, gy - 28, force, 14, RED) : '')
  return wrap(inner)
}

// 水平面上两物块并排（spring=1 时中间画弹簧）；force 可选作用于左块的推力
function tTwoBlocks(p: FigureSpec['params']): string {
  const l1 = str(p.label1, 'm₁')
  const l2 = str(p.label2, 'm₂')
  const force = str(p.force)
  const hasSpring = str(p.spring) === '1' || p.spring === 1
  const gy = 175
  const w1 = 74, h1 = 52
  const x1 = 120
  const gap = hasSpring ? 46 : 0
  const x2 = x1 + w1 + gap
  const w2 = 74
  let mid = ''
  if (hasSpring) {
    let zig = `M ${x1 + w1} ${gy - h1 / 2} `
    for (let i = 1; i <= 4; i++) zig += `L ${x1 + w1 + (gap / 5) * i} ${gy - h1 / 2 + (i % 2 ? -10 : 10)} `
    zig += `L ${x2} ${gy - h1 / 2}`
    mid += `<path d="${zig}" fill="none" stroke="${INK}" stroke-width="2"/>`
  } else {
    mid += txt((x1 + w1 + x2) / 2, gy - h1 / 2 + 4, '', 12)
  }
  const inner =
    `<line x1="50" y1="${gy}" x2="350" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${62 + i * 38}" y1="${gy + 10}" x2="${72 + i * 38}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<rect x="${x1}" y="${gy - h1}" width="${w1}" height="${h1}" rx="4" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(x1 + w1 / 2, gy - h1 / 2 + 5, l1, 14) +
    `<rect x="${x2}" y="${gy - h1}" width="${w2}" height="${h1}" rx="4" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(x2 + w2 / 2, gy - h1 / 2 + 5, l2, 14) +
    mid +
    (force ? arrow(x1 - 14, gy - h1 / 2, x1 - 60, gy - h1 / 2, RED, 3) + txt(x1 - 46, gy - h1 / 2 - 12, force, 14, RED) : '')
  return wrap(inner)
}

// 斜面 + 底端挡板 + 弹簧 + 物块
function tInclineSpring(p: FigureSpec['params']): string {
  const angle = Math.min(70, Math.max(10, num(p.angle, 30)))
  const label = str(p.label, 'm')
  const rad = (angle * Math.PI) / 180
  const gy = 190
  const apexX = 90, apexY = gy - 150
  const s = Math.sin(rad), c = Math.cos(rad)
  // 弹簧沿斜面：从底端挡板沿斜面向上
  const footX = apexX + 150 / Math.tan(rad)
  const baffleX = Math.min(footX + 10, 352)
  // 弹簧固定点在斜面底端，沿斜面向上长 70px
  const spLen = 70
  const springEnd = { x: footX - spLen * c, y: gy - spLen * s }
  let zig = `M ${footX} ${gy - 4} `
  for (let i = 1; i <= 6; i++) {
    const t = i / 7
    zig += `L ${footX - spLen * t * c} ${gy - spLen * t * s + (i % 2 ? -12 : 12) * c} `
  }
  zig += `L ${springEnd.x} ${springEnd.y - 4}`
  // 物块贴弹簧上端
  const bw = 34, bh = 24
  const bx = springEnd.x - bw / 2 * c - bh * s / 2, by = springEnd.y - 4 - bw / 2 * s
  const bpts = `${bx - bw / 2 * c},${by + bw / 2 * s} ${bx + bw / 2 * c},${by - bw / 2 * s} ${bx + bw / 2 * c - bh * s},${by - bw / 2 * s - bh * c} ${bx - bw / 2 * c - bh * s},${by + bw / 2 * s - bh * c}`
  const inner =
    `<polygon points="${apexX},${apexY} ${footX},${gy} ${apexX},${gy}" fill="#eef2ff" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="40" y1="${gy}" x2="360" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${52 + i * 44}" y1="${gy + 10}" x2="${62 + i * 44}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 挡板
    `<rect x="${baffleX}" y="${gy - 44}" width="8" height="44" fill="#e2e8f0" stroke="${INK}" stroke-width="1.5"/>` +
    // 弹簧
    `<path d="${zig}" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<polygon points="${bpts}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx - bh * s - 2, by - bh * c - 6, label, 14) +
    `<path d="M ${footX - 40} ${gy} A 40 40 0 0 0 ${footX - 40 * c} ${gy - 40 * s}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
    txt(footX - 76, gy - 14, angleLabel(p.angle, angle), 14, RED) +
    txt(apexX + 40, apexY - 10, '挡板+弹簧', 11, '#64748b')
  return wrap(inner)
}

// 等势面：kind=parallel（平行等距直线）| circle（同心圆 + 中心点电荷）
function tEquipotential(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'parallel') === 'circle' ? 'circle' : 'parallel'
  const charge = str(p.charge, '+Q')
  const label = str(p.label, '')
  if (kind === 'circle') {
    const cx = 200, cy = 122
    const inner =
      [46, 76, 106].map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>` + txt(cx + r - 4, cy - 8, `φ${i + 1}`, 11, '#64748b', 'start')).join('') +
      `<circle cx="${cx}" cy="${cy}" r="16" fill="#fecaca" stroke="${RED}" stroke-width="2"/>` +
      txt(cx, cy + 5, charge, 13, RED) +
      (label ? txt(cx, 224, label, 12, '#64748b') : '') +
      (str(p.caption) ? txt(cx, 28, str(p.caption), 12, '#64748b') : '')
    return wrap(inner)
  }
  const inner =
    [100, 160, 220, 280].map((x, i) => `<line x1="${x}" y1="55" x2="${x}" y2="195" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>` + txt(x, 48, `φ${i + 1}`, 11, '#64748b')).join('') +
    // 入射粒子（垂直等势面）
    `<circle cx="60" cy="125" r="9" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    arrow(72, 125, 108, 125, RED, 2.5) +
    txt(88, 114, label || 'v', 13, RED) +
    (str(p.caption) ? txt(200, 224, str(p.caption), 12, '#64748b') : '')
  return wrap(inner)
}

// 磁场符号 ⊗（圆形边界内小叉）
function cross(x: number, y: number, r = 7): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
    `<line x1="${x - r * 0.6}" y1="${y - r * 0.6}" x2="${x + r * 0.6}" y2="${y + r * 0.6}" stroke="${INK}" stroke-width="1.4"/>` +
    `<line x1="${x - r * 0.6}" y1="${y + r * 0.6}" x2="${x + r * 0.6}" y2="${y - r * 0.6}" stroke="${INK}" stroke-width="1.4"/>`
}

// 矩形匀强磁场区域 + 粒子从边界入射（angle 入射角相对边界）
function tMagnetRect(p: FigureSpec['params']): string {
  const charge = str(p.charge, '+q')
  const label = str(p.label, 'v0')
  const angle = Math.min(90, Math.max(0, num(p.angle, 0)))
  const rad = (angle * Math.PI) / 180
  const rx = 110, ry = 45, rw = 210, rh = 160 // 磁场区
  const dots = []
  for (let gy = ry + 26; gy < ry + rh - 10; gy += 34) {
    for (let gx = rx + 26; gx < rx + rw - 10; gx += 34) dots.push(cross(gx, gy, 5))
  }
  // 粒子从左边界入射
  const px = rx, py = ry + rh * 0.6
  const vx = 90 * Math.cos(rad), vy = -90 * Math.sin(rad)
  const inner =
    `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#eef2ff" opacity="0.55" stroke="${INK}" stroke-width="2" stroke-dasharray="7 5"/>` +
    dots.join('') +
    txt(rx + rw / 2, ry - 8, str(p.caption, 'B'), 12, '#64748b') +
    `<circle cx="${px}" cy="${py}" r="9" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(px - 16, py + 5, charge, 12, RED) +
    arrow(px + 6, py, px + 6 + vx, py + vy, RED, 2.5) +
    txt(px + 6 + vx * 0.55, py + vy * 0.55 - 10, label, 13, RED) +
    (angle > 0 ? txt(px + 34, py + 18, angleLabel(p.angle, angle), 12, RED) : '')
  return wrap(inner)
}

// 圆形匀强磁场区域 + 粒子沿半径指向圆心入射
function tMagnetCircle(p: FigureSpec['params']): string {
  const charge = str(p.charge, '+q')
  const label = str(p.label, 'v0')
  const cx = 230, cy = 122, R = 82
  const dots = []
  for (let gy = cy - 60; gy <= cy + 60; gy += 30) {
    for (let gx = cx - 60; gx <= cx + 60; gx += 30) {
      if ((gx - cx) ** 2 + (gy - cy) ** 2 < (R - 12) ** 2) dots.push(cross(gx, gy, 5))
    }
  }
  const px = cx - R - 46
  const inner =
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#eef2ff" opacity="0.55" stroke="${INK}" stroke-width="2" stroke-dasharray="7 5"/>` +
    dots.join('') +
    `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${INK}"/>` +
    txt(cx + 8, cy - 8, 'O', 12, '#64748b') +
    txt(cx, 22, str(p.caption, 'B'), 12, '#64748b') +
    `<circle cx="${px}" cy="${cy}" r="9" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(px, cy + 26, charge, 12, RED) +
    arrow(px + 12, cy, px + 52, cy, RED, 2.5) +
    txt(px + 32, cy - 10, label, 13, RED) +
    `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${cy}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>`
  return wrap(inner)
}

// 平行导轨 + 导体棒（电磁感应）：R 末端电阻、label 棒、v 可选速度
function tRail(p: FigureSpec['params']): string {
  const R = str(p.R, 'R')
  const label = str(p.label, 'L')
  const v = str(p.v, 'v')
  const y1 = 80, y2 = 170
  const xL = 80, xR = 340, rodX = 230
  const dots = []
  for (let gy = y1 + 22; gy < y2; gy += 22) {
    for (let gx = xL + 40; gx < xR; gx += 44) dots.push(cross(gx, gy, 5))
  }
  const inner =
    // 导轨
    `<line x1="${xL}" y1="${y1}" x2="${xR}" y2="${y1}" stroke="${INK}" stroke-width="2.5"/>` +
    `<line x1="${xL}" y1="${y2}" x2="${xR}" y2="${y2}" stroke="${INK}" stroke-width="2.5"/>` +
    dots.join('') +
    txt((xL + xR) / 2, y1 - 12, str(p.caption, 'B'), 12, '#64748b') +
    // 左端电阻
    `<rect x="${xL - 14}" y="${y1 - 14}" width="28" height="${y2 - y1 + 28}" fill="none" stroke="none"/>` +
    `<line x1="${xL}" y1="${y1}" x2="${xL}" y2="${y1 - 40}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${xL}" y1="${y2}" x2="${xL}" y2="${y2 + 40}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${xL}" y1="${y1 - 40}" x2="${xL}" y2="${y2 + 40}" stroke="none"/>` +
    `<rect x="${xL - 30}" y="${(y1 + y2) / 2 - 24}" width="18" height="48" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(xL - 44, (y1 + y2) / 2 + 4, R, 14, '#64748b', 'end') +
    // 导体棒（竖直，跨两轨）
    `<line x1="${rodX}" y1="${y1 - 10}" x2="${rodX}" y2="${y2 + 10}" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>` +
    txt(rodX + 14, (y1 + y2) / 2, label, 13, ACCENT, 'start') +
    arrow(rodX, y1 - 26, rodX + 44, y1 - 26, RED, 2.5) +
    txt(rodX + 28, y1 - 34, v, 13, RED)
  return wrap(inner)
}

// 竖直平面圆周：kind=rope|rod|track，angle 位置方位角（0=最高点，顺时针），R 半径
function tVerticalCircle(p: FigureSpec['params']): string {
  const kind = ['rope', 'rod', 'track'].includes(str(p.kind, 'rope')) ? str(p.kind, 'rope') : 'rope'
  const angle = Math.min(350, Math.max(0, num(p.angle, 30)))
  const R = num(p.R, NaN)
  const label = str(p.label, 'm')
  const cx = 200, cy = 122, Rr = 86
  const rad = (angle * Math.PI) / 180
  const bx = cx + Rr * Math.sin(rad), by = cy - Rr * Math.cos(rad)
  let anchor = ''
  if (kind === 'rope') {
    anchor =
      `<line x1="120" y1="${cy - Rr - 46}" x2="280" y2="${cy - Rr - 46}" stroke="${INK}" stroke-width="3"/>` +
      [0, 1, 2, 3, 4].map((i) => `<line x1="${128 + i * 30}" y1="${cy - Rr - 46}" x2="${120 + i * 30}" y2="${cy - Rr - 36}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
      `<line x1="${cx}" y1="${cy - Rr}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>` +
      `<circle cx="${cx}" cy="${cy - Rr}" r="3.5" fill="${INK}"/>` +
      txt(cx + 12, cy - Rr + 2, 'O', 13)
  }
  const inner =
    anchor +
    `<circle cx="${cx}" cy="${cy}" r="${Rr}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="${kind === 'rope' ? '4 4' : '0'}"/>` +
    `<circle cx="${bx}" cy="${by}" r="14" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + 4, label, 11) +
    // 切向速度箭头（顺时针方向）
    arrow(bx, by, bx + 34 * Math.cos(rad), by + 34 * Math.sin(rad), RED, 2.2) +
    txt(bx + 40 * Math.cos(rad), by + 40 * Math.sin(rad) + 4, 'v', 12, RED) +
    (Number.isFinite(R) ? txt(cx + Rr + 12, cy + 4, `R=${R}m`, 12, '#64748b', 'start') : txt(cx, cy + Rr + 24, kind === 'rod' ? '轻杆模型' : kind === 'track' ? '圆轨道内侧' : '轻绳模型', 12, '#64748b'))
  return wrap(inner)
}

// 单摆：L 摆长、angle 摆角（偏离竖直方向）、label
function tPendulum(p: FigureSpec['params']): string {
  const angle = Math.min(80, Math.max(0, num(p.angle, 15)))
  const L = num(p.L, NaN)
  const label = str(p.label, 'm')
  const ox = 200, oy = 40
  const Lr = 140
  const rad = (angle * Math.PI) / 180
  const bx = ox + Lr * Math.sin(rad), by = oy + Lr * Math.cos(rad)
  const inner =
    // 悬点 + 天花板
    `<line x1="150" y1="${oy}" x2="250" y2="${oy}" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3, 4].map((i) => `<line x1="${158 + i * 22}" y1="${oy}" x2="${150 + i * 22}" y2="${oy - 8}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<circle cx="${ox}" cy="${oy}" r="3.5" fill="${INK}"/>` +
    txt(ox + 10, oy - 6, 'O', 12, '#64748b') +
    // 竖直参考虚线
    `<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy + Lr + 14}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
    // 摆线 + 摆球
    `<line x1="${ox}" y1="${oy}" x2="${bx}" y2="${by}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${bx}" cy="${by}" r="14" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + 4, label, 11) +
    // 摆角弧 + 摆长标注
    (angle > 0
      ? `<path d="M ${ox} ${oy + 44} A 44 44 0 0 1 ${ox + 44 * Math.sin(rad)} ${oy + 44 * Math.cos(rad)}" fill="none" stroke="${RED}" stroke-width="1.5"/>` +
        txt(ox + 26, oy + 62, angleLabel(p.angle, angle), 13, RED)
      : '') +
    (Number.isFinite(L) ? txt(ox - 34, oy + Lr * 0.6, `L=${L}m`, 13, '#64748b', 'end') : '')
  return wrap(inner)
}

// 波形图 y-x：lambda 波长（m）、A 振幅（m）、label 可选质点标注
function tWave(p: FigureSpec['params']): string {
  const lambda = num(p.lambda, 4)
  const A = num(p.A, 0.2)
  const label = str(p.label, 'P')
  const ox = 50, oy = 120
  const w = 320, halfA = 60
  // 正弦曲线（每 8px 一点）
  const pts: string[] = []
  for (let x = 0; x <= w; x += 8) {
    const y = -halfA * Math.sin((2 * Math.PI * x) / 160)
    pts.push(`${ox + x},${oy + y}`)
  }
  // λ 标注：相邻两波峰（160px 一个波长）
  const c1 = ox + 40, c2 = ox + 200 // 两峰 x（sin 峰在 λ/4 与 λ/4+λ）
  const inner =
    // 坐标轴
    `<line x1="${ox}" y1="${oy + halfA + 26}" x2="${ox + w + 20}" y2="${oy + halfA + 26}" stroke="${INK}" stroke-width="1.8"/>` +
    `<line x1="${ox}" y1="${oy + halfA + 26}" x2="${ox}" y2="${oy - halfA - 14}" stroke="${INK}" stroke-width="1.8"/>` +
    txt(ox + w + 10, oy + halfA + 42, 'x/m', 12) +
    txt(ox - 10, oy - halfA - 4, 'y/m', 12) +
    // 平衡位置虚线
    `<line x1="${ox}" y1="${oy}" x2="${ox + w}" y2="${oy}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 4"/>` +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="${ACCENT}" stroke-width="2.5"/>` +
    // λ 标注（双箭头竖线）
    `<line x1="${c1}" y1="${oy + halfA + 12}" x2="${c2}" y2="${oy + halfA + 12}" stroke="${RED}" stroke-width="1.5"/>` +
    `<line x1="${c1}" y1="${oy + halfA + 6}" x2="${c1}" y2="${oy + halfA + 18}" stroke="${RED}" stroke-width="1.5"/>` +
    `<line x1="${c2}" y1="${oy + halfA + 6}" x2="${c2}" y2="${oy + halfA + 18}" stroke="${RED}" stroke-width="1.5"/>` +
    txt((c1 + c2) / 2, oy + halfA + 24 + 12, `λ=${lambda}m`, 13, RED) +
    // 振幅标注
    arrow(ox + 12, oy, ox + 12, oy - halfA, '#64748b', 1.6) +
    txt(ox + 22, oy - halfA / 2, `A=${A}m`, 12, '#64748b', 'start') +
    // 质点 P（波峰上）
    `<circle cx="${c2}" cy="${oy - halfA}" r="5" fill="${RED}"/>` +
    txt(c2 + 12, oy - halfA - 6, label, 12, RED)
  return wrap(inner)
}

// 振动图 y-t：T 周期（s）、A 振幅（m）
function tVibrate(p: FigureSpec['params']): string {
  const T = num(p.T, 2)
  const A = num(p.A, 0.2)
  const ox = 50, oy = 120
  const w = 320, halfA = 60
  const periodPx = 160
  const pts: string[] = []
  for (let x = 0; x <= w; x += 8) {
    const y = -halfA * Math.sin((2 * Math.PI * x) / periodPx)
    pts.push(`${ox + x},${oy + y}`)
  }
  const p1 = ox + 40, p2 = ox + 40 + periodPx
  const inner =
    `<line x1="${ox}" y1="${oy + halfA + 26}" x2="${ox + w + 20}" y2="${oy + halfA + 26}" stroke="${INK}" stroke-width="1.8"/>` +
    `<line x1="${ox}" y1="${oy + halfA + 26}" x2="${ox}" y2="${oy - halfA - 14}" stroke="${INK}" stroke-width="1.8"/>` +
    txt(ox + w + 6, oy + halfA + 42, 't/s', 12) +
    txt(ox - 10, oy - halfA - 4, 'y/m', 12) +
    `<line x1="${ox}" y1="${oy}" x2="${ox + w}" y2="${oy}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 4"/>` +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="${ACCENT}" stroke-width="2.5"/>` +
    // T 标注（相邻两峰）
    `<line x1="${p1}" y1="${oy + halfA + 12}" x2="${p2}" y2="${oy + halfA + 12}" stroke="${RED}" stroke-width="1.5"/>` +
    `<line x1="${p1}" y1="${oy + halfA + 6}" x2="${p1}" y2="${oy + halfA + 18}" stroke="${RED}" stroke-width="1.5"/>` +
    `<line x1="${p2}" y1="${oy + halfA + 6}" x2="${p2}" y2="${oy + halfA + 18}" stroke="${RED}" stroke-width="1.5"/>` +
    txt((p1 + p2) / 2, oy + halfA + 24 + 12, `T=${T}s`, 13, RED) +
    arrow(ox + 12, oy, ox + 12, oy - halfA, '#64748b', 1.6) +
    txt(ox + 22, oy - halfA / 2, `A=${A}m`, 12, '#64748b', 'start')
  return wrap(inner)
}

// 光的折射/全反射：kind=refract|reflect、i 入射角、r 折射角、n1/n2 可选介质标注
function tOpticsRefract(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'refract') === 'reflect' ? 'reflect' : 'refract'
  const i = Math.min(88, Math.max(1, num(p.i, 45)))
  const r = Math.min(89, Math.max(1, num(p.r, 30)))
  const n1 = str(p.n1)
  const n2 = str(p.n2)
  const ox = 200, oy = 140 // 入射点
  const radI = (i * Math.PI) / 180
  const radR = (r * Math.PI) / 180
  // 入射光：左上方 → O；折射光：O → 右下方；全反射：O → 右上方
  const incX = ox - 120 * Math.sin(radI), incY = oy - 120 * Math.cos(radI)
  const refrX = ox + 120 * Math.sin(radR), refrY = oy + 120 * Math.cos(radR)
  const reflX = ox + 120 * Math.sin(radI), reflY = oy - 120 * Math.cos(radI)
  const ray = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    // 光线带中途箭头
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    const seg = arrow(mx, my, x2, y2, color, 2)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>` + seg
  }
  const inner =
    // 界面（水平）+ 法线（竖直虚线）
    `<line x1="40" y1="${oy}" x2="360" y2="${oy}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${ox}" y1="40" x2="${ox}" y2="225" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
    (str(p.normal, '1') === '0' ? '' : txt(ox + 8, 52, '法线', 11, '#64748b', 'start')) +
    // 介质标注（n1/n2 传了才画，文字须与题干用词一致）
    (n1 ? txt(60, oy - 14, n1, 12, '#64748b', 'start') : '') +
    (n2 ? txt(60, oy + 20, n2, 12, '#64748b', 'start') : '') +
    // 入射光
    ray(incX, incY, ox, oy, RED) +
    txt(incX + 14, incY + 10, '入射光', 11, RED, 'start') +
    (kind === 'refract'
      ? ray(ox, oy, refrX, refrY, ACCENT) + txt(refrX - 10, refrY + 14, '折射光', 11, ACCENT)
      : ray(ox, oy, reflX, reflY, ACCENT) + txt(reflX - 20, reflY + 12, '反射光', 11, ACCENT)) +
    // 角度弧与标注
    `<path d="M ${ox} ${oy - 44} A 44 44 0 0 0 ${ox - 44 * Math.sin(radI)} ${oy - 44 * Math.cos(radI)}" fill="none" stroke="${RED}" stroke-width="1.3"/>` +
    txt(ox - 62, oy - 50, `i=${i}°`, 12, RED) +
    (kind === 'refract'
      ? `<path d="M ${ox} ${oy + 44} A 44 44 0 0 1 ${ox + 44 * Math.sin(radR)} ${oy + 44 * Math.cos(radR)}" fill="none" stroke="${ACCENT}" stroke-width="1.3"/>` +
        txt(ox + 54, oy + 62, `r=${r}°`, 12, ACCENT)
      : `<path d="M ${ox} ${oy - 44} A 44 44 0 0 1 ${ox + 44 * Math.sin(radI)} ${oy - 44 * Math.cos(radI)}" fill="none" stroke="${ACCENT}" stroke-width="1.3"/>` +
        txt(ox + 46, oy - 50, `${i}°`, 12, ACCENT))
  return wrap(inner)
}

// 打点计时器小车实验：小车 + 纸带 + 计时器 + 定滑轮 + 悬挂砝码
function tExpTrolley(p: FigureSpec['params']): string {
  const label = str(p.label, 'M')
  const m2 = str(p.m2, 'm')
  const gy = 160
  const inner =
    // 长木板
    `<line x1="30" y1="${gy}" x2="330" y2="${gy}" stroke="${INK}" stroke-width="2.5"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${44 + i * 44}" y1="${gy + 10}" x2="${54 + i * 44}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    // 打点计时器（左端小盒）
    `<rect x="40" y="${gy - 26}" width="34" height="26" rx="3" fill="#e2e8f0" stroke="${INK}" stroke-width="2"/>` +
    txt(57, gy - 32, '打点计时器', 10, '#64748b') +
    // 小车
    `<rect x="120" y="${gy - 40}" width="76" height="28" rx="4" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="138" cy="${gy - 8}" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="178" cy="${gy - 8}" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(158, gy - 20, label, 13) +
    // 纸带（车后引出）
    `<line x1="120" y1="${gy - 22}" x2="74" y2="${gy - 22}" stroke="#94a3b8" stroke-width="3"/>` +
    [0, 1, 2, 3, 4].map((i) => `<line x1="${80 + i * 9}" y1="${gy - 26}" x2="${80 + i * 9}" y2="${gy - 18}" stroke="#94a3b8" stroke-width="1"/>`).join('') +
    // 定滑轮（板右端）+ 细线 + 砝码
    `<circle cx="336" cy="${gy - 12}" r="10" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="336" cy="${gy - 12}" r="2" fill="${INK}"/>` +
    `<line x1="196" y1="${gy - 26}" x2="336" y2="${gy - 12}" stroke="${INK}" stroke-width="1.6"/>` +
    `<line x1="346" y1="${gy - 12}" x2="346" y2="${gy + 56}" stroke="${INK}" stroke-width="1.6"/>` +
    `<rect x="${346 - 12}" y="${gy + 56}" width="24" height="26" rx="3" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(346, gy + 74, m2, 12)
  return wrap(inner)
}

// 伏安法实验电路：kind=limit（限流）| divide（分压）
function tExpCircuit(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'limit') === 'divide' ? 'divide' : 'limit'
  const emf = str(p.emf, 'E')
  // 简化电路回路：矩形回路 90,60 → 330,60 → 330,190 → 90,190
  const x1 = 90, y1 = 60, x2 = 330, y2 = 190
  // 电流表（左竖边中点）圆圈 A
  const amY = (y1 + y2) / 2
  // 待测电阻（右竖边中点）矩形
  const rY = amY
  // 滑动变阻器（上边）
  const rhx1 = 150, rhx2 = 260
  const arrowSlider = `<line x1="205" y1="${y1 - 26}" x2="205" y2="${y1}" stroke="${INK}" stroke-width="1.8"/>` +
    `<polygon points="205,${y1} 200,${y1 - 9} 210,${y1 - 9}" fill="${INK}"/>` +
    txt(205, y1 - 34, kind === 'divide' ? '分压接法' : '限流接法', 11, '#64748b')
  const rheo = `<rect x="${rhx1}" y="${y1 - 5}" width="${rhx2 - rhx1}" height="10" fill="#fff" stroke="${INK}" stroke-width="1.8"/>` +
    `${arrowSlider}`
  const inner =
    // 回路四边（上边留滑变、下边留电池缺口）
    `<line x1="${x1}" y1="${y1}" x2="${rhx1}" y2="${y1}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${rhx2}" y1="${y1}" x2="${x2}" y2="${y1}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${x2}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="${x1}" y1="${y2}" x2="185" y2="${y2}" stroke="${INK}" stroke-width="2"/>` +
    `<line x1="215" y1="${y2}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="2"/>` +
    // 电源（下边中点，长短线）
    `<line x1="187" y1="${y2 - 7}" x2="187" y2="${y2 + 7}" stroke="${INK}" stroke-width="4"/><line x1="196" y1="${y2 - 4}" x2="196" y2="${y2 + 4}" stroke="${INK}" stroke-width="2"/><line x1="205" y1="${y2 - 7}" x2="205" y2="${y2 + 7}" stroke="${INK}" stroke-width="4"/><line x1="214" y1="${y2 - 4}" x2="214" y2="${y2 + 4}" stroke="${INK}" stroke-width="2"/>` +
    txt(200, y2 + 26, `电源 ${emf}`, 12) +
    // 电流表
    `<circle cx="${x1}" cy="${amY}" r="16" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(x1, amY + 5, 'A', 13) +
    // 待测电阻
    `<rect x="${x2 - 9}" y="${rY - 26}" width="18" height="52" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(x2 + 24, rY + 4, 'Rx', 13) +
    // 电压表（并联在 Rx 两侧）
    `<line x1="${x2}" y1="${rY - 26}" x2="${x2 + 40}" y2="${rY - 26}" stroke="${INK}" stroke-width="1.6"/>` +
    `<line x1="${x2 + 40}" y1="${rY - 26}" x2="${x2 + 40}" y2="${rY + 26}" stroke="${INK}" stroke-width="1.6"/>` +
    `<line x1="${x2 + 40}" y1="${rY + 26}" x2="${x2}" y2="${rY + 26}" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="${x2 + 40}" cy="${rY}" r="16" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(x2 + 40, rY + 5, 'V', 13) +
    rheo
  return wrap(inner)
}

// 水平气缸 + 活塞封闭气体：label 气体标注、p 压强标注、thermo=1 画温度计
function tGasCylinder(p: FigureSpec['params']): string {
  const label = str(p.label, '气体')
  const pv = str(p.p)
  const thermo = str(p.thermo) === '1' || p.thermo === 1
  const gy = 150
  const cx1 = 110, cx2 = 300
  const ch = 70
  const pistonX = 250
  const inner =
    // 气缸（左/下/上壁，右开口）
    `<line x1="${cx1}" y1="${gy - ch / 2}" x2="${cx1}" y2="${gy + ch / 2}" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${cx1}" y1="${gy - ch / 2}" x2="${cx2 + 16}" y2="${gy - ch / 2}" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${cx1}" y1="${gy + ch / 2}" x2="${cx2 + 16}" y2="${gy + ch / 2}" stroke="${INK}" stroke-width="3"/>` +
    // 活塞（竖杆+厚板）+ 活塞杆
    `<rect x="${pistonX}" y="${gy - ch / 2 + 3}" width="10" height="${ch - 6}" fill="#94a3b8" stroke="${INK}" stroke-width="1.5"/>` +
    `<line x1="${pistonX + 5}" y1="${gy - ch / 2}" x2="${pistonX + 5}" y2="${gy - ch / 2 - 34}" stroke="${INK}" stroke-width="2.5"/>` +
    // 气体区（浅蓝填充）+ 标注
    `<rect x="${cx1 + 2}" y="${gy - ch / 2 + 3}" width="${pistonX - cx1 - 2}" height="${ch - 6}" fill="#dbeafe" opacity="0.5"/>` +
    txt((cx1 + pistonX) / 2, gy + 5, label, 14) +
    (pv ? txt((cx1 + pistonX) / 2, gy - 20, `p=${pv}`, 13, RED) : '') +
    (thermo
      ? `<circle cx="${cx1 + 26}" cy="${gy + ch / 2 + 24}" r="9" fill="#fecaca" stroke="${RED}" stroke-width="1.6"/>` +
        `<line x1="${cx1 + 26}" y1="${gy + ch / 2 + 16}" x2="${cx1 + 26}" y2="${gy + ch / 2 - 8}" stroke="${RED}" stroke-width="2.4"/>` +
        txt(cx1 + 44, gy + ch / 2 + 30, '温度计', 10, '#64748b', 'start')
      : '')
  return wrap(inner)
}

// 通用函数图像（1~2 条直线段）：xlabel/ylabel、l1_start/l1_end/l2_start/l2_end 纵值、label1/label2
function tGraphLines(p: FigureSpec['params']): string {
  const xl = str(p.xlabel, 't/s')
  const yl = str(p.ylabel, 'y')
  const has2 = p.l2_start !== undefined || p.l2_end !== undefined
  const a1 = num(p.l1_start, 0), b1 = num(p.l1_end, 10)
  const a2 = num(p.l2_start, 0), b2 = num(p.l2_end, 10)
  const ox = 60, oyC = 130
  const w = 290, half = 80
  const X = (t: number) => ox + t * w
  const Y = (v: number) => oyC - (v / Math.max(Math.abs(a1), Math.abs(b1), has2 ? Math.abs(a2) : 0, has2 ? Math.abs(b2) : 0, 1)) * (half * 0.8)
  const seg = (a: number, b: number, color: string, label: string) => {
    const x1 = X(0), y1 = Y(a), x2 = X(1), y2 = Y(b)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5"/>` +
      `<circle cx="${x1}" cy="${y1}" r="3.5" fill="${color}"/><circle cx="${x2}" cy="${y2}" r="3.5" fill="${color}"/>` +
      (label ? txt((x1 + x2) / 2 + 14, (y1 + y2) / 2 - 6, label, 13, color, 'start') : '')
  }
  const inner =
    // 坐标轴
    `<line x1="${ox - 10}" y1="${oyC}" x2="${ox + w + 24}" y2="${oyC}" stroke="${INK}" stroke-width="1.8"/>` +
    `<line x1="${ox}" y1="${oyC + half + 10}" x2="${ox}" y2="${oyC - half - 16}" stroke="${INK}" stroke-width="1.8"/>` +
    txt(ox + w + 18, oyC + 22, xl, 12) +
    txt(ox - 8, oyC - half - 4, yl, 12) +
    seg(a1, b1, ACCENT, str(p.label1, '')) +
    (has2 ? seg(a2, b2, RED, str(p.label2, '')) : '')
  return wrap(inner)
}


// 汽车/列车在平直公路上：kind=brake（带刹车痕）|run、v0、a 可选、label
function tCarRoad(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'run') === 'brake' ? 'brake' : 'run'
  const v0 = str(p.v0, 'v0')
  const a = str(p.a)
  const label = str(p.label, '汽车')
  const gy = 170
  const inner =
    `<line x1="30" y1="${gy}" x2="370" y2="${gy}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<line x1="${44 + i * 38}" y1="${gy + 10}" x2="${54 + i * 38}" y2="${gy}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<rect x="140" y="${gy - 40}" width="120" height="26" rx="6" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M 155 ${gy - 40} Q 175 ${gy - 62} 215 ${gy - 40}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="165" cy="${gy - 8}" r="9" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="235" cy="${gy - 8}" r="9" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    txt(200, gy - 20, label, 13) +
    arrow(270, gy - 22, 320, gy - 22, RED, 3) +
    txt(296, gy - 34, v0, 13, RED) +
    (a ? txt(296, gy - 52, a, 12, ACCENT) : '') +
    (kind === 'brake'
      ? `<line x1="120" y1="${gy + 4}" x2="150" y2="${gy + 4}" stroke="#94a3b8" stroke-width="3" stroke-dasharray="8 5"/>` +
        txt(132, gy + 22, '刹车痕', 10, '#64748b')
      : '')
  return wrap(inner)
}

// p-V 状态图：pA/VA/pB/VB/... 数值点位，依次连线（闭合循环），xlabel/ylabel/label1~4 各点标注
function tPvDiagram(p: FigureSpec['params']): string {
  const xl = str(p.xlabel, 'V/m3')
  const yl = str(p.ylabel, 'p/Pa')
  const labels = [str(p.label1, 'A'), str(p.label2, 'B'), str(p.label3, 'C'), str(p.label4, 'D')]
  const pts: Array<{ x: number; y: number; label: string }> = []
  const keys = [['pA', 'VA'], ['pB', 'VB'], ['pC', 'VC'], ['pD', 'VD']]
  for (let i = 0; i < 4; i++) {
    const pv = num(p[keys[i][0]], NaN)
    const vv = num(p[keys[i][1]], NaN)
    if (Number.isFinite(pv) && Number.isFinite(vv)) pts.push({ x: vv, y: pv, label: labels[i] })
  }
  if (pts.length < 2) return wrap(txt(200, 120, '（缺少状态点参数）', 13, RED))
  const ox = 70, oy = 200
  const w = 280, h = 160
  const maxX = Math.max(...pts.map((q) => q.x)) * 1.15 || 1
  const maxY = Math.max(...pts.map((q) => q.y)) * 1.15 || 1
  const X = (v: number) => ox + (v / maxX) * w
  const Y = (v: number) => oy - (v / maxY) * h
  const closed = pts.length >= 3
  const path = pts.map((q, i) => `${i === 0 ? 'M' : 'L'} ${X(q.x)} ${Y(q.y)}`).join(' ') + (closed ? ` Z` : '')
  const arrowsSeg = closed ? pts : pts.slice(0, -1)
  const arrowMarks = arrowsSeg.map((q: any, i: number) => {
    const nx = closed ? pts[(i + 1) % pts.length] : pts[i + 1]
    if (!nx) return ''
    const mx = (X(q.x) + X(nx.x)) / 2, my = (Y(q.y) + Y(nx.y)) / 2
    const ang = Math.atan2(Y(nx.y) - Y(q.y), X(nx.x) - X(q.x))
    return arrow(mx - 8 * Math.cos(ang), my - 8 * Math.sin(ang), mx + 8 * Math.cos(ang), my + 8 * Math.sin(ang), ACCENT, 1.8)
  }).join('')
  const dots = pts.map((q) => `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="3.5" fill="${RED}"/>` + txt(X(q.x) + (X(q.x) > ox + w / 2 ? 12 : -12), Y(q.y) - 8, q.label, 13, RED)).join('')
  const inner =
    `<line x1="${ox - 8}" y1="${oy}" x2="${ox + w + 24}" y2="${oy}" stroke="${INK}" stroke-width="1.8"/>` +
    `<line x1="${ox}" y1="${oy + 8}" x2="${ox}" y2="${oy - h - 20}" stroke="${INK}" stroke-width="1.8"/>` +
    txt(ox + w + 14, oy + 20, xl, 12) +
    txt(ox - 12, oy - h - 6, yl, 12) +
    `<path d="${path}" fill="none" stroke="${ACCENT}" stroke-width="2"/>` +
    arrowMarks + dots
  return wrap(inner)
}

// 两球碰撞：m1/v1、m2/v2（v2 可为负=反向）
function tCollision(p: FigureSpec['params']): string {
  const m1 = str(p.m1, 'm1'), m2 = str(p.m2, 'm2')
  const v1 = num(p.v1, 4), v2 = num(p.v2, 0)
  const l1 = str(p.label1, '球1'), l2 = str(p.label2, '球2')
  const gy = 150
  const r1 = 26, r2 = 26
  const x1 = 120, x2 = v2 < 0 ? 300 : 260
  const arr = (x: number, dir: number, val: number, color: string) =>
    val === 0 ? '' : arrow(x, gy - r1 - 22, x + 46 * dir, gy - r1 - 22, color, 2.5) +
      txt(x + 23 * dir + (dir > 0 ? 4 : -20), gy - r1 - 34, `v=${val}`, 12, color)
  const inner =
    `<line x1="50" y1="${gy + r1}" x2="350" y2="${gy + r1}" stroke="${INK}" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${62 + i * 42}" y1="${gy + r1 + 10}" x2="${72 + i * 42}" y2="${gy + r1}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<circle cx="${x1}" cy="${gy}" r="${r1}" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(x1, gy + 5, l1, 13) +
    txt(x1, gy - r1 - 4, m1, 12, '#64748b') +
    `<circle cx="${x2}" cy="${gy}" r="${r2}" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(x2, gy + 5, l2, 13) +
    txt(x2, gy - r2 - 4, m2, 12, '#64748b') +
    arr(x1 + 10, 1, v1, RED) +
    arr(x2 - 10, v2 < 0 ? -1 : 1, v2, ACCENT)
  return wrap(inner)
}

// 竖直下落/上抛：kind=down|up、h 高度、v0 可选、label
function tFreefall(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'down') === 'up' ? 'up' : 'down'
  const h = num(p.h, NaN)
  const v0 = str(p.v0)
  const label = str(p.label, 'm')
  const groundY = 200
  const topY = 60
  const bx = 200
  const by = kind === 'down' ? topY + 30 : groundY - 60
  const inner =
    `<line x1="80" y1="${groundY}" x2="320" y2="${groundY}" stroke="${INK}" stroke-width="2.5"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${94 + i * 34}" y1="${groundY + 10}" x2="${104 + i * 34}" y2="${groundY}" stroke="#94a3b8" stroke-width="1.5"/>`).join('') +
    `<line x1="${bx - 90}" y1="${topY}" x2="${bx - 90}" y2="${groundY}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
    `<line x1="${bx - 100}" y1="${topY}" x2="${bx - 80}" y2="${topY}" stroke="#94a3b8" stroke-width="1.5"/>` +
    `<line x1="${bx - 100}" y1="${groundY}" x2="${bx - 80}" y2="${groundY}" stroke="#94a3b8" stroke-width="1.5"/>` +
    (Number.isFinite(h) ? txt(bx - 100, (topY + groundY) / 2, `h=${h}m`, 13, '#64748b', 'end') : '') +
    `<circle cx="${bx}" cy="${by}" r="14" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
    txt(bx, by + 4, label, 11) +
    (kind === 'down'
      ? arrow(bx, by + 18, bx, by + 62, RED, 2.5) + txt(bx + 12, by + 44, v0 || '下落', 12, RED)
      : arrow(bx, by - 18, bx, by - 62, RED, 2.5) + txt(bx + 12, by - 44, v0 || 'v0', 12, RED))
  return wrap(inner)
}

// 平行板电场：kind=accel（双板带孔，粒子加速穿过）| deflect（粒子平行于板射入板间偏转）
function tAccelPlates(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'accel') === 'deflect' ? 'deflect' : 'accel'
  const U = str(p.U, 'U')
  const d = p.d !== undefined ? `d=${p.d}m` : ''
  const charge = str(p.charge, '-e')
  const label = str(p.label, '')
  if (kind === 'accel') {
    const inner =
      `<line x1="140" y1="50" x2="140" y2="104" stroke="${INK}" stroke-width="3"/>` +
      `<line x1="140" y1="146" x2="140" y2="200" stroke="${INK}" stroke-width="3"/>` +
      `<line x1="240" y1="50" x2="240" y2="104" stroke="${RED}" stroke-width="3"/>` +
      `<line x1="240" y1="146" x2="240" y2="200" stroke="${RED}" stroke-width="3"/>` +
      txt(140, 40, 'A（-）', 12, '#64748b') +
      txt(240, 40, 'B（+）', 12, RED) +
      `<line x1="140" y1="216" x2="240" y2="216" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
      txt(190, 232, `U=${U}`, 13, ACCENT) +
      (d ? txt(190, 30, d, 11, '#64748b') : '') +
      `<circle cx="70" cy="125" r="9" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
      txt(70, 152, charge, 12, RED) +
      arrow(84, 125, 126, 125, RED, 2.5) +
      arrow(152, 125, 196, 125, ACCENT, 2.5) +
      (label ? txt(174, 110, label, 12, ACCENT) : '')
    return wrap(inner)
  }
  const inner =
    `<line x1="110" y1="80" x2="310" y2="80" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="110" y1="170" x2="310" y2="170" stroke="${RED}" stroke-width="3"/>` +
    txt(200, 70, '上极板（-）', 11, '#64748b') +
    txt(200, 192, '下极板（+）', 11, RED) +
    (d ? txt(330, 130, d, 11, '#64748b', 'start') : '') +
    `<line x1="330" y1="80" x2="330" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 4"/>` +
    `<circle cx="60" cy="125" r="9" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(60, 152, charge, 12, RED) +
    arrow(74, 125, 118, 125, RED, 2.5) +
    txt(96, 114, label || 'v0', 12, RED) +
    `<path d="M 110 125 Q 220 128 300 150" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 4"/>` +
    arrow(262, 143, 300, 150, ACCENT, 2) +
    txt(190, 236, `U=${U}`, 13, ACCENT)
  return wrap(inner)
}

// 通电导线/运动电荷在磁场中：kind=wire|charge、B 标注、F 可选
function tWireBfield(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'wire') === 'charge' ? 'charge' : 'wire'
  const B = str(p.B, 'B（垂直纸面向里）')
  const F = str(p.F)
  const label = str(p.label, '')
  const dots: string[] = []
  for (let gy = 55; gy <= 215; gy += 40) for (let gx = 70; gx <= 330; gx += 52) dots.push(cross(gx, gy, 6))
  if (kind === 'wire') {
    const inner =
      dots.join('') +
      txt(200, 36, B, 12, '#64748b') +
      `<line x1="110" y1="135" x2="290" y2="135" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>` +
      arrow(170, 135, 214, 135, RED, 2.8) +
      txt(196, 122, 'I', 14, RED) +
      (label ? txt(290, 156, label, 12, ACCENT, 'end') : '') +
      (F ? arrow(240, 90, 240, 52, '#10b981', 2.8) + txt(254, 62, F, 13, '#10b981', 'start') : '')
    return wrap(inner)
  }
  const inner =
    dots.join('') +
    txt(200, 36, B, 12, '#64748b') +
    `<circle cx="180" cy="135" r="12" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(180, 140, label || 'q', 11) +
    arrow(196, 135, 252, 135, RED, 2.8) +
    txt(226, 122, 'v', 13, RED) +
    (F ? arrow(180, 118, 180, 76, '#10b981', 2.8) + txt(194, 86, F, 13, '#10b981', 'start') : '')
  return wrap(inner)
}

// 光电效应：光照金属板逸出光电子
function tPhotoelectric(p: FigureSpec['params']): string {
  const nu = str(p.nu, 'ν')
  const Ek = str(p.Ek)
  const W = str(p.W)
  const label = str(p.label, '金属')
  const inner =
    `<rect x="250" y="60" width="26" height="150" fill="#e2e8f0" stroke="${INK}" stroke-width="2"/>` +
    txt(263, 232, label, 12) +
    `<path d="M 60 110 Q 90 90 120 110 T 180 110 T 240 110" fill="none" stroke="${RED}" stroke-width="2"/>` +
    arrow(240, 110, 252, 118, RED, 2.2) +
    txt(120, 92, `光 ${nu}`, 13, RED) +
    arrow(248, 96, 196, 60, ACCENT, 2.2) +
    `<circle cx="190" cy="56" r="6" fill="#fde68a" stroke="${INK}" stroke-width="1.6"/>` +
    txt(168, 48, 'e', 12, ACCENT, 'start') +
    (Ek ? txt(120, 150, `Ek=${Ek}`, 12, ACCENT, 'start') : '') +
    (W ? txt(300, 140, `W=${W}`, 12, '#64748b', 'start') : '')
  return wrap(inner)
}

// 线圈在磁场中：kind=static|rotate
function tCoilFlux(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'static') === 'rotate' ? 'rotate' : 'static'
  const B = str(p.B, 'B（垂直纸面向里）')
  const label = str(p.label, '线圈')
  const dots: string[] = []
  for (let gy = 55; gy <= 215; gy += 40) for (let gx = 70; gx <= 330; gx += 52) dots.push(cross(gx, gy, 6))
  if (kind === 'rotate') {
    const inner =
      dots.join('') +
      txt(200, 36, B, 12, '#64748b') +
      `<polygon points="150,80 250,80 270,180 170,180" fill="#c7d2fe" opacity="0.85" stroke="${INK}" stroke-width="2"/>` +
      `<line x1="200" y1="50" x2="200" y2="210" stroke="${RED}" stroke-width="2" stroke-dasharray="6 4"/>` +
      `<circle cx="200" cy="50" r="3" fill="${RED}"/><circle cx="200" cy="210" r="3" fill="${RED}"/>` +
      txt(212, 62, "O'", 11, RED, 'start') +
      txt(212, 206, 'O', 11, RED, 'start') +
      arrow(262, 110, 292, 110, ACCENT, 2) +
      txt(278, 100, 'w', 12, ACCENT) +
      txt(200, 232, label + '（绕轴匀速转动）', 11, '#64748b')
    return wrap(inner)
  }
  const inner =
    dots.join('') +
    txt(200, 36, B, 12, '#64748b') +
    `<rect x="140" y="90" width="120" height="90" rx="6" fill="none" stroke="${ACCENT}" stroke-width="3"/>` +
    txt(200, 140, label, 13, ACCENT) +
    txt(200, 232, '闭合线圈（平面与磁场垂直）', 11, '#64748b')
  return wrap(inner)
}

// 卫星/行星轨道：kind=circle|ellipse、R 轨道半径、center 中心天体、label
function tOrbit(p: FigureSpec['params']): string {
  const kind = str(p.kind, 'circle') === 'ellipse' ? 'ellipse' : 'circle'
  const R = num(p.R, NaN)
  const center = str(p.center, 'M')
  const label = str(p.label, 'm')
  const cx = 200, cy = 122
  const Rr = 88
  const inner =
    (kind === 'circle'
      ? `<circle cx="${cx}" cy="${cy}" r="${Rr}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 4"/>` +
        `<circle cx="${cx + Rr}" cy="${cy}" r="11" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
        txt(cx + Rr, cy + 4, label, 11) +
        arrow(cx + Rr - 14, cy, cx + 22, cy, RED, 2)
      : `<ellipse cx="${cx}" cy="${cy}" rx="${Rr}" ry="${Rr * 0.62}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 4"/>` +
        `<circle cx="${cx - Rr * 0.6}" cy="${cy}" r="11" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
        txt(cx - Rr * 0.6, cy + 4, label, 11)) +
    `<circle cx="${cx}" cy="${cy}" r="20" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(cx, cy + 5, center, 12) +
    (Number.isFinite(R) ? txt(cx, cy + Rr + 40, `r=${R}m`, 12, '#64748b') : '')
  return wrap(inner)
}


// 氢原子能级图：max_n 能级数（默认 4）、from→to 跃迁箭头、E1 基态能量标注
function tEnergyLevels(p: FigureSpec['params']): string {
  const maxN = Math.min(6, Math.max(3, num(p.max_n, 4)))
  const from = Math.min(maxN, Math.max(2, num(p.from, 4)))
  const to = Math.min(maxN, Math.max(1, num(p.to, 2)))
  const e1 = str(p.E1, '-13.6')
  const levels = []
  for (let n = 1; n <= maxN; n++) {
    // 能级间距随 n 增大而收窄（近似真实能级图的几何感受）
    const y = 200 - (Math.pow(0.62, n - 1)) * 0 // 占位防lint
  }
  // 均匀分布更可读：n=1 在底部
  const yOf = (n: number) => 40 + ((n - 1) / (maxN - 1)) * 160
  for (let n = 1; n <= maxN; n++) {
    levels.push(`<line x1="140" y1="${yOf(n)}" x2="300" y2="${yOf(n)}" stroke="${INK}" stroke-width="2"/>` +
      `<text x="306" y="${yOf(n) + 4}" font-size="12" fill="${INK}" text-anchor="start" ${FONT}>n=${n}</text>` +
      (n === 1 ? `<text x="134" y="${yOf(n) + 4}" font-size="11" fill="#64748b" text-anchor="end" ${FONT}>E1=${e1}eV</text>` : ''))
  }
  // 跃迁箭头（from → to，向下）
  const fy = yOf(from), ty = yOf(to)
  const trans = arrow(160, fy - 4, 160, ty + 4, RED, 2) +
    `<text x="168" y="${(fy + ty) / 2 + 4}" font-size="11" fill="${RED}" text-anchor="start" ${FONT}>${from}→${to} 发出光子</text>`
  const inner =
    txt(200, 24, '氢原子能级图', 12, '#64748b') +
    levels.join('') + trans
  return wrap(inner)
}

// 双缝干涉：双缝 + 波前弧线 + 光屏 + 条纹 + L/d/λ 标注
function tDoubleSlit(p: FigureSpec['params']): string {
  const d = p.d !== undefined ? `d=${p.d}mm` : 'd'
  const L = p.L !== undefined ? `L=${p.L}m` : (p.l !== undefined ? `L=${p.l}m` : 'L')
  const lam = str(p.lambda)
  const sx = 110 // 双缝屏 x
  const sy1 = 90, sy2 = 150 // 两缝
  const screenX = 320
  const inner =
    // 单缝光源（左）
    `<circle cx="55" cy="120" r="6" fill="#fde68a" stroke="${INK}" stroke-width="2"/>` +
    txt(55, 142, 'S', 12) +
    // 挡板 + 双缝
    `<line x1="${sx}" y1="40" x2="${sx}" y2="${sy1 - 7}" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${sx}" y1="${sy1 + 7}" x2="${sx}" y2="${sy2 - 7}" stroke="${INK}" stroke-width="3"/>` +
    `<line x1="${sx}" y1="${sy2 + 7}" x2="${sx}" y2="200" stroke="${INK}" stroke-width="3"/>` +
    `S₁<text x="${sx - 12}" y="${sy1 + 4}" font-size="11" fill="${INK}" text-anchor="end" ${FONT}>S₁</text>` +
    `<text x="${sx - 12}" y="${sy2 + 4}" font-size="11" fill="${INK}" text-anchor="end" ${FONT}>S₂</text>` +
    // 波前弧线（从两缝发出）
    [0, 1, 2].map((i) => `<path d="M ${sx + 18 + i * 26} ${sy1} A ${26 + i * 26} ${26 + i * 26} 0 0 1 ${sx + 18 + i * 26} ${sy1 + 2 * (26 + i * 26) * 0}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>`).join('') +
    `<path d="M ${sx + 18} ${sy1} A 30 30 0 0 1 ${sx + 18 + 30 * Math.cos(0.9)} ${sy1 + 30 * Math.sin(0.9)}" fill="none" stroke="#94a3b8" stroke-width="1.2"/>` +
    `<path d="M ${sx + 18} ${sy2} A 30 30 0 0 0 ${sx + 18 + 30 * Math.cos(0.9)} ${sy2 - 30 * Math.sin(0.9)}" fill="none" stroke="#94a3b8" stroke-width="1.2"/>` +
    // 光屏 + 干涉条纹（中央亮纹宽、两侧渐弱）
    `<line x1="${screenX}" y1="40" x2="${screenX}" y2="205" stroke="${INK}" stroke-width="3"/>` +
    [0, 1, 2, 3, 4].map((i) => `<rect x="${screenX + 6}" y="${108 - i * 17}" width="8" height="${Math.max(4, 9 - i * 1.6)}" fill="#111"/>` + `<rect x="${screenX + 6}" y="${128 + i * 17}" width="8" height="${Math.max(4, 9 - i * 1.6)}" fill="#111"/>`).join('') +
    txt(324, 224, '光屏', 11, '#64748b') +
    // d 与 L 标注
    `<line x1="${sx}" y1="222" x2="${screenX}" y2="222" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
    txt((sx + screenX) / 2, 234, L, 12, '#64748b') +
    `<line x1="${sx - 8}" y1="${sy1}" x2="${sx - 8}" y2="${sy2}" stroke="${RED}" stroke-width="1.2"/>` +
    txt(sx - 16, (sy1 + sy2) / 2 + 4, d, 11, RED, 'end') +
    (lam ? txt(200, 60, `λ=${lam}`, 12, ACCENT) : '')
  return wrap(inner)
}

// 油膜法估测分子大小：浅盘水面 + 一滴油酸 + 单分子油膜（网格圆斑）
function tOilFilm(p: FigureSpec['params']): string {
  const label = str(p.label, '油膜')
  const panL = 60, panR = 340, panT = 70, panB = 200
  const grid = []
  for (let x = panL + 10; x < panR; x += 30) grid.push(`<line x1="${x}" y1="${panT}" x2="${x}" y2="${panB}" stroke="#cbd5e1" stroke-width="0.8"/>`)
  for (let y = panT + 10; y < panB; y += 30) grid.push(`<line x1="${panL}" y1="${y}" x2="${panR}" y2="${y}" stroke="#cbd5e1" stroke-width="0.8"/>`)
  const inner =
    // 浅盘（水面网格）
    `<rect x="${panL}" y="${panT}" width="${panR - panL}" height="${panB - panT}" fill="#e0f2fe" stroke="${INK}" stroke-width="2"/>` +
    grid.join('') +
    // 油膜（椭圆斑，单分子层）
    `<ellipse cx="200" cy="135" rx="86" ry="46" fill="#fde68a" opacity="0.85" stroke="${RED}" stroke-width="2" stroke-dasharray="6 4"/>` +
    txt(200, 140, label, 13, RED) +
    // 滴管 + 液滴
    `<line x1="90" y1="26" x2="104" y2="58" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="107" cy="62" r="3" fill="${ACCENT}"/>` +
    txt(64, 44, '油酸酒精溶液一滴', 10, '#64748b', 'start') +
    txt(200, 224, '爽身粉均匀撒在水面上（显示油膜轮廓）', 10, '#64748b')
  return wrap(inner)
}

// 多用电表欧姆挡测电阻：表盘 + 指针 + 表笔 + 待测电阻
function tMultimeter(p: FigureSpec['params']): string {
  const ohm = str(p.ohm, '×100')
  const label = str(p.label, 'Rx')
  const cx = 170, cy = 130, R = 78
  const needleAng = (38 * Math.PI) / 180 // 指针偏角（偏右=阻值小）
  const nx = cx + R * Math.cos(needleAng), ny = cy - R * Math.sin(needleAng)
  const inner =
    // 表盘（圆 + 欧姆刻度弧）
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` +
    `<path d="M ${cx - 62} ${cy + 40} A 74 74 0 0 1 ${cx + 62} ${cy + 40}" fill="none" stroke="${INK}" stroke-width="1.4"/>` +
    txt(cx + 58, cy + 62, 'Ω', 12) +
    txt(cx - 70, cy + 62, '∞', 12, '#64748b', 'start') +
    // 倍率标注
    txt(cx, cy + 96, `欧姆挡 ${ohm}`, 12, ACCENT) +
    // 指针
    `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${RED}" stroke-width="2.4"/>` +
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${RED}"/>` +
    // 表笔（两根引线）+ 待测电阻
    `<line x1="${cx - 60}" y1="${cy + 66}" x2="${cx - 100}" y2="${cy + 100}" stroke="${RED}" stroke-width="2"/>` +
    `<line x1="${cx + 60}" y1="${cy + 66}" x2="${cx + 100}" y2="${cy + 100}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="${cx + 76}" y="${cy + 96}" width="16" height="34" fill="#fde68a" stroke="${INK}" stroke-width="1.8" transform="rotate(-45 ${cx + 84} ${cy + 113})"/>` +
    txt(cx + 118, cy + 108, label, 13, '#64748b', 'start') +
    txt(cx, 34, '多用电表测电阻', 12, '#64748b')
  return wrap(inner)
}

const TEMPLATES: Record<string, (p: FigureSpec['params']) => string> = {
  incline: tIncline,
  flatblock: tFlatblock,
  pulley: tPulley,
  hang: tHang,
  circuit: tCircuit,
  projectile: tProjectile,
  container2balls: tContainer2balls,
  spring: tSpring,
  bridge: tBridge,
  field_region: tFieldRegion,
  bowl: tBowl,
  bowl2balls: tBowl2balls,
  incline_baffle: tInclineBaffle,
  ring_ball: tRingBall,
  three_ropes: tThreeRopes,
  rod_hinge: tRodHinge,
  // B1 扩充
  conveyor: tConveyor,
  block_on_block: tBlockOnBlock,
  two_blocks: tTwoBlocks,
  incline_spring: tInclineSpring,
  equipotential: tEquipotential,
  magnet_rect: tMagnetRect,
  magnet_circle: tMagnetCircle,
  rail: tRail,
  vertical_circle: tVerticalCircle,
  pendulum: tPendulum,
  wave: tWave,
  vibrate: tVibrate,
  optics_refract: tOpticsRefract,
  exp_trolley: tExpTrolley,
  exp_circuit: tExpCircuit,
  gas_cylinder: tGasCylinder,
  graph_lines: tGraphLines,
  car_road: tCarRoad,
  pv_diagram: tPvDiagram,
  collision: tCollision,
  freefall: tFreefall,
  accel_plates: tAccelPlates,
  wire_bfield: tWireBfield,
  photoelectric: tPhotoelectric,
  coil_flux: tCoilFlux,
  orbit: tOrbit,
  energy_levels: tEnergyLevels,
  double_slit: tDoubleSlit,
  oil_film: tOilFilm,
  multimeter: tMultimeter,
}


// figure_spec → SVG 字符串；模板未知或渲染异常返回空串（调用方按无图处理）
export function specToSvg(spec: FigureSpec | null | undefined): string {
  if (!spec || !spec.template) return ''
  const fn = TEMPLATES[spec.template]
  if (!fn) return ''
  try {
    return fn(spec.params || {})
  } catch {
    return ''
  }
}

// question.figure（JSON 文本）→ 可内联的 HTML 片段（svg 内联 / img 绝对地址）；无图返回 ''
export function figureHtml(figure: string | null | undefined, origin = ''): string {
  if (!figure) return ''
  let f: any
  try { f = JSON.parse(figure) } catch { return '' }
  if (!f || typeof f !== 'object') return ''
  if (f.kind === 'svg' && typeof f.data === 'string' && f.data.startsWith('<svg')) return f.data
  if (f.kind === 'img' && typeof f.data === 'string') {
    const src = f.data.startsWith('http') ? f.data : `${origin}${f.data}`
    return `<img src="${src}" style="max-width:100%;max-height:240px" />`
  }
  return ''
}
