// 课件 15：匀速圆周运动 · 转盘与圆锥摆（高一·必修二）
// 转盘模式：拖 ω 加速，物体超过临界 ωc=√(μg/r) 自动外滑；圆锥摆模式：拖摆角看张力与周期
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, G, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const CX = 320
const CY = 235
const PIVOT: V = v(320, 70)

interface S extends LabState {
  phi: number // 旋转相位
  rr: number // 转盘模式：物体当前半径（米，滑动中会增大）
  vr: number // 径向速度
  sliding: boolean
}

export const turntableScene: LabScene = {
  id: 'turntable-pendulum',
  title: '匀速圆周运动 · 转盘与圆锥摆',
  grade: '高一',
  chapter: '必修二 · 曲线运动',
  desc: '转盘：拖 ω 超过 ωc=√(μg/r) 物体外滑；圆锥摆：拖摆角，张力与周期实时',
  tags: ['匀速圆周运动', '向心力', '圆锥摆', '转盘', '临界'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'mode', label: '模式', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '水平转盘' }, { value: 1, label: '圆锥摆' }],
    },
    { key: 'r', label: '物体半径 r', min: 0.2, max: 1.35, step: 0.05, unit: 'm', default: 0.8, modes: [0], reset: false },
    { key: 'omega', label: '角速度 ω', min: 0, max: 8, step: 0.1, unit: 'rad/s', default: 2, modes: [0], reset: false },
    { key: 'mu', label: '摩擦因数 μ', min: 0.05, max: 0.8, step: 0.05, unit: '', default: 0.3, modes: [0], reset: false },
    { key: 'L', label: '摆长 L', min: 0.6, max: 1.5, step: 0.05, unit: 'm', default: 1, modes: [1], reset: false },
    { key: 'theta', label: '摆角 θ', min: 10, max: 70, step: 1, unit: '°', default: 30, modes: [1], reset: false },
    { key: 'm', label: '质量 m', min: 0.2, max: 2, step: 0.1, unit: 'kg', default: 0.5, reset: false },
  ],
  presets: [
    { name: '转盘·慢速稳定', params: { mode: 0, r: 0.8, omega: 2, mu: 0.3, L: 1, theta: 30, m: 0.5 } },
    { name: '转盘·临界（ωc=√(μg/r)）', params: { mode: 0, r: 0.8, omega: 1.9, mu: 0.3, L: 1, theta: 30, m: 0.5 } },
    { name: '转盘·超临界外滑', params: { mode: 0, r: 0.6, omega: 4, mu: 0.3, L: 1, theta: 30, m: 0.5 } },
    { name: '圆锥摆·30°', params: { mode: 1, r: 0.8, omega: 2, mu: 0.3, L: 1, theta: 30, m: 0.5 } },
    { name: '圆锥摆·60°', params: { mode: 1, r: 0.8, omega: 2, mu: 0.3, L: 1, theta: 60, m: 0.5 } },
  ],
  formulas: [
    'f_{\\text{向}} = m\\omega^2 r \\le \\mu mg',
    '\\omega_c = \\sqrt{\\mu g / r}',
    '\\omega = \\sqrt{g/(L\\cos\\theta)}',
    'T_{\\text{张}} = mg/\\cos\\theta',
  ],
  keyPoints: [
    '转盘：静摩擦提供向心力，ω 超过临界 ωc=√(μg/r) 时物体离心外滑',
    '临界角速度与质量无关（mω²r 与 μmg 同含 m）',
    '圆锥摆：T = mg/cosθ，θ 越大张力越大；ω=√(g/(Lcosθ)) 随 θ 增大',
  ],
  challenge: {
    question: '转盘上的物体随盘匀速转动，转速 ω 增大到超过临界值 √(μg/r) 时，物体会怎样？',
    options: ['继续做圆周运动', '逐渐沿半径向外滑动直至离盘', '立即沿切线飞出盘外', '向圆心滑动'],
    answer: 1,
    explanation: '需要的向心力 mω²r 超过最大静摩擦 μmg 后，静摩擦「供不上」，物体沿半径向外滑（实际轨迹是缓慢外旋的螺线，不是立即沿切线飞出）。',
    reveal_preset: '转盘·超临界外滑',
  },
  init(): S {
    return { phi: 0, rr: 0, vr: 0, sliding: false }
  },
  step(dt, params, state) {
    const st = state as S
    if (params.mode === 0) {
      // 转盘：向心力不足时径向外滑 a = ω²r − μg
      if (st.rr === 0) st.rr = params.r
      st.phi += params.omega * dt
      if (params.omega * params.omega * st.rr > params.mu * G) {
        st.sliding = true
        st.vr += (params.omega * params.omega * st.rr - params.mu * G) * dt
        st.rr += st.vr * dt
        if (st.rr >= 1.35) {
          st.rr = 1.35
          st.vr = 0
        }
      } else {
        st.sliding = false
        st.vr = 0
        st.rr = params.r
      }
    } else {
      // 圆锥摆：ω 由 θ 决定
      const w = Math.sqrt(G / (params.L * Math.cos((params.theta * Math.PI) / 180)))
      st.phi += w * dt
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const mode0 = params.mode === 0

    if (mode0) {
      // —— 转盘（俯视圆盘）——
      const R = 1.35 * 130 // 盘边缘像素半径
      ctx.set('disc', 'circle', { cx: CX, cy: CY, r: R, fill: '#e2e8f0', 'fill-opacity': 0.35, stroke: '#64748b', 'stroke-width': 2 })
      ctx.set('disc-hub', 'circle', { cx: CX, cy: CY, r: 8, fill: '#475569' })
      // 转动参考辐条（随 phi 旋转，直观显示盘在转）
      for (let i = 0; i < 4; i++) {
        const a = st.phi + (i * Math.PI) / 2
        ctx.set(`spoke${i}`, 'line', { x1: CX, y1: CY, x2: CX + R * Math.cos(a), y2: CY + R * Math.sin(a), stroke: 'currentColor', 'stroke-opacity': 0.12, 'stroke-width': 2 })
      }
      // 半径刻度（米）
      for (let m = 0.5; m <= 1.3; m += 0.4) {
        const rp = m * 130
        ctx.set(`rt${m}`, 'circle', { cx: CX, cy: CY, r: rp, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.15, 'stroke-dasharray': '3 5' })
        ctx.set(`rtl${m}`, 'text', { x: CX + rp * 0.7071 + 4, y: CY - rp * 0.7071 - 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.45, text: `${fmt(m, 1)}m` })
      }
      // 物体（沿半径可拖改 r）
      const pr = st.rr * 130
      const px = CX + pr * Math.cos(st.phi)
      const py = CY + pr * Math.sin(st.phi)
      const need = params.omega * params.omega * st.rr * params.m // 需要的向心力
      const fmax = params.mu * params.m * G
      const obj = ctx.set('obj', 'circle', { cx: px, cy: py, r: 11, fill: st.sliding ? C.friction : C.accent, stroke: st.sliding ? '#b45309' : '#312e81', 'stroke-width': 2 })
      ctx.drag(obj, (p) => {
        const d = Math.hypot(p.x - CX, p.y - CY) / 130
        ctx.setParam('r', clamp(Math.round(d * 20) / 20, 0.2, 1.35))
        st.rr = params.r
        st.vr = 0
        ctx.requestRender()
      })
      // 沿半径的滑动方向提示
      if (st.sliding) {
        const dir = v(Math.cos(st.phi), Math.sin(st.phi))
        drawArrow(ctx, 'slide', v(px, py), add(v(px, py), { x: dir.x * 26, y: dir.y * 26 }), { color: C.friction, label: '外滑' })
      } else ctx.remove('slide', 'slide-head', 'slide-label')
      // 向心力（静摩擦）箭头：指向圆心
      if (opts.showForces && !st.sliding) {
        const fNeed = Math.min(need, fmax)
        drawArrow(ctx, 'fc', v(px, py), add(v(px, py), { x: -Math.cos(st.phi) * fNeed * 0.7, y: -Math.sin(st.phi) * fNeed * 0.7 }), { color: C.friction, label: `f=μ?${fmt(need, 2)}N` })
      } else ctx.remove('fc', 'fc-head', 'fc-label')
      // 临界信息
      const wc = Math.sqrt((params.mu * G) / params.r)
      const tips: string[] = []
      if (st.sliding) tips.push(`已外滑：ω²r > μg（需 ${fmt(need, 2)}N > 最大静摩擦 ${fmt(fmax, 2)}N）`)
      else if (params.omega > wc * 0.9) tips.push(`接近临界：ωc=√(μg/r)=${fmt(wc, 2)} rad/s`)
      if (st.rr >= 1.35) tips.push('已滑出盘缘！')
      ctx.set('tip', 'text', { x: 60, y: 40, 'font-size': 13, fill: C.warn, text: tips.join('；') })
      data['模式'] = '水平转盘'
      data['需要的向心力 mω²r'] = `${fmt(need, 3)} N`
      data['最大静摩擦 μmg'] = `${fmt(fmax, 3)} N`
      data['临界角速度 ωc'] = `${fmt(wc, 3)} rad/s`
      data['当前半径 r'] = `${fmt(st.rr, 2)} m`
    } else {
      // —— 圆锥摆（侧视 + 旋转投影）——
      const L = params.L * 130 // 摆长像素
      const rad = (params.theta * Math.PI) / 180
      const Rr = L * Math.sin(rad) // 圆半径像素
      const dy = L * Math.cos(rad)
      const bobY = PIVOT.y + dy
      // 圆锥轮廓（虚线两条母线 + 顶圆投影椭圆）
      ctx.set('cone-l', 'line', { x1: PIVOT.x, y1: PIVOT.y, x2: PIVOT.x - Rr, y2: bobY, stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '5 5' })
      ctx.set('cone-r', 'line', { x1: PIVOT.x, y1: PIVOT.y, x2: PIVOT.x + Rr, y2: bobY, stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '5 5' })
      ctx.set('cone-ellipse', 'ellipse', { cx: PIVOT.x, cy: bobY, rx: Rr, ry: Rr * 0.3, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.2, 'stroke-dasharray': '4 4' })
      // 悬点
      ctx.set('pivot', 'rect', { x: PIVOT.x - 14, y: PIVOT.y - 10, width: 28, height: 8, fill: '#475569' })
      // 摆球（旋转投影，拖动改 θ）
      const bx = PIVOT.x + Rr * Math.sin(st.phi)
      const by = bobY + Rr * 0.3 * Math.cos(st.phi)
      ctx.set('string', 'line', { x1: PIVOT.x, y1: PIVOT.y, x2: bx, y2: by, stroke: '#334155', 'stroke-width': 2 })
      const bob = ctx.set('bob', 'circle', { cx: bx, cy: by, r: 12, fill: C.accent, stroke: '#312e81', 'stroke-width': 2 })
      ctx.drag(bob, (p) => {
        const dx = clamp(p.x - PIVOT.x, -(L * 0.94), L * 0.94)
        const ang = clamp(Math.asin(Math.abs(dx) / L) * (180 / Math.PI), 10, 70)
        ctx.setParam('theta', Math.round(ang))
        ctx.requestRender()
      })
      // 力：张力沿绳、重力向下、合力指向圆心（水平）
      const Ten = params.m * G / Math.cos(rad)
      if (opts.showForces) {
        const dirS = v((PIVOT.x - bx), (PIVOT.y - by))
        const l = Math.hypot(dirS.x, dirS.y) || 1
        drawArrow(ctx, 'ten', v(bx, by), add(v(bx, by), { x: (dirS.x / l) * Ten * 0.55, y: (dirS.y / l) * Ten * 0.55 }), { color: C.tension, label: `T=${fmt(Ten, 2)}N` })
        drawArrow(ctx, 'gr', v(bx, by), add(v(bx, by), v(0, params.m * G * 0.55)), { color: C.gravity, label: 'mg' })
        // 合力（向心）水平指向轨迹圆心
        const toC = bx > PIVOT.x ? -1 : 1
        drawArrow(ctx, 'net', v(bx, by), add(v(bx, by), { x: toC * params.m * G * Math.tan(rad) * 0.55, y: 0 }), { color: C.net, dashed: true, label: '合力=向心力' })
      } else {
        ctx.remove('ten', 'ten-head', 'ten-label', 'gr', 'gr-head', 'gr-label', 'net', 'net-head', 'net-label')
      }
      const w = Math.sqrt(G / (params.L * Math.cos(rad)))
      const Tp = (2 * Math.PI) / w
      ctx.set('tip', 'text', { x: 60, y: 40, 'font-size': 13, fill: C.warn, text: `θ 越大 → cosθ 越小 → 张力与角速度越大（T=mg/cosθ）` })
      data['模式'] = '圆锥摆'
      data['角速度 ω'] = `${fmt(w, 3)} rad/s`
      data['周期 2π√(Lcosθ/g)'] = `${fmt(Tp, 3)} s`
      data['绳张力 T=mg/cosθ'] = `${fmt(Ten, 2)} N`
      data['圆周半径 r=Lsinθ'] = `${fmt(params.L * Math.sin(rad), 2)} m`
    }
    data['质量 m'] = `${fmt(params.m, 1)} kg`
    data['转速'] = `${fmt((params.mode === 0 ? params.omega : Math.sqrt(G / (params.L * Math.cos((params.theta * Math.PI) / 180)))) * 60 / (2 * Math.PI), 1)} 转/分`
    return data
  },
}
