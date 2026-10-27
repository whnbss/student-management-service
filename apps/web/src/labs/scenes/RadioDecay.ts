// 课件 41：放射性衰变与半衰期（选择性必修三 · 原子物理）
// 100 个放射性核按概率衰变：剩余数 N=N₀·2^(−t/T)，
// 右图 N-t 曲线带半衰期分隔线，衰变是统计规律、无法预言单个核
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, fmt } from '../engine/vec'
import { axes, gx, gy, polyline } from '../engine/graph'

const GRID_COLS = 20
const N0 = 100
const CELL = 15
const ORIGIN_X = 90
const ORIGIN_Y = 60
const SAMPLE = 0.25

interface S extends LabState {
  t: number
  alive: boolean[]
  flash: number[] // 刚衰变的核闪烁计时（下标→剩余闪烁时间）
  pts: [number, number][]
  nextSample: number
}

export const radioDecayScene: LabScene = {
  id: 'radio-decay',
  title: '放射性衰变与半衰期',
  grade: '高三',
  chapter: '选择性必修三 · 原子物理',
  desc: '100 个核的衰变模拟：N=N₀·2^(−t/T)，每个半衰期剩一半，统计规律不预言个体',
  tags: ['半衰期', '放射性衰变', '统计规律', '原子核'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'T', label: '半衰期 T', min: 1, max: 10, step: 0.5, unit: 's', default: 3, reset: false },
  ],
  presets: [
    { name: '快衰变 T=1.5s', params: { T: 1.5 } },
    { name: '标准 T=3s', params: { T: 3 } },
    { name: '慢衰变 T=8s', params: { T: 8 } },
  ],
  formulas: [
    'N = N_0\\cdot 2^{-t/T}',
    'm = m_0\\cdot 2^{-t/T}',
    '\\text{半衰期由核自身决定，与温度/压强/状态无关}',
  ],
  keyPoints: [
    '半衰期是统计规律：对大量原子核成立，不能预言某一个核何时衰变',
    '每经过一个半衰期，剩余未衰变的核数减半（不是「再衰变一半需要同样多的时间」的错误理解）',
    '半衰期由原子核内部自身决定，与温度、压强、化学状态无关，不能用物理/化学方法改变',
  ],
  init(): S {
    return { t: 0, alive: new Array(N0).fill(true), flash: new Array(N0).fill(0), pts: [[0, N0]], nextSample: SAMPLE }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    // 每个未衰变核在 dt 内以 p=ln2/T·dt 的概率衰变
    const p = (Math.LN2 / params.T) * dt
    for (let i = 0; i < N0; i++) {
      if (st.alive[i] && Math.random() < p) {
        st.alive[i] = false
        st.flash[i] = 0.4
      }
      if (st.flash[i] > 0) st.flash[i] -= dt
    }
    if (st.t >= st.nextSample) {
      st.pts.push([Number(st.t.toFixed(2)), st.alive.filter(Boolean).length])
      st.nextSample += SAMPLE
    }
  },
  render(ctx, params, state): LabData {
    const st = state as S
    const data: LabData = {}
    const aliveCount = st.alive.filter(Boolean).length

    // 核阵列（实心=未衰变，空心+闪烁=已衰变）
    for (let i = 0; i < N0; i++) {
      const x = ORIGIN_X + (i % GRID_COLS) * CELL
      const y = ORIGIN_Y + Math.floor(i / GRID_COLS) * CELL
      if (st.alive[i]) {
        ctx.set(`n${i}`, 'circle', { cx: x, cy: y, r: 5.5, fill: '#4f46e5' })
        ctx.remove(`nd${i}`, `nf${i}`)
      } else {
        ctx.set(`nd${i}`, 'circle', { cx: x, cy: y, r: 5.5, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-width': 1.2 })
        if (st.flash[i] > 0) {
          ctx.set(`nf${i}`, 'circle', { cx: x, cy: y, r: 6 + (0.4 - st.flash[i]) * 16, fill: 'none', stroke: C.warn, 'stroke-opacity': st.flash[i] / 0.4, 'stroke-width': 2 })
        } else ctx.remove(`nf${i}`)
        ctx.remove(`n${i}`)
      }
    }
    ctx.set('legend1', 'text', { x: ORIGIN_X, y: 46, 'font-size': 13, fill: C.accent, text: `● 未衰变 ${aliveCount}` })
    ctx.set('legend2', 'text', { x: ORIGIN_X + 150, y: 46, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.55, text: '○ 已衰变（闪烁=刚衰变）' })

    // 理论曲线对比提示
    const theory = N0 * Math.pow(2, -st.t / params.T)
    const nHalf = Math.floor(st.t / params.T)
    ctx.set('tip', 'text', {
      x: 60, y: ctx.h - 18, 'font-size': 13, fill: C.warn,
      text: `已历 ${fmt(nHalf, 0)} 个半衰期：理论剩 ${fmt(theory, 1)} 个（统计规律只对大量核近似成立）`,
    })

    // 图像面板：N-t 曲线 + 半衰期分隔线
    if (ctx.gw) {
      const box = { x: 44, y: 20, w: ctx.gw - 70, h: ctx.gh - 62 }
      const tMax = 30
      axes(ctx, box, { xLabel: 't/s', yLabel: '剩余核数 N', xMax: tMax, yMax: 100 })
      polyline(ctx, 'g-nt', st.pts, box, 0, tMax, 0, 100, C.accent)
      for (let k = 1; k <= 4; k++) {
        const X = gx(box, 0, tMax, k * params.T)
        if (X > box.x + box.w) break
        ctx.gset(`g-h${k}`, 'line', { x1: X, y1: box.y, x2: X, y2: box.y + box.h, stroke: C.warn, 'stroke-opacity': 0.35, 'stroke-dasharray': '4 3' })
        ctx.gset(`g-hl${k}`, 'text', { x: X + 3, y: box.y + 12 + (k - 1) * 12, 'font-size': 13, fill: C.warn, text: `${k}T→${N0 / 2 ** k}` })
      }
    }

    data['时间 t'] = `${fmt(st.t, 1)} s`
    data['剩余未衰变 N'] = `${aliveCount} / ${N0}`
    data['已衰变'] = `${N0 - aliveCount}`
    data['剩余比例'] = `${fmt((aliveCount / N0) * 100, 1)} %`
    data['理论值 N₀·2^(-t/T)'] = fmt(theory, 1)
    return data
  },
}
