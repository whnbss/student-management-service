// 课件 32：横波的形成与传播（选择性必修一 · 机械波）
// 绳上质点依次被波源带动形成横波：质点只在自己平衡位置附近振动、不随波迁移；
// 可拖动「观察质点」，右图同步画出该质点的 y-t 振动曲线
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { axes, gx, gy, polyline } from '../engine/graph'

const X0 = 110 // 波源横坐标
const N = 25 // 质点数
const GAP = 19 // 质点间距 px
const PX_PER_M = 22 // 像素/米（振幅换算）
const BASE_Y = 210 // 平衡位置
const SAMPLE = 0.1 // 观察曲线采样间隔 s

interface S extends LabState {
  t: number
  obs: number // 观察质点下标（0=波源）
  trace: [number, number][] // 观察质点位移-时间曲线
  nextSample: number
}

export const transverseWaveScene: LabScene = {
  id: 'transverse-wave',
  title: '横波的形成与传播',
  grade: '高二',
  chapter: '选择性必修一 · 机械波',
  desc: '绳波逐点传播动画：拖观察质点看 y-t 振动曲线，理解「质点不随波迁移」',
  tags: ['机械波', '横波', '波长', '波速', '频率'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'A', label: '振幅 A', min: 0.2, max: 1.4, step: 0.1, unit: 'm', default: 0.8, reset: false },
    { key: 'f', label: '频率 f', min: 0.2, max: 1.2, step: 0.1, unit: 'Hz', default: 0.5, reset: false },
    { key: 'v', label: '波速 v', min: 2, max: 16, step: 0.5, unit: 'm/s', default: 6, reset: false },
  ],
  presets: [
    { name: '标准横波', params: { A: 0.8, f: 0.5, v: 6 } },
    { name: '高频短波', params: { A: 0.6, f: 1.0, v: 4 } },
    { name: '长波慢传', params: { A: 1.2, f: 0.3, v: 12 } },
    { name: '盯住远端质点', params: { A: 0.8, f: 0.5, v: 6 }, state: { obs: 18 } },
  ],
  formulas: [
    'v = \\lambda f',
    'T = \\tfrac{1}{f}',
    'y = A\\sin\\left[2\\pi f\\left(t-\\tfrac{x}{v}\\right)\\right]',
  ],
  keyPoints: [
    '质点只在平衡位置附近上下振动，不随波迁移——波传播的是振动形式和能量',
    '波源振动一个周期，波向前传播一个波长 λ；后一质点总是重复前一质点的振动（滞后）',
    '波长由波源与介质共同决定：v = λf，同一介质中 v 不变，f 加倍则 λ 减半',
  ],
  init(params: SceneParams): S {
    return { t: 0, obs: 3, trace: [], nextSample: SAMPLE }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    if (st.t >= st.nextSample) {
      st.trace.push([Number(st.t.toFixed(2)), obsDisp(st, params)])
      st.nextSample += SAMPLE
      if (st.trace.length > 240) st.trace.shift()
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const lam = params.v / params.f // 波长 m
    const omega = 2 * Math.PI * params.f

    // 绳上各质点：先画波形曲线，再画质点
    const pts: string[] = []
    for (let i = 0; i < N; i++) {
      const x = X0 + i * GAP
      const y = BASE_Y - dispAt(i, st, params) * PX_PER_M
      pts.push(`${i === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`)
    }
    ctx.set('rope', 'path', { d: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 3, 'stroke-linecap': 'round' })

    // 平衡位置虚线
    ctx.set('base', 'line', { x1: X0 - 30, y1: BASE_Y, x2: X0 + N * GAP + 10, y2: BASE_Y, stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '5 5' })
    ctx.set('base-l', 'text', { x: X0 + N * GAP + 14, y: BASE_Y + 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.45, text: '平衡位置' })

    // 波源（小圆块）
    ctx.set('src', 'circle', { cx: X0 - 26, cy: BASE_Y - dispAt(0, st, params) * PX_PER_M, r: 9, fill: C.accentDeep })
    ctx.set('src-l', 'text', { x: X0 - 26, y: BASE_Y + 26, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '波源' })

    // 各质点小圆点 + 观察质点高亮（可沿绳水平拖动换观察对象）
    for (let i = 1; i < N; i++) {
      const x = X0 + i * GAP
      const y = BASE_Y - dispAt(i, st, params) * PX_PER_M
      if (i === st.obs) continue
      ctx.set(`p${i}`, 'circle', { cx: x, cy: y, r: 4, fill: C.muted })
    }
    const ox = X0 + st.obs * GAP
    const oy = BASE_Y - dispAt(st.obs, st, params) * PX_PER_M
    ctx.remove(`p${st.obs}`)
    const obsEl = ctx.set('obs', 'circle', { cx: ox, cy: oy, r: 8, fill: C.gravity, stroke: C.redInk, 'stroke-width': 2 })
    ctx.drag(obsEl, (p) => {
      st.obs = clamp(Math.round((p.x - X0) / GAP), 1, N - 1)
      st.trace = []
      st.nextSample = st.t + SAMPLE
      ctx.requestRender()
    })
    ctx.set('obs-l', 'text', { x: ox, y: oy - 16, 'font-size': 13, 'text-anchor': 'middle', fill: C.warn, text: `观察质点（距波源 ${fmt((st.obs * GAP) / PX_PER_M, 1)}m）` })

    // 观察质点振动方向箭头（分量开关 = 显示质点速度方向）
    const obsDelay = (st.obs * GAP) / PX_PER_M / params.v // 波传到观察质点所需时间（s）
    const vy = omega * params.A * Math.cos(omega * (st.t - obsDelay))
    if (opts.showComponents && st.t > obsDelay + 0.01) {
      const dir = vy > 0 ? -1 : 1 // 屏幕向下为正，速度向上画向上箭头
      const L = clamp(Math.abs(vy) * 26, 8, 60)
      if (L >= 8) {
        ctx.set('v-obs', 'line', { x1: ox, y1: oy, x2: ox, y2: oy + dir * L, stroke: C.normal, 'stroke-width': 2.5 })
        ctx.set('v-obs-h', 'polygon', { points: `${ox},${oy + dir * L} ${ox - 4},${oy + dir * (L - 8)} ${ox + 4},${oy + dir * (L - 8)}`, fill: C.normal })
        ctx.set('v-obs-l', 'text', { x: ox + 10, y: oy + (dir * L) / 2, 'font-size': 13, fill: C.normal, text: 'v' })
      } else ctx.remove('v-obs', 'v-obs-h', 'v-obs-l')
    } else ctx.remove('v-obs', 'v-obs-h', 'v-obs-l')

    // 提示（两行拉开行距，避免重叠）
    const reached = st.t * params.v
    ctx.set('tip', 'text', {
      x: 60, y: 38, 'font-size': 13, fill: C.warn,
      text: st.t < 0.05 ? '点「播放」：波从波源逐点向右传播' : `波前已传播 ${fmt(reached, 1)} m（红点质点可左右拖动换观察对象）`,
    })
    ctx.set('tip2', 'text', { x: 60, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '注意：每个质点都只上下振动，绳子整体不向右移动' })

    // 图像面板：观察质点 y-t 曲线（纵轴量程按当前振幅自适应，避免半板空白）
    if (ctx.gw) {
      const yMax = Math.max(0.3, Math.ceil(params.A * 1.2 * 10) / 10)
      const box = { x: 44, y: 22, w: ctx.gw - 70, h: ctx.gh - 66 }
      axes(ctx, box, { xLabel: 't/s', yLabel: '位移/m', xMax: 24, yMax, yMin: -yMax })
      polyline(ctx, 'g-obs', st.trace, box, 0, 24, -yMax, yMax, C.warn)
      const y0 = gy(box, -yMax, yMax, 0)
      ctx.gset('g-zero', 'line', { x1: box.x, y1: y0, x2: box.x + box.w, y2: y0, stroke: 'currentColor', 'stroke-opacity': 0.2, 'stroke-dasharray': '3 3' })
    }

    data['波长 λ=v/f'] = `${fmt(lam, 2)} m`
    data['周期 T=1/f'] = `${fmt(1 / params.f, 2)} s`
    data['时间 t'] = `${fmt(st.t, 1)} s`
    data['观察质点位移'] = `${fmt(obsDisp(st, params), 2)} m`
    // 状态判断：与「波传到观察质点的时间」比较（此前误与距离米数比较，导致波到达后仍显示"波未到达"）
    data['观察质点速度'] = st.t < obsDelay ? '波未到达' : `${fmt(Math.abs(vy), 2)} m/s（${vy > 0 ? '向上' : '向下'}）`
    return data
  },
}

/** 第 i 个质点在 t 时刻的位移（m）：波未传到则为 0 */
function dispAt(i: number, st: S, params: SceneParams): number {
  const delay = (i * GAP) / PX_PER_M / params.v // 波从波源传到该质点的时间
  if (st.t <= delay) return 0
  return params.A * Math.sin(2 * Math.PI * params.f * (st.t - delay))
}
/** 观察质点位移 */
function obsDisp(st: S, params: SceneParams): number {
  return dispAt(st.obs, st, params)
}
