// 题目配图：AI 只输出 figure_spec（模板名 + 参数），前端按模板渲染成风格统一的 SVG
// 数据模型：question.figure = '{"kind":"svg","data":"<svg …>"}' 或 '{"kind":"img","data":"/uploads/questions/x.png"}'
import type { FigureSpec } from '@workbench/shared'

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
    txt(100, topY + (gy - topY) / 2 + 5, '桌面', 13, '#64748b') +
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
