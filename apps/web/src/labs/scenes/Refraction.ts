// 课件 37：光的折射与全反射（选择性必修一 · 光学）
// 光从介质 1 射向介质 2：拖入射光线改入射角，n₁sinθ₁=n₂sinθ₂ 实时求解，
// 入射角超过临界角时自动切换为全反射
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt, fromDeg, v, add, scale, type V } from '../engine/vec'

const O: V = v(320, 210) // 界面上的入射点
const RAY_L = 190 // 入射光线长度 px

interface S extends LabState {
  t: number
}

export const refractionScene: LabScene = {
  id: 'refraction',
  title: '光的折射与全反射',
  grade: '高二',
  chapter: '选择性必修一 · 光学',
  desc: '拖入射光线改入射角：折射角按 n₁sinθ₁=n₂sinθ₂ 实时求解，超临界角发生全反射',
  tags: ['折射定律', '全反射', '临界角', '折射率', '光的传播'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'n1', label: '介质1折射率 n₁（上）', min: 1.0, max: 2.5, step: 0.05, unit: '', default: 1.0, reset: false },
    { key: 'n2', label: '介质2折射率 n₂（下）', min: 1.0, max: 2.5, step: 0.05, unit: '', default: 1.5, reset: false },
    { key: 'th1', label: '入射角 θ₁', min: 0, max: 89, step: 1, unit: '°', default: 30, reset: false },
  ],
  presets: [
    { name: '空气→玻璃', params: { n1: 1.0, n2: 1.5, th1: 30 } },
    { name: '玻璃→空气', params: { n1: 1.5, n2: 1.0, th1: 30 } },
    { name: '水中→空气 临界角48.6°', params: { n1: 1.33, n2: 1.0, th1: 48 } },
    { name: '全反射（光导纤维原理）', params: { n1: 1.5, n2: 1.0, th1: 70 } },
  ],
  formulas: [
    'n_1\\sin\\theta_1 = n_2\\sin\\theta_2',
    '\\sin C = \\dfrac{n_2}{n_1}\\ (n_1>n_2)',
    '\\text{光密→光疏，且入射角 > 临界角 C 时全反射}\\ \\text{时全反射}',
  ],
  keyPoints: [
    '折射光线与入射光线分居法线两侧，处于同一平面内；光从真空进入介质频率不变、波长变短',
    '只有从光密介质射向光疏介质（n₁>n₂）才可能发生全反射，临界角 C=arcsin(n₂/n₁)',
    '全反射时反射光能量 100%，这是光导纤维传光的原理',
  ],
  init(): S {
    return { t: 0 }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    void st
    const data: LabData = {}

    // 上下介质区域与标注
    ctx.set('med1', 'rect', { x: 40, y: 40, width: 560, height: O.y - 40, fill: params.n1 > 1.05 ? C.skyLight : C.paper, 'fill-opacity': params.n1 > 1.05 ? 0.10 : 0.02 })
    ctx.set('med2', 'rect', { x: 40, y: O.y, width: 560, height: 340, fill: params.n2 > 1.05 ? C.skyLight : C.paper, 'fill-opacity': params.n2 > 1.05 ? 0.14 : 0.02 })
    ctx.set('if', 'line', { x1: 40, y1: O.y, x2: 600, y2: O.y, stroke: 'currentColor', 'stroke-opacity': 0.6, 'stroke-width': 2 })
    ctx.set('med1-l', 'text', { x: 52, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.7, text: `介质1  n₁=${fmt(params.n1, 2)}` })
    ctx.set('med2-l', 'text', { x: 52, y: 380, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.7, text: `介质2  n₂=${fmt(params.n2, 2)}` })

    // 法线（竖直虚线）
    ctx.set('normal', 'line', { x1: O.x, y1: 50, x2: O.x, y2: 380, stroke: 'currentColor', 'stroke-opacity': 0.35, 'stroke-dasharray': '6 5' })
    ctx.set('normal-l', 'text', { x: O.x + 6, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '法线' })

    // 入射光线：从左上方射向 O（θ₁ 相对法线）
    const incDir = v(-Math.sin((params.th1 * Math.PI) / 180), -Math.cos((params.th1 * Math.PI) / 180))
    const incStart = add(O, scale(incDir, -RAY_L))
    ctx.set('incident', 'line', { x1: incStart.x, y1: incStart.y, x2: O.x, y2: O.y, stroke: C.amber, 'stroke-width': 3 })
    // 入射角标注
    const arcR = 56
    ctx.set('arc1', 'path', { d: describeArc(O.x, O.y, arcR, 270, 270 + params.th1), fill: 'none', stroke: C.amber, 'stroke-width': 1.5 })
    ctx.set('arc1-l', 'text', { x: O.x - 74, y: O.y - 12, 'font-size': 13, fill: C.amber, text: `θ₁=${fmt(params.th1, 0)}°` })

    // 可拖手柄：在入射光线上，拖动改变 θ₁
    const handle = ctx.set('handle', 'circle', { cx: add(O, scale(incDir, -RAY_L * 0.7)).x, cy: add(O, scale(incDir, -RAY_L * 0.7)).y, r: 9, fill: C.amber, stroke: C.dash, 'stroke-width': 2 })
    ctx.drag(handle, (p) => {
      const d = { x: p.x - O.x, y: p.y - O.y }
      // 只允许左半平面拖动，角度相对竖直法线
      let th = (Math.atan2(-d.x, -d.y) * 180) / Math.PI
      th = clamp(th, 0, 89)
      ctx.setParam('th1', Math.round(th))
      ctx.requestRender()
    })
    ctx.set('handle-l', 'text', { x: incStart.x - 4, y: incStart.y - 12, 'font-size': 13, fill: C.amber, 'text-anchor': 'middle', text: '↔ 拖我改入射角' })

    // 反射光线（右侧对称）
    const reflDir = v(Math.sin((params.th1 * Math.PI) / 180), -Math.cos((params.th1 * Math.PI) / 180))
    const total = params.n1 > params.n2 && params.th1 >= criticalDeg(params.n1, params.n2)
    ctx.set('refl', 'line', {
      x1: O.x, y1: O.y, x2: O.x + reflDir.x * RAY_L, y2: O.y + reflDir.y * RAY_L,
      stroke: total ? C.warn : C.faint, 'stroke-width': total ? 3.5 : 1.5,
      ...(total ? {} : { 'stroke-dasharray': '5 4' }),
    })

    // 折射光线（右下方）
    const sin2 = (params.n1 * Math.sin((params.th1 * Math.PI) / 180)) / params.n2
    let dataTheta2 = '—'
    if (sin2 <= 1) {
      const th2 = (Math.asin(sin2) * 180) / Math.PI
      dataTheta2 = `${fmt(th2, 1)}°`
      const refrDir = v(Math.sin((th2 * Math.PI) / 180), Math.cos((th2 * Math.PI) / 180))
      ctx.set('refr', 'line', { x1: O.x, y1: O.y, x2: O.x + refrDir.x * RAY_L, y2: O.y + refrDir.y * RAY_L, stroke: C.sky, 'stroke-width': 3 })
      ctx.set('arc2', 'path', { d: describeArc(O.x, O.y, arcR, 90, 90 - th2), fill: 'none', stroke: C.sky, 'stroke-width': 1.5 })
      ctx.set('arc2-l', 'text', { x: O.x + 60, y: O.y + 22, 'font-size': 13, fill: C.sky, text: `θ₂=${fmt(th2, 1)}°` })
      ctx.remove('total-tip')
    } else {
      ctx.remove('refr', 'arc2', 'arc2-l')
      ctx.set('total-tip', 'text', { x: O.x + 66, y: O.y + 40, 'font-size': 13, 'font-weight': 600, fill: C.warn, text: '✦ 全反射！无折射光线' })
    }

    // 临界角提示
    if (params.n1 > params.n2 + 0.01) {
      ctx.set('crit-l', 'text', { x: 400, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.7, text: `临界角 C=${fmt(criticalDeg(params.n1, params.n2), 1)}°（θ₁${total ? ' ≥' : ' <'} C）` })
    } else ctx.remove('crit-l')

    // 波前示意（分量开关 = 显示光的传播波前）
    if (opts.showComponents) {
      for (let i = 1; i <= 3; i++) {
        const d = RAY_L * (i / 4)
        const pw = add(O, scale(incDir, -d))
        ctx.set(`wf${i}`, 'line', {
          x1: pw.x + fromDeg(90).x * 14, y1: pw.y + fromDeg(90).y * 14,
          x2: pw.x - fromDeg(90).x * 14, y2: pw.y - fromDeg(90).y * 14,
          stroke: C.amber, 'stroke-opacity': 0.4, 'stroke-width': 1.5,
        })
      }
    } else ctx.remove('wf1', 'wf2', 'wf3')

    data['入射角 θ₁'] = `${fmt(params.th1, 0)}°`
    data['折射角 θ₂'] = dataTheta2
    data['临界角 C'] = params.n1 > params.n2 ? `${fmt(criticalDeg(params.n1, params.n2), 1)}°` : '不存在（n₁≤n₂）'
    data['状态'] = sin2 > 1 ? '全反射（光密→光疏且 θ₁>C）' : '折射 + 部分反射'
    data['n₁sinθ₁'] = fmt(params.n1 * Math.sin((params.th1 * Math.PI) / 180), 3)
    data['n₂sinθ₂'] = sin2 <= 1 ? fmt(params.n2 * sin2, 3) : '—（>1 无解）'
    return data
  },
}

/** 临界角（度） */
function criticalDeg(n1: number, n2: number): number {
  return (Math.asin(Math.min(n2 / n1, 1)) * 180) / Math.PI
}

/** 圆弧 path（从角度 a1 到 a2，屏幕坐标系，a=270 指向上） */
function describeArc(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p1 = { x: cx + r * Math.cos((a1 * Math.PI) / 180), y: cy + r * Math.sin((a1 * Math.PI) / 180) }
  const p2 = { x: cx + r * Math.cos((a2 * Math.PI) / 180), y: cy + r * Math.sin((a2 * Math.PI) / 180) }
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0
  const sweep = a2 > a1 ? 1 : 0
  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} A${r},${r} 0 ${large} ${sweep} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
}
