// 课件 42：核反应与质能方程（选择性必修三 · 原子物理）
// 三种典型核反应（聚变/裂变/α衰变）质量亏损 → E=Δm·931.5 MeV；
// 右图画比结合能曲线（半经验公式），标出产物核的工作点
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, fmt } from '../engine/vec'
import { axes, gx, gy } from '../engine/graph'

const U = 931.5 // 1u 对应 MeV

interface Reaction {
  before: { label: string; r: number; color: string }[]
  after: { label: string; r: number; color: string }[]
  dm: number // 质量亏损 u
  productA: number // 主要产物核子数（比结合能曲线工作点）
  note: string
}

const REACTIONS: Reaction[] = [
  {
    // 氘核 2.0141u + 氚 3.0160u → 氦4 4.0026u + 中子 1.0087u
    before: [{ label: '²H 氘', r: 24, color: '#3b82f6' }, { label: '³H 氚', r: 28, color: '#8b5cf6' }],
    after: [{ label: '⁴He', r: 32, color: '#10b981' }, { label: 'n', r: 16, color: '#64748b' }],
    dm: 2.0141 + 3.016 - 4.0026 - 1.0087,
    productA: 4,
    note: '太阳与氢弹的能量来源：轻核聚变，单位质量放能最多',
  },
  {
    // U-235 + n → Ba-141 + Kr-92 + 3n（一种典型裂变方式）
    before: [{ label: '²³⁵U', r: 40, color: '#ef4444' }, { label: 'n', r: 16, color: '#64748b' }],
    after: [{ label: '¹⁴¹Ba', r: 34, color: '#f59e0b' }, { label: '⁹²Kr', r: 30, color: '#3b82f6' }, { label: '3n', r: 16, color: '#64748b' }],
    dm: 235.0439 + 1.0087 - 140.9144 - 91.9262 - 3 * 1.0087,
    productA: 141,
    note: '核电站链式反应：重核分裂，释放约 200 MeV 量级',
  },
  {
    // Ra-226 → Rn-222 + α（镭的 α 衰变）
    before: [{ label: '²²⁶Ra', r: 38, color: '#ef4444' }],
    after: [{ label: '²²²Rn', r: 35, color: '#3b82f6' }, { label: 'α ⁴He', r: 20, color: '#10b981' }],
    dm: 226.0254 - 222.0176 - 4.0026,
    productA: 222,
    note: '天然放射性：α 衰变释放氦核，半衰期 1600 年',
  },
]

/** 半经验质量公式估算比结合能 ε(A) MeV/核子（Z≈A/2.5，形状与真实曲线一致） */
function bindingPerNucleon(A: number): number {
  const Z = A / 2.5
  const aV = 15.8, aS = 18.3, aC = 0.714, aA = 23.2
  const B = aV * A - aS * Math.pow(A, 2 / 3) - (aC * Z * (Z - 1)) / Math.pow(A, 1 / 3) - (aA * (A - 2 * Z) * (A - 2 * Z)) / A
  return B / A
}

