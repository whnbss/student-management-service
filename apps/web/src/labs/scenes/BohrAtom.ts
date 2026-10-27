// 课件 40：玻尔模型与能级跃迁（选择性必修三 · 原子物理）
// 氢原子能级图：电子在能级间跃迁辐射/吸收光子，λ=1240/ΔE(eV) nm，
// 可见光按真实颜色显示，紫外/红外如实标注
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'

const LEVEL_X0 = 110
const LEVEL_X1 = 430 // 能级线画满舞台主体，右侧留给光子飞行区
const LEVEL_Y = (n: number): number => 108 + (n - 1) * 62 // 能级线纵坐标（n=1..5），下移避开顶部提示与 n=∞ 虚线
const INF_Y = 78 // n=∞ 电离能级（与提示行拉开距离，不重叠）
const N_LEVELS = 5
const PHOTON_X0 = LEVEL_X1 + 40 // 光子起点（辐射向右 / 吸收由右向左）
const PHOTON_X1 = 620

/** 波长 nm → RGB（可见光按真实色相；紫外/红外由调用方兜底配色） */
function visibleRGB(nm: number): string {
  const w = clamp(nm, 380, 780)
  let r = 0, g = 0, b = 0
  if (w < 440) { r = -(w - 440) / 60; b = 1 }
  else if (w < 490) { g = (w - 440) / 50; b = 1 }
  else if (w < 510) { g = 1; b = -(w - 510) / 20 }
  else if (w < 580) { r = (w - 510) / 70; g = 1 }
  else if (w < 645) { r = 1; g = -(w - 645) / 65 }
  else { r = 1 }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

interface S extends LabState {
  t: number
  phase: number // 0=电子停在 n1（等待） 1=光子飞行 2=完成后停留
  n: number // 电子当前所在能级
  photonX: number // 光子头位置（px）
  tHold?: number // 完成后的停留计时
}

export const bohrAtomScene: LabScene = {
  id: 'bohr-atom',
  title: '玻尔模型与能级跃迁',
  grade: '高三',
  chapter: '选择性必修三 · 原子物理',
  desc: '氢原子能级跃迁动画：辐射/吸收光子 λ=1240/ΔE，巴尔末系可见光谱直接着色',
  tags: ['玻尔模型', '能级', '跃迁', '光子', '氢原子光谱'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'mode', label: '跃迁类型', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [
        { value: 0, label: '辐射跃迁（高能级→低能级，放光子）' },
        { value: 1, label: '吸收跃迁（低能级→高能级，吞光子）' },
      ],
    },
    { key: 'n1', label: '起始能级 n₁', min: 1, max: 5, step: 1, unit: '', default: 3, reset: false },
    { key: 'n2', label: '目标能级 n₂', min: 1, max: 5, step: 1, unit: '', default: 2, reset: false, modes: [0] },
    { key: 'n2a', label: '吸收后到达 n₂', min: 2, max: 5, step: 1, unit: '', default: 3, reset: false, modes: [1] },
  ],
  presets: [
    { name: '3→2 Hα 红光656nm', params: { mode: 0, n1: 3, n2: 2 } },
    { name: '4→2 青蓝486nm', params: { mode: 0, n1: 4, n2: 2 } },
    { name: '2→1 紫外（赖曼系）', params: { mode: 0, n1: 2, n2: 1 } },
    { name: '吸收 1→3', params: { mode: 1, n1: 1, n2a: 3 } },
  ],
  formulas: [
    'E_n = \\dfrac{-13.6}{n^2}\\ \\text{eV}',
    'h\\nu = E_{n1} - E_{n2}',
    '\\lambda = \\dfrac{1240}{\\Delta E(\\text{eV})}\\ \\text{nm}',
  ],
  keyPoints: [
    '原子只能处于一系列不连续的能量状态（定态），能量最低的基态最稳定',
    '从高能级跃迁到低能级辐射光子，hν=|E₁−E₂|；从低到高必须恰好吸收一个等于能级差的光子',
    '一群氢原子跃迁时最多可发出 C(n,2)=n(n−1)/2 种频率的光子',
  ],
  init(params: SceneParams): S {
    return { t: 0, phase: 0, n: params.mode === 0 ? params.n1 : params.n1, photonX: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    const to = params.mode === 0 ? params.n2 : params.n2a
    const from = params.mode === 0 ? params.n1 : params.n1
    if (st.phase === 0 && st.t > 0.6) {
      st.phase = 1
      st.photonX = params.mode === 0 ? PHOTON_X0 : PHOTON_X1
    }
    if (st.phase === 1) {
      st.photonX += (params.mode === 0 ? 120 : -120) * dt
      // 电子随光子进程移动
      const progress = params.mode === 0
        ? (st.photonX - PHOTON_X0) / 150
        : (PHOTON_X1 - st.photonX) / 150
      if (progress >= 1) {
        st.photonX = params.mode === 0 ? PHOTON_X1 : PHOTON_X0
        st.phase = 2
        st.tHold = 0
      }
      st.n = params.mode === 0 ? from + (to - from) * Math.min(progress, 1) : from + (to - from) * Math.min(Math.max(progress, 0), 1)
    }
    if (st.phase === 2) {
      st.tHold = (st.tHold as number | undefined ?? 0) + dt
      if ((st.tHold as number) > 1.2) {
        // 循环重演
        st.phase = 0
        st.t = 0
        st.n = from
        st.tHold = 0
      }
    }
  },
  render(ctx, params, state): LabData {
    const st = state as S
    const data: LabData = {}
    const from = params.mode === 0 ? params.n1 : params.n1
    const to = params.mode === 0 ? params.n2 : params.n2a

    // 能级横线 + 能量标注
    for (let n = 1; n <= N_LEVELS; n++) {
      const E = -13.6 / (n * n)
      ctx.set(`lv${n}`, 'line', { x1: LEVEL_X0, y1: LEVEL_Y(n), x2: LEVEL_X1, y2: LEVEL_Y(n), stroke: 'currentColor', 'stroke-opacity': 0.55, 'stroke-width': 2 })
      ctx.set(`lv${n}-l`, 'text', { x: LEVEL_X0 - 12, y: LEVEL_Y(n) + 4, 'font-size': 13, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.7, text: `n=${n}` })
      ctx.set(`lv${n}-e`, 'text', { x: LEVEL_X1 + 10, y: LEVEL_Y(n) + 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.6, text: `${fmt(E, 2)} eV` })
    }
    // 电离能级（n=∞，与顶部提示行留出间距不重叠）
    ctx.set('lv-inf', 'line', { x1: LEVEL_X0, y1: INF_Y, x2: LEVEL_X1, y2: INF_Y, stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '4 4' })
    ctx.set('lv-inf-l', 'text', { x: LEVEL_X0 - 12, y: INF_Y + 4, 'font-size': 13, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.5, text: 'n=∞' })

    // 跃迁箭头（灰）
    ctx.set('trans', 'line', {
      x1: (LEVEL_X0 + LEVEL_X1) / 2 - 40, y1: LEVEL_Y(from),
      x2: (LEVEL_X0 + LEVEL_X1) / 2 - 40, y2: LEVEL_Y(to),
      stroke: 'currentColor', 'stroke-opacity': 0.4, 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
    })
    ctx.set('trans-l', 'text', { x: (LEVEL_X0 + LEVEL_X1) / 2 - 52, y: (LEVEL_Y(from) + LEVEL_Y(to)) / 2, 'font-size': 13, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.6, text: `${params.mode === 0 ? '辐射' : '吸收'} ${from}→${to}` })

    // 电子（当前能级上，可竖直拖到任意能级）
    const ex = LEVEL_X0 + 60
    const ey = LEVEL_Y(st.n)
    const eEl = ctx.set('electron', 'circle', { cx: ex, cy: ey, r: 9, fill: C.accent, stroke: '#312e81', 'stroke-width': 2 })
    ctx.drag(eEl, (p) => {
      const nn = clamp(Math.round((p.y - LEVEL_Y(1)) / 62) + 1, 1, N_LEVELS)
      if (nn !== Math.round(st.n)) {
        st.n = nn
        ctx.setParam('n1', nn)
        ctx.requestRender()
      }
    })
    ctx.set('electron-l', 'text', { x: ex - 16, y: ey + 4, 'font-size': 13, 'text-anchor': 'end', fill: C.accent, text: 'e⁻' })

    // 光子（波浪线飞行）
    const dE = Math.abs(-13.6 / (from * from) - -13.6 / (to * to))
    const lam = dE > 0.01 ? 1240 / dE : Infinity
    const color = lam >= 380 && lam <= 780 ? visibleRGB(lam) : lam < 380 ? '#7c3aed' : '#94a3b8'
    if (st.phase === 1) {
      const py = (LEVEL_Y(from) + LEVEL_Y(to)) / 2
      const x0 = st.photonX
      const dirSign = params.mode === 0 ? 1 : -1
      let d = ''
      for (let i = 0; i <= 12; i++) {
        const x = x0 - dirSign * i * 9
        d += `${i === 0 ? 'M' : 'L'}${x},${py + (i % 2 === 0 ? 0 : 6)}`
      }
      ctx.set('photon', 'path', { d, fill: 'none', stroke: color, 'stroke-width': 2.5 })
      ctx.set('photon-h', 'polygon', { points: `${x0 + dirSign * 6},${py} ${x0 - dirSign * 2},${py - 4} ${x0 - dirSign * 2},${py + 4}`, fill: color })
      ctx.set('photon-l', 'text', { x: x0, y: py - 14, 'font-size': 13, 'text-anchor': 'middle', fill: color, text: `λ=${lam > 9000 ? '∞' : fmt(lam, 0)}nm` })
    } else ctx.remove('photon', 'photon-h', 'photon-l')

    // 提示
    const band = lam < 380 ? '紫外区（不可见）' : lam > 780 ? '红外区（不可见）' : '可见光'
    ctx.set('tip', 'text', {
      x: 46, y: 34, 'font-size': 13, fill: C.warn,
      text: params.mode === 0
        ? `n=${from}→n=${to}：ΔE=${fmt(dE, 2)}eV，辐射光子 λ=${lam > 9000 ? '∞' : fmt(lam, 0)}nm（${band}）`
        : `n=${from}→n=${to}：必须恰好吸收 ΔE=${fmt(dE, 2)}eV 的光子（能量不符不吸收）`,
    })
    ctx.set('tip2', 'text', { x: 46, y: 54, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '拖电子到其他能级可换跃迁；2→3/4/5 即巴尔末系可见光谱' })

    data['跃迁'] = params.mode === 0 ? `辐射 ${from}→${to}` : `吸收 ${from}→${to}`
    data['E（起始）'] = `${fmt(-13.6 / (from * from), 2)} eV`
    data['E（目标）'] = `${fmt(-13.6 / (to * to), 2)} eV`
    data['能级差 ΔE'] = `${fmt(dE, 2)} eV`
    data['光子波长 λ'] = lam > 9000 ? '—' : `${fmt(lam, 0)} nm（${band}）`
    data['光子频率 ν'] = lam > 9000 ? '—' : `${fmt(3e8 / (lam * 1e-9) / 1e14, 1)} ×10¹⁴ Hz`
    return data
  },
}
