// 课件 28：洛伦兹力与粒子圆周运动（必修三 · 磁场）
// 粒子预设（电子/质子/α 粒子）自动带出真实 q、m（比荷只读）；拖 v、B，r=mv/(qB)、T=2πm/(qB)、F=qvB 全部自洽；
// 正负电荷（电子为负）偏转方向切换；质谱仪预设
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const CENTER: { x: number; y: number } = { x: 320, y: 220 }
// 像素↔实际：1px = 1cm（半径超出可见范围时按限幅绘制并在数据面板标注）
const PX_PER_M = 100
const E_CHARGE = 1.6e-19

/** 粒子预设：q（C，带符号）、m（kg）为真实物理量 */
const PARTICLES = [
  { label: '电子 e⁻（负电荷）', q: -E_CHARGE, m: 9.11e-31 },
  { label: '质子 p（正电荷）', q: E_CHARGE, m: 1.67e-27 },
  { label: 'α 粒子（正电荷）', q: 2 * E_CHARGE, m: 6.64e-27 },
]

interface S extends LabState {
  theta: number // 圆周相位
  turn: number // 已转圈数
}

/** 半径 m → px（限幅在舞台内） */
function rToPx(rM: number): number {
  return clamp(rM * PX_PER_M, 18, 170)
}

/** 半径的显示单位自适应：m / cm / mm */
function fmtLength(m: number): string {
  if (m >= 1) return `${fmt(m, 2)} m`
  if (m >= 0.01) return `${fmt(m * 100, 1)} cm`
  return `${fmt(m * 1000, 2)} mm`
}

