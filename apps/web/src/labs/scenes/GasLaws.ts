// 课件 36：气体实验定律（选择性必修三 · 热学）
// 三种过程：等温（玻意耳）/ 等容（查理）/ 等压（盖-吕萨克）；
// 活塞气缸 + 分子动画 + p-V 图上画出对应过程曲线与工作点
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { axes, gx, gy } from '../engine/graph'

const CYL = { x: 150, y: 105, w: 155, hMax: 260 } // 气缸（竖直，活塞下移压缩）——加大画满舞台左半
const N_MOL = 42
const A_COEF = 0.3409 // p(kPa) = A_COEF·T(K)/V(L)，n≈0.041 mol

interface Mol {
  x: number
  y: number
  dx: number
  dy: number
}

interface S extends LabState {
  t: number
  mols: Mol[]
  vCur: number // 当前体积 L
  pCur: number // 当前压强 kPa
}

/** 由过程参数计算当前 (V, p) */
function solve(params: SceneParams): { V: number; p: number } {
  if (params.mode === 0) {
    // 等温：拖体积，p=nRT/V
    return { V: params.V, p: (A_COEF * 300) / params.V }
  }
  if (params.mode === 1) {
    // 等容：V 固定 1.0L，拖温度
    return { V: 1.0, p: (A_COEF * params.T) / 1.0 }
  }
  // 等压：p 固定 102 kPa（T=300K、V=1L 时），V 随 T 变
  const p0 = A_COEF * 300
  return { V: (A_COEF * params.T) / p0, p: p0 }
}

