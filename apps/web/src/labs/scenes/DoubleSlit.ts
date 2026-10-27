// 课件 38：双缝干涉（选择性必修一 · 光学）
// 激光经双缝在屏上形成等间距条纹：Δy=λL/d；条纹颜色随波长变化，
// 探针可拖到屏上读条纹级数与明暗
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'

const SLIT_X = 200 // 双缝板位置
const SCREEN_X = 560 // 屏位置
const SLIT_Y = 210 // 双缝中点
const SCALE = 90 // 屏上 px / mm（屏视图范围 ±20mm）

interface S extends LabState {
  t: number
  probeY: number // 探针在屏上的 y（相对中点 mm）
  cacheKey: string
  fringeStrip: boolean[]
}

/** 波长 nm → 近似 RGB（380~780nm 可见光） */
function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (nm < 440) { r = -(nm - 440) / 60; b = 1 }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1 }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20 }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1 }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65 }
  else { r = 1 }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export const doubleSlitScene: LabScene = {
  id: 'double-slit',
  title: '双缝干涉',
  grade: '高二',
  chapter: '选择性必修一 · 光学',
  desc: '激光双缝实验：Δy=λL/d 决定条纹间距，换波长看条纹变疏变密、颜色随波长变化',
  tags: ['双缝干涉', '光的干涉', '波长', '条纹间距', '相干光'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'lam', label: '波长 λ', min: 400, max: 700, step: 5, unit: 'nm', default: 650, reset: false },
    { key: 'd', label: '缝间距 d', min: 0.1, max: 0.5, step: 0.02, unit: 'mm', default: 0.25, reset: false },
    { key: 'L', label: '缝屏距 L', min: 0.5, max: 2.5, step: 0.1, unit: 'm', default: 1.5, reset: false },
  ],
  presets: [
    { name: '红光 650nm', params: { lam: 650, d: 0.25, L: 1.5 } },
    { name: '绿光 532nm', params: { lam: 532, d: 0.25, L: 1.5 } },
    { name: '紫光 405nm', params: { lam: 405, d: 0.25, L: 1.5 } },
    { name: '缝距加倍 条纹变密', params: { lam: 650, d: 0.5, L: 1.5 } },
  ],
  formulas: [
    '\\Delta y = \\dfrac{\\lambda L}{d}',
    '\\text{亮纹：} d\\sin\\theta = k\\lambda',
    '\\text{暗纹：} d\\sin\\theta = (2k+1)\\dfrac{\\lambda}{2}',
  ],
  keyPoints: [
    '相邻亮纹（或暗纹）间距 Δy=λL/d：红光比紫光条纹宽，缝距 d 加大条纹变密',
    '双缝干涉证明光是一种波；中央到各亮纹路程差为整数个波长',
    '白光入射时中央亮纹为白色，两侧出现彩色条纹（紫在内、红在外）',
  ],
  init(): S {
    return { t: 0, probeY: 0, cacheKey: '', fringeStrip: [] }
  },
  step(dt, _params, state) {
    ;(state as S).t += dt
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const dyMm = ((params.lam * 1e-6) * params.L * 1000) / params.d // 条纹间距 mm = λ(mm)·L(mm)/d(mm)
    const [r, g, b] = wavelengthToRGB(params.lam)
    const rgbStr = `rgb(${r},${g},${b})`

    // —— 激光器 + 到双缝的平行光 ——
    ctx.set('laser', 'rect', { x: 40, y: SLIT_Y - 40, width: 60, height: 80, rx: 6, fill: C.ink })
    ctx.set('laser-t', 'text', { x: 70, y: SLIT_Y + 60, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6, text: '激光' })
    for (let i = 0; i < 5; i++) {
      const y = SLIT_Y - 24 + i * 12
      ctx.set(`laser-ray${i}`, 'line', { x1: 102, y1: y, x2: SLIT_X - 8, y2: y, stroke: rgbStr, 'stroke-opacity': 0.5, 'stroke-width': 1.5 })
    }

    // —— 双缝板与两条缝 ——
    const gapPx = clamp(params.d * 160, 16, 80) // 缝间距视觉大小
    ctx.set('plate-t', 'rect', { x: SLIT_X, y: 60, width: 8, height: SLIT_Y - gapPx / 2 - 8 - 60, fill: 'currentColor', 'fill-opacity': 0.55 })
    ctx.set('plate-m', 'rect', { x: SLIT_X, y: SLIT_Y - gapPx / 2 - 8, width: 8, height: 16, fill: 'currentColor', 'fill-opacity': 0.55 })
    ctx.set('plate-b', 'rect', { x: SLIT_X, y: SLIT_Y + gapPx / 2 + 8, width: 8, height: 340 - (SLIT_Y + gapPx / 2), fill: 'currentColor', 'fill-opacity': 0.55 })
    ctx.set('d-brace', 'line', { x1: SLIT_X - 14, y1: SLIT_Y - gapPx / 2, x2: SLIT_X - 14, y2: SLIT_Y + gapPx / 2, stroke: C.accent, 'stroke-width': 1.5 })
    ctx.set('d-l', 'text', { x: SLIT_X - 20, y: SLIT_Y + 4, 'font-size': 13, 'text-anchor': 'end', fill: C.accent, text: `d=${fmt(params.d, 2)}mm` })

    // —— 传播波面示意（分量开关=显示波前弧线）——
    if (opts.showComponents) {
      for (let k = 1; k <= 8; k++) {
        const x = SLIT_X + 8 + ((SCREEN_X - SLIT_X - 16) * k) / 9
        for (const sy of [SLIT_Y - gapPx / 2, SLIT_Y + gapPx / 2]) {
          ctx.set(`w${k}-${sy}`, 'path', {
            d: `M${x},${SLIT_Y - 46} Q${x + 26},${SLIT_Y} ${x},${SLIT_Y + 46}`,
            fill: 'none', stroke: rgbStr, 'stroke-opacity': 0.18, 'stroke-width': 1.2,
          })
        }
      }
    }

    // —— 屏与条纹（参数变化时重算，平时只贴缓存）——
    ctx.set('screen', 'rect', { x: SCREEN_X, y: 60, width: 10, height: 340, fill: C.lead2, rx: 2 })
    const key = `${params.lam}|${params.d}|${params.L}`
    const stripH = 300
    if (key !== st.cacheKey) {
      st.cacheKey = key
      st.fringeStrip = []
      const rows = stripH / 2
      for (let i = 0; i < rows; i++) {
        const yMm = (i - rows / 2) * 2 / SCALE // 相对中点的 mm
        // 双缝光强：I = I₀cos²(π·y/Δy)（单缝包络略去）
        const inten = Math.pow(Math.cos((Math.PI * yMm) / dyMm), 2)
        st.fringeStrip.push(inten > 0.5)
      }
    }
    const rows = st.fringeStrip.length
    for (let i = 0; i < rows; i++) {
      const y = 60 + 20 + i * 2
      if (!st.fringeStrip[i]) {
        ctx.remove(`fr${i}`)
        continue
      }
      ctx.set(`fr${i}`, 'rect', { x: SCREEN_X + 10, y, width: 46, height: 2, fill: rgbStr })
    }
    // 中央亮纹标记
    ctx.set('k0', 'line', { x1: SCREEN_X + 62, y1: SLIT_Y, x2: SCREEN_X + 74, y2: SLIT_Y, stroke: 'currentColor', 'stroke-opacity': 0.5 })
    ctx.set('k0-l', 'text', { x: SCREEN_X + 78, y: SLIT_Y + 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.6, text: 'k=0' })
    // 屏刻度
    for (const mm of [-10, 0, 10]) {
      const y = SLIT_Y + mm * SCALE
      ctx.set(`sc${mm}`, 'line', { x1: SCREEN_X - 6, y1: y, x2: SCREEN_X + 16, y2: y, stroke: 'currentColor', 'stroke-opacity': 0.3 })
      ctx.set(`scl${mm}`, 'text', { x: SCREEN_X + 20, y: y + 4, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: `${mm > 0 ? '+' : ''}${mm}mm` })
    }

    // —— 探针（拖到屏上读条纹级数）——
    const py = SLIT_Y + st.probeY * SCALE
    const probe = ctx.set('probe', 'polygon', {
      points: `${SCREEN_X - 16},${py} ${SCREEN_X - 4},${py - 6} ${SCREEN_X - 4},${py + 6}`,
      fill: C.warn,
    })
    ctx.drag(probe, (p) => {
      st.probeY = clamp((p.y - SLIT_Y) / SCALE, -12, 12)
      ctx.requestRender()
    })
    const kVal = st.probeY / dyMm
    const nearBright = Math.abs(kVal - Math.round(kVal)) < 0.25
    const nearDark = Math.abs(kVal - Math.round(kVal - Math.sign(kVal) * 0.5)) < 0.25
    ctx.set('probe-l', 'text', {
      x: SCREEN_X - 24, y: py - 10, 'font-size': 13, 'text-anchor': 'end', fill: C.warn,
      text: `y=${st.probeY >= 0 ? '+' : ''}${fmt(st.probeY, 1)}mm ${nearBright ? `亮纹（k=${fmt(Math.round(kVal), 0)}）` : nearDark ? '暗纹' : '半明半暗'}`,
    })
    // 双缝到探针的光路 + 路程差
    ctx.set('ray1', 'line', { x1: SLIT_X + 8, y1: SLIT_Y - gapPx / 2, x2: SCREEN_X - 6, y2: py, stroke: C.accent, 'stroke-opacity': 0.4, 'stroke-dasharray': '3 3' })
    ctx.set('ray2', 'line', { x1: SLIT_X + 8, y1: SLIT_Y + gapPx / 2, x2: SCREEN_X - 6, y2: py, stroke: C.accent, 'stroke-opacity': 0.4, 'stroke-dasharray': '3 3' })

    ctx.set('tip', 'text', {
      x: 60, y: 42, 'font-size': 13, fill: C.warn,
      text: `相邻亮纹间距 Δy=λL/d=${fmt(dyMm, 2)} mm —— ${params.lam > 600 ? '红光波长长，条纹最疏' : params.lam < 460 ? '紫光波长短，条纹最密' : ''}`,
    })
    ctx.set('tip2', 'text', { x: 60, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '拖屏上红色探针读条纹级数；改 λ / d / L 看条纹疏密变化' })

    data['条纹间距 Δy'] = `${fmt(dyMm, 2)} mm`
    data['波长 λ'] = `${params.lam} nm`
    data['缝间距 d'] = `${fmt(params.d, 2)} mm`
    data['缝屏距 L'] = `${fmt(params.L, 1)} m`
    data['探针位置'] = `${st.probeY >= 0 ? '+' : ''}${fmt(st.probeY, 1)} mm（${fmt(kVal, 2)} 个 Δy）`
    data['判定'] = nearBright ? '亮纹' : nearDark ? '暗纹' : '过渡区'
    return data
  },
}
