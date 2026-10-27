// 课件 18：功、功率与机车启动（高一·必修二）
// 功的定义：拖力箭头看 W=Flcosα；机车：恒功率/恒加速两种启动的 v-t 与功率过程
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const GROUND_Y = 320
const START_X = 80
const PX_PER_M = 5
const SAMPLE = 0.25

interface S extends LabState {
  t: number
  x: number // 位移（米）
  vel: number
  switched: boolean // 恒加速阶段是否已到额定功率
  pts: [number, number][] // v-t
  nextSample: number
  lastKey: string // 功模式：记录 F/α 变化
}

export const powerScene: LabScene = {
  id: 'power-locomotive',
  title: '功、功率与机车启动',
  grade: '高一',
  chapter: '必修二 · 机械能守恒定律',
  desc: 'W=Flcosα 拖力演示；机车恒功率/恒加速两种启动的 v-t 图像与最大速度',
  tags: ['功', '功率', '机车启动', '机械能', 'P=Fv'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    {
      key: 'mode', label: '模式', min: 0, max: 2, step: 1, unit: '', default: 1,
      options: [{ value: 0, label: '功的定义 W=Flcosα' }, { value: 1, label: '恒功率启动' }, { value: 2, label: '恒加速启动' }],
    },
    { key: 'F', label: '拉力 F（功模式）', min: 10, max: 200, step: 5, unit: 'N', default: 50, modes: [0], reset: false },
    { key: 'alpha', label: '拉力角 α（功模式）', min: 0, max: 90, step: 5, unit: '°', default: 30, modes: [0], reset: false },
    { key: 'm', label: '机车质量 m', min: 500, max: 3000, step: 100, unit: 'kg', default: 1000, modes: [1, 2], reset: false },
    { key: 'P', label: '额定功率 P', min: 10, max: 100, step: 5, unit: 'kW', default: 40, modes: [1, 2], reset: false },
    { key: 'f', label: '阻力 f', min: 200, max: 8000, step: 100, unit: 'N', default: 2000, modes: [1, 2], reset: false },
    { key: 'F0', label: '恒加速牵引力 F0', min: 2000, max: 30000, step: 500, unit: 'N', default: 5000, modes: [2], reset: false },
  ],
  presets: [
    { name: '功的定义（30° 拉力）', params: { mode: 0, F: 50, alpha: 30, m: 1000, P: 40, f: 2000, F0: 5000 } },
    { name: '恒功率启动', params: { mode: 1, F: 50, alpha: 30, m: 1000, P: 40, f: 2000, F0: 5000 } },
    { name: '恒加速启动', params: { mode: 2, F: 50, alpha: 30, m: 1000, P: 40, f: 2000, F0: 5000 } },
    { name: '恒加速·更大 F0', params: { mode: 2, F: 50, alpha: 30, m: 1000, P: 40, f: 2000, F0: 8000 } },
  ],
  formulas: [
    'W = Fl\\cos\\alpha',
    'P = Fv',
    'v_{max} = P/f',
    '\\text{恒加速段：} a = (F_0 - f)/m',
  ],
  keyPoints: [
    'W = Fl·cosα：力与位移垂直时（α=90°）不做功',
    '恒功率启动：F=P/v 随 v 增大而减小，a 逐渐变小，v 趋近 vmax=P/f',
    '恒加速启动：先匀加速（F0 恒定），实际功率达到额定功率后转恒功率段',
  ],
  init(params: SceneParams): S {
    return {
      t: 0,
      x: 0,
      vel: params.mode >= 1 ? 1 : 0,
      switched: false,
      pts: [[0, params.mode >= 1 ? 1 : 0]],
      nextSample: SAMPLE,
      lastKey: `${params.F}|${params.alpha}`,
    }
  },
  step(dt, params, state) {
    const st = state as S
    st.t = (st.t ?? 0) + dt
    if (params.mode === 0) {
      // 功的定义：物块匀速被拉，W 随位移累积
      st.x += 1.2 * dt
      if (st.x >= 24) st.x = 0
      return
    }
    const P = params.P * 1000
    if (params.mode === 1) {
      // 恒功率：a = (P/v − f)/m
      const v = Math.max(st.vel, 0.5)
      const a = (P / v - params.f) / params.m
      st.vel = Math.max(0, st.vel + a * dt)
      st.x += st.vel * dt
      if (P / st.vel <= params.f + 0.5) st.vel = P / params.f // 到最大速度
    } else {
      // 恒加速 → 额定功率后转恒功率
      if (!st.switched) {
        const a = (params.F0 - params.f) / params.m
        st.vel += a * dt
        st.x += st.vel * dt
        if (params.F0 * st.vel >= P) st.switched = true
      } else {
        const v = Math.max(st.vel, 0.5)
        const a = (P / v - params.f) / params.m
        st.vel = Math.max(0, st.vel + a * dt)
        st.x += st.vel * dt
      }
    }
    if (st.x >= 40) {
      st.x = 40
      st.vel = 0
    }
    if (st.t >= st.nextSample) {
      st.pts.push([Number(st.t.toFixed(2)), st.vel])
      st.nextSample += SAMPLE
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const P = params.P * 1000

    if (params.mode === 0) {
      // —— 功的定义：斜向上拉物块 ——
      ctx.set('ground', 'rect', { x: 40, y: GROUND_Y + 26, width: 560, height: 8, fill: C.faint, rx: 2 })
      const bx = START_X + st.x * PX_PER_M
      const bw = 64
      const block = ctx.set('block', 'rect', { x: bx - bw / 2, y: GROUND_Y - 16, width: bw, height: 42, rx: 6, fill: C.accentDeep, stroke: C.indigoDeep, 'stroke-width': 2 })
      ctx.drag(block, (p) => {
        st.x = clamp((p.x - START_X) / PX_PER_M, 0, 24)
        ctx.requestRender()
      })
      // 力箭头：从物块沿 α 方向，端点可拖（改变 F 与 α）
      const c = v(bx, GROUND_Y + 4)
      const rad = (params.alpha * Math.PI) / 180
      const tip = add(c, { x: params.F * 1.6 * Math.cos(rad), y: -params.F * 1.6 * Math.sin(rad) })
      drawArrow(ctx, 'fPull', c, tip, { color: C.tension, label: `F=${fmt(params.F, 0)}N ∠${params.alpha}°` })
      const tipEl = ctx.set('ftip', 'circle', { cx: tip.x, cy: tip.y, r: 10, fill: C.surface, 'fill-opacity': 0.95, stroke: C.tension, 'stroke-width': 2 })
      ctx.drag(tipEl, (p) => {
        const dx = clamp(p.x - c.x, 8, 320)
        const dy = c.y - p.y
        const L = Math.hypot(dx, dy)
        ctx.setParam('F', clamp(Math.round((L / 1.6) / 5) * 5, 10, 200))
        ctx.setParam('alpha', clamp(Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 5) * 5, 0, 90))
      })
      // 分量虚线
      if (opts.showComponents) {
        drawArrow(ctx, 'fx', c, add(c, v(params.F * 1.6 * Math.cos(rad), 0)), { color: C.net, component: true, label: `Fcosα=${fmt(params.F * Math.cos(rad), 1)}N` })
      } else ctx.remove('fx', 'fx-head', 'fx-label')
      // 位移标注
      ctx.set('distline', 'line', { x1: START_X, y1: GROUND_Y + 44, x2: bx, y2: GROUND_Y + 44, stroke: C.accent, 'stroke-width': 2 })
      ctx.set('distlabel', 'text', { x: (START_X + bx) / 2, y: GROUND_Y + 58, 'font-size': 13, 'text-anchor': 'middle', fill: C.accent, text: `l=${fmt(st.x, 2)} m` })
      ctx.set('tip', 'text', { x: 70, y: 44, 'font-size': 13, fill: C.warn, text: '拖箭头端点改 F 与 α；α=90° 时力不做功（W=0）' })
      if (ctx.gw) ctx.gclear()
      const W = params.F * st.x * Math.cos(rad)
      data['功 W=Flcosα'] = `${fmt(W, 1)} J`
      data['水平分量 Fcosα'] = `${fmt(params.F * Math.cos(rad), 1)} N`
      data['竖直分量 Fsinα'] = `${fmt(params.F * Math.sin(rad), 1)} N`
      data['位移 l'] = `${fmt(st.x, 2)} m`
      return data
    }

    // —— 机车启动 ——
    ctx.set('road', 'rect', { x: 40, y: GROUND_Y + 16, width: 560, height: 10, fill: C.faint, rx: 3 })
    const bx = START_X + st.x * PX_PER_M
    ctx.set('car-body', 'rect', { x: bx - 30, y: GROUND_Y - 20, width: 60, height: 20, rx: 5, fill: C.accentDeep, stroke: C.indigoDeep, 'stroke-width': 2 })
    ctx.set('car-chim', 'rect', { x: bx + 12, y: GROUND_Y - 32, width: 8, height: 14, fill: C.indigoDeep })
    ctx.set('car-w1', 'circle', { cx: bx - 16, cy: GROUND_Y + 2, r: 7, fill: C.navy })
    ctx.set('car-w2', 'circle', { cx: bx + 16, cy: GROUND_Y + 2, r: 7, fill: C.navy })

    const vMax = P / params.f
    const vSwitch = P / params.F0
    const traction = params.mode === 1 ? P / Math.max(st.vel, 0.5) : st.switched ? P / Math.max(st.vel, 0.5) : params.F0
    if (opts.showForces) {
      drawArrow(ctx, 'fF', v(bx, GROUND_Y + 8), add(v(bx, GROUND_Y + 8), v(Math.min(traction, 30000) * 0.006, 0)), { color: C.tension, label: `F=${fmt(Math.min(traction, 30000), 0)}N` })
      drawArrow(ctx, 'ff', v(bx, GROUND_Y + 8), add(v(bx, GROUND_Y + 8), v(-params.f * 0.006, 0)), { color: C.friction, label: `f=${fmt(params.f, 0)}N` })
    } else ctx.remove('fF', 'fF-head', 'fF-label', 'ff', 'ff-head', 'ff-label')

    const tips: string[] = []
    if (params.mode === 1) tips.push(`恒功率：F=P/v 随 v 增大而减小，v→vmax=P/f=${fmt(vMax, 1)} m/s`)
    else {
      if (!st.switched) tips.push(`恒加速段：a=(F0−f)/m=${fmt((params.F0 - params.f) / params.m, 2)} m/s²，到 v=${fmt(vSwitch, 1)} m/s 达额定功率`)
      else tips.push(`已转恒功率段：F=P/v 减小，v→vmax=${fmt(vMax, 1)} m/s`)
    }
    if (st.x >= 40) tips.push('已到最右端，点「重置」再来')
    ctx.set('tip', 'text', { x: 70, y: 44, 'font-size': 13, fill: C.warn, text: tips.join('；') })

    // v-t 图像
    if (ctx.gw) {
      const box = { x: 44, y: 24, w: ctx.gw - 70, h: ctx.gh - 66 }
      const yMax = Math.max(15, Math.ceil(vMax * 1.2))
      axes(ctx, box, { xLabel: 't/s', yLabel: 'v/(m/s)', xMax: 60, yMax })
      polyline(ctx, 'g-vt', st.pts, box, 0, 60, 0, yMax, C.accent)
      // vmax 参考线
      ctx.gset('g-vmax', 'line', { x1: box.x, y1: gy(box, 0, yMax, vMax), x2: box.x + box.w, y2: gy(box, 0, yMax, vMax), stroke: C.friction, 'stroke-dasharray': '6 4', 'stroke-opacity': 0.8 })
      ctx.gset('g-vmaxl', 'text', { x: box.x + 6, y: gy(box, 0, yMax, vMax) - 5, 'font-size': 13, fill: C.friction, text: `vmax=P/f=${fmt(vMax, 1)}` })
      // 恒加速→恒功率切换点
      if (params.mode === 2 && vSwitch < vMax) {
        const tSwitch = vSwitch / ((params.F0 - params.f) / params.m)
        const X = gx(box, 0, 60, tSwitch)
        ctx.gset('g-sw', 'line', { x1: X, y1: box.y, x2: X, y2: box.y + box.h, stroke: C.warn, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.7 })
        ctx.gset('g-swl', 'text', { x: X + 4, y: box.y + 12, 'font-size': 13, fill: C.warn, text: `达额定功率 t=${fmt(tSwitch, 1)}s` })
      } else ctx.remove('g-sw', 'g-swl')
    }
    data['模式'] = params.mode === 1 ? '恒功率启动' : '恒加速启动'
    data['当前牵引力 F'] = `${fmt(Math.min(traction, 30000), 0)} N`
    data['速度 v'] = `${fmt(st.vel, 2)} m/s`
    data['最大速度 vmax=P/f'] = `${fmt(vMax, 2)} m/s`
    data['当前功率'] = `${fmt((Math.min(traction, 30000) * st.vel) / 1000, 1)} kW`
    data['额定功率 P'] = `${fmt(params.P, 0)} kW`
    return data
  },
}