export const gasLawsScene: LabScene = {
  id: 'gas-laws',
  title: '气体实验定律（等温/等容/等压）',
  grade: '高三',
  chapter: '选择性必修三 · 热学',
  desc: '活塞气缸演示三大实验定律，p-V 图同步画出过程曲线与工作点',
  tags: ['气体实验定律', '玻意耳定律', '查理定律', '盖-吕萨克定律', '理想气体'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    {
      key: 'mode', label: '过程类型', min: 0, max: 2, step: 1, unit: '', default: 0,
      options: [
        { value: 0, label: '等温过程（玻意耳定律）' },
        { value: 1, label: '等容过程（查理定律）' },
        { value: 2, label: '等压过程（盖-吕萨克定律）' },
      ],
    },
    { key: 'V', label: '体积 V', min: 0.5, max: 2.8, step: 0.05, unit: 'L', default: 1.2, reset: false, modes: [0] },
    { key: 'T', label: '温度 T', min: 180, max: 600, step: 5, unit: 'K', default: 300, reset: false, modes: [1, 2] },
  ],
  presets: [
    { name: '玻意耳：压缩减半 压强翻倍', params: { mode: 0, V: 0.6, T: 300 } },
    { name: '玻意耳：膨胀', params: { mode: 0, V: 2.4, T: 300 } },
    { name: '查理：等容升温', params: { mode: 1, T: 500 } },
    { name: '盖-吕萨克：等压升温膨胀', params: { mode: 2, T: 500 } },
  ],
  formulas: [
    '\\text{等温：} pV = C \\quad (T\\ \\text{不变})',
    '\\text{等容：} \\dfrac{p}{T} = C \\quad (V\\ \\text{不变})',
    '\\text{等压：} \\dfrac{V}{T} = C \\quad (p\\ \\text{不变})',
  ],
  keyPoints: [
    '玻意耳定律：T 不变时 p 与 V 成反比，p-V 图是双曲线的一支',
    '查理定律：V 不变时 p 与 T 成正比；盖-吕萨克定律：p 不变时 V 与 T 成正比（热力学温标）',
    'p-V 图上「点」是一个状态，「线」是一个过程；等温线离原点越远温度越高',
  ],
  challenge: {
    question: '一定质量气体等温压缩，体积减半，压强如何变化？',
    options: ['减半', '不变', '加倍', '变为 4 倍'],
    answer: 2,
    explanation: '玻意耳定律 pV = 恒量（温度不变）：V 减半，p 加倍。图像上即双曲线上的对应点——试试拖动活塞验证。',
    reveal_preset: '玻意耳：压缩减半 压强翻倍',
  },
  init(): S {
    const mols: Mol[] = []
    for (let i = 0; i < N_MOL; i++) {
      mols.push({ x: CYL.x + 10 + Math.random() * (CYL.w - 20), y: CYL.y + CYL.hMax * 0.5 + Math.random() * (CYL.hMax * 0.4), dx: Math.random() - 0.5, dy: Math.random() - 0.5 })
    }
    return { t: 0, mols, vCur: 1.2, pCur: 100 }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    const { V } = solve(params)
    st.vCur = V
    const speed = 24 * Math.sqrt(params.T / 300)
    // 分子在活塞下方气体区域内运动
    const gasTop = CYL.y + (CYL.hMax * V) / 2.8 // V=2.8L 时活塞到顶
    for (const m of st.mols) {
      m.x += m.dx * speed * dt
      m.y += m.dy * speed * dt
      if (m.x < CYL.x + 5) { m.x = CYL.x + 5; m.dx = Math.abs(m.dx) }
      if (m.x > CYL.x + CYL.w - 5) { m.x = CYL.x + CYL.w - 5; m.dx = -Math.abs(m.dx) }
      if (m.y < gasTop + 5) { m.y = gasTop + 5; m.dy = Math.abs(m.dy) }
      if (m.y > CYL.y + CYL.hMax - 5) { m.y = CYL.y + CYL.hMax - 5; m.dy = -Math.abs(m.dy) }
      // 温度改变时轻推方向，模拟速率重排
      if (Math.random() < 0.01) {
        m.dx += (Math.random() - 0.5) * 0.4
        m.dy += (Math.random() - 0.5) * 0.4
        const l = Math.hypot(m.dx, m.dy) || 1
        m.dx /= l
        m.dy /= l
      }
    }
  },
  render(ctx, params, state): LabData {
    const st = state as S
    const data: LabData = {}
    const { V, p } = solve(params)
    st.vCur = V
    st.pCur = p
    const pistonY = CYL.y + (CYL.hMax * V) / 2.8

    // 气缸壁（下端封闭）
    ctx.set('cyl-l', 'line', { x1: CYL.x, y1: CYL.y, x2: CYL.x, y2: CYL.y + CYL.hMax, stroke: 'currentColor', 'stroke-opacity': 0.6, 'stroke-width': 3 })
    ctx.set('cyl-r', 'line', { x1: CYL.x + CYL.w, y1: CYL.y, x2: CYL.x + CYL.w, y2: CYL.y + CYL.hMax, stroke: 'currentColor', 'stroke-opacity': 0.6, 'stroke-width': 3 })
    ctx.set('cyl-b', 'rect', { x: CYL.x - 6, y: CYL.y + CYL.hMax, width: CYL.w + 12, height: 8, fill: 'currentColor', 'fill-opacity': 0.4 })

    // 气体区域淡蓝底
    ctx.set('gas', 'rect', { x: CYL.x + 1.5, y: pistonY, width: CYL.w - 3, height: CYL.y + CYL.hMax - pistonY, fill: '#38bdf8', 'fill-opacity': 0.12 })

    // 活塞（等温模式可上下拖动 → 改 V）
    const piston = ctx.set('piston', 'rect', { x: CYL.x - 4, y: pistonY - 10, width: CYL.w + 8, height: 10, fill: '#94a3b8', rx: 2 })
    if (params.mode === 0) {
      ctx.drag(piston, (pt) => {
        const v = clamp(((pt.y - CYL.y) / CYL.hMax) * 2.8, 0.5, 2.8)
        ctx.setParam('V', Math.round(v * 20) / 20)
        ctx.requestRender()
      })
      ctx.set('piston-hint', 'text', { x: CYL.x + CYL.w + 14, y: pistonY - 2, 'font-size': 13, fill: C.accent, text: '↕ 拖活塞改体积' })
    } else {
      ctx.remove('piston-hint')
    }

    // 分子
    for (let i = 0; i < st.mols.length; i++) {
      ctx.set(`m${i}`, 'circle', { cx: st.mols[i].x, cy: st.mols[i].y, r: 3, fill: C.normal, 'fill-opacity': 0.8 })
    }

    // 压强表（指针角度随 p）
    const gaugeX = 420
    const gaugeY = 170
    const ang = (-140 + (clamp(p, 0, 260) / 260) * 280) * (Math.PI / 180)
    ctx.set('gauge', 'circle', { cx: gaugeX, cy: gaugeY, r: 46, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.4, 'stroke-width': 2 })
    ctx.set('gauge-needle', 'line', { x1: gaugeX, y1: gaugeY, x2: gaugeX + Math.cos(ang) * 38, y2: gaugeY + Math.sin(ang) * 38, stroke: C.warn, 'stroke-width': 2.5 })
    ctx.set('gauge-l', 'text', { x: gaugeX, y: gaugeY + 22, 'font-size': 13, 'text-anchor': 'middle', fill: C.warn, text: `${fmt(p, 0)} kPa` })

    // 温度色标（等容/等压时活塞旁）
    if (params.mode !== 0) {
      ctx.set('temp-l', 'text', { x: CYL.x + CYL.w + 14, y: pistonY + 16, 'font-size': 13, fill: params.T > 450 ? C.warn : 'currentColor', 'fill-opacity': 0.7, text: `T=${fmt(params.T, 0)}K` })
    } else ctx.remove('temp-l')

    // 提示
    const lawName = ['玻意耳定律（等温）', '查理定律（等容）', '盖-吕萨克定律（等压）'][params.mode]
    ctx.set('tip', 'text', { x: 60, y: 46, 'font-size': 13, fill: C.warn, text: lawName })
    ctx.set('tip2', 'text', { x: 60, y: 64, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: params.mode === 0 ? '拖活塞压缩气体：V 减半 → p 翻倍（pV 恒定）' : params.mode === 1 ? '升温升压：V 不变，p ∝ T' : '等压膨胀：V ∝ T，活塞自动上移' })

    // p-V 图：量程按当前过程的理论极值自适应（避免曲线贴边或半板空白），画理论曲线 + 工作点
    if (ctx.gw) {
      const box = { x: 44, y: 20, w: ctx.gw - 70, h: ctx.gh - 62 }
      // 各过程的理论极值：等温 V∈[0.5,2.85]、p 峰值在 V=0.5；等容 V=1；等压 p=102、V∈[0.6,2.02]
      const gMax = params.mode === 0
        ? { xMax: 3.0, yMax: Math.ceil(((A_COEF * 300) / 0.5) * 1.1) }
        : params.mode === 1
          ? { xMax: 2.0, yMax: Math.ceil((A_COEF * 600) * 1.1) }
          : { xMax: 2.5, yMax: Math.ceil((A_COEF * 300) * 1.5) }
      axes(ctx, box, { xLabel: 'V/L', yLabel: 'p/kPa', xMax: gMax.xMax, yMax: gMax.yMax })
      if (params.mode === 0) {
        // 过当前点的等温线（双曲线）
        const pts: string[] = []
        for (let vv = 0.5; vv <= 2.85; vv += 0.05) {
          const pp = (A_COEF * 300) / vv
          const X = gx(box, 0, gMax.xMax, vv)
          const Y = gy(box, 0, gMax.yMax, Math.min(pp, gMax.yMax))
          pts.push(`${pts.length === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`)
        }
        ctx.gset('g-curve', 'path', { d: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2 })
      } else if (params.mode === 1) {
        const X = gx(box, 0, gMax.xMax, 1.0)
        ctx.gset('g-curve', 'line', { x1: X, y1: box.y, x2: X, y2: box.y + box.h, stroke: C.accent, 'stroke-width': 2 })
      } else {
        const Y = gy(box, 0, gMax.yMax, p)
        ctx.gset('g-curve', 'line', { x1: box.x, y1: Y, x2: box.x + box.w, y2: Y, stroke: C.accent, 'stroke-width': 2 })
      }
      ctx.gset('g-pt', 'circle', { cx: gx(box, 0, gMax.xMax, V), cy: gy(box, 0, gMax.yMax, Math.min(p, gMax.yMax)), r: 5, fill: C.warn })
      ctx.gset('g-pt-l', 'text', { x: gx(box, 0, gMax.xMax, V) + 8, y: gy(box, 0, gMax.yMax, Math.min(p, gMax.yMax)) - 6, 'font-size': 13, fill: C.warn, text: `(${fmt(V, 2)}, ${fmt(p, 0)})` })
    }

    data['过程'] = lawName
    data['体积 V'] = `${fmt(V, 2)} L`
    data['温度 T'] = `${fmt(params.T, 0)} K（等温过程恒为 300K）`
    data['压强 p'] = `${fmt(p, 1)} kPa`
    data['pV 乘积'] = `${fmt(p * V, 1)} kPa·L${params.mode === 0 ? '（恒定）' : ''}`
    return data
  },
}
