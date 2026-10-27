// 课件 13：摩擦力专题（高一·必修一）
// 水平推力 F 从 0 连续加大：静摩擦跟踪外力 → 临界滑动 → 突降为滑动摩擦；f-F 图像实时描绘并标注突变
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const GROUND_Y = 300
const START_X = 90
const PX_PER_M = 12
const SAMPLE = 0.2

interface S extends LabState {
  x: number // 滑块位移（米）
  vel: number
  moving: boolean
  ff: number // 当前摩擦力
  trace: [number, number][] // (推力 F, 摩擦力 f) 轨迹
  nextSample: number
  justSlipped: boolean // 刚发生突变的标记（用于高亮）
}

export const frictionScene: LabScene = {
  id: 'friction-force',
  title: '摩擦力专题 · 静摩擦到滑动摩擦',
  grade: '高一',
  chapter: '必修一 · 相互作用',
  desc: '拖推力手柄从 0 加大：静摩擦=外力逐步跟踪，到临界突降为滑动摩擦，f-F 图像实时描绘',
  tags: ['摩擦力', '静摩擦', '滑动摩擦', '临界', '受力分析'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'm', label: '滑块质量 m', min: 1, max: 10, step: 0.5, unit: 'kg', default: 2, reset: false },
    { key: 'mus', label: '最大静摩擦因数 μs', min: 0.1, max: 1, step: 0.05, unit: '', default: 0.5, reset: false },
    { key: 'muk', label: '滑动摩擦因数 μk', min: 0.05, max: 1, step: 0.05, unit: '', default: 0.3, reset: false },
    { key: 'F', label: '水平推力 F', min: 0, max: 30, step: 0.2, unit: 'N', default: 0, reset: false },
  ],
  presets: [
    { name: '静摩擦跟踪', params: { m: 2, mus: 0.5, muk: 0.3, F: 4 } },
    { name: '临界滑动', params: { m: 2, mus: 0.5, muk: 0.3, F: 9.8 } },
    { name: '滑动中', params: { m: 2, mus: 0.5, muk: 0.3, F: 14 } },
    { name: '无突变（μs=μk）', params: { m: 2, mus: 0.4, muk: 0.4, F: 12 } },
  ],
  formulas: [
    'f_{\\text{静}} = F_{\\text{外}} \\ (F \\le \\mu_s mg)',
    'f_{\\text{滑}} = \\mu_k mg',
    '\\text{临界：} F_c = \\mu_s mg',
  ],
  keyPoints: [
    '静摩擦大小随外力「被动跟踪」，与 μ 无关（只要没滑动）；只有最大静摩擦才由 μs 决定',
    '滑动瞬间摩擦力从 μs·mg 突降为 μk·mg（μk < μs），物体会突然加速',
    'f-F 图像：斜率 1 的直线 → 突跳 → 水平线；这是判断临界点的标准图像',
  ],
  challenge: {
    question: 'm = 2 kg、μs = 0.5、μk = 0.3（g = 10），水平拉力 F 从 0 缓慢加到 12 N。摩擦力怎么变？',
    options: ['始终等于 F，最大 12 N', '先随 F 增到 10 N，突降为 6 N 后保持不变', '恒为 6 N', '恒为 10 N'],
    answer: 1,
    explanation: '静摩擦阶段 f = F 跟随外力，最大到 μs·mg = 10 N；一旦滑动，摩擦突降为滑动摩擦 μk·mg = 6 N 不再随 F 变化。「突变」是本模型的考点。',
    reveal_preset: '滑动中',
  },
  init(params: SceneParams): S {
    const fs = Math.min(params.F, params.mus * params.m * G)
    return {
      x: 0,
      vel: 0,
      moving: params.F > params.mus * params.m * G,
      ff: params.moving ? params.muk * params.m * G : fs,
      trace: [[0, 0]],
      nextSample: SAMPLE,
      justSlipped: false,
    }
  },
  step(dt, params, state) {
    const st = state as S
    const F = params.F
    const fsMax = params.mus * params.m * G
    const fk = params.muk * params.m * G
    if (!st.moving) {
      if (F <= fsMax) {
        st.ff = F // 静摩擦跟踪外力
        st.justSlipped = false
      } else {
        st.ff = fk
        st.moving = true
        st.justSlipped = true // 突变！
      }
    } else {
      st.ff = fk
      st.justSlipped = false
      const a = (F - fk) / params.m
      st.vel += a * dt
      if (st.vel <= 0) {
        st.vel = 0
        st.moving = false // 停下回到静摩擦
      } else {
        st.x += st.vel * dt
      }
    }
    if (st.x >= 20) {
      st.x = 20
      st.vel = 0
      st.moving = false
    }
    if ((st.t = (st.t ?? 0) + dt) >= st.nextSample) {
      st.trace.push([Number(F.toFixed(2)), Number(st.ff.toFixed(2))])
      st.nextSample += SAMPLE
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const fsMax = params.mus * params.m * G
    const fk = params.muk * params.m * G

    // 地面
    ctx.set('ground', 'rect', { x: 40, y: GROUND_Y + 26, width: 560, height: 8, fill: C.faint, rx: 2 })
    // 滑块
    const bx = START_X + st.x * PX_PER_M
    const bw = 50 + params.m * 4
    const block = ctx.set('block', 'rect', { x: bx - bw / 2, y: GROUND_Y - 18, width: bw, height: 44, rx: 6, fill: st.moving ? C.friction : C.accentDeep, stroke: st.moving ? C.amberDeep : C.indigoDeep, 'stroke-width': 2 })
    ctx.set('block-t', 'text', { x: bx, y: GROUND_Y + 8, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: `${fmt(params.m, 1)}kg` })
    // 推力手柄：拖动改 F（↔）
    const handle = ctx.set('handle', 'circle', { cx: bx + 40, cy: GROUND_Y + 4, r: 13, fill: C.surface, 'fill-opacity': 0.95, stroke: C.tension, 'stroke-width': 2 })
    ctx.set('handle-t', 'text', { x: bx + 40, y: GROUND_Y + 8, 'font-size': 13, 'text-anchor': 'middle', fill: C.greenInk, text: 'F↔' })
    ctx.drag(handle, (p) => {
      ctx.setParam('F', clamp(Math.round((p.x - START_X) * 0.08 * 5) / 5, 0, 30))
    })
    ctx.drag(block, (p) => {
      ctx.setParam('F', clamp(Math.round((p.x - START_X) * 0.08 * 5) / 5, 0, 30))
    })

    // 力箭头：统一比例——最大力 = 90px 基准（避免 N/mg 短到不可见）
    const center = v(bx, GROUND_Y + 4)
    const k = 90 / Math.max(params.F, st.ff, params.m * G, 1)
    if (opts.showForces) {
      drawArrow(ctx, 'fF', center, add(center, v(params.F * k, 0)), { color: C.tension, label: `F=${fmt(params.F, 1)}N` })
      drawArrow(ctx, 'ff', v(bx - 6, GROUND_Y + 4), add(v(bx - 6, GROUND_Y + 4), v(-st.ff * k, 0)), { color: C.friction, label: `f=${fmt(st.ff, 1)}N` })
      drawArrow(ctx, 'fg', center, add(center, v(0, params.m * G * k)), { color: C.gravity, label: 'mg' })
      drawArrow(ctx, 'fn', center, add(center, v(0, -params.m * G * k)), { color: C.normal, label: 'N' })
      if (opts.showComponents) {
        // 正交分解示意：F 的竖直分量此处为 0，仅显示水平参考线
        ctx.set('fx', 'line', { x1: center.x, y1: center.y, x2: center.x + params.F * k, y2: center.y, stroke: C.net, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.5 })
      } else ctx.remove('fx')
    } else {
      ctx.remove('fF', 'fF-head', 'fF-label', 'ff', 'ff-head', 'ff-label', 'fg', 'fg-head', 'fg-label', 'fn', 'fn-head', 'fn-label', 'fx')
    }

    // 状态提示
    const tips: string[] = []
    if (st.justSlipped) tips.push('临界！摩擦力由 μs·mg 突降为 μk·mg')
    if (st.moving) tips.push('滑动中：f = μk·mg 不再随 F 增大')
    else if (params.F <= fsMax) tips.push(`静止：静摩擦 f=F=${fmt(params.F, 1)}N 跟踪外力`)
    if (st.x >= 20) tips.push('已到最右端，点「重置」再来')
    ctx.set('tip', 'text', { x: 70, y: 44, 'font-size': 13, fill: C.warn, text: tips.join('；') })

    // f-F 图像
    if (ctx.gw) {
      const box = { x: 46, y: 24, w: ctx.gw - 72, h: ctx.gh - 66 }
      const fMax = Math.max(30, fsMax * 1.15)
      axes(ctx, box, { xLabel: '推力 F/N', yLabel: '摩擦力 f/N', xMax: fMax, yMax: fMax })
      // f=F 参考对角线
      ctx.gset('g-diag', 'line', { x1: gx(box, 0, fMax, 0), y1: gy(box, 0, fMax, 0), x2: gx(box, 0, fMax, fMax), y2: gy(box, 0, fMax, fMax), stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '5 5' })
      ctx.gset('g-diagl', 'text', { x: gx(box, 0, fMax, fMax) - 6, y: gy(box, 0, fMax, fMax) + 14, 'font-size': 13, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.5, text: 'f=F' })
      // μs·mg 临界线（红虚线）
      ctx.gset('g-fs', 'line', { x1: box.x, y1: gy(box, 0, fMax, fsMax), x2: box.x + box.w, y2: gy(box, 0, fMax, fsMax), stroke: C.gravity, 'stroke-dasharray': '6 4', 'stroke-opacity': 0.8 })
      ctx.gset('g-fsl', 'text', { x: box.x + 6, y: gy(box, 0, fMax, fsMax) - 5, 'font-size': 13, fill: C.gravity, text: `μs·mg=${fmt(fsMax, 1)}` })
      // μk·mg 滑动摩擦线（橙实线）
      ctx.gset('g-fk', 'line', { x1: box.x, y1: gy(box, 0, fMax, fk), x2: box.x + box.w, y2: gy(box, 0, fMax, fk), stroke: C.friction, 'stroke-opacity': 0.8 })
      ctx.gset('g-fkl', 'text', { x: box.x + 6, y: gy(box, 0, fMax, fk) - 5, 'font-size': 13, fill: C.friction, text: `μk·mg=${fmt(fk, 1)}` })
      // 实测轨迹
      polyline(ctx, 'g-trace', st.trace, box, 0, fMax, 0, fMax, C.net)
    }
    data['推力 F'] = `${fmt(params.F, 1)} N`
    data['摩擦力 f'] = `${fmt(st.ff, 2)} N`
    data['最大静摩擦 μs·mg'] = `${fmt(fsMax, 2)} N`
    data['滑动摩擦 μk·mg'] = `${fmt(fk, 2)} N`
    data['速度 v'] = `${fmt(st.vel, 2)} m/s`
    data['状态'] = st.moving ? '滑动' : params.F > fsMax ? '即将滑动' : '静止'
    return data
  },
}
