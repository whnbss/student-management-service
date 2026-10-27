// 课件 39：光电效应（选择性必修三 · 原子物理）
// 光照阴极 → 电子逸出飞向阳极：E=hν，逸出条件 hν>W₀，最大初动能 Eₖ=hν−W₀；
// 右图 Eₖ-ν 图线与工作点（遏止电压 = Eₖ）
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { axes, gx, gy } from '../engine/graph'

const CATHODE_X = 240
const ANODE_X = 495
const TUBE_Y = 195 // 光电管加大（更高更宽），阴极/阳极标签 13px 投影可读

interface Electron {
  x: number
  y: number
  born: number
  speed: number
}

interface S extends LabState {
  t: number
  electrons: Electron[]
  nextSpawn: number
}

/** 金属逸出功选项（eV） */
const METALS = [
  { label: '铯 Cs（W₀=2.1eV）', value: 0 },
  { label: '钠 Na（W₀=2.3eV）', value: 1 },
  { label: '锌 Zn（W₀=4.3eV）', value: 2 },
  { label: '铂 Pt（W₀=6.3eV）', value: 3 },
]
const W0S = [2.1, 2.3, 4.3, 6.3]

export const photoelectricScene: LabScene = {
  id: 'photoelectric',
  title: '光电效应',
  grade: '高三',
  chapter: '选择性必修三 · 原子物理',
  desc: '调波长与光强：hν>W₀ 才有电子逸出，Eₖ=hν−W₀ 与光强无关（右图 Eₖ-ν 图线）',
  tags: ['光电效应', '光子', '逸出功', '遏止电压', '截止频率'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'lam', label: '光波长 λ', min: 200, max: 700, step: 5, unit: 'nm', default: 400, reset: false },
    { key: 'I', label: '光强（单位时间光子数）', min: 0, max: 100, step: 5, unit: '%', default: 60, reset: false },
    { key: 'metal', label: '阴极金属（逸出功）', min: 0, max: 3, step: 1, unit: '', default: 1, options: METALS, reset: false },
  ],
  presets: [
    { name: '钠+紫光：能逸出', params: { lam: 400, I: 60, metal: 1 } },
    { name: '锌+可见光：不能逸出', params: { lam: 500, I: 60, metal: 2 } },
    { name: '光强加倍 Eₖ不变', params: { lam: 400, I: 100, metal: 1 } },
    { name: '波长减短 Eₖ增大', params: { lam: 250, I: 60, metal: 1 } },
  ],
  formulas: [
    'E = h\\nu = \\dfrac{hc}{\\lambda}',
    'E_k = h\\nu - W_0\\ (h\\nu > W_0)',
    'eU_c = E_k \\quad \\nu_0 = \\dfrac{W_0}{h}',
  ],
  keyPoints: [
    '存在截止频率 ν₀：频率低于 ν₀ 无论光强多大都不能发生光电效应',
    '最大初动能只由频率决定（Eₖ=hν−W₀），与光强无关；光强只影响饱和光电流',
    '光电效应是瞬时发生的，证明光具有粒子性（光子能量 hν 一份一份）',
  ],
  init(): S {
    return { t: 0, electrons: [], nextSpawn: 0.2 }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    const W0 = W0S[params.metal] ?? W0S[0]
    const eV = 1240 / params.lam // 光子能量 eV
    const emitting = eV > W0 && params.I > 0
    // 按光强生成光电子（速度∝√Eₖ）
    if (emitting && st.t >= st.nextSpawn) {
      st.electrons.push({
        x: CATHODE_X,
        y: TUBE_Y - 55 + Math.random() * 110,
        born: st.t,
        speed: 60 + 90 * Math.sqrt(Math.max(eV - W0, 0.05)),
      })
      st.nextSpawn = st.t + 0.25 / Math.max(params.I / 100, 0.05)
      if (st.electrons.length > 40) st.electrons.shift()
    }
    // 电子飞行，出管移除
    st.electrons = st.electrons.filter((e) => {
      e.x += e.speed * dt
      return e.x < ANODE_X + 8
    })
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const W0 = W0S[params.metal] ?? W0S[0]
    const eV = 1240 / params.lam
    const Ek = Math.max(eV - W0, 0)
    const emitting = eV > W0 && params.I > 0
    const nu0 = (W0 * 1.602e-19) / 6.63e-34 / 1e14 // 截止频率 ×10¹⁴Hz
    const nu = 3e8 / (params.lam * 1e-9) / 1e14

    // 光电管（加大）
    ctx.set('tube', 'rect', { x: CATHODE_X - 14, y: TUBE_Y - 90, width: ANODE_X - CATHODE_X + 28, height: 180, rx: 18, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.4, 'stroke-width': 2 })
    // 阴极（左板）/阳极（右板）
    ctx.set('cath', 'rect', { x: CATHODE_X - 10, y: TUBE_Y - 75, width: 8, height: 150, fill: '#64748b' })
    ctx.set('cath-l', 'text', { x: CATHODE_X - 6, y: TUBE_Y + 92, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '阴极' })
    ctx.set('anode', 'rect', { x: ANODE_X + 2, y: TUBE_Y - 75, width: 8, height: 150, fill: '#64748b' })
    ctx.set('anode-l', 'text', { x: ANODE_X + 6, y: TUBE_Y + 92, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '阳极' })

    // 光源（左）：波长决定颜色 + 波纹箭头（波纹间距加大，不挤成一团）
    const [r, g, b] = wavelengthRGB(params.lam)
    ctx.set('lamp', 'circle', { cx: 110, cy: TUBE_Y, r: 28, fill: `rgb(${r},${g},${b})`, 'fill-opacity': 0.85 })
    ctx.set('lamp-l', 'text', { x: 110, y: TUBE_Y + 50, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: `λ=${params.lam}nm` })
    const waves = clamp(Math.round(params.I / 25), 1, 4)
    for (let i = 0; i < (emitting ? waves : 0); i++) {
      const x = 148 + i * 26 + ((st.t * 60) % 26)
      if (x > CATHODE_X - 16) continue
      ctx.set(`w${i}`, 'path', { d: `M${x},${TUBE_Y - 14} q6,14 0,28 q-6,14 0,0`, fill: 'none', stroke: `rgb(${r},${g},${b})`, 'stroke-opacity': 0.7, 'stroke-width': 2 })
    }
    if (!emitting) for (let i = 0; i < 4; i++) ctx.remove(`w${i}`)

    // 光电子
    for (let i = 0; i < st.electrons.length; i++) {
      const e = st.electrons[i]
      ctx.set(`e${i}`, 'circle', { cx: e.x, cy: e.y, r: 4, fill: C.accent })
      if (opts.showForces) {
        // 光子命中标记
        if (st.t - e.born < 0.12) {
          ctx.set(`e${i}-hit`, 'circle', { cx: CATHODE_X, cy: e.y, r: 10, fill: 'none', stroke: `rgb(${r},${g},${b})`, 'stroke-width': 2 })
        } else ctx.remove(`e${i}-hit`)
      }
    }
    // 超界清理
    for (let i = st.electrons.length; i < 40; i++) {
      ctx.remove(`e${i}`, `e${i}-hit`)
    }

    // 电路：电流表
    ctx.set('meter', 'circle', { cx: (CATHODE_X + ANODE_X) / 2, cy: TUBE_Y + 110, r: 20, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.5, 'stroke-width': 2 })
    ctx.set('meter-l', 'text', { x: (CATHODE_X + ANODE_X) / 2, y: TUBE_Y + 116, 'font-size': 13, 'text-anchor': 'middle', fill: emitting ? C.accent : 'currentColor', text: emitting ? 'A' : 'A' })
    ctx.set('meter-val', 'text', { x: (CATHODE_X + ANODE_X) / 2, y: TUBE_Y + 150, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: emitting ? `光电流 ∝ 光强 ${fmt(params.I, 0)}%` : '无光电流' })

    // 提示
    ctx.set('tip', 'text', {
      x: 60, y: 46, 'font-size': 13, fill: emitting ? '#10b981' : C.warn,
      text: emitting
        ? `✓ 发生光电效应：E光=${fmt(eV, 2)}eV > W₀=${fmt(W0, 1)}eV`
        : `✗ 不能逸出：E光=${fmt(eV, 2)}eV ≤ W₀=${fmt(W0, 1)}eV（加大光强也没用！）`,
    })

    // —— Eₖ-ν 图线（爱因斯坦方程）——
    if (ctx.gw) {
      const box = { x: 44, y: 20, w: ctx.gw - 70, h: ctx.gh - 62 }
      const nuMax = 15
      const ekMax = 4.5
      axes(ctx, box, { xLabel: 'ν/(10¹⁴Hz)', yLabel: 'Eₖ/eV', xMax: nuMax, yMax: ekMax })
      // 图线：Eₖ = hν − W₀（斜线，从 ν₀ 起）
      const slope = 4.14e-15 / 1e-14 / (1.602e-19 / 1.602e-19) // h/eV ÷ 10¹⁴ = 4.14e-15/1e-14 = 0.414 eV/(10¹⁴Hz)
      const x1 = gx(box, 0, nuMax, nu0)
      const y1 = gy(box, 0, ekMax, 0)
      const x2 = gx(box, 0, nuMax, nuMax)
      const y2 = gy(box, 0, ekMax, Math.min(slope * (nuMax - nu0), ekMax))
      ctx.gset('g-line', 'line', { x1, y1, x2, y2, stroke: C.accent, 'stroke-width': 2.5 })
      // 截止频率标记
      ctx.gset('g-nu0', 'line', { x1: x1, y1: box.y, x2: x1, y2: y1, stroke: C.warn, 'stroke-dasharray': '4 3', 'stroke-opacity': 0.7 })
      ctx.gset('g-nu0-l', 'text', { x: x1 + 4, y: box.y + 12, 'font-size': 13, fill: C.warn, text: `ν₀=${fmt(nu0, 1)}` })
      // 工作点
      ctx.gset('g-pt', 'circle', { cx: gx(box, 0, nuMax, nu), cy: gy(box, 0, ekMax, Math.min(Ek, ekMax)), r: 5, fill: C.warn })
    }

    data['光子能量 E=hν'] = `${fmt(eV, 2)} eV`
    data['逸出功 W₀'] = `${fmt(W0, 1)} eV`
    data['最大初动能 Eₖ'] = emitting ? `${fmt(Ek, 2)} eV（与光强无关）` : '—'
    data['截止频率 ν₀'] = `${fmt(nu0, 1)} ×10¹⁴ Hz`
    data['遏止电压 Uc'] = emitting ? `${fmt(Ek, 2)} V` : '—'
    data['光电流'] = emitting ? `与光强成正比（当前 ${fmt(params.I, 0)}%）` : '0'
    return data
  },
}

/** 波长 nm → RGB（复用近似映射） */
function wavelengthRGB(nm: number): [number, number, number] {
  const w = clamp(nm, 380, 780)
  let r = 0, g = 0, b = 0
  if (w < 440) { r = -(w - 440) / 60; b = 1 }
  else if (w < 490) { g = (w - 440) / 50; b = 1 }
  else if (w < 510) { g = 1; b = -(w - 510) / 20 }
  else if (w < 580) { r = (w - 510) / 70; g = 1 }
  else if (w < 645) { r = 1; g = -(w - 645) / 65 }
  else { r = 1 }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}
