// 课件 14：连接体与滑轮（高一·必修一）
// 桌上 m1 经定滑轮吊 m2：m1/m2/μ 均可拖，「整体法/隔离法」两套受力图切换展示
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const TABLE_Y = 260
const PULLEY: V = v(452, 246)
const M1_START = 150
const PX_PER_M = 55
const SAMPLE = 0.25

interface S extends LabState {
  t: number
  x: number // m1 位移（米）
  vel: number
  stuck: boolean
  finished: boolean
  pts: [number, number][]
  nextSample: number
}

export const pulleyScene: LabScene = {
  id: 'pulley-system',
  title: '连接体与滑轮 · 整体法与隔离法',
  grade: '高一',
  chapter: '必修一 · 牛顿运动定律',
  desc: '桌面 m1 经滑轮吊 m2：两法受力图切换，T=2m₁m₂g/(m₁+m₂)，v-t 图像实时',
  tags: ['连接体', '滑轮', '整体法', '隔离法', '绳张力', '牛顿第二定律'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'm1', label: '桌面滑块 m1', min: 0.2, max: 3, step: 0.1, unit: 'kg', default: 1, reset: false },
    { key: 'm2', label: '悬挂物 m2', min: 0.05, max: 1.5, step: 0.05, unit: 'kg', default: 0.4, reset: false },
    { key: 'mu', label: '摩擦因数 μ', min: 0, max: 0.5, step: 0.02, unit: '', default: 0.1, reset: false },
    {
      key: 'method', label: '分析方法', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '整体法' }, { value: 1, label: '隔离法' }],
    },
  ],
  presets: [
    { name: '理想无摩擦', params: { m1: 1, m2: 0.4, mu: 0, method: 0 } },
    { name: '有摩擦', params: { m1: 1, m2: 0.4, mu: 0.15, method: 1 } },
    { name: '拉不动（μ 大）', params: { m1: 2, m2: 0.1, mu: 0.4, method: 0 } },
    { name: 'm2 远大于摩擦', params: { m1: 0.4, m2: 1, mu: 0.05, method: 1 } },
  ],
  formulas: [
    'a = \\frac{m_2 g - \\mu m_1 g}{m_1 + m_2}',
    'T = \\frac{2 m_1 m_2 g}{m_1 + m_2}\\ (\\mu = 0)',
    'T = m_1(a + \\mu g) = m_2(g - a)',
  ],
  keyPoints: [
    '整体法看外力（m₂g 与 μm₁g），隔离法看内力 T——求 a 用整体、求 T 用隔离',
    '轻绳不可伸长：两物体加速度大小相等；绳张力 T < m₂g（m₂ 失重）',
    '拉不动条件：m₂g ≤ μm₁g，此时静摩擦与绳张力平衡，a = 0',
  ],
  init(): S {
    return { t: 0, x: 0, vel: 0, stuck: false, finished: false, pts: [[0, 0]], nextSample: SAMPLE }
  },
  step(dt, params, state) {
    const st = state as S
    const a = accel(params)
    if (a <= 0) {
      st.stuck = true
      return
    }
    if (st.finished) return
    st.stuck = false
    st.vel += a * dt
    st.x += st.vel * dt
    st.t = (st.t ?? 0) + dt
    if (st.x >= 4) {
      st.x = 4
      st.finished = true
    }
    if (st.t >= st.nextSample) {
      st.pts.push([Number(st.t.toFixed(2)), st.vel])
      st.nextSample += SAMPLE
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const a = accel(params)
    const f = params.mu * params.m1 * G
    const T = a > 0 ? params.m1 * (a + params.mu * G) : params.m2 * G
    const data: LabData = {}

    // 桌面与滑轮
    ctx.set('table', 'rect', { x: 60, y: TABLE_Y + 22, width: 390, height: 10, fill: C.faint, rx: 3 })
    ctx.set('table-leg', 'line', { x1: 90, y1: TABLE_Y + 32, x2: 90, y2: 380, stroke: 'currentColor', 'stroke-opacity': 0.4 })
    ctx.set('table-leg2', 'line', { x1: 420, y1: TABLE_Y + 32, x2: 420, y2: 380, stroke: 'currentColor', 'stroke-opacity': 0.4 })
    ctx.set('pulley', 'circle', { cx: PULLEY.x, cy: PULLEY.y, r: 14, fill: C.line, stroke: C.ink2, 'stroke-width': 2 })
    ctx.set('pulley-hub', 'circle', { cx: PULLEY.x, cy: PULLEY.y, r: 3, fill: C.ink2 })
    ctx.set('pulley-arm', 'line', { x1: PULLEY.x, y1: PULLEY.y - 14, x2: PULLEY.x, y2: 70, stroke: C.ink2, 'stroke-width': 3 })
    ctx.set('pulley-mount', 'rect', { x: PULLEY.x - 16, y: 58, width: 32, height: 12, fill: C.ink2 })

    // m1 位置与绳
    const x1 = M1_START + st.x * PX_PER_M
    const y1 = TABLE_Y - 8 - params.m1 * 3
    const hangerY = PULLEY.y + 16 + st.x * 24 // 比例缩小，保证 m2 终点不出画
    // 绳从 m1 右缘中点连出（不再悬空）
    const bw0 = 56 + params.m1 * 18
    ctx.set('rope1', 'line', { x1: x1 + bw0 / 2, y1: y1, x2: PULLEY.x, y2: PULLEY.y, stroke: C.ink, 'stroke-width': 2 })
    ctx.set('rope2', 'line', { x1: PULLEY.x, y1: PULLEY.y, x2: PULLEY.x, y2: hangerY, stroke: C.ink, 'stroke-width': 2 })

    // m1 滑块（拖动本体 = 摆放位移，拖内部手柄 = 改质量）
    const bw = 56 + params.m1 * 18
    const m1el = ctx.set('m1', 'rect', { x: x1 - bw / 2, y: y1 - 22, width: bw, height: 44, rx: 6, fill: C.accentDeep, stroke: C.indigoDeep, 'stroke-width': 2 })
    ctx.set('m1-t', 'text', { x: x1, y: y1 + 4, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: `m1=${fmt(params.m1, 1)}` })
    const m1h = ctx.set('m1-handle', 'circle', { cx: x1 - bw / 4, cy: y1, r: 11, fill: C.surface, 'fill-opacity': 0.9, stroke: C.indigoDeep, 'stroke-width': 2 })
    ctx.set('m1h-t', 'text', { x: x1 - bw / 4, y: y1 + 3, 'font-size': 13, 'text-anchor': 'middle', fill: C.indigoDeep, text: '↕' })
    ctx.drag(m1el, (p) => {
      st.x = clamp((p.x - M1_START) / PX_PER_M, 0, 4)
      ctx.requestRender()
    })
    ctx.drag(m1h, (p) => {
      ctx.setParam('m1', clamp(Math.round((params.m1 - (p.y - y1) * 0.02) * 10) / 10, 0.2, 3))
    })
    // m2 悬挂物（拖动改质量）
    const m2el = ctx.set('m2', 'rect', { x: PULLEY.x - 16, y: hangerY, width: 32, height: 30 + params.m2 * 12, rx: 4, fill: C.amber, stroke: C.amberDeep, 'stroke-width': 2 })
    ctx.set('m2-t', 'text', { x: PULLEY.x, y: hangerY + 22 + params.m2 * 6, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: `m2=${fmt(params.m2, 2)}` })
    ctx.drag(m2el, (p) => {
      ctx.setParam('m2', clamp(Math.round((params.m2 - (p.y - hangerY) * 0.008) * 100) / 100, 0.05, 1.5))
    })

    // 受力图：整体法 vs 隔离法
    const whole = params.method === 0
    if (opts.showForces) {
      if (whole) {
        // 整体法：把 m1+m2 看作整体，动力 m2g、阻力 μm1g（虚线框限制在舞台内不穿底）
        const sysC = v(x1 + 10, y1 + 60)
        const boxH = Math.min(hangerY - y1 + 66, 415 - (y1 - 30))
        ctx.set('sys-box', 'rect', { x: x1 - bw / 2 - 8, y: y1 - 30, width: PULLEY.x - x1 + bw / 2 + 30, height: boxH, fill: 'none', stroke: C.net, 'stroke-dasharray': '6 5', 'stroke-opacity': 0.6, rx: 8 })
        ctx.set('sys-label', 'text', { x: x1 + 10, y: y1 - 36, 'font-size': 13, fill: C.net, 'fill-opacity': 0.7, text: '整体 (m1+m2)' })
        drawArrow(ctx, 'wDrive', sysC, add(sysC, v(0, params.m2 * G * 0.8)), { color: C.gravity, label: `m2g=${fmt(params.m2 * G, 2)}N（动力）` })
        drawArrow(ctx, 'wRes2', sysC, add(sysC, v(-(params.m2 * G - f) * 0.8, 0)), { color: C.friction, label: `μm1g=${fmt(f, 2)}N（阻力）` })
        ctx.remove('isoT1', 'isoT1-head', 'isoT1-label', 'isoT2', 'isoT2-head', 'isoT2-label', 'isoF1', 'isoF1-head', 'isoF1-label', 'isoF2', 'isoF2-head', 'isoF2-label')
      } else {
        ctx.remove('sys-box', 'sys-label', 'wDrive', 'wDrive-head', 'wDrive-label', 'wRes2', 'wRes2-head', 'wRes2-label')
        // 隔离法 m1：T 向右，f 向左
        const c1 = v(x1, y1 + 6)
        drawArrow(ctx, 'isoT1', c1, add(c1, v(T * 0.9, 0)), { color: C.tension, label: `T=${fmt(T, 2)}N` })
        if (f > 0) drawArrow(ctx, 'isoF1', v(c1.x, c1.y + 18), add(v(c1.x, c1.y + 18), v(-f * 0.9, 0)), { color: C.friction, label: `f=${fmt(f, 2)}N` })
        else ctx.remove('isoF1', 'isoF1-head', 'isoF1-label')
        // 隔离法 m2：T 向上，m2g 向下
        const c2 = v(PULLEY.x, hangerY + 16)
        drawArrow(ctx, 'isoT2', c2, add(c2, v(0, -T * 0.9)), { color: C.tension, label: `T=${fmt(T, 2)}N` })
        drawArrow(ctx, 'isoF2', c2, add(c2, v(0, params.m2 * G * 0.9)), { color: C.gravity, label: `m2g=${fmt(params.m2 * G, 2)}N` })
      }
      if (opts.showPoints) {
        ctx.set('dot1', 'circle', { cx: x1, cy: y1 + 6, r: 4, fill: C.inkStrong })
        ctx.set('dot2', 'circle', { cx: PULLEY.x, cy: hangerY + 16, r: 4, fill: C.inkStrong })
      } else ctx.remove('dot1', 'dot2')
    } else {
      ctx.remove('sys-box', 'sys-label', 'wDrive', 'wDrive-head', 'wDrive-label', 'wRes2', 'wRes2-head', 'wRes2-label', 'isoT1', 'isoT1-head', 'isoT1-label', 'isoF1', 'isoF1-head', 'isoF1-label', 'isoT2', 'isoT2-head', 'isoT2-label', 'isoF2', 'isoF2-head', 'isoF2-label', 'dot1', 'dot2')
    }

    // 状态提示
    const tips: string[] = []
    if (st.stuck) tips.push('拉不动：m2g ≤ μm1g，静摩擦与绳张力平衡')
    if (st.finished) tips.push('m1 已到滑轮处，点「重置」再来')
    ctx.set('tip', 'text', { x: 70, y: 46, 'font-size': 13, fill: C.warn, text: tips.join('；') })

    // v-t 图像：量程按当前参数的理论终点自适应（位移 4m 内的末速/时长，避免曲线被裁平）
    const vEnd = Math.sqrt(2 * a * 4)
    const tEnd = a > 0 ? Math.sqrt(2 * 4 / a) : 4
    const yMaxG = Math.max(1, Math.ceil(vEnd * 1.2 * 2) / 2)
    const xMaxG = Math.max(2, Math.ceil(tEnd * 1.2 * 2) / 2)
    if (ctx.gw) {
      const box = { x: 44, y: 24, w: ctx.gw - 70, h: ctx.gh - 66 }
      axes(ctx, box, { xLabel: 't/s', yLabel: 'v/(m/s)', xMax: xMaxG, yMax: yMaxG })
      polyline(ctx, 'g-vt', st.pts, box, 0, xMaxG, 0, yMaxG, C.accent)
      if (st.pts.length > 1) {
        const last = st.pts[st.pts.length - 1]
        ctx.gset('g-dot', 'circle', { cx: gx(box, 0, xMaxG, last[0]), cy: gy(box, 0, yMaxG, last[1]), r: 4, fill: C.accent })
      }
    }
    data['分析方法'] = whole ? '整体法' : '隔离法'
    data['加速度 a'] = `${fmt(a, 3)} m/s²`
    data['速度 v'] = `${fmt(st.vel, 2)} m/s`
    data['绳张力 T'] = `${fmt(T, 2)} N`
    data['摩擦力 f'] = st.stuck ? `${fmt(Math.min(params.m2 * G, f), 2)} N（静摩擦）` : `${fmt(f, 2)} N`
    data['状态'] = st.stuck ? '静止（拉不动）' : st.finished ? '已到终点' : '匀加速'
    return data
  },
}

function accel(p: SceneParams): number {
  const a = (p.m2 * G - p.mu * p.m1 * G) / (p.m1 + p.m2)
  return a > 0 ? a : 0
}
