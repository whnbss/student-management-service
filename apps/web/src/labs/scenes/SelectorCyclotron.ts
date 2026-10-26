// 课件 29：速度选择器与回旋加速器（高三 · 综合）
// 选择器：拖 E、B、v，qE=qvB 平衡判断能否直线通过；回旋加速器：螺旋加速动画与末动能
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const Q_E = 1.6e-19
const M_P = 1.67e-27 // 质子质量
const DEMO_W = 3 // 回旋演示角速度（rad/s，真实周期太快）
const PASS_TOL = 0.09 // 直线通过的相对速度容差（与视觉偏转一致）

interface S extends LabState {
  // 选择器
  selX: number // 入射推进（px）
  selY: number // 纵向偏移（px，+向下）
  selDone: boolean
  selAbsorbed: boolean
  // 回旋
  phi: number // 累计转角
  done: boolean
}

export const selectorScene: LabScene = {
  id: 'selector-cyclotron',
  title: '速度选择器与回旋加速器',
  grade: '高三',
  chapter: '综合 · 电磁应用',
  desc: '速度选择器：qE=qvB 判断能否直线通过；回旋加速器：螺旋加速动画，末动能与 D 形盒半径',
  tags: ['速度选择器', '回旋加速器', '电场', '磁场', '直线运动条件'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'mode', label: '演示内容', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '速度选择器' }, { value: 1, label: '回旋加速器' }],
    },
    { key: 'E', label: '电场强度 E', min: 1, max: 20, step: 0.5, unit: '×10⁴V/m', default: 5, modes: [0], reset: false },
    { key: 'B', label: '磁感应强度 B', min: 0.1, max: 1, step: 0.05, unit: 'T', default: 0.3, modes: [0, 1], reset: false },
    { key: 'v', label: '入射速度 v', min: 0.5, max: 10, step: 0.1, unit: '×10⁵m/s', default: 2, modes: [0], reset: false },
    { key: 'U', label: '加速电压 U', min: 100, max: 2000, step: 50, unit: 'V', default: 800, modes: [1], reset: false },
    { key: 'R', label: 'D 形盒半径', min: 0.2, max: 1.2, step: 0.05, unit: 'm', default: 0.6, modes: [1], reset: false },
  ],
  presets: [
    { name: '选择器 · 恰好直线通过', params: { mode: 0, E: 5, B: 0.3, v: 1.7, U: 800, R: 0.6 } },
    { name: '选择器 · 太快（打上板）', params: { mode: 0, E: 5, B: 0.3, v: 4, U: 800, R: 0.6 } },
    { name: '选择器 · 太慢（打下板）', params: { mode: 0, E: 5, B: 0.3, v: 0.8, U: 800, R: 0.6 } },
    { name: '回旋 · 标准演示', params: { mode: 1, E: 5, B: 0.3, v: 2, U: 800, R: 0.6 } },
  ],
  formulas: [
    '\\text{选择器：} qE = qvB \\Rightarrow v_0 = \\frac{E}{B}',
    '\\text{回旋：} r_n = \\frac{mv_n}{qB},\\quad E_{kn} = nqU',
    'r_{\\max} = R \\Rightarrow E_{k\\max} = \\frac{q^2B^2R^2}{2m}',
  ],
  keyPoints: [
    '速度选择器：只对速度 v₀=E/B 的粒子「放行」，与电荷量、电性均无关',
    '回旋加速器：磁场负责偏转、电场负责加速；每转半圈加速一次',
    '粒子能达到的最大动能由 D 形盒半径 R 与 B 决定，与加速电压 U 无关',
  ],
  init(): S {
    return { selX: 0, selY: 0, selDone: false, selAbsorbed: false, phi: 0, done: false }
  },
  step(dt, params, state) {
    const st = state as S
    if (params.mode === 0) {
      const v0 = (params.E * 1e4) / params.B
      const v = params.v * 1e5
      const imbalance = (v - v0) / (v0 || 1)
      const simV = 90 // px/s 演示飞行速度
      if (!st.selDone) {
        st.selX += simV * dt
        const frac = st.selX / 320
        // 太快（qvB>qE）向上偏（屏幕 −y）；太快为正 imbalance → selY 为负
        st.selY = -imbalance * frac * frac * 500
        if (Math.abs(st.selY) > 46) {
          st.selDone = true
          st.selAbsorbed = true
        }
        if (st.selX > 340) st.selDone = true
      }
    } else {
      if (st.done) return
      st.phi += DEMO_W * dt
      const n = Math.floor(st.phi / Math.PI)
      const rN = radiusAt(n, params)
      if (rN >= params.R) st.done = true
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const mode = params.mode

    if (mode === 0) {
      // —— 速度选择器 ——
      const v0 = (params.E * 1e4) / params.B
      const v = params.v * 1e5
      const balanced = Math.abs((v - v0) / v0) < PASS_TOL
      const tooFast = v > v0
      const px0 = 120
      const px1 = 480
      const cy = 210
      ctx.set('plate-t', 'rect', { x: px0, y: cy - 62, width: px1 - px0, height: 8, fill: '#8b5cf6' })
      ctx.set('plate-b', 'rect', { x: px0, y: cy + 54, width: px1 - px0, height: 8, fill: '#8b5cf6' })
      ctx.set('plate-t-l', 'text', { x: px0 - 6, y: cy - 50, 'font-size': 11, 'text-anchor': 'end', fill: C.field, text: '+' })
      ctx.set('plate-b-l', 'text', { x: px0 - 6, y: cy + 62, 'font-size': 11, 'text-anchor': 'end', fill: C.field, text: '−' })
      for (let i = 0; i < 4; i++) {
        const X = px0 + 40 + i * 90
        ctx.set(`e${i}`, 'line', { x1: X, y1: cy - 50, x2: X, y2: cy + 50, stroke: C.field, 'stroke-opacity': 0.3, 'stroke-width': 1.4 })
      }
      let idx = 0
      for (let gy2 = cy - 42; gy2 <= cy + 42; gy2 += 28) {
        for (let gx2 = px0 + 20; gx2 <= px1 - 20; gx2 += 52) {
          ctx.set(`b${idx}`, 'text', { x: gx2, y: gy2, 'font-size': 12, 'text-anchor': 'middle', fill: C.field, 'fill-opacity': 0.28, text: '×' })
          idx++
        }
      }
      for (let i = idx; i < 20; i++) ctx.remove(`b${i}`)

      ctx.set('slit', 'line', { x1: px0 - 26, y1: cy - 14, x2: px0 - 26, y2: cy + 14, stroke: '#94a3b8', 'stroke-width': 5 })
      ctx.set('slit-l', 'text', { x: px0 - 30, y: cy + 32, 'font-size': 10, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.5, text: '入口' })
      const pX = px0 - 20 + Math.min(st.selX + 20, 360)
      const pY = cy + clamp(st.selY, -60, 60)
      ctx.set('p', 'circle', { cx: pX, cy: pY, r: 7, fill: '#f59e0b', stroke: '#b45309' })
      if (opts.showForces) {
        const pC = { x: pX, y: pY }
        drawArrow(ctx, 'fE', pC, { x: pC.x, y: pC.y + 24 }, { color: C.field, label: 'qE↓' })
        drawArrow(ctx, 'fB', pC, { x: pC.x, y: pC.y - 24 }, { color: C.net, dashed: true, label: 'qvB↑' })
      } else ctx.remove('fE', 'fE-head', 'fE-label', 'fB', 'fB-head', 'fB-label')

      const result = st.selAbsorbed ? (tooFast ? '被上板吸收' : '被下板吸收') : st.selDone ? '直线通过' : '飞行中'
      ctx.set('tip', 'text', {
        x: 44, y: 44, 'font-size': 13,
        fill: st.selAbsorbed ? C.warn : st.selDone ? '#059669' : 'currentColor',
        'fill-opacity': st.selDone ? 1 : 0.55,
        text: st.selDone
          ? result === '直线通过'
            ? '✓ 直线通过（qvB = qE）'
            : tooFast ? '✗ v 太快：qvB > qE，偏向上板被吸收' : '✗ v 太慢：qvB < qE，偏向下板被吸收'
          : '飞行中……注意观察是否偏转',
      })
      ctx.set('tip2', 'text', { x: 44, y: 64, 'font-size': 12, fill: 'currentColor', 'fill-opacity': 0.55, text: `v₀=E/B=${fmt(v0 / 1e5, 2)}×10⁵m/s（当前 v=${fmt(params.v, 1)}×10⁵）` })

      data['模式'] = '速度选择器'
      data['直线通过条件 v₀=E/B'] = `${fmt(v0 / 1e5, 2)}×10⁵ m/s`
      data['当前 v'] = `${fmt(params.v, 1)}×10⁵ m/s`
      data['受力比较'] = balanced ? 'qE = qvB（平衡）' : tooFast ? 'qvB > qE（向上偏）' : 'qvB < qE（向下偏）'
      data['结果'] = result
    } else {
      // —— 回旋加速器 ——
      const B = params.B
      const U = params.U
      const Rmax = params.R
      const n = Math.floor(st.phi / Math.PI)
      const rN = radiusAt(n, params)
      const reachedMax = rN >= Rmax
      const vN = Math.sqrt((2 * Math.max(n, 1) * Q_E * U) / M_P)

      // 两个 D 形盒（左上 / 右下，竖直缝隙）
      ctx.set('d1', 'path', { d: 'M320,210 L320,80 A130,130 0 0,0 190,210 Z', fill: '#e2e8f0', 'fill-opacity': 0.4, stroke: '#64748b', 'stroke-width': 2 })
      ctx.set('d2', 'path', { d: 'M320,210 L320,340 A130,130 0 0,1 450,210 Z', fill: '#cbd5e1', 'fill-opacity': 0.4, stroke: '#64748b', 'stroke-width': 2 })
      ctx.set('d-l', 'text', { x: 245, y: 145, 'font-size': 12, fill: '#475569', text: 'D₁' })
      ctx.set('d-l2', 'text', { x: 398, y: 285, 'font-size': 12, fill: '#475569', text: 'D₂' })
      ctx.set('gap-l', 'text', { x: 312, y: 210, 'font-size': 9, 'text-anchor': 'end', fill: C.warn, text: '缝隙' })

      // 螺旋轨迹：每半圈半径按 r_n 增长
      const pts: string[] = []
      const phiEnd = Math.min(st.phi, n * Math.PI + (st.done ? 0 : 0.1))
      for (let ph = 0; ph <= phiEnd; ph += 0.1) {
        const k = Math.floor(ph / Math.PI)
        const rPh = radiusAt(k, params)
        const Rp = clamp((Math.min(rPh, Rmax) / Rmax) * 122, 5, 122)
        pts.push(`${pts.length === 0 ? 'M' : 'L'}${(320 + Rp * Math.cos(ph)).toFixed(1)},${(210 - Rp * Math.sin(ph)).toFixed(1)}`)
      }
      if (pts.length > 2) ctx.set('spiral', 'path', { d: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 1.8, 'stroke-opacity': 0.85 })
      else ctx.remove('spiral')

      // 粒子当前位置（沿螺旋）
      const RpNow = clamp((Math.min(rN, Rmax) / Rmax) * 122, 5, 122)
      const phNow = Math.min(st.phi, n * Math.PI)
      const pXc = 320 + RpNow * Math.cos(phNow)
      const pYc = 210 - RpNow * Math.sin(phNow)
      ctx.set('pc', 'circle', { cx: pXc, cy: pYc, r: 6, fill: '#f59e0b', stroke: '#b45309' })

      if (reachedMax || st.done) {
        ctx.set('exit', 'rect', { x: 442, y: 200, width: 34, height: 18, fill: '#059669', rx: 3 })
        ctx.set('exit-l', 'text', { x: 459, y: 194, 'font-size': 10, 'text-anchor': 'middle', fill: '#059669', text: '引出口' })
        ctx.set('tip', 'text', { x: 44, y: 44, 'font-size': 13, fill: '#059669', text: `★ 达到最大半径 R=${fmt(Rmax, 2)}m，引出射出！共加速 ${n} 次` })
      } else {
        ctx.remove('exit', 'exit-l')
        ctx.set('tip', 'text', { x: 44, y: 44, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.6, text: '螺旋半径渐增：每经过缝隙加速一次，r=mv/(qB) 随之变大' })
      }
      ctx.set('tip2', 'text', { x: 44, y: 64, 'font-size': 11, fill: 'currentColor', 'fill-opacity': 0.45, text: '点「播放」观看螺旋加速动画；最大动能只由 R 与 B 决定（与 U 无关）' })

      data['模式'] = '回旋加速器'
      data['已加速次数 n'] = String(n)
      data['当前速度 v_n'] = `${sci(vN)} m/s`
      data['当前半径 r=mv/(qB)'] = `${fmt(rN, 2)} m`
      data['D 形盒半径 R'] = `${fmt(Rmax, 2)} m`
      data['当前动能 Ek'] = `${fmt((0.5 * M_P * vN * vN) / Q_E / 1e6, 3)} MeV`
      data['最大动能（R 上限）'] = `${fmt(((Q_E * params.B * Rmax) ** 2) / (2 * M_P) / Q_E / 1e6, 2)} MeV`
    }
    return data
  },
}

/** 加速 n 次后的半径（n=0 时按 1 次计算，避免 r=0） */
function radiusAt(n: number, params: SceneParams): number {
  const k = Math.max(n, 1)
  const v = Math.sqrt((2 * k * Q_E * params.U) / M_P)
  return (M_P * v) / (Q_E * params.B)
}

function sci(n: number): string {
  if (n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  if (exp >= -2 && exp <= 4) return fmt(n, 2)
  return `${fmt(n / 10 ** exp, 2)}×10^${exp}`
}
