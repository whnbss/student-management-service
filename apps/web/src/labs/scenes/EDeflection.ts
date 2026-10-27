// 课件 23：带电粒子在电场中的加速与偏转（必修三 · 静电场）
// 示波管模型：拖 U 加速、U′ 偏转、板距 d、板长 L，类平抛轨迹，荧光屏落点 y=eU′L²/(4dmv₀²)
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, add, clamp, fmt, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const E_CHARGE = 1.6e-19
const M_E = 9.11e-31 // 电子质量

// 舞台布局
const GUN_X = 60 // 阴极
const PLATE_X0 = 150 // 偏转电场左缘
const PLATE_X1 = 330 // 右缘
const SCREEN_X = 560 // 荧光屏
const MID_Y = 210 // 中轴线
const PX_PER_M_X = 900 // 横向像素/米
const SCALE_Y = 2200 // 纵向视觉放大（y 位移米→像素）

interface S extends LabState {
  t: number // 动画时间
}

export const eDeflectionScene: LabScene = {
  id: 'e-deflection',
  title: '电场中的加速与偏转',
  grade: '高二',
  chapter: '必修三 · 静电场',
  desc: '示波管模型：加速电场提速 → 偏转电场类平抛 → 荧光屏落点，拖 U′ 看偏移量实时变化',
  tags: ['带电粒子', '电场偏转', '类平抛', '示波管', '加速电场'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'U1', label: '加速电压 U', min: 200, max: 2000, step: 50, unit: 'V', default: 800, reset: false },
    { key: 'U2', label: '偏转电压 U′', min: -400, max: 400, step: 10, unit: 'V', default: 160, reset: false },
    { key: 'd', label: '板间距 d', min: 0.02, max: 0.1, step: 0.005, unit: 'm', default: 0.04, reset: false },
    { key: 'L', label: '板长 L', min: 0.1, max: 0.25, step: 0.01, unit: 'm', default: 0.2, reset: false },
    {
      key: 'play', label: '发射电子', min: 0, max: 1, step: 1, unit: '', default: 0, reset: false,
      options: [{ value: 0, label: '暂停' }, { value: 1, label: '发射（动画）' }],
    },
  ],
  presets: [
    { name: '标准演示', params: { U1: 800, U2: 160, d: 0.04, L: 0.2, play: 1 } },
    { name: "U′=0 不偏转", params: { U1: 800, U2: 0, d: 0.04, L: 0.2, play: 1 } },
    { name: "大偏转（U′=360V）", params: { U1: 800, U2: 360, d: 0.04, L: 0.2, play: 1 } },
    { name: '先加速更强（U=2000V）', params: { U1: 2000, U2: 160, d: 0.04, L: 0.2, play: 1 } },
  ],
  formulas: [
    'v_0 = \\sqrt{2eU/m}',
    'y_1 = \\tfrac{1}{2}at^2,\\quad a = \\frac{eU\'}{md}',
    'y_{\\text{屏}} \\propto U\' \\quad (\\text{示波器原理})',
  ],
  keyPoints: [
    '加速：qU = ½mv²，出加速场的速度由加速电压决定',
    '偏转：类平抛——沿初速方向匀速、垂直方向匀加速',
    '同一加速电压下，屏上偏移 y 与偏转电压 U′ 成正比（示波器扫描原理）',
  ],
  init(): S {
    return { t: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    if (params.play === 1) st.t += dt
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}

    // 物理量
    const v0 = Math.sqrt((2 * E_CHARGE * params.U1) / M_E) // m/s
    const L = params.L
    const d = params.d
    const aDef = (E_CHARGE * params.U2) / (M_E * d) // m/s²
    const tPlate = L / v0
    const dirY = params.U2 >= 0 ? 1 : -1 // U2>0：电子（负电）向下偏（屏幕 y 向下）
    const yExitM = 0.5 * aDef * tPlate * tPlate
    const vyExit = aDef * tPlate
    const D = (SCREEN_X - PLATE_X1) / PX_PER_M_X // 板右缘到屏距离（m）
    const yScreenM = yExitM + vyExit * (D / v0)
    const gapPx = Math.max(18, ((d / 2) * SCALE_Y) / 2) // 视觉板距（减半防出画）
    const LIMIT_Y = 140 // 轨迹离中轴超出即撞板

    const yPxAt = (xpx: number): number => {
      if (xpx < PLATE_X0) return MID_Y
      if (xpx <= PLATE_X1) {
        const s1 = (xpx - PLATE_X0) / PX_PER_M_X
        return MID_Y + 0.5 * aDef * (s1 / v0) ** 2 * dirY * SCALE_Y
      }
      const s2 = (xpx - PLATE_X1) / PX_PER_M_X
      return MID_Y + (yExitM * dirY + (vyExit / v0) * s2 * dirY) * SCALE_Y
    }

    // 装置
    ctx.set('axis', 'line', { x1: GUN_X, y1: MID_Y, x2: SCREEN_X, y2: MID_Y, stroke: 'currentColor', 'stroke-opacity': 0.2, 'stroke-dasharray': '4 4' })
    ctx.set('cathode', 'rect', { x: GUN_X - 10, y: MID_Y - 30, width: 10, height: 60, fill: '#475569' })
    ctx.set('cathode-l', 'text', { x: GUN_X - 4, y: MID_Y + 48, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: `阴极 U=${fmt(params.U1, 0)}V` })
    ctx.set('anode', 'rect', { x: GUN_X + 34, y: MID_Y - 30, width: 8, height: 60, fill: '#94a3b8' })
    ctx.set('anode-hole', 'rect', { x: GUN_X + 34, y: MID_Y - 5, width: 8, height: 10, fill: '#fde68a' })
    ctx.set('plate-top', 'rect', { x: PLATE_X0, y: MID_Y - gapPx - 8, width: PLATE_X1 - PLATE_X0, height: 8, fill: '#8b5cf6' })
    ctx.set('plate-bot', 'rect', { x: PLATE_X0, y: MID_Y + gapPx, width: PLATE_X1 - PLATE_X0, height: 8, fill: '#8b5cf6' })
    ctx.set('plate-l', 'text', { x: (PLATE_X0 + PLATE_X1) / 2, y: MID_Y - gapPx - 15, 'font-size': 13, 'text-anchor': 'middle', fill: C.field, text: `U′=${fmt(params.U2, 0)}V` })
    ctx.set('plate-d', 'text', { x: PLATE_X1 + 14, y: MID_Y + 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: `d=${fmt(d * 100, 1)}cm` })
    ctx.set('screen', 'rect', { x: SCREEN_X, y: 60, width: 12, height: 300, fill: '#334155', rx: 4 })
    ctx.set('screen-l', 'text', { x: SCREEN_X + 6, y: 50, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '荧光屏' })

    // 轨迹：板内抛物线 + 板外直线（撞板截断）
    const trajPts: string[] = []
    let hitPlate = false
    for (let X = GUN_X + 42; X <= SCREEN_X; X += 4) {
      const Y = yPxAt(X)
      if (X <= PLATE_X1 && Math.abs(Y - MID_Y) > Math.min(LIMIT_Y, gapPx)) {
        hitPlate = true
        break
      }
      trajPts.push(`${trajPts.length === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`)
    }
    if (trajPts.length > 2) ctx.set('traj', 'path', { d: trajPts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2, 'stroke-opacity': 0.8 })
    else ctx.remove('traj')

    // 飞行的电子（沿轨迹动画；play=0 时停在轨迹中点）
    const startX = GUN_X + 42
    const totalX = SCREEN_X - startX
    const cyc = 1.6
    const progress = ((st.t * v0 * PX_PER_M_X) / cyc) % (totalX * cyc)
    const eX = startX + (progress <= totalX ? progress : 0)
    const eY = yPxAt(eX)
    const showE = !hitPlate && eX <= SCREEN_X && (params.play === 1 ? progress <= totalX : true)
    if (showE) {
      const pausedX = params.play === 1 ? eX : startX + totalX * 0.4
      ctx.set('electron', 'circle', { cx: pausedX, cy: yPxAt(pausedX), r: 5, fill: '#fde047', stroke: '#ca8a04' })
    } else ctx.remove('electron')
    // 荧光点（撞板则无光点）
    const Ys = yPxAt(SCREEN_X - 2)
    if (!hitPlate && Math.abs(Ys - MID_Y) <= 140) {
      ctx.set('glow', 'circle', { cx: SCREEN_X - 1, cy: Ys, r: 7, fill: '#a3e635', 'fill-opacity': 0.9 })
      ctx.set('glow-core', 'circle', { cx: SCREEN_X - 1, cy: Ys, r: 3, fill: '#ecfccb' })
    } else ctx.remove('glow', 'glow-core')

    // 速度/电场力箭头
    const exNow = params.play === 1 ? eX : startX + totalX * 0.4
    if (opts.showForces && exNow > PLATE_X0 && exNow < PLATE_X1 && !hitPlate) {
      const p = v(exNow, yPxAt(exNow))
      drawArrow(ctx, 'fv', p, add(p, v(28, 0)), { color: C.tension, label: `v₀=${sciFmt(v0)}m/s` })
      if (Math.abs(params.U2) > 1) drawArrow(ctx, 'fF', p, add(p, v(0, dirY * 30)), { color: C.field, label: 'F=eE′' })
      else ctx.remove('fF', 'fF-head', 'fF-label')
    } else {
      ctx.remove('fv', 'fv-head', 'fv-label', 'fF', 'fF-head', 'fF-label')
    }
    if (hitPlate) ctx.set('tip', 'text', { x: 44, y: 40, 'font-size': 13, fill: C.warn, text: '⚠ 电子打在偏转板上（U′ 过大或 d 过小），调小 U′ 再试' })
    else ctx.remove('tip')

    // 图像面板：y_屏 与 U′ 的线性关系 + 当前工作点
    if (ctx.gw) {
      const box = { x: 42, y: 24, w: ctx.gw - 66, h: ctx.gh - 62 }
      const u2Max = 400
      const pts: [number, number][] = []
      for (let u2 = -u2Max; u2 <= u2Max; u2 += 8) {
        const a = (E_CHARGE * u2) / (M_E * d)
        const yE = 0.5 * a * tPlate * tPlate
        if (Math.abs(yE) > d / 2 - 0.002) continue // 撞板段不画
        pts.push([u2, (yE + a * tPlate * (D / v0)) * 1000])
      }
      const yMax = Math.max(6, Math.ceil(Math.abs(yScreenM * 1000 * 1.4)))
      axes(ctx, box, { xLabel: "U'/(V)", yLabel: 'y_屏/(mm)', xMax: u2Max, yMax, xMin: -u2Max, yMin: -yMax })
      polyline(ctx, 'g-line', pts, box, -u2Max, u2Max, -yMax, yMax, C.accent)
      ctx.gset('g-zero', 'line', { x1: box.x, y1: gy(box, -yMax, yMax, 0), x2: box.x + box.w, y2: gy(box, -yMax, yMax, 0), stroke: 'currentColor', 'stroke-opacity': 0.3, 'stroke-dasharray': '3 3' })
      const cxg = gx(box, -u2Max, u2Max, clamp(params.U2, -u2Max, u2Max))
      const cyg = gy(box, -yMax, yMax, clamp(yScreenM * 1000, -yMax, yMax))
      ctx.gset('g-dot', 'circle', { cx: cxg, cy: cyg, r: 5, fill: C.warn })
      ctx.gset('g-dot-l', 'text', { x: cxg + 8, y: cyg - 6, 'font-size': 13, fill: C.warn, text: `(${fmt(params.U2, 0)}V, ${fmt(Math.abs(yScreenM) * 1000, 1)}mm)` })
    }

    data['出加速场速度 v₀'] = `${sciFmt(v0)} m/s`
    data['偏转加速度 a=eU′/(md)'] = aDef !== 0 ? `${sciFmt(aDef)} m/s²` : '0'
    data['板内运动时间 t=L/v₀'] = `${sciFmt(tPlate)} s`
    data['离板偏移 y₁'] = `${fmt(Math.abs(yExitM) * 1000, 2)} mm`
    data['荧光屏偏移 y_屏'] = hitPlate ? '打在板上' : `${fmt(Math.abs(yScreenM) * 1000, 2)} mm`
    data['与 U′ 关系'] = 'y_屏 ∝ U′（线性）'
    return data
  },
}

/** 科学计数显示 */
function sciFmt(n: number): string {
  if (n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  if (exp >= -2 && exp <= 4) return fmt(n, 2)
  return `${fmt(n / 10 ** exp, 2)}×10^${exp}`
}
