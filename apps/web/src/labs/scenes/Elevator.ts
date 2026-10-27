// 课件 5：超重与失重 · 电梯（高一·必修一）
// 真实楼层行程：按设定 a 加速 2s → 反向减速 2s → 停；体重计读数做成轿厢顶大屏，力箭头限制在轿厢内
import type { LabScene, LabState, LabData } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const SHAFT_L = 220 // 井道左壁
const SHAFT_R = 420 // 井道右壁
const TOP = 70 // 楼顶
const FLOOR = 390 // 底层
const PX_PER_M = 5 // 像素/米（竖直运动）
const CAB_H = 90
const ACC_T = 2 // 加速段时长 s（之后自动减速，行程更真实）

interface S extends LabState {
  y: number // 轿厢顶部 y 坐标
  vel: number // m/s（向上为正）
  phase: 0 | 1 | 2 // 0=加速段 1=减速段 2=已停
  stoppedBy: '' | 'top' | 'bottom' | 'trip' // 停止原因
}

export const elevatorScene: LabScene = {
  id: 'elevator-weight',
  title: '超重与失重 · 电梯',
  grade: '高一',
  chapter: '必修一 · 牛顿运动定律',
  desc: '真实楼层行程（加速→匀速→减速→停）：体重计读数 F=m(g+a)，超重/失重/完全失重三种状态',
  tags: ['超重', '失重', '牛顿第二定律', '视重', '完全失重'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'm', label: '人的质量 m', min: 40, max: 100, step: 5, unit: 'kg', default: 60, reset: false },
    { key: 'a', label: '电梯加速度 a（大小）', min: 0, max: 10, step: 0.5, unit: 'm/s²', default: 2, reset: false },
    {
      key: 'dir', label: '运动方向', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '向上（加速上升/减速下降）' }, { value: 1, label: '向下（加速下降/减速上升）' }],
    },
  ],
  presets: [
    { name: '加速上升（超重）', params: { m: 60, a: 3, dir: 0 } },
    { name: '匀速（平衡）', params: { m: 60, a: 0, dir: 0 } },
    { name: '加速下降（失重）', params: { m: 60, a: 3, dir: 1 } },
    { name: '完全失重 a=g', params: { m: 60, a: 9.8, dir: 1 } },
  ],
  formulas: [
    'F = m(g + a) \\quad (\\text{a 向上为正})',
    '\\text{超重：} a > 0 \\quad \\text{失重：} a < 0',
    '\\text{完全失重：} a = -g',
  ],
  keyPoints: [
    '超重/失重看的是加速度方向，不是速度方向：向上加速和向上减速状态完全相反',
    '视重 F = m(g+a)：a 向上为超重，a 向下为失重；a=−g 时完全失重，F=0',
    '匀速段 a=0：无论多快，视重都等于实重——电梯里感受不到匀速',
  ],
  challenge: {
    question: '电梯以 a = 9.8 m/s² 向下加速（完全失重），站在体重计上的人读数是多少？',
    options: ['等于 mg', '约 0.5mg', '0', '约 2mg'],
    answer: 2,
    explanation: '完全失重时人与体重计以同样的加速度下落，相互之间没有挤压——支持力 N = m(g − a) = 0，体重计读数为零。',
    reveal_preset: '完全失重 a=g',
  },
  init(): S {
    return { t: 0, y: FLOOR - CAB_H, vel: 0, phase: 0, stoppedBy: '' }
  },
  step(dt, params, state) {
    const st = state as S
    if (st.phase === 2) return
    const sgn = params.dir === 0 ? 1 : -1 // 速度方向（向上为正）
    const aMag = params.a
    // 实际加速度：加速段取 +sgn·a，减速段取 −sgn·a（对地加速度方向决定超/失重）
    const aEff = st.phase === 0 ? sgn * aMag : -sgn * aMag
    st.vel += aEff * dt
    // 减速段速度过零即停
    if (st.phase === 1 && ((sgn > 0 && st.vel <= 0) || (sgn < 0 && st.vel >= 0))) {
      st.vel = 0
      st.phase = 2
      st.stoppedBy = 'trip'
    }
    st.y -= st.vel * dt * PX_PER_M
    // 轿厢碰顶/触底：停住
    if (st.y < TOP) {
      st.y = TOP
      st.vel = 0
      st.phase = 2
      st.stoppedBy = 'top'
    }
    if (st.y > FLOOR - CAB_H) {
      st.y = FLOOR - CAB_H
      st.vel = 0
      st.phase = 2
      st.stoppedBy = 'bottom'
    }
    // 加速段计时到 ACC_T 转减速段
    st.t = (st.t ?? 0) + dt
    if (st.phase === 0 && (st.t ?? 0) >= ACC_T) st.phase = 1
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const m = params.m
    // 当前实际加速度（决定超/失重与体重计读数）
    const sgn = params.dir === 0 ? 1 : -1
    const aEff = st.phase === 2 ? 0 : st.phase === 0 ? sgn * params.a : -sgn * params.a
    const F = m * (G + aEff) // 体重计读数（视重）
    const ratio = F / (m * G)
    const data: LabData = {}

    // 井道
    ctx.set('shaft-l', 'line', { x1: SHAFT_L, y1: TOP - 10, x2: SHAFT_L, y2: FLOOR, stroke: 'currentColor', 'stroke-width': 3 })
    ctx.set('shaft-r', 'line', { x1: SHAFT_R, y1: TOP - 10, x2: SHAFT_R, y2: FLOOR, stroke: 'currentColor', 'stroke-width': 3 })
    ctx.set('floor', 'line', { x1: SHAFT_L - 30, y1: FLOOR, x2: SHAFT_R + 30, y2: FLOOR, stroke: 'currentColor', 'stroke-width': 3 })
    ctx.set('top', 'line', { x1: SHAFT_L - 30, y1: TOP - 10, x2: SHAFT_R + 30, y2: TOP - 10, stroke: 'currentColor', 'stroke-width': 3 })
    // 楼层刻度
    for (let i = 0; i <= 6; i++) {
      const y = FLOOR - i * 50
      ctx.set(`fl${i}`, 'line', { x1: SHAFT_L - 30, y1: y, x2: SHAFT_L - 20, y2: y, stroke: 'currentColor', 'stroke-opacity': 0.4 })
      ctx.set(`flt${i}`, 'text', { x: SHAFT_L - 34, y: y + 4, 'font-size': 13, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.5, text: `${i}F` })
    }

    // 轿厢
    const cy = st.y
    const cab = ctx.set('cab', 'rect', { x: SHAFT_L + 6, y: cy, width: SHAFT_R - SHAFT_L - 12, height: CAB_H, rx: 6, fill: '#c7d2fe', 'fill-opacity': 0.6, stroke: C.accent, 'stroke-width': 2 })
    ctx.drag(cab, (p) => {
      // 直接拖轿厢上下摆放（暂停时用于摆放位置）
      st.y = clamp(p.y - CAB_H / 2, TOP, FLOOR - CAB_H)
      st.vel = 0
      st.phase = 2
      st.stoppedBy = 'trip'
      ctx.requestRender()
    })
    // 轿厢顶部的「体重计大屏」（像电梯楼层屏，靠右放，不与 N 箭头标签重叠）
    ctx.set('scale-screen-bg', 'rect', { x: SHAFT_R - 116, y: cy + 4, width: 110, height: 22, rx: 4, fill: '#0f172a' })
    ctx.set('scale-screen', 'text', { x: SHAFT_R - 61, y: cy + 20, 'font-size': 16, 'text-anchor': 'middle', fill: '#7dd3fc', text: `${fmt(F, 0)} N` })

    // 体重计（轿厢底部）+ 人站在秤上
    ctx.set('scale', 'rect', { x: SHAFT_L + 40, y: cy + CAB_H - 14, width: 70, height: 10, rx: 3, fill: '#1e293b' })
    const px = SHAFT_L + 75
    ctx.set('p-head', 'circle', { cx: px, cy: cy + CAB_H - 42, r: 10, fill: '#fbbf24' })
    ctx.set('p-body', 'line', { x1: px, y1: cy + CAB_H - 32, x2: px, y2: cy + CAB_H - 14, stroke: '#fbbf24', 'stroke-width': 5, 'stroke-linecap': 'round' })

    // a 控制柄（井道右侧：拖 ↕ 改加速度大小）
    const gripX = SHAFT_R + 60
    const gripY = 230 - params.a * 15
    const grip = ctx.set('a-grip', 'circle', { cx: gripX, cy: gripY, r: 14, fill: '#fff', stroke: C.field, 'stroke-width': 3 })
    ctx.set('a-grip-t', 'text', { x: gripX, y: gripY + 4, 'font-size': 13, 'text-anchor': 'middle', fill: C.field, text: 'a' })
    ctx.set('a-axis', 'line', { x1: gripX, y1: 80, x2: gripX, y2: 380, stroke: 'currentColor', 'stroke-opacity': 0.2, 'stroke-dasharray': '4 4' })
    ctx.set('a-label', 'text', { x: gripX, y: 60, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: `拖我调 a（当前 ${fmt(params.a, 1)} m/s²）` })
    ctx.drag(grip, (p) => {
      ctx.setParam('a', clamp(Math.round((230 - p.y) / 15 * 2) / 2, 0, 10))
    })

    // 状态徽标（按当前实际加速度）
    let badge = ''
    let color = '#059669'
    if (st.phase === 2) {
      badge = st.stoppedBy === 'top' ? '已到顶端（已停止）' : st.stoppedBy === 'bottom' ? '已到底端（已停止）' : '行程结束（已停止）'
    } else if (Math.abs(aEff + G) < 0.3) {
      badge = '完全失重（a = -g）'
      color = C.warn
    } else if (aEff > 0.05) {
      badge = '超重（a > 0，视重 > 实重）'
      color = C.warn
    } else if (aEff < -0.05) {
      badge = '失重（a < 0，视重 < 实重）'
      color = '#2563eb'
    } else {
      badge = '平衡（a = 0，视重 = 实重）'
    }
    ctx.set('badge-bg', 'rect', { x: 470, y: 100, width: 150, height: 46, rx: 10, fill: color, 'fill-opacity': 0.12 })
    ctx.set('badge', 'text', { x: 545, y: 120, 'font-size': 13, 'text-anchor': 'middle', fill: color, text: badge.split('（')[0] })
    ctx.set('badge2', 'text', { x: 545, y: 138, 'font-size': 13, 'text-anchor': 'middle', fill: color, 'fill-opacity': 0.8, text: badge.split('（')[1]?.replace('）', '') ?? '' })

    // 受力（人）：重力 + 支持力（箭头限制在轿厢内）
    const personC: V = v(px, cy + CAB_H - 24)
    if (opts.showForces) {
      const gLen = 20 // G 箭头不穿出轿厢底
      drawArrow(ctx, 'fG', personC, add(personC, v(0, gLen)), { color: C.gravity, label: `G=${fmt(m * G, 0)}N` })
      const nLen = clamp((F / (m * G)) * 30, 4, 40) // 支持力箭头不超出轿厢顶
      drawArrow(ctx, 'fN', v(px - 14, personC.y), add(v(px - 14, personC.y), v(0, -nLen)), { color: C.normal, label: `N=${fmt(F, 0)}N` })
      // 加速度方向箭头（紫色，画在轿厢外侧右缘）
      if (Math.abs(aEff) > 0.05) drawArrow(ctx, 'fa', v(SHAFT_R - 10, cy + 45), add(v(SHAFT_R - 10, cy + 45), v(0, -clamp(aEff * 6, -40, 40))), { color: C.field, label: 'a' })
      else ctx.remove('fa', 'fa-head', 'fa-label')
      if (opts.showPoints) ctx.set('dot', 'circle', { cx: personC.x, cy: personC.y, r: 4, fill: '#111827' })
      else ctx.remove('dot')
    } else {
      ctx.remove('fG', 'fG-head', 'fG-label', 'fN', 'fN-head', 'fN-label', 'fa', 'fa-head', 'fa-label', 'dot')
    }

    data['体重计读数 F'] = `${fmt(F, 1)} N`
    data['实重 mg'] = `${fmt(m * G, 1)} N`
    data['视重/实重'] = `${fmt(ratio, 2)} 倍`
    data['当前加速度 a'] = `${fmt(aEff, 1)} m/s²（向上为正）`
    data['速度 v'] = `${fmt(st.vel, 2)} m/s（向上为正）`
    data['行程阶段'] = st.phase === 0 ? `加速中（0~${ACC_T}s）` : st.phase === 1 ? '减速中' : '已停止'
    data['状态'] = badge
    return data
  },
}