export const nuclearEnergyScene: LabScene = {
  id: 'nuclear-energy',
  title: '核反应与质能方程',
  grade: '高三',
  chapter: '选择性必修三 · 原子物理',
  desc: '聚变/裂变/α衰变三种核反应：质量亏损 Δm 算释放能量 E=Δmc²，配比结合能曲线',
  tags: ['质能方程', '质量亏损', '核聚变', '核裂变', '比结合能'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    {
      key: 'mode', label: '核反应类型', min: 0, max: 2, step: 1, unit: '', default: 0,
      options: [
        { value: 0, label: '轻核聚变 ²H+³H' },
        { value: 1, label: '重核裂变 ²³⁵U' },
        { value: 2, label: 'α衰变 ²²⁶Ra' },
      ],
    },
  ],
  presets: [
    { name: '聚变（太阳/氢弹）', params: { mode: 0 } },
    { name: '裂变（核电站）', params: { mode: 1 } },
    { name: 'α衰变（天然放射）', params: { mode: 2 } },
  ],
  formulas: [
    'E = \\Delta m c^2',
    '1u = 931.5\\ \\text{MeV}',
    '\\text{中等质量核比结合能最大（Fe 附近）最稳定}',
  ],
  keyPoints: [
    '核反应中质量数与电荷数守恒；反应前后出现质量亏损 Δm，释放 E=Δmc²',
    '1u 的质量亏损对应 931.5 MeV；聚变单位核子放能约 3.5 MeV，裂变约 0.85 MeV',
    '比结合能（平均每个核子的结合能）越大核越稳定：中等质量核最大，所以聚变与裂变都放能',
  ],
  init(): LabState {
    return { t: 0 }
  },
  render(ctx, params, state): LabData {
    const st = state as LabState
    void st
    const data: LabData = {}
    const r = REACTIONS[params.mode] ?? REACTIONS[0]
    const E = r.dm * U

    // —— 反应式舞台：反应前 → 反应后 ——
    const midY = 205
    // 反应前粒子
    let x = 60
    r.before.forEach((p, i) => {
      ctx.set(`b${i}`, 'circle', { cx: x + p.r, cy: midY, r: p.r, fill: p.color, 'fill-opacity': 0.85 })
      ctx.set(`b${i}-l`, 'text', { x: x + p.r, y: midY + 4, 'font-size': 13, 'text-anchor': 'middle', fill: '#fff', text: p.label })
      x += p.r * 2 + 16
    })
    // 反应箭头
    ctx.set('arrow', 'line', { x1: x + 10, y1: midY, x2: x + 90, y2: midY, stroke: C.warn, 'stroke-width': 3 })
    ctx.set('arrow-h', 'polygon', { points: `${x + 100},${midY} ${x + 88},${midY - 6} ${x + 88},${midY + 6}`, fill: C.warn })
    ctx.set('arrow-l', 'text', { x: x + 55, y: midY - 16, 'font-size': 13, 'text-anchor': 'middle', fill: C.warn, text: 'Δm 质量亏损' })
    // 反应后粒子
    x += 120
    r.after.forEach((p, i) => {
      ctx.set(`a${i}`, 'circle', { cx: x + p.r, cy: midY, r: p.r, fill: p.color, 'fill-opacity': 0.85 })
      ctx.set(`a${i}-l`, 'text', { x: x + p.r, y: midY + 4, 'font-size': 13, 'text-anchor': 'middle', fill: '#fff', text: p.label })
      x += p.r * 2 + 16
    })

    // 释放能量柱
    const barMax = 220
    const barW = (Math.min(E, 220) / 220) * barMax
    ctx.set('e-bar-bg', 'rect', { x: 60, y: 305, width: barMax, height: 26, fill: 'currentColor', 'fill-opacity': 0.08, rx: 4 })
    ctx.set('e-bar', 'rect', { x: 60, y: 305, width: barW, height: 26, fill: C.warn, 'fill-opacity': 0.85, rx: 4 })
    ctx.set('e-bar-l', 'text', { x: 60 + barW + 8, y: 323, 'font-size': 13, fill: C.warn, text: `释放 E=${fmt(E, 1)} MeV` })
    ctx.set('e-note', 'text', { x: 60, y: 352, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.7, text: r.note })
    ctx.set('e-eq', 'text', { x: 60, y: 374, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.7, text: `Δm=${fmt(Math.abs(r.dm), 4)}u × 931.5 MeV/u = ${fmt(E, 1)} MeV` })
    ctx.set('tip', 'text', { x: 46, y: 40, 'font-size': 13, fill: C.warn, text: '核子结合成核时质量减小（质量亏损），亏损的质量以能量形式释放' })

    // —— 比结合能曲线（图像面板）——
    if (ctx.gw) {
      const box = { x: 40, y: 20, w: ctx.gw - 66, h: ctx.gh - 60 }
      axes(ctx, box, { xLabel: '核子数 A', yLabel: '比结合能/MeV', xMax: 250, yMax: 10 })
      const pts: string[] = []
      for (let A = 2; A <= 250; A += 2) {
        const X = gx(box, 0, 250, A)
        const Y = gy(box, 0, 10, bindingPerNucleon(A))
        pts.push(`${pts.length === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`)
      }
      ctx.gset('g-curve', 'path', { d: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2 })
      // 工作点：产物核
      const px = gx(box, 0, 250, r.productA)
      const py = gy(box, 0, 10, bindingPerNucleon(r.productA))
      ctx.gset('g-pt', 'circle', { cx: px, cy: py, r: 5, fill: C.warn })
      ctx.gset('g-pt-l', 'text', { x: px + 6, y: py - 6, 'font-size': 13, fill: C.warn, text: `A=${r.productA}` })
      // Fe-56 峰值参考
      ctx.gset('g-fe', 'circle', { cx: gx(box, 0, 250, 56), cy: gy(box, 0, 10, 8.8), r: 3, fill: '#10b981' })
      ctx.gset('g-fe-l', 'text', { x: gx(box, 0, 250, 56) + 5, y: gy(box, 0, 10, 8.8) - 8, 'font-size': 13, fill: '#10b981', text: '⁵⁶Fe 最稳定' })
    }

    data['反应类型'] = ['轻核聚变', '重核裂变', 'α衰变'][params.mode] ?? '—'
    data['质量亏损 Δm'] = `${fmt(Math.abs(r.dm), 4)} u`
    data['释放能量 E=Δmc²'] = `${fmt(E, 1)} MeV`
    data['每核子平均放能'] = `${fmt(E / (r.productA + 2), 2)} MeV`
    data['产物比结合能'] = `${fmt(bindingPerNucleon(r.productA), 2)} MeV/核子`
    return data
  },
}
