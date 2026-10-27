// 课件 24：平行板电容器（必修三 · 静电场）
// 拖 d、S，实时 C=ε₀S/d、Q=CU；充电（恒压）/断开电源两种模式，断开后拉大 d 电压升高（Q 不变）
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'

const EPS0 = 8.85e-12 // F/m
// 像素↔实际：1px = 0.2mm
const PX_PER_M = 5000

interface S extends LabState {
  chargeQ: number // 断开模式下的冻结电量（接电源时持续刷新 = C·U）
}

export const capacitorScene: LabScene = {
  id: 'capacitor-plates',
  title: '平行板电容器',
  grade: '高二',
  chapter: '必修三 · 静电场',
  desc: '拖极板改 d 与 S，C=ε₀S/(4πkd) 实时；充电恒压 vs 断开电源两种模式对比',
  tags: ['电容器', '电容', '平行板', '决定式', '充电放电'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'd', label: '板距 d', min: 0.5, max: 10, step: 0.1, unit: 'mm', default: 3, reset: false },
    { key: 'S', label: '正对面积 S', min: 10, max: 100, step: 5, unit: 'cm²', default: 50, reset: false },
    { key: 'U', label: '电源电压 U', min: 1, max: 12, step: 0.5, unit: 'V', default: 6, modes: [0], reset: false },
    {
      key: 'mode', label: '工作模式', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '始终接电源（U 不变）' }, { value: 1, label: '先充电后断开（Q 不变）' }],
    },
  ],
  presets: [
    { name: '标准（接电源）', params: { mode: 0, d: 3, S: 50, U: 6 } },
    { name: '断开后拉大 d', params: { mode: 1, d: 3, S: 50, U: 6 } },
    { name: '正对面积减半', params: { mode: 0, d: 3, S: 25, U: 6 } },
    { name: '板距减半 C×2', params: { mode: 0, d: 1.5, S: 50, U: 6 } },
  ],
  formulas: [
    'C = \\frac{\\varepsilon_r S}{4\\pi k d}',
    'C = \\frac{Q}{U},\\quad E = \\frac{U}{d}',
    '\\text{断开后改变 } d \\text{：} Q \\text{ 不变，} U = Q/C \\text{ 变}',
  ],
  keyPoints: [
    '决定式 C=εS/(4πkd)：d 越小、S 越大，电容越大',
    '始终接电源：U 不变，拉大 d → C 减小 → Q=CU 减小（放电）',
    '断开电源：Q 不变，拉大 d → C 减小 → U=Q/C 增大，但场强 E=U/d 不变',
  ],
  init(params: SceneParams): S {
    // 初始电量按当前配置充电值
    const cap = (EPS0 * (params.S * 1e-4)) / (params.d / 1000)
    return { chargeQ: cap * params.U }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    void opts
    const dM = params.d / 1000
    const SM2 = params.S * 1e-4
    const cap = (EPS0 * SM2) / dM // F
    const connected = params.mode === 0
    if (connected) st.chargeQ = cap * params.U // 接电源：电量实时跟随
    const U = connected ? params.U : st.chargeQ / cap
    const Q = st.chargeQ
    const Efield = U / dM

    // 极板（上板可拖改 d，右缘手柄拖改 S）
    const gapPxVis = clamp(dM * PX_PER_M, 24, 170)
    const plateW = clamp((params.S / 1) * 2.2, 60, 320)
    const cx = 320
    const cy = 210
    const topY = cy - gapPxVis / 2 - 9
    const botY = cy + gapPxVis / 2 + 9
    ctx.set('plate-t', 'rect', { x: cx - plateW / 2, y: topY, width: plateW, height: 9, fill: C.ink2, rx: 2 })
    ctx.set('plate-b', 'rect', { x: cx - plateW / 2, y: botY, width: plateW, height: 9, fill: C.ink2, rx: 2 })
    const tPlate = ctx.set('plate-t-hit', 'rect', { x: cx - plateW / 2, y: topY - 14, width: plateW, height: 30, fill: 'transparent' })
    ctx.drag(tPlate, (p) => {
      const dNew = clamp(Math.abs(p.y - cy) * 2 - 18, 0, 170)
      const dMm = clamp((dNew * 1000) / PX_PER_M, 0.5, 10)
      ctx.setParam('d', Math.round(dMm * 10) / 10)
      ctx.requestRender()
    })
    const handle = ctx.set('s-handle', 'circle', { cx: cx + plateW / 2 + 10, cy: topY + 4, r: 9, fill: C.surface, stroke: C.accent, 'stroke-width': 2 })
    ctx.set('s-handle-t', 'text', { x: cx + plateW / 2 + 10, y: topY + 8, 'font-size': 13, 'text-anchor': 'middle', fill: C.accent, text: 'S' })
    ctx.drag(handle, (p) => {
      const wNew = clamp(p.x - (cx - plateW / 2), 60, 320)
      const sCm2 = clamp(wNew / 2.2, 10, 100)
      ctx.setParam('S', Math.round(sCm2 / 5) * 5)
      ctx.requestRender()
    })
    ctx.set('d-label', 'text', { x: cx - plateW / 2 - 10, y: cy + 4, 'font-size': 13, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.55, text: `d=${fmt(params.d, 1)}mm` })

    // 板上电荷符号 + 场强箭头
    if (U > 0.01) {
      const n = Math.min(10, Math.max(3, Math.round(cap * 1e12 * U * 8)))
      for (let i = 0; i < n; i++) {
        const x = cx - plateW / 2 + 12 + (i * (plateW - 24)) / Math.max(n - 1, 1)
        ctx.set(`ch-t${i}`, 'text', { x, y: topY - 5, 'font-size': 13, 'text-anchor': 'middle', fill: C.redDeep, text: '+' })
        ctx.set(`ch-b${i}`, 'text', { x, y: botY + 14, 'font-size': 13, 'text-anchor': 'middle', fill: C.blueDeep, text: '−' })
      }
      for (let i = n; i < 10; i++) ctx.remove(`ch-t${i}`, `ch-b${i}`)
      const nE = Math.min(6, Math.max(2, Math.round(Efield / 2000)))
      for (let i = 0; i < nE; i++) {
        const x = cx - plateW / 2 + 20 + (i * (plateW - 40)) / Math.max(nE - 1, 1)
        ctx.set(`ef${i}`, 'line', { x1: x, y1: topY + 12, x2: x, y2: botY - 2, stroke: C.field, 'stroke-opacity': 0.6, 'stroke-width': 1.5 })
        ctx.set(`ef${i}-h`, 'polygon', { points: `${x},${botY - 2} ${x - 3},${botY - 8} ${x + 3},${botY - 8}`, fill: C.field, 'fill-opacity': 0.6 })
      }
      for (let i = nE; i < 6; i++) ctx.remove(`ef${i}`, `ef${i}-h`)
    } else {
      for (let i = 0; i < 10; i++) ctx.remove(`ch-t${i}`, `ch-b${i}`)
      for (let i = 0; i < 6; i++) ctx.remove(`ef${i}`, `ef${i}-h`)
    }

    // 电源/断开开关示意
    if (connected) {
      ctx.set('bat', 'rect', { x: 40, y: cy - 22, width: 44, height: 44, fill: C.tension, rx: 6 })
      ctx.set('bat-l', 'text', { x: 62, y: cy + 4, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: `${fmt(params.U, 1)}V` })
      ctx.set('bat-l2', 'text', { x: 62, y: cy - 30, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '接通' })
      ctx.remove('bat-l3')
    } else {
      ctx.set('bat', 'rect', { x: 40, y: cy - 22, width: 44, height: 44, fill: C.faint, rx: 6 })
      ctx.set('bat-l', 'text', { x: 62, y: cy + 4, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: '✂' })
      ctx.set('bat-l2', 'text', { x: 62, y: cy - 30, 'font-size': 13, 'text-anchor': 'middle', fill: C.warn, text: '已断开' })
      ctx.set('bat-l3', 'text', { x: 62, y: cy + 40, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.5, text: 'Q 保持不变' })
    }

    ctx.set('tip', 'text', {
      x: 44, y: 34, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.55,
      text: connected ? '接电源模式：U 恒定，拖极板改 d/S 看 C 与 Q 变化' : '断开模式：Q 恒定，拉大 d → C 减小 → U=Q/C 升高，但 E=U/d 不变',
    })

    data['电容 C=ε₀S/d'] = `${fmt(cap * 1e12, 2)} pF`
    data['电压 U'] = `${fmt(U, 2)} V`
    data['带电量 Q=CU'] = `${fmt(Q * 1e12, 2)} pC`
    data['板间场强 E=U/d'] = `${fmt(Efield, 0)} V/m`
    data['模式'] = connected ? '接电源（U 不变）' : '断开（Q 不变）'
    return data
  },
}
