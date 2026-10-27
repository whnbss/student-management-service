// 课件 19：斜抛运动（高一·必修二）
// 拖 v0 与抛射角 θ：轨迹族叠加（历史参数轨迹留影）、45° 射程最大标注、射高/射程实时
// 坐标轴按当前射程/射高自适应缩放（轨迹占舞台 ≥70% 宽），刻度随之变化
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const ORIGIN: V = v(70, 360)
const GHOST_MAX = 4

interface Traj {
  /** 轨迹点（米制坐标 [x, y]，绘制时按当前比例换算屏幕像素，量程变化后旧轨迹不错位） */
  pts: [number, number][]
  label: string
}

interface S extends LabState {
  t: number
  lastKey: string // 参数指纹，变化时把旧轨迹存为「轨迹族」
  ghosts: Traj[]
  landedAt: number // 落地时刻（-1 未落地）
  landTimer: number // 落地后计时，用于自动重发
}

export const launchScene: LabScene = {
  id: 'angled-launch',
  title: '斜抛运动',
  grade: '高一',
  chapter: '必修二 · 抛体运动',
  desc: '拖 v0 与抛射角：轨迹族叠加对比，坐标轴随射程自适应缩放，45° 射程最大自动标注',
  tags: ['斜抛运动', '抛体运动', '运动的合成与分解', '射程'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'v0', label: '初速度 v0', min: 5, max: 40, step: 1, unit: 'm/s', default: 22, reset: false },
    { key: 'theta', label: '抛射角 θ', min: 5, max: 85, step: 1, unit: '°', default: 45, reset: false },
  ],
  presets: [
    { name: '45° 最远', params: { v0: 22, theta: 45 } },
    { name: '30° 平射', params: { v0: 22, theta: 30 } },
    { name: '60° 高抛', params: { v0: 22, theta: 60 } },
    { name: '75° 冲天炮', params: { v0: 30, theta: 75 } },
  ],
  formulas: [
    'x = v_0\\cos\\theta\\, t',
    'y = v_0\\sin\\theta\\, t - \\tfrac{1}{2}gt^2',
    'R = \\frac{v_0^2\\sin 2\\theta}{g}',
    'H = \\frac{v_0^2\\sin^2\\theta}{2g}',
  ],
  keyPoints: [
    '45° 时射程最大（sin2θ=1）；θ 与 90°−θ 等射程',
    '水平方向匀速、竖直方向竖直上抛——运动的合成与分解是处理曲线运动的基本方法',
    '同一高度抛出与落地：落地速率等于抛出速率（机械能守恒）',
  ],
  init(params: SceneParams): S {
    return { t: 0, lastKey: `${params.v0}|${params.theta}`, ghosts: [], landedAt: -1, landTimer: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    const key = `${params.v0}|${params.theta}`
    if (key !== st.lastKey) {
      // 参数变化：把当前轨迹存入轨迹族（米制坐标）
      st.ghosts.push({ pts: tracePtsM(params), label: `v0=${params.v0} θ=${params.theta}°` })
      if (st.ghosts.length > GHOST_MAX) st.ghosts.shift()
      st.lastKey = key
      st.t = 0
      st.landedAt = -1
      st.landTimer = 0
    }
    st.t += dt
    const tEnd = flightTime(params)
    if (st.t >= tEnd) {
      st.t = tEnd
      st.landedAt = tEnd
      st.landTimer += dt
      if (st.landTimer > 1) {
        st.landTimer = 0
        st.t = 0 // 自动重新发射
      }
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const rad = (params.theta * Math.PI) / 180
    const vx0 = params.v0 * Math.cos(rad)
    const vy0 = params.v0 * Math.sin(rad)
    const tEnd = flightTime(params)

    // —— 坐标自适应缩放：轨迹占舞台 ≥70% 宽、射高不越顶 ——
    const R = (params.v0 * params.v0 * Math.sin(2 * rad)) / G
    const H = (vy0 * vy0) / (2 * G)
    const PX = Math.min(500 * 0.72 / Math.max(R, 20), 290 / Math.max(H, 8), 12)
    const sx = (m: number) => ORIGIN.x + m * PX
    const sy = (m: number) => ORIGIN.y - m * PX

    // 地面 + 自适应标尺（约 8 个刻度，取「好数」步长）
    ctx.set('ground', 'rect', { x: 40, y: ORIGIN.y + 6, width: 580, height: 6, fill: '#94a3b8', rx: 2 })
    const stepM = niceStep(R / 8)
    for (let m = 0; m <= R * 1.15; m += stepM) {
      const X = sx(m)
      if (X > 620) break
      ctx.set(`gt${m}`, 'line', { x1: X, y1: ORIGIN.y + 12, x2: X, y2: ORIGIN.y + 18, stroke: 'currentColor', 'stroke-opacity': 0.4 })
      ctx.set(`gtl${m}`, 'text', { x: X, y: ORIGIN.y + 30, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.45, text: `${Math.round(m)}m` })
    }
    // 发射台（小炮台）
    ctx.set('cannon', 'rect', { x: ORIGIN.x - 8, y: ORIGIN.y - 10, width: 16, height: 12, fill: '#475569', rx: 2 })
    ctx.set('cannon-barrel', 'line', { x1: ORIGIN.x, y1: ORIGIN.y - 8, x2: ORIGIN.x + 26 * Math.cos(rad), y2: ORIGIN.y - 8 - 26 * Math.sin(rad), stroke: '#475569', 'stroke-width': 7, 'stroke-linecap': 'round' })

    // 轨迹族（历史留影，浅色；米制坐标按当前比例换算）
    st.ghosts.forEach((g, i) => {
      ctx.set(`ghost${i}`, 'path', { d: pathOfScreen(g.pts, sx, sy), fill: 'none', stroke: C.accent, 'stroke-opacity': 0.22, 'stroke-width': 2, 'stroke-dasharray': '2 5' })
    })
    for (let i = st.ghosts.length; i < GHOST_MAX; i++) ctx.remove(`ghost${i}`)

    // 当前理论轨迹（虚线）
    const cur = tracePtsM(params)
    ctx.set('traj', 'path', { d: pathOfScreen(cur, sx, sy), fill: 'none', stroke: C.accent, 'stroke-opacity': 0.65, 'stroke-width': 2, 'stroke-dasharray': '5 6' })

    // 45° 参考轨迹（同 v0，淡灰色 + 标注）
    const ref45 = tracePtsM({ v0: params.v0, theta: 45 })
    ctx.set('ref45', 'path', { d: pathOfScreen(ref45, sx, sy), fill: 'none', stroke: C.net, 'stroke-opacity': 0.25, 'stroke-width': 1.5 })
    const R45 = (params.v0 * params.v0) / G
    if (sx(R45) < 610) {
      ctx.set('ref45l', 'text', { x: sx(R45 * 0.5), y: sy((params.v0 * params.v0) / (2 * G)) - 10, 'font-size': 13, fill: C.net, 'fill-opacity': 0.45, 'text-anchor': 'middle', text: `45° 时射程最大 R=${fmt(R45, 1)}m` })
    } else ctx.remove('ref45l')

    // 小球（沿轨迹运动，可拖改 v0/θ——拖球=调 θ，配合滑块）
    const t = Math.min(st.t, tEnd)
    const bx = sx(vx0 * t)
    const by = sy(vy0 * t - 0.5 * G * t * t)
    const ball = ctx.set('ball', 'circle', { cx: bx, cy: by - 6, r: 8, fill: '#f59e0b', stroke: '#b45309', 'stroke-width': 2 })
    ctx.drag(ball, (p) => {
      // 拖球：水平方向映射抛射角（v0 不变），直观感受角度影响
      const dx = clamp(p.x - ORIGIN.x, 20, 560)
      const dy = clamp(ORIGIN.y - p.y, 10, 340)
      const ang = clamp(Math.round((Math.atan2(dy, dx) * 180) / Math.PI), 5, 85)
      ctx.setParam('theta', ang)
    })

    // 速度箭头（绿）与重力（红）
    if (opts.showForces) {
      const vx = vx0
      const vy = vy0 - G * t
      const spd = Math.hypot(vx, vy)
      if (spd > 0.3) drawArrow(ctx, 'fv', v(bx, by - 6), add(v(bx, by - 6), { x: (vx / spd) * (20 + spd * 0.9), y: -(vy / spd) * (20 + spd * 0.9) }), { color: C.tension, label: `v=${fmt(spd, 1)}m/s` })
      else ctx.remove('fv', 'fv-head', 'fv-label')
      drawArrow(ctx, 'fg', v(bx, by - 6), add(v(bx, by - 6), v(0, 30)), { color: C.gravity, label: 'g' })
      if (opts.showComponents) {
        drawArrow(ctx, 'fvx', v(bx, by - 6), add(v(bx, by - 6), v(vx * 0.9, 0)), { color: C.normal, component: true, label: `vx=${fmt(vx, 1)}` })
        drawArrow(ctx, 'fvy', v(bx, by - 6), add(v(bx, by - 6), v(0, -vy * 0.9)), { color: C.field, component: true, label: `vy=${fmt(vy, 1)}` })
      } else ctx.remove('fvx', 'fvx-head', 'fvx-label', 'fvy', 'fvy-head', 'fvy-label')
    } else {
      ctx.remove('fv', 'fv-head', 'fv-label', 'fg', 'fg-head', 'fg-label', 'fvx', 'fvx-head', 'fvx-label', 'fvy', 'fvy-head', 'fvy-label')
    }

    // 最高点与落点标记
    if (H > 0.5) {
      ctx.set('apex', 'circle', { cx: sx(vx0 * (vy0 / G)), cy: sy(H), r: 3, fill: C.warn })
      ctx.set('apexl', 'text', { x: sx(vx0 * (vy0 / G)) + 6, y: sy(H) - 4, 'font-size': 13, fill: C.warn, text: `H=${fmt(H, 1)}m` })
    } else ctx.remove('apex', 'apexl')
    ctx.set('land', 'line', { x1: sx(R), y1: ORIGIN.y, x2: sx(R), y2: ORIGIN.y - 16, stroke: C.accent, 'stroke-width': 2 })
    ctx.set('landl', 'text', { x: sx(R), y: ORIGIN.y - 20, 'font-size': 13, 'text-anchor': 'middle', fill: C.accent, text: `R=${fmt(R, 1)}m` })

    const tips: string[] = []
    if (Math.abs(params.theta - 45) < 1) tips.push('θ=45°：sin2θ=1，射程最大')
    else if (params.theta > 45) tips.push(`θ>45°：射高优先（与 θ=${90 - params.theta}° 等射程）`)
    else tips.push(`θ<45°：与 θ=${90 - params.theta}° 等射程`)
    if (st.ghosts.length) tips.push(`轨迹族 ${st.ghosts.length} 条（改参数即留影）`)
    ctx.set('tip', 'text', { x: 200, y: 40, 'font-size': 13, fill: C.warn, text: tips.join('；') })

    data['射程 R=v0²sin2θ/g'] = `${fmt(R, 2)} m`
    data['射高 H=v0²sin²θ/2g'] = `${fmt(H, 2)} m`
    data['飞行时间 T=2v0sinθ/g'] = `${fmt(tEnd, 2)} s`
    data['当前 t'] = `${fmt(t, 2)} s`
    data['当前速率'] = `${fmt(Math.hypot(vx0, vy0 - G * t), 2)} m/s`
    data['状态'] = st.t >= tEnd ? '已落地（自动重发）' : '飞行中'
    return data
  },
}

function flightTime(p: SceneParams): number {
  return (2 * p.v0 * Math.sin((p.theta * Math.PI) / 180)) / G
}

/** 理论轨迹点列（米制坐标） */
function tracePtsM(p: SceneParams): [number, number][] {
  const rad = (p.theta * Math.PI) / 180
  const vx0 = p.v0 * Math.cos(rad)
  const vy0 = p.v0 * Math.sin(rad)
  const tEnd = flightTime(p)
  const pts: [number, number][] = []
  for (let i = 0; i <= 60; i++) {
    const t = (tEnd * i) / 60
    pts.push([vx0 * t, vy0 * t - 0.5 * G * t * t])
  }
  return pts
}

/** 米制点列 → 屏幕 path */
function pathOfScreen(pts: [number, number][], sx: (m: number) => number, sy: (m: number) => number): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')
}

/** 取「好数」步长（1/2/5 × 10^n），刻度数字整齐 */
function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))))
  for (const mul of [1, 2, 5, 10]) {
    if (mul * pow >= raw) return mul * pow
  }
  return 10 * pow
}