/** 科学计数法：×10^-7 的 ^ 写成 Unicode 上标（×10⁻⁷） */
function sci(n: number): string {
  if (n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  if (exp >= -2 && exp <= 3) return fmt(n, 3)
  const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
  return `${fmt(n / 10 ** exp, 2)}×10${String(exp).split('').map((c) => SUP[c] ?? c).join('')}`
}

export const lorentzScene: LabScene = {
  id: 'lorentz-circle',
  title: '洛伦兹力与粒子圆周运动',
  grade: '高二',
  chapter: '必修三 · 磁场',
  desc: '选粒子（电子/质子/α）：q、m 自动带出，r=mv/(qB)、T=2πm/(qB)、F=qvB 实时自洽',
  tags: ['洛伦兹力', '圆周运动', '质谱仪', '磁场', '带电粒子'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'particle', label: '粒子（q、m 自动带出）', min: 0, max: 2, step: 1, unit: '', default: 1,
      options: PARTICLES.map((p, i) => ({ value: i, label: p.label })),
    },
    { key: 'v', label: '速率 v', min: 0.5, max: 20, step: 0.5, unit: '×10⁶m/s', default: 15, reset: false },
    { key: 'B', label: '磁感应强度 B', min: 0.1, max: 2, step: 0.05, unit: 'T', default: 0.3, reset: false },
    {
      key: 'bDir', label: 'B 方向', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '垂直纸面向里 ⊗' }, { value: 1, label: '垂直纸面向外 ⊙' }],
    },
  ],
  presets: [
    { name: '质子 · 标准演示', params: { particle: 1, v: 15, B: 0.3, bDir: 0 } },
    { name: '电子 · 反向偏转', params: { particle: 0, v: 10, B: 0.1, bDir: 0 } },
    { name: 'α 粒子 · 大圆（质谱仪）', params: { particle: 2, v: 10, B: 0.2, bDir: 0 } },
    { name: '强磁场（半径小）', params: { particle: 1, v: 5, B: 2, bDir: 0 } },
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
  challenge: {
    question: '电子与质子以相同速度垂直射入同一匀强磁场，谁的轨道半径更小？',
    options: ['电子（质量小）', '质子（质量大）', '两者相同', '取决于电荷量以外的因素'],
    answer: 0,
    explanation: 'r = mv/(qB)：速度与磁场相同、电荷量大小同为一个 e，质量小的电子轨道半径小得多（约 1/1836）。质谱仪正是利用这一点区分同位素。',
    reveal_preset: '电子 · 反向偏转',
  },
  init(): S {
    return { theta: -Math.PI / 2, turn: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    // 演示用固定可视角速度（真实周期 10⁻⁷s 量级太快）；旋转方向由电荷符号与 B 方向定
    const qSign = (PARTICLES[params.particle] ?? PARTICLES[1]).q > 0 ? 1 : -1
    const spin = qSign * (params.bDir === 0 ? -1 : 1)
    const w = 2.2 // rad/s
    st.theta += spin * w * dt
    st.turn += (w * dt) / (2 * Math.PI)
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const pt = PARTICLES[params.particle] ?? PARTICLES[1]
    const q = pt.q
    const m = pt.m
    const v = params.v * 1e6
    const rM = (m * v) / (Math.abs(q) * params.B) // 真实半径 m
    const T = (2 * Math.PI * m) / (Math.abs(q) * params.B)
    const F = Math.abs(q) * v * params.B
    const Rpx = rToPx(rM)
    const rClamped = Math.abs(Rpx - rM * PX_PER_M) > 0.5

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

    // 粒子（拖拽改半径 → 反推 B / v，保持物理自洽）
    const isNeg = q < 0
    const particle = ctx.set('p', 'circle', { cx: px2, cy: py2, r: 9, fill: isNeg ? C.sky : C.amber, stroke: isNeg ? C.skyDeep : C.amberDeep, 'stroke-width': 2 })
    ctx.set('p-t', 'text', { x: px2, y: py2 + 4, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: isNeg ? '−' : '+' })
    ctx.drag(particle, (p2) => {
      const d = Math.hypot(p2.x - CENTER.x, p2.y - CENTER.y)
      const rNew = clamp(d / PX_PER_M, 0.01, 5)
      // r = mv/(qB) → 优先反推 B；B 超量程时反推 v
      const bNew = (m * v) / (Math.abs(q) * rNew)
      if (bNew >= 0.1 && bNew <= 2) {
        ctx.setParam('B', Math.round(bNew * 20) / 20)
      } else {
        const vNew = clamp((Math.abs(q) * params.B * rNew) / m / 1e6, 0.5, 20)
        ctx.setParam('v', Math.round(vNew * 2) / 2)
      }
      // 保持相位连续
      st.theta = Math.atan2(p2.y - CENTER.y, p2.x - CENTER.x)
      ctx.requestRender()
    })

    // v 与 F 箭头（F 指向圆心）
    if (opts.showForces) {
      const kF = 90 / Math.max(F, 1e-18)
      const pC = { x: px2, y: py2 }
      // v 切向：顺/逆时针由电荷符号与 B 方向决定
      const spin = (isNeg ? -1 : 1) * (params.bDir === 0 ? -1 : 1)
      const tang = { x: -Math.sin(st.theta) * spin, y: Math.cos(st.theta) * spin }
      drawArrow(ctx, 'fv', pC, { x: pC.x + tang.x * 40, y: pC.y + tang.y * 40 }, { color: C.tension, label: `v=${fmt(params.v, 1)}×10⁶` })
      const toC = { x: (CENTER.x - px2) / (Rpx || 1), y: (CENTER.y - py2) / (Rpx || 1) }
      drawArrow(ctx, 'fF', pC, { x: pC.x + toC.x * F * kF * 0.5, y: pC.y + toC.y * F * kF * 0.5 }, { color: C.field, label: 'F=qvB' })
      if (opts.showPoints) ctx.set('dot-p', 'circle', { cx: px2, cy: py2, r: 2.5, fill: C.inkStrong })
      else ctx.remove('dot-p')
    } else {
      ctx.remove('fv', 'fv-head', 'fv-label', 'fF', 'fF-head', 'fF-label', 'dot-p')
    }

    // 提示
    ctx.set('tip', 'text', {
      x: 44, y: 40, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.55,
      text: rClamped
        ? `真实半径 ${fmtLength(rM)} 超出画面比例（1px=1cm），图中按限幅半径示意；数据面板为真实值`
        : `B⊗ 时正电荷逆时针、负电荷顺时针（洛伦兹力指向圆心）；拖粒子改半径`,
    })

    data['粒子'] = pt.label.split('（')[0]
    data['电荷 q'] = `${sci(Math.abs(q))} C（${isNeg ? '负' : '正'}）`
    data['质量 m'] = `${sci(m)} kg`
    data['比荷 q/m（只读）'] = `${sci(Math.abs(q) / m)} C/kg`
    data['速率 v'] = `${fmt(params.v, 1)}×10⁶ m/s`
    data['半径 r=mv/(qB)'] = fmtLength(rM)
    data['周期 T=2πm/(qB)'] = `${sci(T)} s`
    data['洛伦兹力 F=qvB'] = `${sci(F)} N`
    data['已转圈数'] = fmt(st.turn, 2)
    return data
  },
}
