// 课件 21：电场线与电场强度（必修三 · 静电场）
// 点电荷/等量同号/等量异号三种电场线，拖动试探电荷看电场力矢量随位置变化
import type { LabScene, LabState, LabData, SceneParams, LabCtx } from '../engine/types'
import { C, add, clamp, fmt, len, norm, sub, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const K = 8.99e9
// 屏幕坐标（像素）→ 实际（m）：1px = 1cm
const PX_PER_M = 100
const Q = 2e-8 // 源电荷 20nC（数值演示）

interface S extends LabState {
  pos: V // 试探电荷（像素）
  linesKey: string // 已生成电场线的参数指纹
  lines: string[] // 电场线 path 数据缓存
}

export const efieldScene: LabScene = {
  id: 'efield-lines',
  title: '电场线与电场强度',
  grade: '高二',
  chapter: '必修三 · 静电场',
  desc: '点电荷/等量同号/等量异号三种电场线图，拖试探电荷看 E 与 F 的大小方向实时变化',
  tags: ['电场强度', '电场线', '点电荷', '试探电荷'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'mode', label: '电荷组合', min: 0, max: 2, step: 1, unit: '', default: 2,
      options: [
        { value: 0, label: '单个正点电荷' },
        { value: 1, label: '等量同号（+ +）' },
        { value: 2, label: '等量异号（+ −）' },
      ],
    },
    { key: 'd', label: '两电荷间距', min: 80, max: 300, step: 10, unit: 'px', default: 180, modes: [1, 2], reset: false },
    { key: 'qt', label: '试探电荷 q', min: -2, max: 2, step: 0.5, unit: 'nC', default: 1, reset: false },
  ],
  presets: [
    { name: '单个正点电荷', params: { mode: 0, qt: 1 } },
    { name: '等量同号', params: { mode: 1, d: 180, qt: 1 } },
    { name: '等量异号', params: { mode: 2, d: 180, qt: 1 } },
    { name: '负试探电荷', params: { mode: 2, d: 180, qt: -1 } },
  ],
  formulas: [
    'E = k\\frac{Q}{r^2}',
    'F = qE',
    '\\text{电场线从正电荷出发，终止于负电荷}',
  ],
  keyPoints: [
    '电场线疏密表示场强大小，切线方向为 E 方向',
    '电场线是人为描绘的曲线，实际并不存在，且永不相交',
    '电场强度由源电荷与位置决定，与试探电荷无关（F 才与 q 有关）',
  ],
  init(params: SceneParams): S {
    return { pos: v(470, 210), linesKey: '', lines: [] }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const mode = params.mode

    // 源电荷位置
    const sources: { pos: V; q: number }[] = []
    if (mode === 0) sources.push({ pos: v(320, 210), q: Q })
    else {
      const half = params.d / 2
      if (mode === 1) {
        sources.push({ pos: v(320 - half, 210), q: Q })
        sources.push({ pos: v(320 + half, 210), q: Q })
      } else {
        sources.push({ pos: v(320 - half, 210), q: Q })
        sources.push({ pos: v(320 + half, 210), q: -Q })
      }
    }

    // 电场线缓存：参数指纹变化时重新积分描绘（render 每帧调用，不能每帧算）
    const key = `${mode}:${Math.round(params.d / 10)}`
    if (st.linesKey !== key) {
      st.linesKey = key
      st.lines = traceLines(sources, ctx)
    }
    st.lines.forEach((d, i) => {
      ctx.set(`fl${i}`, 'path', { d, fill: 'none', stroke: C.field, 'stroke-opacity': 0.5, 'stroke-width': 1.3 })
    })
    for (let i = st.lines.length; i < 40; i++) ctx.remove(`fl${i}`)

    // 源电荷
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      const pos = s.q >= 0
      ctx.set(`src${i}`, 'circle', { cx: s.pos.x, cy: s.pos.y, r: 15, fill: pos ? '#ef4444' : '#3b82f6', stroke: pos ? '#b91c1c' : '#1d4ed8', 'stroke-width': 2 })
      ctx.set(`src${i}-t`, 'text', { x: s.pos.x, y: s.pos.y + 5, 'font-size': 14, 'text-anchor': 'middle', fill: '#fff', text: pos ? '+' : '−' })
    }

    // 试探电荷（自由拖动）
    const qt = params.qt * 1e-9
    const posQ = params.qt >= 0
    const tc = ctx.set('tc', 'circle', { cx: st.pos.x, cy: st.pos.y, r: 11, fill: posQ ? '#f59e0b' : '#0ea5e9', stroke: posQ ? '#b45309' : '#0284c7', 'stroke-width': 2, 'fill-opacity': 0.95 })
    ctx.set('tc-t', 'text', { x: st.pos.x, y: st.pos.y + 4, 'font-size': 11, 'text-anchor': 'middle', fill: '#fff', text: posQ ? '+' : '−' })
    ctx.drag(tc, (p) => {
      st.pos = v(clamp(p.x, 14, ctx.w - 14), clamp(p.y, 14, ctx.h - 14))
      ctx.requestRender()
    })

    // 合场强与电场力
    let E = v(0, 0)
    for (const s of sources) {
      const rpx = Math.max(len(sub(st.pos, s.pos)), 12)
      const rM = rpx / PX_PER_M
      const em = (K * Math.abs(s.q)) / (rM * rM) // N/C
      const u = norm(sub(st.pos, s.pos))
      const sign = s.q >= 0 ? 1 : -1
      E = add(E, { x: sign * em * u.x, y: sign * em * u.y })
    }
    const Emag = len(E)
    const F = Math.abs(qt) * Emag
    if (opts.showForces && Emag > 1) {
      const k = 90 / Math.max(Emag, 1)
      const from = st.pos
      drawArrow(ctx, 'fE', from, add(from, { x: (E.x / Emag) * k, y: (E.y / Emag) * k }), { color: C.field, label: `E=${sciFmt(Emag)}N/C` })
      if (Math.abs(qt) > 0.01) {
        const fdir = qt >= 0 ? 1 : -1 // 负电荷受力与 E 反向
        drawArrow(ctx, 'fF', from, add(from, { x: (fdir * E.x / Emag) * k * 0.7, y: (fdir * E.y / Emag) * k * 0.7 }), { color: C.net, dashed: true, label: `F=${sciFmt(F)}N` })
      } else ctx.remove('fF', 'fF-head', 'fF-label')
      if (opts.showPoints) ctx.set('dot-t', 'circle', { cx: st.pos.x, cy: st.pos.y, r: 2.5, fill: '#111827' })
      else ctx.remove('dot-t')
    } else {
      ctx.remove('fE', 'fE-head', 'fE-label', 'fF', 'fF-head', 'fF-label', 'dot-t')
    }

    // 提示
    ctx.set('tip', 'text', { x: 44, y: 32, 'font-size': 12, fill: 'currentColor', 'fill-opacity': 0.55, text: '紫线=电场线（疏→密 场强增大）；橙色=试探电荷（可拖）' })
    if (Math.abs(qt) < 0.01) ctx.set('tip2', 'text', { x: 44, y: 50, 'font-size': 12, fill: C.warn, text: 'q=0：不受力，但该点场强 E 依然存在' })
    else ctx.remove('tip2')

    data['电荷组合'] = mode === 0 ? '单个正点电荷' : mode === 1 ? '等量同号' : '等量异号'
    data['试探电荷位置场强 E'] = `${sciFmt(Emag)} N/C`
    data['电场力 F=qE'] = `${sciFmt(F)} N`
    data['F 与 E 方向'] = qt >= 0 ? '相同（正电荷）' : '相反（负电荷）'
    return data
  },
}

