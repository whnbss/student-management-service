// 课件 4：牛顿第二定律小车（高一·必修一）
// 气垫导轨小车经滑轮挂钩码：拖质量手柄改 M/m，μ 滑块；实时 a、v、T 与 v-t 图像逐秒绘制
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const TRACK_Y = 300 // 导轨高度
const PULLEY: V = v(470, 285) // 滑轮
const PX_PER_M = 55 // 像素/米
const CART_START: V = v(120, TRACK_Y - 26) // 小车初始位置（左上角）

interface S extends LabState {
  x: number // 小车位移（米）
  vel: number // 速度 m/s
  stuck: boolean // 拉不动
  finished: boolean
  pts: [number, number][] // v-t 记录
  nextSample: number
}

export const cartScene: LabScene = {
  id: 'newton-second-cart',
  title: '牛顿第二定律 · 小车与滑轮',
  grade: '高一',
  chapter: '必修一 · 牛顿运动定律',
  desc: '绳跨滑轮挂钩码：a=F/(M+m) 实时验证，v-t 图像逐秒绘制，控制变量演示',
  tags: ['牛顿第二定律', '加速度', '摩擦力', '连接体', '绳张力'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'M', label: '小车质量 M', min: 0.2, max: 2, step: 0.1, unit: 'kg', default: 0.6, reset: false },
    { key: 'm', label: '钩码质量 m', min: 0.02, max: 0.5, step: 0.02, unit: 'kg', default: 0.2, reset: false },
    { key: 'mu', label: '摩擦因数 μ', min: 0, max: 0.5, step: 0.02, unit: '', default: 0, reset: false },
  ],
  presets: [
    { name: '理想无摩擦', params: { M: 0.6, m: 0.2, mu: 0 } },
    { name: '有摩擦', params: { M: 0.6, m: 0.2, mu: 0.15 } },
    { name: '拉不动（μ 大）', params: { M: 1.2, m: 0.05, mu: 0.4 } },
    { name: '整体法演示', params: { M: 0.4, m: 0.4, mu: 0 } },
  ],
  formulas: [
    'a = \\frac{mg - \\mu Mg}{M + m}',
    'T = m(g - a)',
    'f = \\mu Mg',
  ],
  keyPoints: [
    '绳张力 T = m(g−a) < mg：钩码失重，不能把 mg 直接当拉力',
    '整体法 a = (mg−μMg)/(M+m)，隔离法对小车 T − μMg = Ma，两法结果一致',
    '实验中「钩码质量 ≪ 小车质量」时才可近似认为 T ≈ mg',
  ],
  challenge: {
    question: '小车 M = 0.6 kg，钩码 m = 0.2 kg，轨道无摩擦。释放后小车的加速度是多少？',
    options: ['约 2.5 m/s²', '约 3.3 m/s²', '约 13.3 m/s²', '无法确定'],
    answer: 0,
    explanation: '对整体用牛顿第二定律：a = mg / (M + m) = 0.2×10 / 0.8 = 2.5 m/s²。注意分母是总质量——误用 a = mg/M 会得 3.3 m/s²（错在漏了钩码也在加速）。',
    reveal_preset: '理想无摩擦',
  },
  init(): S {
    return { t: 0, x: 0, vel: 0, stuck: false, finished: false, pts: [[0, 0]], nextSample: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    const a = accel(params)
    if (a === 0 && st.vel === 0) {
      st.stuck = true
    }
    if (a !== 0 && !st.finished) {
      st.vel += a * dt
      st.x += st.vel * dt
      // 到达终点：钩码落地（最多下落 ~60px）或小车撞滑轮
      if (st.x >= 2) {
        st.x = 2
        st.finished = true
      }
      // 逐 0.5 秒采样 v-t
      st.t = (st.t ?? 0) + dt
      if (st.t >= st.nextSample) {
        st.pts.push([Number(st.t.toFixed(2)), st.vel])
        st.nextSample += 0.5
      }
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const a = accel(params)
    const f = params.mu * params.M * G
    const T = Math.max(params.m * (G - a), 0)
    const data: LabData = {}

    // 导轨
    ctx.set('track', 'rect', { x: 60, y: TRACK_Y + 18, width: 420, height: 10, fill: C.faint, rx: 3 })
    ctx.set('track-legs', 'line', { x1: 80, y1: TRACK_Y + 28, x2: 80, y2: 380, stroke: 'currentColor', 'stroke-opacity': 0.4 })
    ctx.set('track-leg2', 'line', { x1: 460, y1: TRACK_Y + 28, x2: 460, y2: 380, stroke: 'currentColor', 'stroke-opacity': 0.4 })
    // 滑轮
    ctx.set('pulley', 'circle', { cx: PULLEY.x, cy: PULLEY.y, r: 14, fill: C.line, stroke: C.ink2, 'stroke-width': 2 })
    ctx.set('pulley-hub', 'circle', { cx: PULLEY.x, cy: PULLEY.y, r: 3, fill: C.ink2 })
    ctx.set('pulley-arm', 'line', { x1: PULLEY.x, y1: PULLEY.y - 14, x2: PULLEY.x, y2: 70, stroke: C.ink2, 'stroke-width': 3 })
    ctx.set('pulley-mount', 'rect', { x: PULLEY.x - 16, y: 58, width: 32, height: 12, fill: C.ink2 })

    // 小车位置
    const cx = CART_START.x + st.x * PX_PER_M
    const cy = CART_Y(params.M)
    // 绳：车 → 滑轮 → 钩码（钩码随小车前进而下降，比例单独调小便于观看）
    const hangerY = PULLEY.y + 16 + st.x * 30
    ctx.set('rope1', 'line', { x1: cx + 52, y1: cy, x2: PULLEY.x, y2: PULLEY.y, stroke: C.ink, 'stroke-width': 2 })
    ctx.set('rope2', 'line', { x1: PULLEY.x, y1: PULLEY.y, x2: PULLEY.x, y2: hangerY, stroke: C.ink, 'stroke-width': 2 })
    // 钩码下方的地面（钩码到 x=2m 时恰好触地 = 行程终点）
    ctx.set('hanger-ground', 'rect', { x: PULLEY.x - 40, y: 380, width: 80, height: 8, fill: C.faint })
    ctx.set('hanger-ground-l', 'text', { x: PULLEY.x, y: 376, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.45, text: '地面' })
    // 小车本体（宽度随质量微变，体现"质量"）
    const bw = 70 + params.M * 20
    const cart = ctx.set('cart', 'rect', { x: cx - bw / 2, y: cy - 24, width: bw, height: 46, rx: 8, fill: C.accentDeep, stroke: C.indigoDeep, 'stroke-width': 2 })
    ctx.set('cart-wheel1', 'circle', { cx: cx - bw / 4, cy: cy + 24, r: 6, fill: C.navy })
    ctx.set('cart-wheel2', 'circle', { cx: cx + bw / 4, cy: cy + 24, r: 6, fill: C.navy })
    // 质量拖拽手柄（小车内部 ↕）
    const mHandle = ctx.set('m-handle', 'circle', { cx: cx, cy: cy - 2, r: 13, fill: C.surface, 'fill-opacity': 0.9, stroke: C.indigoDeep, 'stroke-width': 2 })
    ctx.set('m-handle-t', 'text', { x: cx, y: cy + 2, 'font-size': 13, 'text-anchor': 'middle', fill: C.indigoDeep, text: 'M↕' })
    ctx.drag(mHandle, (p) => {
      // 竖直拖动调质量
      const dy = p.y - cy
      ctx.setParam('M', clamp(round2(params.M - dy * 0.01), 0.2, 2))
    })
    ctx.drag(cart, (p) => {
      // 拖小车水平移动 = 直接设定位移（暂停时摆放）
      st.x = clamp((p.x - CART_START.x) / PX_PER_M, 0, 2)
      ctx.requestRender()
    })
    // 钩码（可拖 ↕ 改质量）
    const hanger = ctx.set('hanger', 'rect', { x: PULLEY.x - 14, y: hangerY, width: 28, height: 26, rx: 4, fill: C.amber, stroke: C.amberDeep })
    ctx.drag(hanger, (p) => {
      const dy = p.y - hangerY
      ctx.setParam('m', clamp(round2(params.m - dy * 0.002), 0.02, 0.5))
    })

    // 力箭头：统一比例——场景内最大力 = 90px 基准，其余按比例（避免 T 等小力短到不可见）
    const center = v(cx, cy)
    const k = 90 / Math.max(T, f, params.m * G, 1)
    if (opts.showForces) {
      drawArrow(ctx, 'fT', center, add(center, v(T * k, 0)), { color: C.tension, label: `T=${fmt(T, 2)}N` })
      if (f > 0) drawArrow(ctx, 'fF', v(cx, cy + 26), add(v(cx, cy + 26), v(-f * k, 0)), { color: C.friction, label: `f=${fmt(f, 2)}N` })
      else ctx.remove('fF', 'fF-head', 'fF-label')
      // 钩码受力
      drawArrow(ctx, 'fhG', v(PULLEY.x, hangerY + 13), add(v(PULLEY.x, hangerY + 13), v(0, params.m * G * k)), { color: C.gravity, label: `mg=${fmt(params.m * G, 2)}N` })
      if (opts.showPoints) ctx.set('dot-c', 'circle', { cx: center.x, cy: center.y, r: 4, fill: C.inkStrong })
      else ctx.remove('dot-c')
    } else {
      ctx.remove('fT', 'fT-head', 'fT-label', 'fF', 'fF-head', 'fF-label', 'fhG', 'fhG-head', 'fhG-label', 'dot-c')
    }

    // 状态提示
    const tips: string[] = []
    if (st.stuck) tips.push('拉不动：钩码重力 ≤ 最大静摩擦，a=0')
    if (st.finished) tips.push('钩码已落地 / 小车到终点，点「重置」再来')
    if (params.mu === 0) tips.push('当前 μ=0（理想气垫）')
    if (tips.length) ctx.set('tip', 'text', { x: 60, y: 50, 'font-size': 13, fill: C.warn, text: tips.join('；') })
    else ctx.remove('tip')

    // v-t 图像：量程按当前参数的理论终点自适应（避免曲线顶到面板被裁平）
    const vEnd = Math.sqrt(2 * a * 2) // 位移 2m 处的理论末速
    const tEnd = a > 0 ? Math.sqrt(2 * 2 / a) : 4
    const yMax = Math.max(1, Math.ceil(vEnd * 1.2 * 2) / 2)
    const xMax = Math.max(2, Math.ceil(tEnd * 1.2 * 2) / 2)
    if (ctx.gw) {
      const box = { x: 42, y: 24, w: ctx.gw - 66, h: ctx.gh - 62 }
      axes(ctx, box, { xLabel: 't/s', yLabel: 'v/(m/s)', xMax, yMax })
      polyline(ctx, 'g-vt', st.pts, box, 0, xMax, 0, yMax, C.accent)
      // 当前点
      if (st.pts.length > 1) {
        const last = st.pts[st.pts.length - 1]
        ctx.gset('g-dot', 'circle', { cx: gx(box, 0, xMax, last[0]), cy: gy(box, 0, yMax, last[1]), r: 4, fill: C.accent })
      }
    }
    data['加速度 a'] = `${fmt(a, 3)} m/s²`
    data['速度 v'] = `${fmt(st.vel, 2)} m/s`
    data['位移 s'] = `${fmt(st.x, 2)} m`
    data['绳张力 T'] = `${fmt(T, 2)} N`
    data['摩擦力 f'] = `${fmt(f, 2)} N`
    data['运动状态'] = st.stuck ? '静止（拉不动）' : st.finished ? '已结束（钩码落地）' : a === 0 ? '匀速/静止' : '匀加速'
    return data
  },
}

function CART_Y(M: number): number {
  return TRACK_Y - 8 - (M * 4)
}
function accel(p: SceneParams): number {
  const a = (p.m * G - p.mu * p.M * G) / (p.M + p.m)
  return a > 0 ? a : 0
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
