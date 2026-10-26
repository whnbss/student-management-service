// 课件 16：拱桥与凹桥（高一·必修二）
// 车沿桥面匀速行驶：拖 v 看 N=mg∓mv²/R 的变化；拱桥 N<0 时真抛体「飞车」——脱离桥面沿切向飞出画抛物线
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const CENTER: V = v(320, 500) // 桥面圆弧的圆心（屏幕坐标）
const R_PX = 200 // 桥面弧的像素半径
const A0 = (225 * Math.PI) / 180 // 起点角（左）
const A1 = (315 * Math.PI) / 180 // 终点角（右）
const ATOP = (270 * Math.PI) / 180 // 桥顶角

interface S extends LabState {
  a: number // 当前弧上角位置（rad，A0→A1）
  air: { pos: V; vel: V; trail: V[] } | null // 飞车抛体状态
}

export const bridgeScene: LabScene = {
  id: 'bridge',
  title: '拱桥与凹桥 · 失重与超重',
  grade: '高一',
  chapter: '必修二 · 曲线运动',
  desc: '车过桥顶/桥底：N=mg∓mv²/R 实时计算，v 超过 √(gR) 桥面托不住 → 真实抛体飞车演示',
  tags: ['圆周运动', '向心力', '超重失重', '拱桥', '支持力', '抛体运动'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'mode', label: '桥型', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '拱桥（凸）' }, { value: 1, label: '凹桥（凹）' }],
    },
    { key: 'v', label: '车速 v', min: 2, max: 30, step: 0.5, unit: 'm/s', default: 8, reset: false },
    { key: 'R', label: '桥面圆弧半径 R', min: 20, max: 80, step: 5, unit: 'm', default: 40, reset: false },
    { key: 'm', label: '车质量 m', min: 500, max: 2000, step: 100, unit: 'kg', default: 1000, reset: false },
  ],
  presets: [
    { name: '拱桥·慢速', params: { mode: 0, v: 8, R: 40, m: 1000 } },
    { name: '拱桥·临界飞车 v=√(gR)', params: { mode: 0, v: 19.8, R: 40, m: 1000 } },
    { name: '拱桥·飞车！', params: { mode: 0, v: 25, R: 40, m: 1000 } },
    { name: '凹桥·超重', params: { mode: 1, v: 15, R: 40, m: 1000 } },
  ],
  formulas: [
    '\\text{拱桥顶：} N = mg - m\\frac{v^2}{R}',
    '\\text{凹桥底：} N = mg + m\\frac{v^2}{R}',
    '\\text{飞车临界：} v_c = \\sqrt{gR}',
  ],
  keyPoints: [
    '拱桥顶 N = mg − mv²/R < mg：失重；凹桥底 N = mg + mv²/R > mg：超重',
    '拱桥顶恰好飞车（N=0）时 mg 全部充当向心力：vc = √(gR)',
    '飞车后车只受重力，做平抛/斜抛运动，桥面对它再无作用力',
  ],
  init(): S {
    return { a: A0, air: null }
  },
  step(dt, params, state) {
    const st = state as S
    const convex = params.mode === 0
    // 换桥型：清掉抛体
    if (st.air && !convex) st.air = null

    if (st.air) {
      // —— 抛体运动：只受重力（屏幕 y 向下，重力加速度换算到像素）——
      const pxPerM = R_PX / params.R
      const gPx = G * pxPerM
      st.air.vel = add(st.air.vel, v(0, gPx * dt))
      st.air.pos = add(st.air.pos, scalePx(st.air.vel, dt))
      st.air.trail.push(v(st.air.pos.x, st.air.pos.y))
      if (st.air.trail.length > 90) st.air.trail.shift()
      // 落出画面：重新上桥
      if (st.air.pos.y > 460 || st.air.pos.x < -40 || st.air.pos.x > 680) {
        st.air = null
        st.a = A0
      }
      return
    }

    // 桥上行驶：角速度 = v / R（按像素比例换算到屏幕弧）
    const pxPerM = R_PX / params.R
    const omega = (params.v * pxPerM) / R_PX
    st.a += omega * dt

    if (convex) {
      // 拱桥：径向 N/m = g·cosΔ − v²/R（Δ 为与桥顶的夹角）；N≤0 处脱离桥面做抛体
      const delta = Math.abs(st.a - ATOP)
      const nPerM = G * Math.cos(delta) - (params.v * params.v) / params.R
      if (nPerM <= 0) {
        // 脱离：速度沿切线方向（a 增大方向）
        const carP = v(CENTER.x + R_PX * Math.cos(st.a), CENTER.y + R_PX * Math.sin(st.a))
        const tang = v(-Math.sin(st.a), Math.cos(st.a))
        st.air = { pos: carP, vel: scalePx(tang, params.v), trail: [carP] }
      }
    }
    if (!st.air && st.a > A1) st.a = A0 // 到对岸后重新上桥
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const convex = params.mode === 0
    const vCritical = Math.sqrt(G * params.R)
    const flying = convex && !!st.air

    // 桥面弧（凸：圆心在下方，取上弧；凹：取下弧的一段）
    const pts: string[] = []
    const n = 60
    for (let i = 0; i <= n; i++) {
      const a = A0 + ((A1 - A0) * i) / n
      const X = CENTER.x + R_PX * Math.cos(a)
      const Y = CENTER.y + R_PX * Math.sin(a)
      pts.push(`${X.toFixed(1)},${Y.toFixed(1)}`)
    }
    if (convex) {
      ctx.set('arc', 'path', { d: `M${pts.join(' L')}`, fill: 'none', stroke: '#64748b', 'stroke-width': 6 })
      ctx.set('ground-l', 'rect', { x: 20, y: CENTER.y + R_PX * Math.sin(A0) - 4, width: CENTER.x + R_PX * Math.cos(A0) - 14, height: 8, fill: '#94a3b8' })
      ctx.set('ground-r', 'rect', { x: CENTER.x + R_PX * Math.cos(A1) + 6, y: CENTER.y + R_PX * Math.sin(A1) - 4, width: 620 - (CENTER.x + R_PX * Math.cos(A1)), height: 8, fill: '#94a3b8' })
    } else {
      // 凹桥：画一段下凹弧（圆心在上方屏幕外，用倒置弧近似）
      const pts2: string[] = []
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const X = 80 + t * 480
        const Y = 250 + 90 * Math.sin(Math.PI * t) // 下凹：中间低
        pts2.push(`${X.toFixed(1)},${Y.toFixed(1)}`)
      }
      ctx.set('arc', 'path', { d: `M${pts2.join(' L')}`, fill: 'none', stroke: '#64748b', 'stroke-width': 6 })
      ctx.set('ground-l', 'rect', { x: 20, y: 246, width: 66, height: 8, fill: '#94a3b8' })
      ctx.set('ground-r', 'rect', { x: 554, y: 246, width: 66, height: 8, fill: '#94a3b8' })
    }

    // 车位置：桥上用弧坐标，飞车后用抛体坐标
    let carP: V
    let carAir = false
    if (st.air) {
      carP = st.air.pos
      carAir = true
    } else if (convex) {
      carP = v(CENTER.x + R_PX * Math.cos(st.a), CENTER.y + R_PX * Math.sin(st.a))
    } else {
      const t = (st.a - A0) / (A1 - A0)
      carP = v(80 + clamp(t, 0, 1) * 480, 250 + 90 * Math.sin(Math.PI * clamp(t, 0, 1)))
    }
    // 桥面法线方向（背离圆心 / 凹桥最低点竖直向上）
    const normalUp = convex ? v((carP.x - CENTER.x) / R_PX, (carP.y - CENTER.y) / R_PX) : v(0, -1)
    // 凹桥的 N=mg+mv²/R 仅在桥底（最低点）成立
    const atBottom = !convex && Math.abs(st.a - ATOP) < 0.12
    const N = convex ? params.m * (G - (params.v * params.v) / params.R) : params.m * (G + (params.v * params.v) / params.R)
    const Nshow = Math.max(N, 0)

    // 飞车抛物线残影（虚线）
    if (st.air && st.air.trail.length > 1) {
      ctx.set('fly-trail', 'path', {
        d: `M${st.air.trail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`,
        fill: 'none', stroke: C.warn, 'stroke-width': 2, 'stroke-dasharray': '4 5', 'stroke-opacity': 0.7,
      })
    } else ctx.remove('fly-trail')

    // 车体（沿桥面切向倾斜；飞行中沿速度方向）
    let ang: number
    if (carAir) {
      ang = (Math.atan2(st.air!.vel.y, st.air!.vel.x) * 180) / Math.PI
    } else {
      const tang = convex ? v(-Math.sin(st.a), Math.cos(st.a)) : v(1, 0)
      ang = (Math.atan2(tang.y, tang.x) * 180) / Math.PI
    }
    const tf = `translate(${carP.x},${carP.y - 10}) rotate(${carAir ? ang : convex ? ang : ang * 0.4})`
    const carBody = ctx.set('car-body', 'rect', { x: -24, y: -16, width: 48, height: 18, rx: 5, fill: '#4f46e5', stroke: '#312e81', 'stroke-width': 2, transform: tf })
    ctx.set('car-top', 'rect', { x: -14, y: -26, width: 26, height: 12, rx: 4, fill: '#818cf8', stroke: '#312e81', 'stroke-width': 1.5, transform: tf })
    ctx.set('car-w1', 'circle', { cx: -13, cy: 4, r: 5, fill: '#1e293b', transform: tf })
    ctx.set('car-w2', 'circle', { cx: 13, cy: 4, r: 5, fill: '#1e293b', transform: tf })
    ctx.remove('car')
    // 车可拖（拖车身沿弧摆放；飞行中拖拽恢复到桥面）
    ctx.drag(carBody, (p) => {
      st.air = null
      if (convex) {
        const a = Math.atan2(p.y - CENTER.y, p.x - CENTER.x)
        st.a = clamp(a, A0, A1)
      } else {
        const t = clamp((p.x - 80) / 480, 0, 1)
        st.a = A0 + t * (A1 - A0)
      }
      ctx.requestRender()
    })

    // 力箭头：G 向下，N 沿法线（背离圆心；飞行中脱离桥面无 N）
    if (opts.showForces) {
      drawArrow(ctx, 'fg', carP, add(carP, v(0, params.m * G * 0.004)), { color: C.gravity, label: `G=${fmt((params.m * G) / 1000, 1)}kN` })
      if (!carAir) {
        const nEnd = add(carP, { x: normalUp.x * Nshow * 0.004, y: normalUp.y * Nshow * 0.004 })
        drawArrow(ctx, 'fn', carP, nEnd, { color: C.normal, label: `N=${fmt(N / 1000, 2)}kN` })
      } else ctx.remove('fn', 'fn-head', 'fn-label')
      // 向心力示意（凸桥顶：G 与 N 的合力提供向心力，指向圆心）
      if (opts.showComponents && !carAir) {
        const fNet = Math.abs((params.m * params.v * params.v) / params.R)
        const dirC = convex ? v(0, 1) : v(0, -1)
        drawArrow(ctx, 'fnet', add(carP, v(30, -14)), add(add(carP, v(30, -14)), { x: dirC.x * fNet * 0.02, y: dirC.y * fNet * 0.02 }), { color: C.net, dashed: true, label: '向心力 mv²/R' })
      } else ctx.remove('fnet', 'fnet-head', 'fnet-label')
    } else {
      ctx.remove('fg', 'fg-head', 'fg-label', 'fn', 'fn-head', 'fn-label', 'fnet', 'fnet-head', 'fnet-label')
    }

    // 状态提示
    const tips: string[] = []
    if (carAir) tips.push('飞车中：脱离桥面只受重力，做抛体运动（虚线为轨迹残影）')
    else if (flying || (convex && params.v > vCritical)) tips.push(`v > vc=√(gR)=${fmt(vCritical, 1)} m/s：桥面托不住车，N<0 → 飞车做抛体`)
    else if (convex && params.v > vCritical * 0.95) tips.push(`接近飞车临界 vc=√(gR)=${fmt(vCritical, 2)} m/s`)
    if (!convex && !carAir) tips.push('凹桥：N=mg+mv²/R 以桥底（最低点）计算，斜坡段数值不适用')
    ctx.set('tip', 'text', { x: 60, y: 40, 'font-size': 12, fill: C.warn, text: tips.join('；') })
    if (carAir) {
      ctx.set('fly-hint', 'text', { x: carP.x + 30, y: carP.y - 30, 'font-size': 16, fill: C.gravity, text: '✈ 抛体飞行！' })
    } else ctx.remove('fly-hint')

    data['桥型'] = convex ? '拱桥（凸）' : '凹桥（凹）'
    data['支持力 N'] = carAir ? '0（已脱离桥面）' : `${fmt(N / 1000, 3)} kN${!convex ? '（桥底值）' : ''}`
    data['重力 mg'] = `${fmt((params.m * G) / 1000, 2)} kN`
    data['向心加速度 v²/R'] = `${fmt((params.v * params.v) / params.R, 2)} m/s²`
    data['飞车临界 vc=√(gR)'] = `${fmt(vCritical, 2)} m/s`
    data['状态'] = carAir ? '抛体飞行（N=0）' : convex && params.v > vCritical ? '即将飞车（N<0）' : N > params.m * G ? '超重' : N < params.m * G * 0.999 ? '失重' : '正常'
    return data
  },
}

/** 标量 × 矢量 */
function scalePx(a: V, s: number): V {
  return v(a.x * s, a.y * s)
}
