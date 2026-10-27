// 课件 34：多普勒效应（选择性必修一 · 机械波）
// 波源沿水平线运动，每隔一个周期发出一圈波前；观察者固定在右侧，
// 实测「观察者每秒收到的波前数」= f·v/(v−vs)；超波速时画出马赫锥
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt, dist } from '../engine/vec'

const TRACK_Y = 160
const OBS = { x: 500, y: 160 } // 观察者位置
const RING_MAX = 14 // 保留的波前圈数

interface Ring {
  x: number
  t0: number
  counted: boolean
}

interface S extends LabState {
  t: number
  sx: number // 波源当前位置
  dir: number // 运动方向（1 向右 / -1 向左）
  rings: Ring[]
  crossings: number[] // 观察者收到波前的时刻
  nextEmit: number
}

export const dopplerScene: LabScene = {
  id: 'doppler',
  title: '多普勒效应',
  grade: '高二',
  chapter: '选择性必修一 · 机械波',
  desc: '运动波源的波前疏密变化：接近变密（频率升高）、远离变疏，超波速出现马赫锥',
  tags: ['多普勒效应', '波源运动', '频率变化', '马赫锥'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'vs', label: '波源速度 vs（右正左负）', min: -160, max: 380, step: 10, unit: 'px/s', default: 120, reset: false },
    { key: 'v', label: '波速 v', min: 120, max: 320, step: 10, unit: 'px/s', default: 200, reset: false },
    { key: 'f', label: '发射频率 f', min: 0.5, max: 2.5, step: 0.1, unit: 'Hz', default: 1.2, reset: false },
  ],
  presets: [
    { name: '波源静止', params: { vs: 0, v: 200, f: 1.2 } },
    { name: '接近观察者', params: { vs: 120, v: 200, f: 1.2 } },
    { name: '远离观察者', params: { vs: -120, v: 200, f: 1.2 } },
    { name: '超波速·马赫锥', params: { vs: 300, v: 180, f: 1.2 } },
  ],
  formulas: [
    "f' = \\dfrac{f\\,v}{v - v_s}\\ \\text{（接近）}",
    "f' = \\dfrac{f\\,v}{v + v_s}\\ \\text{（远离）}",
    '\\sin\\alpha = \\dfrac{v}{v_s}\\ \\text{（马赫角）}',
  ],
  keyPoints: [
    '波源接近时波前被「压密」，观察者收到的频率变高；远离时变低——波源频率本身没变',
    '频率变化只发生在波源与观察者的连线方向上，与二者距离远近无关',
    '当 vs ≥ v 时波前在最前方堆积成马赫锥（超音速飞机的「音爆」）',
  ],
  init(): S {
    return { t: 0, sx: 60, dir: 1, rings: [], crossings: [], nextEmit: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    // 波源沿轨道往返运动，便于反复观察接近/远离两种情形
    st.dir = st.dir ?? (params.vs >= 0 ? 1 : -1)
    st.sx += params.vs * dt
    if (st.sx > 560) { st.sx = 560; st.dir = -1 }
    else if (st.sx < 60) { st.sx = 60; st.dir = 1 }

    // 到达发射时刻：记录当前位置为一圈波前的圆心
    if (st.t >= st.nextEmit) {
      st.rings.push({ x: st.sx, t0: st.t, counted: false })
      st.nextEmit = st.t + 1 / params.f
      if (st.rings.length > RING_MAX + 6) st.rings.shift()
    }
    // 波前到达观察者：计数（只在波源位于观察者左侧向右传播时计）
    for (const r of st.rings) {
      const radius = params.v * (st.t - r.t0)
      if (!r.counted && radius >= dist({ x: r.x, y: TRACK_Y }, OBS)) {
        r.counted = true
        st.crossings.push(st.t)
        if (st.crossings.length > 40) st.crossings.shift()
      }
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const supersonic = Math.abs(params.vs) >= params.v

    // 波前圆环：圆心固定在发射点，半径随时间扩大（疏密自动呈现）
    for (const r of st.rings) {
      const radius = params.v * (st.t - r.t0)
      if (radius <= 0 || radius > 620) continue
      ctx.set(`r${r.t0.toFixed(2)}`, 'circle', {
        cx: r.x, cy: TRACK_Y, r: radius,
        fill: 'none', stroke: C.accent, 'stroke-opacity': r.counted ? 0.25 : 0.5, 'stroke-width': 1.6,
      })
      if (st.rings.length > RING_MAX) ctx.remove(`r${st.rings[0].t0.toFixed(2)}`)
    }

    // 马赫锥（超波速）：从波源出发的两条锥线
    if (supersonic) {
      const alpha = Math.asin(params.v / Math.abs(params.vs))
      const L = 160
      const dx = L * Math.cos(alpha) * (params.vs >= 0 ? -1 : 1)
      ctx.set('mach1', 'line', { x1: st.sx, y1: TRACK_Y, x2: st.sx + dx, y2: TRACK_Y - L * Math.sin(alpha), stroke: C.warn, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' })
      ctx.set('mach2', 'line', { x1: st.sx, y1: TRACK_Y, x2: st.sx + dx, y2: TRACK_Y + L * Math.sin(alpha), stroke: C.warn, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' })
    } else ctx.remove('mach1', 'mach2')

    // 观察者（右端固定）
    ctx.set('obs-body', 'circle', { cx: OBS.x, cy: TRACK_Y - 22, r: 9, fill: 'none', stroke: C.tension, 'stroke-width': 2.5 })
    ctx.set('obs-hd', 'circle', { cx: OBS.x, cy: TRACK_Y - 38, r: 6, fill: C.tension })
    ctx.set('obs-l', 'text', { x: OBS.x, y: TRACK_Y + 34, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '观察者' })

    // 波源（小车）
    ctx.set('src', 'rect', { x: st.sx - 16, y: TRACK_Y - 12, width: 32, height: 18, rx: 4, fill: C.accentDeep })
    ctx.set('src-w1', 'circle', { cx: st.sx - 9, cy: TRACK_Y + 7, r: 4, fill: C.ink })
    ctx.set('src-w2', 'circle', { cx: st.sx + 9, cy: TRACK_Y + 7, r: 4, fill: C.ink })
    ctx.set('src-l', 'text', { x: st.sx, y: TRACK_Y - 22, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: `vs=${fmt(params.vs, 0)}` })

    // 轨道
    ctx.set('track', 'line', { x1: 40, y1: TRACK_Y + 12, x2: 600, y2: TRACK_Y + 12, stroke: 'currentColor', 'stroke-opacity': 0.2 })

    // 提示
    const approaching = st.sx < OBS.x && params.vs > 0
    const leaving = (params.vs < 0 && st.sx > 60) || st.sx >= OBS.x
    const ahead = st.sx <= OBS.x
    const fAhead = (params.f * params.v) / Math.max(params.v - params.vs, 0.05)
    const fBehind = (params.f * params.v) / (params.v + Math.abs(params.vs))
    ctx.set('tip', 'text', {
      x: 40, y: 40, 'font-size': 13, fill: C.warn,
      text: supersonic
        ? `超波速！波前堆积成马赫锥，锥内才听得到声音（马赫角 ${fmt((Math.asin(params.v / Math.abs(params.vs)) * 180) / Math.PI, 0)}°）`
        : ahead
          ? `波源在观察者左侧${approaching ? '接近中：前方波前变密，接收频率升高' : leaving ? '已越过：后方波前变疏，接收频率降低' : ''}`
          : '波源已越过观察者（在右侧远离）',
    })

    // 实测接收频率：最近 5 秒收到的波前数 / 5
    const recent = st.crossings.filter((tc) => st.t - tc <= 5)
    const measured = recent.length / Math.min(st.t, 5)

    data['波源速度 vs'] = `${fmt(params.vs, 0)} px/s（${params.vs > 0 ? '向右' : params.vs < 0 ? '向左' : '静止'}）`
    data['发射频率 f'] = `${fmt(params.f, 1)} Hz`
    data['前方理论频率'] = supersonic ? '—（超波速）' : `${fmt(fAhead, 2)} Hz`
    data['后方理论频率'] = `${fmt(fBehind, 2)} Hz`
    data['观察者实测频率'] = `${fmt(measured, 2)} Hz（近5s收到${recent.length}个波前）`
    data['状态'] = supersonic ? '超波速（马赫锥）' : approaching ? '接近 → 频率升高' : '远离 → 频率降低'
    if (opts.showForces) {
      ctx.set('hint2', 'text', { x: 40, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '圆环=每隔一个周期发出的波前；圆心固定在发射时的位置' })
    } else ctx.remove('hint2')
    return data
  },
}
