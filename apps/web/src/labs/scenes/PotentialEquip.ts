// 课件 22：电势与等势面（必修三 · 静电场）
// 沿等势面拖动「做功为零」，沿电场线（径向）拖动看电势能与电势变化，W=qU
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, add, clamp, fmt, len, norm, sub, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const K = 8.99e9
const CENTER: V = v(300, 210)
// 源电荷 4μC：等势面取 Φ = 90/60/30 kV 对应 r = kq/Φ
const PHI_LEVELS = [90, 60, 30] // kV
const Q_SRC = 4e-6

interface S extends LabState {
  pos: V // 试探电荷（像素）
  r0: number // 拖动开始时的半径（px），等势面锁定用
  rPrev: number // 上一帧距源距离（px），用于估算拖动过程 W=qΔΦ
}

/** 电势 Φ(kV) → 等势面半径（px），1px=1cm */
function phiToR(phiKv: number): number {
  return (K * Q_SRC) / (phiKv * 1e3) * 100
}

export const potentialScene: LabScene = {
  id: 'potential-equip',
  title: '电势与等势面',
  grade: '高二',
  chapter: '必修三 · 静电场',
  desc: '正点电荷的等势面族：沿等势面拖动电荷做功为零；沿径向拖动看 Φ、Ep 与 W=qU 变化',
  tags: ['电势', '等势面', '电势能', '电势差', '电场力做功'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'qt', label: '试探电荷 q', min: -3, max: 3, step: 0.5, unit: 'μC', default: 1, reset: false },
    {
      key: 'guide', label: '拖动辅助', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '自由拖动' }, { value: 1, label: '锁定到等势面（演示 W=0）' }],
    },
  ],
  presets: [
    { name: '沿等势面移动（W=0）', params: { qt: 1, guide: 1 }, state: { pos: v(300, 210 - phiToR(60)) } },
    { name: '沿电场线靠近（电场力做正功）', params: { qt: 1, guide: 0 }, state: { pos: v(300, 210 - phiToR(90)) } },
    { name: '负试探电荷', params: { qt: -1, guide: 0 }, state: { pos: v(300, 210 - phiToR(60)) } },
  ],
  formulas: [
    '\\Phi = k\\frac{Q}{r}',
    'E_p = q\\Phi',
    'W_{AB} = qU_{AB} = q(\\Phi_A - \\Phi_B)',
  ],
  keyPoints: [
    '等势面与电场线处处垂直；同一等势面上移动电荷电场力不做功',
    '沿电场线方向电势降低；正电荷顺电场线移动电场力做正功、电势能减少',
    '电势是标量、有正负（相对零电势点），与试探电荷无关',
  ],
  init(params: SceneParams): S {
    return { pos: v(300, 210 - phiToR(60)), r0: phiToR(60), rPrev: phiToR(60) }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}

    // 等势面（虚线圆）+ 电势标注
    for (let i = 0; i < PHI_LEVELS.length; i++) {
      const R = phiToR(PHI_LEVELS[i])
      ctx.set(`eq${i}`, 'circle', { cx: CENTER.x, cy: CENTER.y, r: R, fill: 'none', stroke: C.accent, 'stroke-opacity': 0.55, 'stroke-dasharray': '6 5', 'stroke-width': 1.5 })
      ctx.set(`eq${i}-l`, 'text', {
        x: CENTER.x + R * 0.7071 + 4, y: CENTER.y - R * 0.7071 - 4, 'font-size': 13, fill: C.accent, 'fill-opacity': 0.8,
        text: `Φ=${PHI_LEVELS[i]}kV`,
      })
    }
    // 放射状电场线（浅）
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      ctx.set(`rl${i}`, 'line', {
        x1: CENTER.x + Math.cos(ang) * 20, y1: CENTER.y + Math.sin(ang) * 20,
        x2: CENTER.x + Math.cos(ang) * (ctx.w / 2 - 6), y2: CENTER.y + Math.sin(ang) * (ctx.h / 2 - 6),
        stroke: C.field, 'stroke-opacity': 0.18, 'stroke-width': 1.2,
      })
    }

    // 源电荷
    ctx.set('src', 'circle', { cx: CENTER.x, cy: CENTER.y, r: 16, fill: C.gravity, stroke: C.redDeep, 'stroke-width': 2 })
    ctx.set('src-t', 'text', { x: CENTER.x, y: CENTER.y + 5, 'font-size': 14, 'text-anchor': 'middle', fill: C.dash, text: '+' })
    ctx.set('src-l', 'text', { x: CENTER.x, y: CENTER.y + 32, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: 'Q=4μC' })

    // 试探电荷（拖动：guide=1 时锁定到最近的等势面）
    const tc = ctx.set('tc', 'circle', { cx: st.pos.x, cy: st.pos.y, r: 12, fill: params.qt >= 0 ? C.amber : C.sky, stroke: params.qt >= 0 ? C.amberDeep : C.skyDeep, 'stroke-width': 2 })
    ctx.set('tc-t', 'text', { x: st.pos.x, y: st.pos.y + 4, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: params.qt >= 0 ? '+' : '−' })
    ctx.drag(
      tc,
      (p) => {
      let np = v(clamp(p.x, 16, ctx.w - 16), clamp(p.y, 16, ctx.h - 16))
      if (params.guide === 1) {
        // 锁定到最近等势面：保持半径不变（起点半径）
        const d = sub(np, CENTER)
        const l = len(d) || 1
        np = add(CENTER, { x: (d.x / l) * st.r0, y: (d.y / l) * st.r0 })
      }
      st.pos = np
      ctx.requestRender()
      },
      () => {
        // 拖动开始：记录当前半径，等势面锁定时保持该半径不变
        st.r0 = len(sub(st.pos, CENTER))
      }
    )

    // 电场力（沿径向，正电荷背离源 / 负电荷指向源）
    const rpx = Math.max(len(sub(st.pos, CENTER)), 20)
    const rM = rpx / 100
    const phi = (K * Q_SRC) / rM // V
    const Ep = params.qt * 1e-6 * phi
    const F = (K * Math.abs(Q_SRC * params.qt * 1e-6)) / (rM * rM)
    if (opts.showForces) {
      const k = 90 / Math.max(F, 1e-9)
      const u = norm(sub(st.pos, CENTER))
      const sgn = params.qt >= 0 ? 1 : -1
      const from = st.pos
      drawArrow(ctx, 'fF', from, add(from, { x: sgn * u.x * F * k, y: sgn * u.y * F * k }), { color: C.field, label: `F=${fmt(F, 2)}N` })
      if (opts.showPoints) ctx.set('dot-t', 'circle', { cx: st.pos.x, cy: st.pos.y, r: 2.5, fill: C.inkStrong })
      else ctx.remove('dot-t')
    } else {
      ctx.remove('fF', 'fF-head', 'fF-label', 'dot-t')
    }

    // 拖动过程 W 提示（qΔΦ，用半径变化估算本次拖动的做功）
    const dPhi = (K * Q_SRC) * (1 / rM - 1 / (st.rPrev / 100 || rM))
    const wMove = params.qt * 1e-6 * dPhi
    st.rPrev = rpx
    const nearEquip = PHI_LEVELS.some((p) => Math.abs(phi / 1000 - p) < 1.5)
    ctx.set('tip', 'text', {
      x: 44, y: 32, 'font-size': 13, fill: nearEquip ? C.accent : 'currentColor', 'fill-opacity': nearEquip ? 1 : 0.55,
      text: nearEquip ? '✓ 正在等势面上移动：W=0（电势能不变）' : params.guide === 1 ? '已锁定等势面：无论怎么拖 W=0' : '跨越等势面移动时：W = q(Φ₁−Φ₂) ≠ 0',
    })

    data['距源电荷 r'] = `${fmt(rM * 100, 1)} cm`
    data['电势 Φ=kQ/r'] = `${fmt(phi / 1000, 2)} kV`
    data['电势能 Ep=qΦ'] = `${fmt(Ep, 2)} J`
    data['电场力 F'] = `${fmt(F, 3)} N`
    data['本次拖动做功 W=qΔΦ'] = `${fmt(wMove, 4)} J`
    data['判断'] = Math.abs(wMove) < 0.005 ? '近似不做功（等势面）' : wMove > 0 ? '电场力做正功，Ep 减少' : '电场力做负功，Ep 增加'
    return data
  },
}
