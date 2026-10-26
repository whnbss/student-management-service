// 课件 28：洛伦兹力与粒子圆周运动（必修三 · 磁场）
// 拖 v、B、q、m，r=mv/(qB)、T=2πm/(qB) 实时；正负电荷偏转方向切换；质谱仪预设
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const CENTER: { x: number; y: number } = { x: 320, y: 220 }
// 像素↔实际：1px = 1cm
const PX_PER_M = 100
const Q_E = 1.6e-19

interface S extends LabState {
  theta: number // 圆周相位
  turn: number // 已转圈数
}

/** 半径 m → px（限幅在舞台内） */
function rToPx(rM: number): number {
  return clamp(rM * PX_PER_M, 18, 170)
}

export const lorentzScene: LabScene = {
  id: 'lorentz-circle',
  title: '洛伦兹力与粒子圆周运动',
  grade: '高二',
  chapter: '必修三 · 磁场',
  desc: '拖 v/B/q/m：r=mv/(qB)、T=2πm/(qB) 实时；正负电荷偏转方向相反；质谱仪预设',
  tags: ['洛伦兹力', '圆周运动', '质谱仪', '磁场', '带电粒子'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'v', label: '速率 v', min: 1, max: 8, step: 0.1, unit: '×10⁶m/s', default: 4, reset: false },
    { key: 'B', label: '磁感应强度 B', min: 0.1, max: 2, step: 0.05, unit: 'T', default: 0.5, reset: false },
    { key: 'qm', label: '比荷 q/m', min: 1, max: 10, step: 0.5, unit: '×10⁷C/kg', default: 4, reset: false },
    {
      key: 'qSign', label: '电荷符号', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '正电荷（+）' }, { value: 1, label: '负电荷（−）' }],
    },
    {
      key: 'bDir', label: 'B 方向', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '垂直纸面向里 ⊗' }, { value: 1, label: '垂直纸面向外 ⊙' }],
    },
  ],
  presets: [
    { name: '标准演示', params: { v: 4, B: 0.5, qm: 4, qSign: 0, bDir: 0 } },
    { name: '负电荷（反转）', params: { v: 4, B: 0.5, qm: 4, qSign: 1, bDir: 0 } },
    { name: '质谱仪（同速不同荷）', params: { v: 4, B: 0.5, qm: 8, qSign: 0, bDir: 0 } },
    { name: '强磁场（半径小）', params: { v: 2, B: 2, qm: 4, qSign: 0, bDir: 0 } },
  ],
  formulas: [
    'F = qvB',
    'r = \\frac{mv}{qB}',
    'T = \\frac{2\\pi m}{qB} \\ (\\text{与 } v \\text{ 无关！})',
  ],
  keyPoints: [
    '洛伦兹力始终垂直于速度：只改变方向不做功，动能不变',
    '半径 r=mv/(qB)：v 越大 r 越大，B 越强 r 越小（质谱仪分离原理）',
    '周期 T=2πm/(qB) 与速率无关——回旋加速器的核心',
  ],
  init(): S {
    return { theta: -Math.PI / 2, turn: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    // 演示用固定可视角速度（真实周期 10⁻⁷s 量级太快），旋转方向由电荷符号与 B 方向定
    const spin = (params.qSign === 0 ? 1 : -1) * (params.bDir === 0 ? -1 : 1)
    const w = 2.2 // rad/s
    st.theta += spin * w * dt
    st.turn += (w * dt) / (2 * Math.PI)
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const q = params.qm * 1e7 * Q_E // C（量级演示）
    const v = params.v * 1e6
    const rM = v / (params.qm * 1e7 * params.B)
    const T = (2 * Math.PI) / (params.qm * 1e7 * params.B)
    const F = (params.qm * 1e7 * Q_E) * v * params.B
    const Rpx = rToPx(rM)

    // 磁场符号阵列
    if (params.B > 0.001) {
      const sym = params.bDir === 0 ? '×' : '•'
      let idx = 0
      for (let gy2 = 60; gy2 <= 400; gy2 += 42) {
        for (let gx2 = 60; gx2 <= 600; gx2 += 46) {
          ctx.set(`b${idx}`, 'text', { x: gx2, y: gy2, 'font-size': 14, 'text-anchor': 'middle', fill: C.field, 'fill-opacity': clamp(params.B * 0.45, 0.1, 0.55), text: sym })
          idx++
        }
      }
      for (let i = idx; i < 130; i++) ctx.remove(`b${i}`)
    } else for (let i = 0; i < 130; i++) ctx.remove(`b${i}`)

    // 轨迹圆
    ctx.set('orbit', 'circle', { cx: CENTER.x, cy: CENTER.y, r: Rpx, fill: 'none', stroke: C.accent, 'stroke-opacity': 0.5, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' })
    // 半径线
    const px2 = CENTER.x + Rpx * Math.cos(st.theta)
    const py2 = CENTER.y + Rpx * Math.sin(st.theta)
    ctx.set('rad', 'line', { x1: CENTER.x, y1: CENTER.y, x2: px2, y2: py2, stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '3 3' })

    // 粒子（拖拽改半径 → 改比荷 qm）
    const particle = ctx.set('p', 'circle', { cx: px2, cy: py2, r: 9, fill: params.qSign === 0 ? '#f59e0b' : '#0ea5e9', stroke: params.qSign === 0 ? '#b45309' : '#0284c7', 'stroke-width': 2 })
    ctx.set('p-t', 'text', { x: px2, y: py2 + 4, 'font-size': 10, 'text-anchor': 'middle', fill: '#fff', text: params.qSign === 0 ? '+' : '−' })
    ctx.drag(particle, (p2) => {
      const d = Math.hypot(p2.x - CENTER.x, p2.y - CENTER.y)
      const rNew = clamp(d / PX_PER_M, 0.2, 1.7)
      // r = mv/(qB) → qm = v/(rB)
      const qmNew = clamp(params.v * 1e6 / (rNew * params.B) / 1e7, 1, 10)
      ctx.setParam('qm', Math.round(qmNew * 2) / 2)
      // 保持相位连续
      st.theta = Math.atan2(p2.y - CENTER.y, p2.x - CENTER.x)
      ctx.requestRender()
    })

    // v 与 F 箭头（F 指向圆心）
    if (opts.showForces) {
      const kF = 90 / Math.max(F, 1e-18)
      const pC = { x: px2, y: py2 }
      // v 切向：顺/逆时针由 spin 决定
      const spin = (params.qSign === 0 ? 1 : -1) * (params.bDir === 0 ? -1 : 1)
      const tang = { x: -Math.sin(st.theta) * spin, y: Math.cos(st.theta) * spin }
      drawArrow(ctx, 'fv', pC, { x: pC.x + tang.x * 40, y: pC.y + tang.y * 40 }, { color: C.tension, label: `v=${fmt(params.v, 1)}×10⁶` })
      const toC = { x: (CENTER.x - px2) / (Rpx || 1), y: (CENTER.y - py2) / (Rpx || 1) }
      drawArrow(ctx, 'fF', pC, { x: pC.x + toC.x * F * kF * 0.5, y: pC.y + toC.y * F * kF * 0.5 }, { color: C.field, label: 'F=qvB' })
      if (opts.showPoints) ctx.set('dot-p', 'circle', { cx: px2, cy: py2, r: 2.5, fill: '#111827' })
      else ctx.remove('dot-p')
    } else {
      ctx.remove('fv', 'fv-head', 'fv-label', 'fF', 'fF-head', 'fF-label', 'dot-p')
    }

    // 提示
    ctx.set('tip', 'text', {
      x: 44, y: 40, 'font-size': 12, fill: 'currentColor', 'fill-opacity': 0.55,
      text: `B⊗ 时正电荷逆时针、负电荷顺时针（洛伦兹力指向圆心）；拖粒子改半径`,
    })

    data['速率 v'] = `${fmt(params.v, 1)}×10⁶ m/s`
    data['半径 r=mv/(qB)'] = `${fmt(rM * 100, 1)} cm`
    data['周期 T=2πm/(qB)'] = `${sci(T)} s`
    data['洛伦兹力 F=qvB'] = `${sci(F)} N`
    data['已转圈数'] = fmt(st.turn, 2)
    data['偏转方向'] = params.qSign === 0 ? '正电荷' : '负电荷'
    return data
  },
}

function sci(n: number): string {
  if (n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  if (exp >= -2 && exp <= 3) return fmt(n, 3)
  return `${fmt(n / 10 ** exp, 2)}×10^${exp}`
}
