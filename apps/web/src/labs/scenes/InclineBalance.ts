// 课件 1：共点力平衡-斜面（高一·必修一）
// 拖拽斜面端点改倾角 θ，拖拽滑块沿斜面移动；实时三力箭头、分解虚线、tanθ 与 μ 临界比较
import type { LabScene, LabState, LabData } from '../engine/types'
import { C, G, add, clamp, dot, fmt, norm, projT, rad, scale, sub, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const A: V = v(70, 360) // 直角顶点（左下）
const HYP = 300 // 斜面（hypotenuse）固定长度

interface S extends LabState {
  s: number // 滑块沿斜面位置参数 0~1（从斜面顶到底）
  vel: number // 滑动模式下的速度（沿斜面向下为正）
  slipped: boolean // 已滑到底标记
}

// 由 θ 计算斜面顶点 C 与底角 B
function geom(thetaDeg: number) {
  const t = rad(thetaDeg)
  const C0 = v(A.x, A.y - HYP * Math.sin(t))
  const B = v(A.x + HYP * Math.cos(t), A.y)
  return { C: C0, B, t }
}

export const inclineScene: LabScene = {
  id: 'incline-balance',
  title: '共点力平衡 · 斜面',
  grade: '高一',
  chapter: '必修一 · 共点力平衡',
  desc: '斜面上滑块的受力分析：N、f 随倾角变化，tanθ 与 μ 临界比较',
  tags: ['共点力平衡', '斜面', '摩擦力', '受力分析', '静摩擦', '力的分解'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'm', label: '质量 m', min: 0.5, max: 10, step: 0.5, unit: 'kg', default: 2, reset: false },
    { key: 'mu', label: '动摩擦因数 μ', min: 0, max: 1, step: 0.05, unit: '', default: 0.4, reset: false },
    { key: 'theta', label: '倾角 θ', min: 5, max: 80, step: 1, unit: '°', default: 30, reset: false },
    {
      key: 'mode', label: '模式', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [
        { value: 0, label: '静止（静摩擦自适应）' },
        { value: 1, label: '滑动中（动摩擦）' },
      ],
    },
  ],
  presets: [
    { name: '15° 静止', params: { m: 2, mu: 0.4, theta: 15, mode: 0 } },
    { name: '37° 临界', params: { m: 2, mu: 0.75, theta: 37, mode: 0 } },
    { name: '滑动中', params: { m: 2, mu: 0.2, theta: 30, mode: 1 } },
  ],
  formulas: [
    'N = mg\\cos\\theta',
    '\\text{静止：} f = mg\\sin\\theta',
    '\\text{滑动：} f = \\mu mg\\cos\\theta',
    '\\text{恰好滑动临界：} \\tan\\theta_0 = \\mu',
  ],
  keyPoints: [
    '静摩擦是被动力：0 < f ≤ μs·mg，大小等于使物体产生滑动趋势的外力分量 mg·sinθ',
    'tanθ > μ 时静摩擦「顶不住」，物体必滑；tanθ = μ 即恰好滑动的临界角',
    '滑动后摩擦力突降为 μmg（μk < μs），所以物体一旦启动往往突然加速',
  ],
  challenge: {
    question: '斜面倾角 37°、μ = 0.4（tan37° ≈ 0.75），滑块会怎样？（先预测再看演示）',
    options: ['保持静止', '沿斜面匀速下滑', '沿斜面加速下滑', '向上滑动'],
    answer: 2,
    explanation: '重力沿斜面分量 mg·sin37° = 0.6mg，最大静摩擦约 μmg·cos37° = 0.32mg。0.6mg > 0.32mg，静摩擦「顶不住」，滑块加速下滑（a = g(sinθ − μcosθ) ≈ 2.8 m/s²）。',
    reveal_params: { m: 2, mu: 0.4, theta: 37, mode: 1 },
  },
  init(): S {
    return { t: 0, s: 0.5, vel: 0, slipped: false }
  },
  step(dt, params, state) {
    const st = state as S
    // 「静止模式」下 tanθ > μ 物理上不可能静止 → 按滑动处理（与渲染一致，不画假静止）
    if (params.mode !== 1 && Math.tan(rad(params.theta)) <= params.mu) return
    const a = G * (Math.sin(rad(params.theta)) - params.mu * Math.cos(rad(params.theta)))
    if (a > 0 && !st.slipped) {
      st.vel += a * dt
      st.s += (st.vel * dt * 100) / HYP // 100 px/m 的比例换算成斜面参数
      if (st.s >= 0.92) {
        st.s = 0.92
        st.slipped = true
        st.vel = 0
      }
    }
    st.t = (st.t ?? 0) + dt
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const theta = params.theta
    const { C: top, B } = geom(theta)
    const t = rad(theta)
    // 斜面三角形
    ctx.set('tri', 'polygon', {
      points: `${A.x},${A.y} ${B.x},${B.y} ${top.x},${top.y}`,
      fill: '#c7d2fe', 'fill-opacity': 0.35, stroke: C.accent, 'stroke-width': 2,
    })
    ctx.set('ground', 'line', {
      x1: 30, y1: A.y, x2: 610, y2: A.y, stroke: 'currentColor', 'stroke-opacity': 0.5, 'stroke-width': 1.5,
    })
    // 地面阴影线
    for (let i = 0; i < 8; i++) {
      const x = 40 + i * 70
      ctx.set(`ground-h${i}`, 'line', { x1: x, y1: A.y, x2: x - 10, y2: A.y + 10, stroke: 'currentColor', 'stroke-opacity': 0.25 })
    }

    // 斜面端点拖拽：改倾角
    const grip = ctx.set('theta-grip', 'circle', {
      cx: top.x, cy: top.y, r: 10, fill: '#fff', stroke: C.accent, 'stroke-width': 2.5,
    })
    ctx.set('theta-grip-hint', 'text', { x: top.x + 14, y: top.y - 8, 'font-size': 13, fill: C.accent, text: `拖我调角度 θ=${fmt(theta, 0)}°` })
    ctx.drag(grip, (p) => {
      // 以顶点 A 为圆心，把指针方向换算成倾角
      const dx = clamp(p.x - A.x, 20, 620)
      const dy = clamp(A.y - p.y, 10, 380)
      ctx.setParam('theta', clamp(Math.round((Math.atan2(dy, dx) * 180) / Math.PI), 5, 80))
    })
    // 顶点必须跟随 θ 重画（拖拽中 grip 位置在下一帧由 set 更新）

    // 滑块：位于斜面上参数 s 处
    const pos = add(top, scale(sub(B, top), st.s))
    const along = norm(sub(B, top)) // 沿斜面向下
    const n = v(Math.sin(t), -Math.cos(t)) // 外法向（斜面指向外）
    const mg = params.m * G
    const N = mg * Math.cos(t)
    const tanTheta = Math.tan(t)
    const willSlide = tanTheta > params.mu + 1e-9
    // 静止模式下 tanθ>μ 物理上不可能静止：按滑动处理（不画假静止的滑块）
    const staticImpossible = params.mode === 0 && willSlide
    const sliding = (params.mode === 1 || staticImpossible) && !st.slipped
    const fMag = staticImpossible || params.mode === 1 ? (sliding ? params.mu * N : 0) : mg * Math.sin(t)

    // 滑块本体（沿斜面旋转的矩形）
    const angDeg = theta
    ctx.set('block', 'g', {})
    const rect = ctx.set('block-rect', 'rect', {
      x: pos.x - 26, y: pos.y - 24, width: 52, height: 44,
      fill: '#4f46e5', 'fill-opacity': 0.9, rx: 6,
      transform: `rotate(${angDeg} ${pos.x} ${pos.y})`,
      stroke: '#312e81',
    })
    // 触摸热区放大（透明大圆）
    const hit = ctx.set('block-hit', 'circle', { cx: pos.x, cy: pos.y, r: 34, fill: 'transparent' })
    ctx.drag(hit, (p) => {
      const tt = clamp(projT(p, top, B), 0.08, 0.92)
      st.s = tt
      st.slipped = false
      st.vel = 0
      ctx.requestRender()
    })
    // 把矩形也作为拖拽入口（与热区同效）
    ctx.drag(rect, (p) => {
      const tt = clamp(projT(p, top, B), 0.08, 0.92)
      st.s = tt
      st.slipped = false
      st.vel = 0
      ctx.requestRender()
    })

    // —— 力的箭头（从滑块中心出发）——
    const center = v(pos.x, pos.y - 2)
    const arrowScale = 90 / Math.max(mg, 1) // 重力箭头固定约 90px，其余按比例
    if (opts.showForces) {
      drawArrow(ctx, 'fG', center, add(center, v(0, mg * arrowScale)), { color: C.gravity, label: `G=${fmt(mg, 1)}N` })
      drawArrow(ctx, 'fN', center, add(center, scale(n, N * arrowScale)), { color: C.normal, label: `N=${fmt(N, 1)}N` })
      // 摩擦力沿斜面：静止/滑动时都指向沿斜面向上（-along）
      if (fMag > 0.01) {
        drawArrow(ctx, 'fF', center, add(center, scale(along, -fMag * arrowScale)), { color: C.friction, label: `f=${fmt(fMag, 1)}N` })
      } else {
        ctx.remove('fF', 'fF-head', 'fF-label')
      }
      if (opts.showComponents) {
        // 重力的正交分解：沿斜面 mg·sinθ 与垂直斜面 mg·cosθ（虚线）
        const gDown = v(0, mg)
        const alongPart = scale(along, dot(gDown, along))
        const normalPart = scale(n, dot(gDown, n))
        drawArrow(ctx, 'fG1', center, add(center, alongPart), { color: C.gravity, component: true, width: 2 })
        drawArrow(ctx, 'fG2', center, add(center, normalPart), { color: C.gravity, component: true, width: 2 })
        // 分量数值
        ctx.set('comp-label', 'text', {
          x: center.x + 90, y: center.y + 60, 'font-size': 13, fill: C.gravity, text: `mg·sinθ=${fmt(mg * Math.sin(t), 1)}N  mg·cosθ=${fmt(mg * Math.cos(t), 1)}N`,
        })
      } else {
        ctx.remove('fG1', 'fG1-head', 'fG1-label', 'fG2', 'fG2-head', 'fG2-label', 'comp-label')
      }
      if (opts.showPoints) {
        ctx.set('dot-center', 'circle', { cx: center.x, cy: center.y, r: 4, fill: '#111827' })
      } else {
        ctx.remove('dot-center')
      }
    } else {
      ctx.remove('fG', 'fG-head', 'fG-label', 'fN', 'fN-head', 'fN-label', 'fF', 'fF-head', 'fF-label', 'fG1', 'fG1-head', 'fG1-label', 'fG2', 'fG2-head', 'fG2-label', 'comp-label', 'dot-center')
    }

    // 临界提示
    const hint = staticImpossible
      ? `tanθ=${fmt(tanTheta, 2)} > μ=${fmt(params.mu, 2)}：该组合不可能静止，已按滑动处理（a=${fmt(G * (Math.sin(t) - params.mu * Math.cos(t)), 2)} m/s²）`
      : willSlide
        ? `tanθ=${fmt(tanTheta, 2)} > μ=${fmt(params.mu, 2)} → 将滑动（滑动模式 a=${fmt(G * (Math.sin(t) - params.mu * Math.cos(t)), 2)} m/s²）`
        : `tanθ=${fmt(tanTheta, 2)} ≤ μ=${fmt(params.mu, 2)} → 保持静止`
    ctx.set('hint', 'text', { x: 30, y: 30, 'font-size': 14, fill: willSlide ? C.warn : '#059669', text: hint })
    if (st.slipped) {
      ctx.set('slipped', 'text', { x: 30, y: 52, 'font-size': 13, fill: C.warn, text: '已滑到底，点「重置」重新演示' })
    } else {
      ctx.remove('slipped')
    }

    return {
      '倾角 θ': `${fmt(theta, 1)}°`,
      '重力 G': `${fmt(mg, 2)} N`,
      '支持力 N': `${fmt(N, 2)} N`,
      '摩擦力 f': `${fmt(fMag, 2)} N${params.mode === 1 || staticImpossible ? '（动）' : '（静）'}`,
      'mg·sinθ': `${fmt(mg * Math.sin(t), 2)} N`,
      'mg·cosθ': `${fmt(mg * Math.cos(t), 2)} N`,
      临界判断: staticImpossible ? 'tanθ > μ，不可能静止，按滑动处理' : willSlide ? 'tanθ > μ，将滑动' : 'tanθ ≤ μ，静止',
    }
  },
}
