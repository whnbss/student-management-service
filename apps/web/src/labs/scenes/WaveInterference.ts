// 课件 33：波的干涉（选择性必修一 · 机械波）
// 两个同频相干波源：波纹圆环动画 + 场点强弱分布网格 + 可拖探测点判读「加强/减弱」
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt, dist } from '../engine/vec'

const S1_BASE = { x: 250, y: 210 }
const S2_BASE = { x: 420, y: 210 }
const GRID = 20 // 强弱分布网格步长

interface S extends LabState {
  t: number
  s1x: number
  s2x: number
  probe: { x: number; y: number }
  cacheKey: string
  dotOn: boolean[] // 网格点是否已建
  destructive: boolean[] // 网格点是否处于减弱区
}

export const waveInterferenceScene: LabScene = {
  id: 'wave-interference',
  title: '波的干涉',
  grade: '高二',
  chapter: '选择性必修一 · 机械波',
  desc: '两相干波源波纹叠加：拖探测点按路程差 Δr 判加强/减弱，红色为减弱区',
  tags: ['波的干涉', '相干波源', '路程差', '加强区', '减弱区'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'lam', label: '波长 λ', min: 20, max: 90, step: 2, unit: 'px', default: 44, reset: false },
    { key: 'd', label: '源间距 d', min: 40, max: 240, step: 4, unit: 'px', default: 120, reset: false },
    { key: 'v', label: '波速（动画）', min: 40, max: 200, step: 10, unit: 'px/s', default: 90, reset: false },
  ],
  presets: [
    { name: 'd≈3λ 经典图样', params: { lam: 44, d: 128, v: 90 } },
    { name: '间距加大 节线变密', params: { lam: 40, d: 208, v: 90 } },
    { name: '波长加大 条纹变疏', params: { lam: 76, d: 128, v: 90 } },
    { name: '中垂线必为加强区', params: { lam: 44, d: 128, v: 90 }, state: { probe: { x: 540, y: 210 } } },
  ],
  formulas: [
    '|\\Delta r|=n\\lambda\\ (n=0,1,2\\dots) \\Rightarrow \\text{加强}',
    '|\\Delta r|=\\left(n+\\tfrac{1}{2}\\right)\\lambda \\Rightarrow \\text{减弱}',
    '\\text{相干条件：同频、恒定相位差}',
  ],
  keyPoints: [
    '产生稳定干涉的必要条件：两列波频率相同、相位差恒定、振动方向相同',
    '到两波源路程差为波长整数倍的点加强（振动始终最强）；半波长奇数倍的点减弱',
    '中垂线上路程差恒为 0，一定是加强区；间距 d 越大、λ 越小，强弱区越密',
  ],
  init(): S {
    return {
      t: 0,
      s1x: S1_BASE.x, s2x: S2_BASE.x,
      probe: { x: 545, y: 120 },
      cacheKey: '',
      dotOn: [],
      destructive: [],
    }
  },
  step(dt, _params, state) {
    ;(state as S).t += dt
  },
  render(ctx, params, state): LabData {
    const st = state as S
    const data: LabData = {}
    // 间距变化以中线为对称中心展开
    const cxp = (S1_BASE.x + S2_BASE.x) / 2
    st.s1x = cxp - params.d / 2
    st.s2x = cxp + params.d / 2

    // —— 强弱分布网格（仅在参数变化时重算，动画帧不重复计算）——
    const key = `${params.lam}|${params.d}|${ctx.w}x${ctx.h}`
    const cols = Math.floor((ctx.w - 40) / GRID)
    const rows = Math.floor((ctx.h - 60) / GRID)
    if (key !== st.cacheKey) {
      st.cacheKey = key
      st.dotOn = new Array(cols * rows).fill(false)
      st.destructive = new Array(cols * rows).fill(false)
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = 30 + i * GRID
          const y = 30 + j * GRID
          const dr = Math.abs(dist({ x, y }, { x: st.s1x, y: S1_BASE.y }) - dist({ x, y }, { x: st.s2x, y: S2_BASE.y }))
          const k = dr / params.lam
          const near = (target: number) => Math.abs(k - target) < 0.22
          st.dotOn[i * rows + j] = near(0) || near(1) || near(2)
          st.destructive[i * rows + j] = near(0.5) || near(1.5) || near(2.5)
        }
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const idx = i * rows + j
        const x = 30 + i * GRID
        const y = 30 + j * GRID
        if (st.destructive[idx]) {
          ctx.set(`d${idx}`, 'circle', { cx: x, cy: y, r: 2.4, fill: C.warn, 'fill-opacity': 0.35 })
        } else if (st.dotOn[idx]) {
          ctx.set(`d${idx}`, 'circle', { cx: x, cy: y, r: 2.4, fill: C.tension, 'fill-opacity': 0.28 })
        } else {
          ctx.remove(`d${idx}`)
        }
      }
    }

    // —— 两波源发出的波纹圆环（峰实线 / 谷虚线，透明度随环序衰减）——
    const omega = (2 * Math.PI * params.v) / params.lam
    for (let s = 0; s < 2; s++) {
      const sx = s === 0 ? st.s1x : st.s2x
      const sy = S1_BASE.y
      for (let k = 0; k < 7; k++) {
        // 第 k 个波峰：t-kT 时刻发出，半径 v·(t-kT)
        const r = params.v * (st.t - k / (params.v / params.lam)) // = v·t − kλ
        if (r <= 0 || r > 560) continue
        const op = 0.55 * (1 - k / 7)
        ctx.set(`c${s}-${k}`, 'circle', { cx: sx, cy: sy, r, fill: 'none', stroke: C.accent, 'stroke-opacity': op, 'stroke-width': 1.6 })
        const rg = r - params.lam / 2
        if (rg > 0 && rg < 560) {
          ctx.set(`c${s}-g${k}`, 'circle', { cx: sx, cy: sy, r: rg, fill: 'none', stroke: C.accent, 'stroke-opacity': op * 0.45, 'stroke-width': 1.2, 'stroke-dasharray': '4 4' })
        } else ctx.remove(`c${s}-g${k}`)
      }
    }

    // —— 探测点（可任意拖动）——
    const p = st.probe
    const r1 = dist(p, { x: st.s1x, y: S1_BASE.y })
    const r2 = dist(p, { x: st.s2x, y: S2_BASE.y })
    const dr = Math.abs(r1 - r2)
    const kk = dr / params.lam
    const nearInt = Math.min(Math.abs(kk - 0), Math.abs(kk - 1), Math.abs(kk - 2)) < 0.18
    const nearHalf = Math.min(Math.abs(kk - 0.5), Math.abs(kk - 1.5), Math.abs(kk - 2.5)) < 0.18
    const probeEl = ctx.set('probe', 'circle', {
      cx: p.x, cy: p.y, r: 8,
      fill: nearInt ? C.tension : nearHalf ? C.warn : C.faint,
      stroke: C.dash, 'stroke-width': 2,
    })
    ctx.drag(probeEl, (pt) => {
      st.probe = { x: clamp(pt.x, 10, ctx.w - 10), y: clamp(pt.y, 10, ctx.h - 10) }
      ctx.requestRender()
    })
    ctx.set('probe-l', 'text', {
      x: p.x + 12, y: p.y - 10, 'font-size': 13, 'font-weight': 600,
      fill: nearInt ? C.tension : nearHalf ? C.warn : 'currentColor',
      text: nearInt ? `加强（Δr≈${fmt(kk, 2)}λ）` : nearHalf ? `减弱（Δr≈${fmt(kk, 2)}λ）` : `介于强弱之间（Δr/λ=${fmt(kk, 2)}）`,
    })
    // 探测点到两源的距离虚线
    ctx.set('l1', 'line', { x1: st.s1x, y1: S1_BASE.y, x2: p.x, y2: p.y, stroke: 'currentColor', 'stroke-opacity': 0.3, 'stroke-dasharray': '3 3' })
    ctx.set('l2', 'line', { x1: st.s2x, y1: S2_BASE.y, x2: p.x, y2: p.y, stroke: 'currentColor', 'stroke-opacity': 0.3, 'stroke-dasharray': '3 3' })

    // —— 波源（可拖改间距）——
    for (let s = 0; s < 2; s++) {
      const sx = s === 0 ? st.s1x : st.s2x
      const el = ctx.set(`s${s}`, 'circle', { cx: sx, cy: S1_BASE.y, r: 10, fill: C.accentDeep, stroke: C.indigoDeep, 'stroke-width': 2 })
      ctx.drag(el, (pt) => {
        const half = Math.abs(pt.x - cxp)
        ctx.setParam('d', clamp(Math.round(half * 2 / 4) * 4, 40, 240))
        ctx.requestRender()
      })
      ctx.set(`s${s}-l`, 'text', { x: sx, y: S1_BASE.y + 26, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: `S${s + 1}` })
    }

    ctx.set('legend', 'text', { x: 40, y: ctx.h - 16, 'font-size': 13, fill: C.tension, 'fill-opacity': 0.8, text: '● 绿点：加强区（Δr=nλ）　● 红点：减弱区（Δr=(n+½)λ）' })
    ctx.set('tip', 'text', { x: 40, y: 26, 'font-size': 13, fill: C.warn, text: '拖白边探测点判断加强/减弱；拖波源改间距 d' })

    data['源间距 d'] = `${fmt(params.d, 0)} px`
    data['波长 λ'] = `${fmt(params.lam, 0)} px`
    data['探测点 r₁'] = fmt(r1, 0)
    data['探测点 r₂'] = fmt(r2, 0)
    data['路程差 Δr'] = `${fmt(dr, 1)} px（${fmt(kk, 2)}λ）`
    data['该点振动'] = nearInt ? '加强（振动始终最强）' : nearHalf ? '减弱（几乎不振）' : '介于之间'
    return data
  },
}
