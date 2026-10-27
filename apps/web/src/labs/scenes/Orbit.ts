// 课件 17：万有引力与卫星轨道（高一·必修二）
// 拖轨道半径 r 看 v/ω/a/T 的反比关系；「变轨点火」模式数值积分演示加速→离心→更高轨道椭圆
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const CENTER: V = v(320, 215)
const EARTH_R = 22 // 地球像素半径
const MU = 398600 // km³/s²（地球引力参数 GM）
const R_E = 6371 // 地球半径 km
const TIME_SCALE = 500 // 仿真时间加速倍数
const TRAIL_MAX = 320

/** 轨道半径（km）→ 像素（幂压缩，近地到月球同屏可见，非等比） */
function px(r: number): number {
  return 55 * Math.pow(r / R_E, 0.38)
}

interface S extends LabState {
  phi: number
  pos: V // km（相对地心，屏幕 y 向下即取负 y）
  vel: V // km/s
  trail: [number, number][]
  mode: number // 记录上帧模式，切换时重置
}

export const orbitScene: LabScene = {
  id: 'gravity-orbit',
  title: '万有引力与卫星轨道',
  grade: '高一',
  chapter: '必修二 · 万有引力与航天',
  desc: '拖轨道半径看 v=√(GM/r)、ω、a、T 反比关系；变轨点火演示加速→离心→椭圆高轨',
  tags: ['万有引力', '卫星', '宇宙速度', '轨道', '开普勒'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'r', label: '轨道半径 r', min: 6600, max: 420000, step: 100, unit: 'km', default: 6771, reset: false },
    {
      key: 'mode', label: '运行模式', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '圆轨道（精确）' }, { value: 1, label: '变轨点火（+18% 速度）' }],
    },
  ],
  presets: [
    { name: '近地卫星（400km）', params: { r: 6771, mode: 0 } },
    { name: '同步卫星（r=42164km）', params: { r: 42164, mode: 0 } },
    { name: '月球轨道（384400km）', params: { r: 384400, mode: 0 } },
    { name: '变轨点火演示', params: { r: 6771, mode: 1 } },
  ],
  formulas: [
    'v = \\sqrt{GM/r}',
    'T = 2\\pi\\sqrt{r^3/GM}',
    'a_{\\text{向}} = GM/r^2',
    '\\omega = \\sqrt{GM/r^3}',
  ],
  keyPoints: [
    '高轨低速大周期：r 越大，v、ω、a 越小，T 越大',
    '第一宇宙速度 7.9km/s 是最大环绕速度（近地轨道）',
    '变轨点火加速 → 速度超环绕速度 → 离心做椭圆运动，远地点更高',
  ],
  init(params: SceneParams): S {
    const st: S = { phi: -Math.PI / 2, pos: v(0, 0), vel: v(0, 0), trail: [], mode: params.mode }
    seedOrbit(st, params)
    return st
  },
  step(dt, params, state) {
    const st = state as S
    if (st.mode !== params.mode) {
      st.mode = params.mode
      seedOrbit(st, params)
    }
    const ts = dt * TIME_SCALE
    if (params.mode === 0) {
      // 圆轨道：解析解
      const w = Math.sqrt(MU / (params.r * params.r * params.r))
      st.phi += w * ts
      const pr = px(params.r)
      st.pos = v(params.r * Math.cos(st.phi), -params.r * Math.sin(st.phi))
      pushTrail(st, CENTER.x + pr * Math.cos(st.phi), CENTER.y - pr * Math.sin(st.phi))
    } else {
      // 变轨：半隐式欧拉数值积分（km、km/s 尺度）
      const d = Math.hypot(st.pos.x, st.pos.y) || 1
      const a = -MU / (d * d * d)
      st.vel = v(st.vel.x + a * st.pos.x * ts, st.vel.y + a * st.pos.y * ts)
      st.pos = v(st.pos.x + st.vel.x * ts, st.pos.y + st.vel.y * ts)
      const pr = px(d)
      pushTrail(st, CENTER.x + (st.pos.x / d) * pr, CENTER.y - (st.pos.y / d) * pr)
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const circular = params.mode === 0

    // 地球
    ctx.set('earth', 'circle', { cx: CENTER.x, cy: CENTER.y, r: EARTH_R, fill: '#3b82f6', stroke: '#1d4ed8', 'stroke-width': 2 })
    ctx.set('earth-l', 'text', { x: CENTER.x, y: CENTER.y + 4, 'font-size': 13, 'text-anchor': 'middle', fill: '#fff', text: '地球' })

    // 圆轨道参考圈（圆轨道模式）
    if (circular) {
      const pr = px(params.r)
      ctx.set('orbit', 'circle', { cx: CENTER.x, cy: CENTER.y, r: pr, fill: 'none', stroke: C.accent, 'stroke-opacity': 0.35, 'stroke-dasharray': '5 6' })
    } else ctx.remove('orbit')

    // 卫星位置
    let satP: V
    let velV: V
    if (circular) {
      const pr = px(params.r)
      satP = v(CENTER.x + pr * Math.cos(st.phi), CENTER.y - pr * Math.sin(st.phi))
      const vc = Math.sqrt(MU / params.r)
      velV = v(-Math.sin(st.phi) * vc, -Math.cos(st.phi) * vc) // 切向（俯视逆时针）
    } else {
      const d = Math.hypot(st.pos.x, st.pos.y) || 1
      const pr = px(d)
      satP = v(CENTER.x + (st.pos.x / d) * pr, CENTER.y - (st.pos.y / d) * pr)
      velV = st.vel
    }
    // 轨迹（变轨模式的椭圆踪迹）
    if (!circular && st.trail.length > 2) {
      ctx.set('trail', 'path', { d: `M${st.trail.map(([X, Y]) => `${X.toFixed(1)},${Y.toFixed(1)}`).join(' L')}`, fill: 'none', stroke: C.accent, 'stroke-opacity': 0.45, 'stroke-width': 1.5 })
    } else ctx.remove('trail')

    // 卫星（拖动改 r，仅圆轨道模式）
    const sat = ctx.set('sat', 'circle', { cx: satP.x, cy: satP.y, r: 7, fill: '#f59e0b', stroke: '#b45309', 'stroke-width': 2 })
    ctx.drag(sat, (p) => {
      const d = Math.hypot(p.x - CENTER.x, p.y - CENTER.y)
      // 反解像素 → km：r = R_E * (d/55)^(1/0.38)
      const rkm = clamp(R_E * Math.pow(d / 55, 1 / 0.38), 6600, 420000)
      ctx.setParam('r', Math.round(rkm / 100) * 100)
      seedOrbit(st, params)
      ctx.requestRender()
    })

    // 力与速度箭头
    if (opts.showForces) {
      const d = circular ? params.r : Math.hypot(st.pos.x, st.pos.y)
      const gAcc = MU / (d * d) // km/s² → 换算 m/s² ×1000
      const toC = v((CENTER.x - satP.x) / 100, (CENTER.y - satP.y) / 100)
      drawArrow(ctx, 'fg', satP, add(satP, toC), { color: C.gravity, label: `a=${fmt(gAcc * 1000, 2)}m/s²` })
      const vl = Math.hypot(velV.x, velV.y)
      if (vl > 0.01) drawArrow(ctx, 'fv', satP, add(satP, { x: (velV.x / vl) * 34, y: -(velV.y / vl) * 34 }), { color: C.tension, label: `v=${fmt(vl, 2)}km/s` })
      else ctx.remove('fv', 'fv-head', 'fv-label')
      if (opts.showPoints) ctx.set('dot-s', 'circle', { cx: satP.x, cy: satP.y, r: 2.5, fill: '#111827' })
      else ctx.remove('dot-s')
    } else {
      ctx.remove('fg', 'fg-head', 'fg-label', 'fv', 'fv-head', 'fv-label', 'dot-s')
    }

    // 提示（多行排布，避免超宽被截断）
    const tips: string[] = []
    if (circular) {
      tips.push('拖卫星改轨道半径：r 越大，v、ω、a 越小，T 越大')
      if (params.r < 6600 + 200) tips.push('r≈R地：第一宇宙速度 7.9km/s（最大环绕速度）')
      if (Math.abs(params.r - 42164) < 500) tips.push('同步卫星：T=24h，与地球自转同步')
    } else {
      tips.push('点火加速 → 离心进入椭圆轨道，远地点更高')
    }
    tips.push('⚠ 半径刻度为对数压缩，非等比')
    tips.forEach((tp, i) => {
      ctx.set(`tip${i}`, 'text', { x: 50, y: 34 + i * 17, 'font-size': 13, fill: i === tips.length - 1 ? 'currentColor' : C.warn, 'fill-opacity': i === tips.length - 1 ? 0.5 : 1, text: tp })
    })
    for (let i = tips.length; i < 5; i++) ctx.remove(`tip${i}`)

    const r = circular ? params.r : Math.hypot(st.pos.x, st.pos.y)
    const vNow = circular ? Math.sqrt(MU / params.r) : Math.hypot(st.vel.x, st.vel.y)
    const omega = Math.sqrt(MU / (r * r * r)) // rad/s
    const period = 2 * Math.PI / omega // 秒
    data['轨道半径 r'] = r >= 100000 ? `${fmt(r / 10000, 2)} 万km` : `${fmt(r, 0)} km`
    data['线速度 v=√(GM/r)'] = `${fmt(vNow, 3)} km/s`
    data['角速度 ω'] = `${fmt(omega, 5)} rad/s`
    data['向心加速度 GM/r²'] = `${fmt((MU / (r * r)) * 1000, 3)} m/s²`
    data['周期 T'] = period > 86400 ? `${fmt(period / 86400, 2)} 天` : period > 3600 ? `${fmt(period / 3600, 2)} h` : `${fmt(period / 60, 1)} min`
    data['模式'] = circular ? '圆轨道' : '变轨椭圆（数值积分）'
    return data
  },
}

/** 按当前参数重置卫星到环轨道状态 */
function seedOrbit(st: S, params: SceneParams) {
  const d = params.r
  const vc = Math.sqrt(MU / d)
  const boost = params.mode === 1 ? 1.18 : 1
  // 起点：卫星在地球正上方（屏幕坐标 y 向下，取 y = -r 即屏幕上方）
  st.pos = v(0, -d)
  st.vel = v(vc * boost, 0) // 切向
  st.trail = []
  pushTrail(st, CENTER.x, CENTER.y - px(d))
}

function pushTrail(st: S, X: number, Y: number) {
  const last = st.trail[st.trail.length - 1]
  if (last && Math.hypot(X - last[0], Y - last[1]) < 2) return
  st.trail.push([X, Y])
  if (st.trail.length > TRAIL_MAX) st.trail.shift()
}
