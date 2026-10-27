// 课件 30：带电粒子在组合场中的运动（高三 · 综合）
// 电场加速 → 磁场偏转全流程动画：拖 U、B、磁场宽度 W，出射位置与偏转角实时
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const Q_E = 1.6e-19
const M_P = 1.67e-27
// 像素↔实际：1px = 1cm
const PX_PER_M = 100

// 舞台布局
const ACCEL_X0 = 40 // 加速区
const ACCEL_X1 = 120
const B_X0 = 240 // 磁场区左缘
const B_W_MAX = 220 // 磁场区最大宽（px）
const EXIT_Y = 210

interface S extends LabState {
  s: number // 沿轨迹的推进量（px）
  pts: [number, number][] // 轨迹像素点缓存（参数变化时重建）
  key: string
}

export const combinedScene: LabScene = {
  id: 'combined-fields',
  title: '组合场：电场加速 + 磁场偏转',
  grade: '高三',
  chapter: '综合 · 电磁应用',
  desc: '直线加速器 → 磁场圆弧偏转全流程：拖 U、B、W，看出射位置与偏转角实时变化',
  tags: ['组合场', '加速电场', '磁场偏转', '带电粒子', '质谱仪'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'U', label: '加速电压 U', min: 200, max: 2000, step: 50, unit: 'V', default: 800, reset: false },
    { key: 'B', label: '磁感应强度 B', min: 0.05, max: 0.5, step: 0.01, unit: 'T', default: 0.15, reset: false },
    { key: 'W', label: '磁场宽度 W', min: 0.1, max: 1.4, step: 0.05, unit: 'm', default: 0.7, reset: false },
  ],
  presets: [
    { name: '标准演示（半圆出射）', params: { U: 800, B: 0.15, W: 0.7 } },
    { name: '弱磁场（大半径直接穿出）', params: { U: 800, B: 0.05, W: 0.7 } },
    { name: '强磁场（小半径急转）', params: { U: 800, B: 0.5, W: 1.0 } },
    { name: '窄磁场（偏转小）', params: { U: 800, B: 0.15, W: 0.2 } },
  ],
  formulas: [
    'v = \\sqrt{2qU/m}',
    'r = \\frac{mv}{qB}',
    '\\text{穿出侧边：} \\sin\\theta = \\frac{W}{r},\\quad \\text{半圆出射：} W \\geq r',
  ],
  keyPoints: [
    '电场区只管加速（qU=½mv²），磁场区只管偏转（不做功）',
    'W ≥ r：粒子转半圆从入射侧飞回；W < r：沿圆弧从右侧穿出',
    '出射速度大小等于进入磁场时的速度（洛伦兹力不做功）',
  ],
  init(): S {
    return { s: 0, pts: [], key: '' }
  },
  step(dt, params, state) {
    const st = state as S
    // 演示飞行速度约 120px/s
    const total = trajLength(params, st)
    if (total > 0) st.s = (st.s + dt * 120) % (total * 1.4)
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}

    const v = Math.sqrt((2 * Q_E * params.U) / M_P)
    const rM = (M_P * v) / (Q_E * params.B)
    const Rpx = clamp(rM * PX_PER_M, 20, 400)
    const Wpx = params.W * PX_PER_M
    const key = `${Math.round(params.U / 50)}:${params.B.toFixed(2)}:${params.W.toFixed(2)}`
    const halfCircle = Wpx >= Rpx // 磁场够宽：半圆转回

    // 轨迹（参数变化时重建缓存）
    if (st.key !== key) {
      st.key = key
      st.pts = []
      // 段1：加速区直线（近似水平直线，初速从小到大）
      for (let X = ACCEL_X1; X <= B_X0; X += 4) st.pts.push([X, EXIT_Y])
      // 段2：磁场圆弧（入射点 (B_X0, EXIT_Y)，圆心在入射点正上方/下方）
      // 正电荷、B⊗：向左偏（逆时针）→ 圆心在入射点上方（屏幕 −y）
      const cycC = { x: B_X0, y: EXIT_Y - Rpx }
      const thetaMax = halfCircle ? Math.PI : Math.asin(clamp(Wpx / Rpx, 0, 1))
      for (let th = 0; th <= thetaMax; th += 0.02) {
        st.pts.push([cycC.x + Rpx * Math.sin(th), cycC.y + Rpx * Math.cos(th)])
      }
      // 段3：出射直线
      if (!halfCircle) {
        const last = st.pts[st.pts.length - 1]
        const dirX = Math.sin(thetaMax)
        const dirY = Math.cos(thetaMax)
        for (let k = 4; k <= 260; k += 4) {
          const X = last[0] + dirX * k
          const Y = last[1] + dirY * k
          if (X > ctx.w - 8 || Y > ctx.h - 8 || Y < 8) break
          st.pts.push([X, Y])
        }
      }
      st.s = 0
    }

    // 加速区
    ctx.set('acc-t', 'rect', { x: ACCEL_X0, y: 110, width: 6, height: 200, fill: '#8b5cf6' })
    ctx.set('acc-b', 'rect', { x: ACCEL_X1, y: 110, width: 6, height: 200, fill: '#8b5cf6' })
    ctx.set('acc-l', 'text', { x: (ACCEL_X0 + ACCEL_X1) / 2, y: 100, 'font-size': 13, 'text-anchor': 'middle', fill: C.field, text: `加速 U=${fmt(params.U, 0)}V` })
    ctx.set('acc-l2', 'text', { x: (ACCEL_X0 + ACCEL_X1) / 2, y: 330, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.5, text: '＋/−' })
    // 磁场区
    ctx.set('b-zone', 'rect', { x: B_X0, y: 40, width: Wpx, height: 340, fill: C.field, 'fill-opacity': 0.05, stroke: C.field, 'stroke-opacity': 0.3, 'stroke-dasharray': '5 4' })
    let idx = 0
    for (let gy2 = 70; gy2 <= 360; gy2 += 42) {
      for (let gx2 = B_X0 + 20; gx2 <= B_X0 + Wpx - 12; gx2 += 44) {
        ctx.set(`b${idx}`, 'text', { x: gx2, y: gy2, 'font-size': 13, 'text-anchor': 'middle', fill: C.field, 'fill-opacity': clamp(params.B * 1.1, 0.15, 0.7), text: '×' })
        idx++
      }
    }
    for (let i = idx; i < 60; i++) ctx.remove(`b${i}`)
    ctx.set('b-l', 'text', { x: B_X0 + 8, y: 34, 'font-size': 13, fill: C.field, text: `B=${fmt(params.B, 2)}T ⊗ W=${fmt(params.W, 2)}m` })

    // 轨迹
    if (st.pts.length > 2) {
      ctx.set('traj', 'path', { d: st.pts.map(([X, Y], i) => `${i === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`).join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2, 'stroke-opacity': 0.8 })
    } else ctx.remove('traj')

    // 飞行的粒子
    const idxNow = Math.min(Math.floor(st.s / 4), st.pts.length - 1)
    if (st.pts.length > 2 && idxNow >= 0) {
      const [pX, pY] = st.pts[idxNow]
      ctx.set('p', 'circle', { cx: pX, cy: pY, r: 6, fill: '#f59e0b', stroke: '#b45309' })
      if (opts.showForces) {
        const pC = { x: pX, y: pY }
        if (pX >= B_X0) {
          // 磁场内：洛伦兹力指向圆心（cycC）
          const cycC = { x: B_X0, y: EXIT_Y - Rpx }
          const dl = Math.hypot(cycC.x - pX, cycC.y - pY) || 1
          drawArrow(ctx, 'fF', pC, { x: pC.x + ((cycC.x - pX) / dl) * 26, y: pC.y + ((cycC.y - pY) / dl) * 26 }, { color: C.field, label: 'F=qvB' })
          ctx.remove('fE2', 'fE2-head', 'fE2-label')
        } else {
          drawArrow(ctx, 'fE2', pC, { x: pC.x, y: pC.y + 24 }, { color: C.field, label: 'qE（加速）' })
          ctx.remove('fF', 'fF-head', 'fF-label')
        }
      } else ctx.remove('fF', 'fF-head', 'fF-label', 'fE2', 'fE2-head', 'fE2-label')
    } else ctx.remove('p')

    // 半圆出射时的回出口标注
    if (halfCircle) {
      ctx.set('half-l', 'text', { x: B_X0 + 12, y: 380, 'font-size': 13, fill: '#059669', text: 'W ≥ r：粒子转半圆从入射侧下方射回（速度大小不变）' })
    } else {
      ctx.remove('half-l')
    }
    // 撞出边界提示
    const lastPt = st.pts[st.pts.length - 1]
    if (!halfCircle && lastPt && lastPt[0] <= B_X0 + Wpx + 2 && Math.abs(lastPt[1] - EXIT_Y) > 160) {
      ctx.set('clip-l', 'text', { x: 44, y: 40, 'font-size': 13, fill: C.warn, text: '⚠ 磁场太强：r 过小，偏转剧烈（轨迹超出可视范围）' })
    } else ctx.remove('clip-l')

    // 出射参数
    const thetaOut = halfCircle ? Math.PI : Math.asin(clamp(Wpx / Rpx, 0, 1))
    data['入磁速度 v=√(2qU/m)'] = `${sci(v)} m/s`
    data['轨道半径 r=mv/(qB)'] = `${fmt(rM, 3)} m`
    data['磁场宽度 W'] = `${fmt(params.W, 2)} m`
    data['W 与 r 比较'] = halfCircle ? 'W ≥ r → 半圆出射' : `W/r = ${fmt(params.W / rM, 2)}（穿侧边出射）`
    data['出射偏转角 θ'] = halfCircle ? '180°（反向）' : `${fmt((thetaOut * 180) / Math.PI, 1)}°`
    data['出射速度大小'] = `${sci(v)} m/s（不变）`
    return data
  },
}

/** 轨迹总长（px），供 step 推进取模 */
function trajLength(params: SceneParams, st: S): number {
  void params
  return st.pts.length * 4
}

function sci(n: number): string {
  if (n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  if (exp >= -2 && exp <= 4) return fmt(n, 2)
  return `${fmt(n / 10 ** exp, 2)}×10^${exp}`
}
