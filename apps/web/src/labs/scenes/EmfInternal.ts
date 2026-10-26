// 课件 26：电源电动势与内阻（必修三 · 电路）
// 拖外阻 R，实时路端电压 U=E−Ir、效率 η、输出功率 P（R=r 时最大），U-I 图线与工作点
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { axes, gx, gy, polyline } from '../engine/graph'

const EMF = 6 // 电动势 V
const R_INT = 1 // 内阻 Ω

interface S extends LabState {
  t: number
}

export const emfScene: LabScene = {
  id: 'emf-internal',
  title: '电源电动势与内阻',
  grade: '高二',
  chapter: '必修三 · 电路',
  desc: '拖外阻 R：U=E−Ir、效率 η、输出功率实时；R=r 时输出功率最大，U-I 图线自动描绘',
  tags: ['电动势', '内阻', '路端电压', '输出功率', '效率'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'R', label: '外阻 R', min: 0.2, max: 20, step: 0.1, unit: 'Ω', default: 2, reset: false },
    { key: 'r', label: '内阻 r', min: 0.2, max: 5, step: 0.1, unit: 'Ω', default: 1, reset: false },
  ],
  presets: [
    { name: 'R = 2r（对比）', params: { R: 2, r: 1 } },
    { name: 'R = r（输出功率最大）', params: { R: 1, r: 1 } },
    { name: 'R ≫ r（电压表测电动势）', params: { R: 20, r: 1 } },
    { name: '短路边缘（R→0.2Ω）', params: { R: 0.2, r: 1 } },
  ],
  formulas: [
    'I = \\frac{E}{R + r}',
    'U = E - Ir',
    'P_{\\text{出}} = I^2R,\\quad R=r \\text{ 时 } P_{\\max} = \\frac{E^2}{4r}',
    '\\eta = \\frac{R}{R + r}',
  ],
  keyPoints: [
    '路端电压 U 随 R 增大而增大（外电路断开时 U=E）',
    'R=r 时电源输出功率最大，但此时效率只有 50%',
    '短路电流 I短 = E/r 很大，实际电源严禁短路',
  ],
  init(): S {
    return { t: 0 }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    void st
    void opts
    const R = params.R
    const r = params.r
    const I = EMF / (R + r)
    const U = EMF - I * r
    const Pout = I * I * R
    const Pmax = (EMF * EMF) / (4 * r)
    const eta = R / (R + r)

    // —— 电路图 ——
    const wire = '#334155'
    const bx = 110
    const by = 300
    ctx.set('w-left', 'line', { x1: bx, y1: by, x2: 80, y2: by, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-up', 'line', { x1: 80, y1: by, x2: 80, y2: 110, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-top', 'line', { x1: 80, y1: 110, x2: 520, y2: 110, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-right', 'line', { x1: 520, y1: 110, x2: 520, y2: by, stroke: wire, 'stroke-width': 2 })
    ctx.set('w-bot', 'line', { x1: 520, y1: by, x2: bx + 20, y2: by, stroke: wire, 'stroke-width': 2 })
    // 电源（长正短负）+ 内阻小方块
    ctx.set('bat', 'line', { x1: bx, y1: by - 18, x2: bx, y2: by + 18, stroke: wire, 'stroke-width': 3 })
    ctx.set('bat2', 'line', { x1: bx + 12, y1: by - 9, x2: bx + 12, y2: by + 9, stroke: wire, 'stroke-width': 7 })
    ctx.set('bat-l', 'text', { x: bx + 26, y: by + 4, 'font-size': 12, fill: 'currentColor', 'fill-opacity': 0.7, text: `E=${EMF}V` })
    ctx.set('rint', 'rect', { x: bx - 18, y: by + 40, width: 36, height: 14, fill: '#e2e8f0', stroke: '#64748b' })
    ctx.set('rint-l', 'text', { x: bx + 26, y: by + 52, 'font-size': 11, fill: 'currentColor', 'fill-opacity': 0.55, text: `r=${fmt(r, 1)}Ω` })
    ctx.set('rint-w1', 'line', { x1: bx, y1: by, x2: bx, y2: by + 40, stroke: wire, 'stroke-width': 2 })
    ctx.set('rint-w2', 'line', { x1: bx, y1: by + 54, x2: bx, y2: by + 70, stroke: wire, 'stroke-width': 2 })
    ctx.set('rint-w3', 'line', { x1: bx, y1: by + 70, x2: 80, y2: by + 70, stroke: wire, 'stroke-width': 2 })
    ctx.set('rint-w4', 'line', { x1: 80, y1: by + 70, x2: 80, y2: by, stroke: wire, 'stroke-width': 2 })

    // 外阻 R（可拖大小：电阻块宽度/颜色变化）
    const rx = 520
    const rh = clamp(30 + (R / 20) * 110, 30, 150)
    const ry = 210 - rh / 2
    const rBody = ctx.set('r-body', 'rect', { x: rx - 12, y: ry, width: 24, height: rh, fill: '#fbbf24', stroke: '#b45309', rx: 4, 'fill-opacity': 0.9 })
    ctx.set('r-l', 'text', { x: rx + 24, y: 208, 'font-size': 13, fill: '#b45309', text: `R=${fmt(R, 1)}Ω` })
    ctx.drag(rBody, (p) => {
      // 纵向拖动改 R（越往上越大）
      const ratio = clamp(1 - (p.y - 120) / 180, 0, 1)
      ctx.setParam('R', Math.round((0.2 + ratio * 19.8) * 10) / 10)
      ctx.requestRender()
    })
    // 电压表（并联在 R 两端，读数 = U）
    ctx.set('volt', 'circle', { cx: 570, cy: 210, r: 22, fill: '#fff', stroke: '#64748b', 'stroke-width': 2 })
    ctx.set('volt-t', 'text', { x: 570, y: 214, 'font-size': 10, 'text-anchor': 'middle', fill: '#0f172a', text: `${fmt(U, 2)}V` })
    ctx.set('volt-w1', 'line', { x1: rx + 12, y1: 150, x2: 570, y2: 192, stroke: wire, 'stroke-width': 1.2 })
    ctx.set('volt-w2', 'line', { x1: rx + 12, y1: 270, x2: 570, y2: 228, stroke: wire, 'stroke-width': 1.2 })
    // 电流表（串联，读数 = I）
    ctx.set('amp', 'circle', { cx: 300, cy: 110, r: 18, fill: '#fff', stroke: '#64748b', 'stroke-width': 2 })
    ctx.set('amp-t', 'text', { x: 300, y: 114, 'font-size': 10, 'text-anchor': 'middle', fill: '#0f172a', text: `${fmt(I, 2)}A` })

    // 提示（R=r 最大功率标注）
    const atMax = Math.abs(R - r) < 0.06
    ctx.set('tip', 'text', {
      x: 44, y: 40, 'font-size': 13, fill: atMax ? C.warn : 'currentColor', 'fill-opacity': atMax ? 1 : 0.55,
      text: atMax ? `★ R=r=${fmt(r, 1)}Ω：输出功率最大 P=${fmt(Pmax, 2)}W（η 仅 50%）` : '拖动 R：注意 U、P_out、η 的变化规律',
    })

    // U-I 图线：U=E−Ir 全量程直线 + 当前工作点
    if (ctx.gw) {
      const box = { x: 42, y: 24, w: ctx.gw - 66, h: ctx.gh - 62 }
      const iMax = EMF / r
      const pts: [number, number][] = []
      for (let i = 0; i <= iMax; i += iMax / 40) pts.push([i, EMF - i * r])
      axes(ctx, box, { xLabel: 'I/(A)', yLabel: 'U/(V)', xMax: Math.ceil(iMax), yMax: EMF })
      polyline(ctx, 'g-line', pts, box, 0, Math.ceil(iMax), 0, EMF, C.accent)
      // R=r 最大功率点竖线标注
      const iAtMax = EMF / (2 * r)
      const xM = gx(box, 0, Math.ceil(iMax), iAtMax)
      ctx.gset('g-mark', 'line', { x1: xM, y1: box.y, x2: xM, y2: box.y + box.h, stroke: C.warn, 'stroke-opacity': 0.4, 'stroke-dasharray': '4 3' })
      ctx.gset('g-mark-l', 'text', { x: xM + 4, y: box.y + 12, 'font-size': 9, fill: C.warn, text: 'R=r' })
      const iDisp = clamp(I, 0, Math.ceil(iMax))
      ctx.gset('g-dot', 'circle', { cx: gx(box, 0, Math.ceil(iMax), iDisp), cy: gy(box, 0, EMF, clamp(U, 0, EMF)), r: 5, fill: C.warn })
    }

    data['电流 I=E/(R+r)'] = `${fmt(I, 3)} A`
    data['路端电压 U=E−Ir'] = `${fmt(U, 3)} V`
    data['输出功率 P=I²R'] = `${fmt(Pout, 3)} W`
    data['最大功率 P_max（R=r）'] = `${fmt(Pmax, 3)} W`
    data['效率 η=R/(R+r)'] = `${fmt(eta * 100, 1)} %`
    data['短路电流 E/r'] = `${fmt(EMF / r, 1)} A`
    return data
  },
}