/** 科学计数显示 */
function sciFmt(n: number): string {
  if (n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  if (exp >= -2 && exp <= 3) return fmt(n, 2)
  return `${fmt(n / 10 ** exp, 2)}×10^${exp}`
}

const SRC_R = 15 // 源电荷半径（电场线起止边界）

/** 从每个源电荷周围均匀撒种子，沿 E 方向积分描出电场线（到源/边界为止） */
function traceLines(sources: { pos: V; q: number }[], ctx: LabCtx): string[] {
  const paths: string[] = []
  const STEP = 4 // 步长 px
  for (const src of sources) {
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2
      let p = v(src.pos.x + Math.cos(ang) * (SRC_R + 3), src.pos.y + Math.sin(ang) * (SRC_R + 3))
      const pts: string[] = [`M${p.x.toFixed(1)},${p.y.toFixed(1)}`]
      const qSign = src.q >= 0 ? 1 : -1 // 负电荷沿逆 E 方向走（终点在负电荷）
      for (let n = 0; n < 900; n++) {
        let E = v(0, 0)
        let hit = -1
        for (let si = 0; si < sources.length; si++) {
          const s = sources[si]
          const d = sub(p, s.pos)
          const rpx = Math.max(len(d), 6)
          if (si !== 0 && rpx < SRC_R + 2) hit = si // 落入另一个源
          const e = (1 / (rpx * rpx)) * (s.q >= 0 ? 1 : -1)
          E = add(E, { x: e * d.x / rpx, y: e * d.y / rpx })
        }
        if (hit >= 0) break
        const l = len(E)
        if (l < 1e-6) break
        const u = { x: (E.x / l) * qSign, y: (E.y / l) * qSign }
        p = v(p.x + u.x * STEP, p.y + u.y * STEP)
        if (p.x < 8 || p.x > ctx.w - 8 || p.y < 8 || p.y > ctx.h - 8) break
        pts.push(`L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      }
      if (pts.length > 4) paths.push(pts.join(' '))
    }
  }
  return paths
}
