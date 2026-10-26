// 课件 11：自由落体与竖直上抛（高一·必修一）
// 拖小球改释放高度 h，v0 可正（上抛）可负（下抛），反弹系数 e 可选；x-t / v-t 双图像同步绘制
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const GROUND_Y = 370 // 地面
const BALL_X = 190 // 小球横坐标
const PX_PER_M = 7 // 像素/米（h 最大 45m ≈ 315px）
const SAMPLE = 0.25 // 采样间隔 s

interface S extends LabState {
  y: number // 高度（米，距地面）
  vy: number // 速度（m/s，向上为正）
  t: number
  pts: [number, number][] // y-t
  vpts: [number, number][] // v-t
  nextSample: number
  bounces: number
  rest: boolean // 已静止
}

export const freeFallScene: LabScene = {
  id: 'free-fall',
  title: '自由落体与竖直上抛',
  grade: '高一',
  chapter: '必修一 · 匀变速直线运动',
  desc: '拖小球改高度，v0 上抛/下抛可调，反弹系数可选，x-t 与 v-t 图像同步',
  tags: ['自由落体', '竖直上抛', '匀变速直线运动', '重力加速度'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'h', label: '初始高度 h', min: 0, max: 45, step: 0.5, unit: 'm', default: 20 },
    { key: 'v0', label: '初速度 v0（上正下负）', min: -25, max: 25, step: 1, unit: 'm/s', default: 0 },
    { key: 'e', label: '反弹系数 e', min: 0, max: 0.9, step: 0.1, unit: '', default: 0, reset: false },
  ],
  presets: [
    { name: '自由落体', params: { h: 20, v0: 0, e: 0 } },
    { name: '竖直上抛', params: { h: 0, v0: 20, e: 0 } },
    { name: '竖直下抛', params: { h: 30, v0: -10, e: 0 } },
    { name: '落地反弹', params: { h: 20, v0: 0, e: 0.6 } },
  ],
  formulas: [
    'h = \\tfrac{1}{2}gt^2 \\quad v = gt',
    'v^2 = 2gh',
    'h = v_0 t - \\tfrac{1}{2}gt^2',
  ],
  keyPoints: [
    '自由落体是初速为 0、加速度为 g 的匀加速直线运动，与质量无关',
    '竖直上抛对称性：上升与回落同一高度处速率相等；全程时间 t = 2v₀/g',
    'v-t 图是斜率为 −g 的直线；x-t 是抛物线（反弹时折返）',
  ],
  init(params: SceneParams): S {
    return {
      y: params.h,
      vy: params.v0,
      t: 0,
      pts: [[0, params.h]],
      vpts: [[0, params.v0]],
      nextSample: SAMPLE,
      bounces: 0,
      rest: params.h === 0 && params.v0 === 0,
    }
  },
  step(dt, params, state) {
    const st = state as S
    if (st.rest) return
    st.vy -= G * dt
    st.y += st.vy * dt
    st.t += dt
    if (st.y <= 0) {
      st.y = 0
      if (params.e > 0 && -st.vy > 0.6) {
        st.vy = -st.vy * params.e // 反弹：速率乘 e
        st.bounces++
      } else {
        st.vy = 0
        st.rest = true
      }
    }
    if (st.t >= st.nextSample) {
      st.pts.push([Number(st.t.toFixed(2)), st.y])
      st.vpts.push([Number(st.t.toFixed(2)), st.vy])
      st.nextSample += SAMPLE
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}

    // 地面与标尺
    ctx.set('ground', 'rect', { x: 40, y: GROUND_Y, width: 560, height: 8, fill: '#94a3b8', rx: 2 })
    ctx.set('ground-hatch', 'line', { x1: 40, y1: GROUND_Y + 8, x2: 600, y2: GROUND_Y + 8, stroke: 'currentColor', 'stroke-opacity': 0.15, 'stroke-width': 6 })
    for (let m = 0; m <= 45; m += 5) {
      const y = GROUND_Y - m * PX_PER_M
      ctx.set(`tick${m}`, 'line', { x1: 96, y1: y, x2: 108, y2: y, stroke: 'currentColor', 'stroke-opacity': 0.4 })
      if (m % 10 === 0) {
        ctx.set(`tickl${m}`, 'text', { x: 90, y: y + 4, 'font-size': 10, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.5, text: `${m}m` })
      }
    }
    // 高度指示虚线
    if (st.y > 0.2) {
      ctx.set('hline', 'line', { x1: BALL_X, y1: GROUND_Y, x2: BALL_X, y2: ballY(st.y), stroke: C.accent, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.6 })
      ctx.set('hlabel', 'text', { x: BALL_X + 6, y: (GROUND_Y + ballY(st.y)) / 2, 'font-size': 11, fill: C.accent, text: `h=${fmt(st.y, 1)}m` })
    } else {
      ctx.remove('hline', 'hlabel')
    }

    // 小球（可竖直拖动改 h；拖动只对未开始时生效——用 t 判断）
    const by = ballY(st.y)
    const ball = ctx.set('ball', 'circle', { cx: BALL_X, cy: by, r: 13, fill: '#4f46e5', stroke: '#312e81', 'stroke-width': 2 })
    ctx.drag(ball, (p) => {
      const h = clamp((GROUND_Y - p.y) / PX_PER_M, 0, 45)
      ctx.setParam('h', Math.round(h * 2) / 2)
      if ((st.t ?? 0) === 0) st.y = h // 尚未启动时实时跟随
      ctx.requestRender()
    })
    // 「拖我」提示（未开始播放时显示）
    if ((st.t ?? 0) === 0 && !st.rest) {
      ctx.set('drag-hint', 'text', { x: BALL_X + 20, y: by - 14, 'font-size': 12, fill: C.accent, text: '↕ 拖我改高度' })
    } else ctx.remove('drag-hint')

    // 速度与重力箭头（g 为示意箭头，固定可见长度）
    const center = v(BALL_X, by)
    if (opts.showForces) {
      if (Math.abs(st.vy) > 0.3) drawArrow(ctx, 'fv', center, add(center, v(0, -st.vy * 3.5)), { color: C.normal, label: `v=${fmt(st.vy, 1)}m/s` })
      else ctx.remove('fv', 'fv-head', 'fv-label')
      drawArrow(ctx, 'fg', add(center, v(22, 0)), add(add(center, v(22, 0)), v(0, 64)), { color: C.gravity, label: 'g=9.8m/s²' })
      if (opts.showPoints) ctx.set('dot-b', 'circle', { cx: BALL_X, cy: by, r: 3, fill: '#111827' })
      else ctx.remove('dot-b')
    } else {
      ctx.remove('fv', 'fv-head', 'fv-label', 'fg', 'fg-head', 'fg-label', 'dot-b')
    }

    // 模式提示
    const tips: string[] = []
    if (params.v0 > 0) tips.push('竖直上抛：先减速上升，到最高点后自由下落')
    else if (params.v0 < 0) tips.push('竖直下抛')
    else tips.push('自由落体：初速为 0，只受重力')
    if (params.e > 0) tips.push(`反弹系数 e=${fmt(params.e, 1)}，每次反弹速率变为 e 倍`)
    if (st.rest) tips.push('已落地静止，点「重置」再来')
    ctx.set('tip', 'text', { x: 130, y: 40, 'font-size': 12, fill: C.warn, text: tips.join('；') })

    // 图像面板：上 y-t、下 v-t
    if (ctx.gw) {
      const half = (ctx.gh - 78) / 2
      const box1 = { x: 44, y: 18, w: ctx.gw - 70, h: half }
      const box2 = { x: 44, y: 18 + half + 46, w: ctx.gw - 70, h: half }
      const tMax = 8
      axes(ctx, box1, { xLabel: 't/s', yLabel: 'h/m', xMax: tMax, yMax: 45 })
      polyline(ctx, 'g-yt', st.pts, box1, 0, tMax, 0, 45, C.accent)
      axes(ctx, box2, { xLabel: 't/s', yLabel: 'v/(m/s)', xMax: tMax, yMax: 30, yMin: -30 })
      polyline(ctx, 'g-vt', st.vpts, box2, 0, tMax, -30, 30, C.normal)
      // v=0 参考线
      ctx.gset('g-zero', 'line', { x1: box2.x, y1: gy(box2, -30, 30, 0), x2: box2.x + box2.w, y2: gy(box2, -30, 30, 0), stroke: 'currentColor', 'stroke-opacity': 0.2, 'stroke-dasharray': '3 3' })
   }
    data['时间 t'] = `${fmt(st.t, 2)} s`
    data['高度 h'] = `${fmt(st.y, 2)} m`
    data['速度 v'] = `${fmt(st.vy, 2)} m/s`
    data['反弹次数'] = String(st.bounces)
    data['状态'] = st.rest ? '已静止' : params.v0 > 0 && st.vy > 0 ? '上升中' : st.y > 0 ? '下落中' : '刚落地'
    return data
  },
}

function ballY(y: number): number {
  return GROUND_Y - y * PX_PER_M - 13
}
