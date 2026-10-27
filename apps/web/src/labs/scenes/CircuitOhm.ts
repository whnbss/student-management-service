// 课件 25：电路 · 滑动变阻器与欧姆定律（必修三 · 电路）
// 限流/分压两种接法切换，拖滑片，实时 I、U、灯泡亮度；U-I 图像工作点
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { axes, gx, gy } from '../engine/graph'

const EMF = 6 // 电源电动势 V
const R0 = 20 // 变阻器全阻值 Ω
const R_BULB = 10 // 灯泡电阻（线性近似）
const R_INT = 0.5 // 电源内阻 Ω

interface S extends LabState {
  pos: number // 滑片位置 0~1
}

export const circuitScene: LabScene = {
  id: 'circuit-ohm',
  title: '滑动变阻器与欧姆定律',
  grade: '高二',
  chapter: '必修三 · 电路',
  desc: '限流/分压两种接法：拖滑片实时看 I、U、灯泡亮度变化；U-I 图像上显示工作点',
  tags: ['欧姆定律', '滑动变阻器', '限流接法', '分压接法', '闭合电路'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    {
      key: 'mode', label: '接法', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '限流接法' }, { value: 1, label: '分压接法' }],
    },
    { key: 'slider', label: '滑片位置', min: 0, max: 1, step: 0.01, unit: '', default: 0.5, reset: false },
  ],
  presets: [
    { name: '限流 · 中点', params: { mode: 0, slider: 0.5 } },
    { name: '限流 · 滑到头（灯最亮）', params: { mode: 0, slider: 1 } },
    { name: '分压 · 从零起调', params: { mode: 1, slider: 0.05 } },
    { name: '分压 · 中点', params: { mode: 1, slider: 0.5 } },
  ],
  formulas: [
    'I = \\frac{E}{R_{\\text{灯}} + R_{\\text{入}} + r}',
    '\\text{限流：} R_{\\text{入}} = xR_0 \\quad \\text{分压：} U_{\\text{灯}} \\text{ 可从 } 0 \\text{ 起调}',
    'U = E - Ir',
  ],
  keyPoints: [
    '限流接法省线但调压范围有限；分压接法电压可从 0 连续调到 E',
    '分压接法：变阻器下端两接线柱必须同时接入电路',
    '闭合电路欧姆定律 U=E−Ir：路端电压随电流增大而减小',
  ],
  init(): S {
    return { pos: 0.5 }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    void opts
    void st
    const mode = params.mode
    const x = clamp(params.slider, 0, 1)

    // 物理量
    let I: number
    let Ubulb: number
    if (mode === 0) {
      // 限流：变阻器 x·R0 与灯串联
      I = EMF / (R_BULB + x * R0 + R_INT)
      Ubulb = I * R_BULB
    } else {
      // 分压：变阻器全阻接电源，灯并在 x 段上（忽略内阻影响近似精确解）
      // 等效：xR0 ∥ R_BULB 再串 (1−x)R0
      const Rx = x * R0
      const par = (Rx * R_BULB) / (Rx + R_BULB)
      I = EMF / (par + (1 - x) * R0 + R_INT)
      Ubulb = I * par
    }
    const Pbulb = Ubulb * I
    const Uterm = EMF - I * R_INT

    // —— 电路图 ——
    const bx = 120
    const by = 300 // 电源位置
    const wire = '#334155'
    // 外框回路
    ctx.set('w-top', 'line', { x1: bx, y1: by, x2: 90, y2: by, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-left', 'line', { x1: 90, y1: by, x2: 90, y2: 120, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-top2', 'line', { x1: 90, y1: 120, x2: 500, y2: 120, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-right', 'line', { x1: 500, y1: 120, x2: 500, y2: by, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-bot', 'line', { x1: 500, y1: by, x2: bx + 60, y2: by, stroke: wire, 'stroke-width': 2 })
    // 电源（长短线）
    ctx.set('bat1', 'line', { x1: bx, y1: by - 16, x2: bx, y2: by + 16, stroke: wire, 'stroke-width': 3 })
    ctx.set('bat2', 'line', { x1: bx + 14, y1: by - 8, x2: bx + 14, y2: by + 8, stroke: wire, 'stroke-width': 6 })
    ctx.set('bat-l', 'text', { x: bx + 34, y: by + 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.7, text: `E=${EMF}V r=${R_INT}Ω` })
    // 灯泡（顶部中央）
    const bulbX = 300
    const bulbY = 120
    const glowR = clamp(10 + Pbulb * 22, 8, 46)
    ctx.set('bulb-glow', 'circle', { cx: bulbX, cy: bulbY - 22, r: glowR, fill: '#fde047', 'fill-opacity': clamp(0.15 + Pbulb / 3, 0.1, 0.85) })
    ctx.set('bulb', 'circle', { cx: bulbX, cy: bulbY - 22, r: 14, fill: '#fef9c3', stroke: '#a16207', 'stroke-width': 2 })
    ctx.set('bulb-l', 'text', { x: bulbX, y: bulbY + 16, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.7, text: `灯 ${R_BULB}Ω` })
    // 变阻器（右侧竖直，四端示意）
    const rx = 500
    const ry0 = 140
    const rh = 150
    ctx.set('rh-body', 'rect', { x: rx - 8, y: ry0, width: 16, height: rh, fill: '#cbd5e1', stroke: '#64748b', rx: 3 })
    // 绕线纹理
    for (let i = 0; i < 8; i++) {
      ctx.set(`rh-w${i}`, 'line', { x1: rx - 8, y1: ry0 + (i * rh) / 8, x2: rx + 8, y2: ry0 + ((i + 1) * rh) / 8, stroke: '#64748b', 'stroke-width': 1 })
    }
    // 滑块（拖拽）
    const sy = ry0 + x * rh
    const slider = ctx.set('rh-slider', 'rect', { x: rx - 20, y: sy - 6, width: 40, height: 12, fill: '#f59e0b', stroke: '#b45309', rx: 3 })
    ctx.drag(slider, (p) => {
      ctx.setParam('slider', clamp((p.y - ry0) / rh, 0, 1))
      ctx.requestRender()
    })
    ctx.set('rh-l', 'text', { x: rx + 28, y: sy + 4, 'font-size': 13, fill: '#b45309', text: `滑片 x=${fmt(x, 2)}` })

    if (mode === 0) {
      // 限流：变阻器下端接回路，滑片经上部导线到灯
      ctx.set('rh-wire1', 'line', { x1: rx, y1: ry0 + rh, x2: rx, y2: by, stroke: wire, 'stroke-width': 2 })
      ctx.set('rh-wire2', 'line', { x1: rx, y1: sy, x2: bulbX + 90, y2: bulbY - 22, stroke: wire, 'stroke-width': 2 })
      ctx.set('rh-wire2b', 'line', { x1: bulbX + 90, y1: bulbY - 22, x2: bulbX + 14, y2: bulbY - 22, stroke: wire, 'stroke-width': 2 })
      ctx.remove('rh-tap')
    } else {
      // 分压：变阻器全阻入电路，滑片引出到灯
      ctx.set('rh-wire1', 'line', { x1: rx, y1: ry0 + rh, x2: rx, y2: by, stroke: wire, 'stroke-width': 2 })
      ctx.set('rh-wire2', 'line', { x1: rx, y1: sy, x2: bulbX + 90, y2: bulbY - 22, stroke: wire, 'stroke-width': 2 })
      ctx.set('rh-wire2b', 'line', { x1: bulbX + 90, y1: bulbY - 22, x2: bulbX + 14, y2: bulbY - 22, stroke: wire, 'stroke-width': 2 })
      ctx.set('rh-tap', 'line', { x1: rx - 12, y1: ry0 + rh, x2: 500, y2: ry0 + rh, stroke: C.warn, 'stroke-width': 1.5, 'stroke-dasharray': '3 2' })
    }

    // 电流方向箭头
    const ia = clamp(I / 0.6, 0.15, 1)
    ctx.set('i-arrow', 'polygon', { points: `200,120 188,115 188,125`, fill: '#059669', 'fill-opacity': ia })
    ctx.set('i-label', 'text', { x: 205, y: 112, 'font-size': 13, fill: '#059669', text: `I=${fmt(I, 3)}A` })

    // 提示
    ctx.set('tip', 'text', {
      x: 44, y: 40, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.55,
      text: mode === 0 ? '限流：滑片向下滑 → 接入电阻变小 → 灯变亮；调压范围有限' : '分压：滑片从最下端起调，灯的电压可从 0 连续调到接近 E',
    })

    // U-I 图像：电源外特性线 U=E−Ir + 当前工作点
    if (ctx.gw) {
      const box = { x: 42, y: 24, w: ctx.gw - 66, h: ctx.gh - 62 }
      const iMax = EMF / (R_BULB + R_INT)
      const uMax = EMF
      axes(ctx, box, { xLabel: 'I/(A)', yLabel: 'U/(V)', xMax: Math.ceil(iMax * 10) / 10, yMax: uMax })
      // 外特性直线（两点）
      const x1p = gx(box, 0, Math.ceil(iMax * 10) / 10, 0)
      const y1p = gy(box, 0, uMax, EMF)
      const x2p = gx(box, 0, Math.ceil(iMax * 10) / 10, iMax)
      const y2p = gy(box, 0, uMax, Uterm > 0 ? 0 : 0)
      ctx.gset('g-line', 'line', { x1: x1p, y1: y1p, x2: x2p, y2: y2p, stroke: C.accent, 'stroke-width': 2 })
      // 工作点
      const iDisp = clamp(I, 0, Math.ceil(iMax * 10) / 10)
      ctx.gset('g-dot', 'circle', { cx: gx(box, 0, Math.ceil(iMax * 10) / 10, iDisp), cy: gy(box, 0, uMax, clamp(Uterm, 0, uMax)), r: 5, fill: C.warn })
      ctx.gset('g-dot-l', 'text', { x: gx(box, 0, Math.ceil(iMax * 10) / 10, iDisp) + 8, y: gy(box, 0, uMax, clamp(Uterm, 0, uMax)) - 6, 'font-size': 13, fill: C.warn, text: `(${fmt(I, 2)}A, ${fmt(Uterm, 2)}V)` })
    }

    data['电流 I'] = `${fmt(I, 3)} A`
    data['灯泡电压 U_灯'] = `${fmt(Ubulb, 2)} V`
    data['路端电压 U=E−Ir'] = `${fmt(Uterm, 2)} V`
    data['灯泡功率 P'] = `${fmt(Pbulb, 3)} W`
    data['亮度'] = Pbulb > 1.2 ? '明亮' : Pbulb > 0.4 ? '较暗' : Pbulb > 0.05 ? '微光' : '熄灭'
    data['接法'] = mode === 0 ? '限流' : '分压'
    return data
  },
}
