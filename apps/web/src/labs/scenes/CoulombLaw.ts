// 课件 20：库仑定律（必修三 · 静电场）
// 两点电荷 q1、q2 与间距 r 均可拖，F=kq₁q₂/r² 实时，同号相斥异号相吸自动切换
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const K = 8.99e9 // 静电力常量 N·m²/C²
const AXIS_Y = 210
const X1 = 140 // q1 固定横坐标

interface S extends LabState {
  x2: number // q2 的横坐标（像素）
}

/** 间距（像素）→ 实际距离 cm（4~36cm 线性映射） */
const PX_PER_CM = 12
function cmToPx(cm: number): number {
  return cm * PX_PER_CM
}

export const coulombScene: LabScene = {
  id: 'coulomb-law',
  title: '库仑定律',
  grade: '高二',
  chapter: '必修三 · 静电场',
  desc: '拖电荷改间距与电荷量，F=kq₁q₂/r² 实时，同号相斥异号相吸自动切换',
  tags: ['库仑定律', '点电荷', '静电力', '电荷'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'q1', label: '电荷量 q₁', min: -6, max: 6, step: 0.5, unit: 'μC', default: 2, reset: false },
    { key: 'q2', label: '电荷量 q₂', min: -6, max: 6, step: 0.5, unit: 'μC', default: 3, reset: false },
    { key: 'r', label: '间距 r', min: 4, max: 34, step: 0.5, unit: 'cm', default: 12, reset: false },
  ],
  presets: [
    { name: '同号相斥（2μC·3μC）', params: { q1: 2, q2: 3, r: 12 } },
    { name: '异号相吸', params: { q1: 3, q2: -3, r: 10 } },
    { name: '距离减半 力×4', params: { q1: 2, q2: 3, r: 6 } },
    { name: '等量同号对称', params: { q1: 4, q2: 4, r: 20 } },
  ],
  formulas: [
    'F = k\\frac{q_1 q_2}{r^2}',
    'k = 9.0\\times10^9\\ \\mathrm{N\\cdot m^2/C^2}',
    '\\text{同号相斥、异号相吸}',
  ],
  keyPoints: [
    '库仑定律只适用于真空中两个点电荷（形状大小可忽略）',
    'r 减半，F 变 4 倍：F 与 r² 成反比，不是与 r 成反比',
    '两电荷间的库仑力是相互作用力，大小恒等、方向相反，与电量是否相等无关',
  ],
  init(): S {
    return { x2: X1 + cmToPx(12) }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const rCm = params.r
    const rM = rCm / 100
    const q1 = params.q1 * 1e-6
    const q2 = params.q2 * 1e-6
    const F = (K * Math.abs(q1 * q2)) / (rM * rM)
    const attract = q1 * q2 < 0

    // 刻度尺（cm）
    for (let cm = 0; cm <= 40; cm += 2) {
      const X = X1 + cmToPx(cm)
      if (X > ctx.w - 20) break
      const major = cm % 10 === 0
      ctx.set(`tick${cm}`, 'line', { x1: X, y1: 330, x2: X, y2: major ? 342 : 337, stroke: 'currentColor', 'stroke-opacity': major ? 0.5 : 0.25 })
      if (major) ctx.set(`tickl${cm}`, 'text', { x: X, y: 356, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.5, text: String(cm) })
    }
    ctx.set('ruler-label', 'text', { x: 40, y: 356, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: 'cm' })

    // 间距标注双箭头
    const X2 = st.x2
    ctx.set('r-line', 'line', { x1: X1, y1: 300, x2: X2, y2: 300, stroke: C.accent, 'stroke-width': 1.5, 'stroke-dasharray': '3 3' })
    ctx.set('r-label', 'text', { x: (X1 + X2) / 2, y: 316, 'font-size': 13, 'text-anchor': 'middle', fill: C.accent, text: `r = ${fmt(rCm, 1)} cm` })

    // 两个点电荷（q2 可水平拖动改 r）
    const sign1 = params.q1 >= 0
    const sign2 = params.q2 >= 0
    const c1 = ctx.set('q1', 'circle', { cx: X1, cy: AXIS_Y, r: 22, fill: sign1 ? '#ef4444' : '#3b82f6', stroke: sign1 ? '#b91c1c' : '#1d4ed8', 'stroke-width': 2 })
    ctx.set('q1-t', 'text', { x: X1, y: AXIS_Y + 5, 'font-size': 15, 'text-anchor': 'middle', fill: '#fff', text: sign1 ? '+' : '−' })
    ctx.set('q1-l', 'text', { x: X1, y: AXIS_Y - 34, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', text: `q₁=${fmt(params.q1, 1)}μC` })
    const c2 = ctx.set('q2', 'circle', { cx: X2, cy: AXIS_Y, r: 22, fill: sign2 ? '#ef4444' : '#3b82f6', stroke: sign2 ? '#b91c1c' : '#1d4ed8', 'stroke-width': 2 })
    ctx.set('q2-t', 'text', { x: X2, y: AXIS_Y + 5, 'font-size': 15, 'text-anchor': 'middle', fill: '#fff', text: sign2 ? '+' : '−' })
    ctx.set('q2-l', 'text', { x: X2, y: AXIS_Y - 34, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', text: `q₂=${fmt(params.q2, 1)}μC` })
    ctx.drag(c2, (p) => {
      const cm = clamp((p.x - X1) / PX_PER_CM, 4, 34)
      ctx.setParam('r', Math.round(cm * 2) / 2)
      st.x2 = X1 + cmToPx(cm)
      ctx.requestRender()
    })
    // q1 也允许整组平移观感（保持 r 不变仅视觉），不绑定

    // 库仑力箭头：q1 受到的力（紫，指向对方=吸 / 背离对方=斥）
    if (opts.showForces && F > 1e-9) {
      const k = 90 / Math.max(F, 1e-9)
      const dir = attract ? 1 : -1 // q1 受力：吸引朝 q2（+x），排斥远离 q2（−x）
      const p1 = v(X1, AXIS_Y)
      drawArrow(ctx, 'f1', p1, add(p1, v(dir * F * k, 0)), { color: C.field, label: `F=${fmt(F, 2)}N` })
      const p2 = v(X2, AXIS_Y)
      drawArrow(ctx, 'f2', p2, add(p2, v(-dir * F * k, 0)), { color: C.field, label: `F'=${fmt(F, 2)}N` })
      if (opts.showPoints) {
        ctx.set('dot1', 'circle', { cx: X1, cy: AXIS_Y, r: 3, fill: '#111827' })
        ctx.set('dot2', 'circle', { cx: X2, cy: AXIS_Y, r: 3, fill: '#111827' })
      } else ctx.remove('dot1', 'dot2')
    } else {
      ctx.remove('f1', 'f1-head', 'f1-label', 'f2', 'f2-head', 'f2-label', 'dot1', 'dot2')
    }

    // 提示
    ctx.set('tip', 'text', {
      x: 50, y: 50, 'font-size': 13, fill: C.warn,
      text: attract ? '异号电荷：相互吸引' : '同号电荷：相互排斥',
    })
    ctx.set('tip2', 'text', {
      x: 50, y: 70, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5,
      text: '拖动右侧电荷改间距 r；箭头长度按当前最大力归一（90px 基准）',
    })

    data['间距 r'] = `${fmt(rCm, 1)} cm`
    data['库仑力 F=kq₁q₂/r²'] = fmt(F) + ' N'
    data['作用性质'] = attract ? '吸引（异号）' : '排斥（同号）'
    data['r 减半时 F 变为'] = `${fmt(F * 4, 2)} N（×4）`
    return data
  },
}
