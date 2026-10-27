// 课件 2：共点力平衡 · 悬挂与三力动态平衡（高一·必修一）
// 两绳悬挂：拖小球改变两绳角度，实时 T1/T2、力的三角形闭合；含「晾衣绳」模式演示绳越平张力越大
import type { LabScene, LabState, LabData, Preset } from '../engine/types'
import { C, G, add, clamp, fmt, norm, scale, sub, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

// 两个固定悬点：天花板点 A1、右侧墙点 A2
const A1: V = v(400, 50)
const A2: V = v(615, 140)

interface S extends LabState {
  p: V // 小球位置（两绳模式）
  sag: number // 晾衣绳模式中点下垂量 px
}

// 解 2×2 平衡方程：T1*u1 + T2*u2 = (0, -mg)（屏幕 y 向下，重力为 +mg）
function tensions(p: V, mg: number): { T1: number; T2: number } {
  const u1 = norm(sub(A1, p))
  const u2 = norm(sub(A2, p))
  const det = u1.x * u2.y - u1.y * u2.x
  if (Math.abs(det) < 1e-6) {
    // 两绳共线（退化）：较竖直的一根承担全部重力
    const vert = Math.abs(u1.y) > Math.abs(u2.y)
    return vert ? { T1: -mg / (u1.y || -1), T2: 0 } : { T1: 0, T2: -mg / (u2.y || -1) }
  }
  // 克莱姆法则
  const T1 = (0 * u2.y - -mg * u2.x) / det
  const T2 = (u1.x * -mg - 0 * u1.y) / det
  return { T1, T2 }
}

export const hangingScene: LabScene = {
  id: 'hanging-balance',
  title: '共点力平衡 · 悬挂与三力动态平衡',
  grade: '高一',
  chapter: '必修一 · 共点力平衡',
  desc: '拖动小球改变两绳角度：T1/T2 实时变化、力的三角形闭合、绳越平张力越大',
  tags: ['共点力平衡', '三力平衡', '张力', '受力分析', '晾衣绳问题'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'm', label: '球质量 m', min: 0.5, max: 10, step: 0.5, unit: 'kg', default: 3, reset: false },
    {
      key: 'mode', label: '模式', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [
        { value: 0, label: '两绳悬挂小球' },
        { value: 1, label: '晾衣绳（拖中点下垂）' },
      ],
    },
  ],
  presets: [
    { name: '对称受力', params: { m: 3, mode: 0 }, state: { p: v(510, 250) } },
    { name: '一绳水平', params: { m: 3, mode: 0 }, state: { p: v(540, 140) } },
    { name: '接近水平（张力爆炸）', params: { m: 3, mode: 0 }, state: { p: v(580, 80) } },
    { name: '晾衣绳 · 下垂多', params: { m: 3, mode: 1 }, state: { sag: 90 } },
  ] as Preset[],
  formulas: [
    'T_1\\vec{u_1} + T_2\\vec{u_2} + m\\vec{g} = 0',
    '\\text{绳 2 水平时：} T_2 = mg\\tan\\beta',
    '\\text{晾衣绳：} T = \\frac{W}{2\\sin\\alpha}',
  ],
  keyPoints: [
    '三力平衡：任意两个力的合力与第三个力等大反向；力的三角形首尾相接自动闭合',
    '绳越接近水平张力越大：T = mg/(2sinα)，α→0 时 T→∞（「绳快断了」的根源）',
    '绳只能拉不能推：某绳张力算出负值说明它已松弛，该绳退出受力',
  ],
  challenge: {
    question: '小球被两根绳悬挂，把右绳逐渐拉到接近水平，右绳的张力会怎么变？',
    options: ['逐渐变小', '几乎不变', '急剧增大，绳越平张力越大', '先减小后增大'],
    answer: 2,
    explanation: '绳越接近水平，张力在竖直方向的分量越小；要维持 mg，张力本身必须急剧增大（T 含 1/sinθ 因子）。接近水平时张力可达重力的许多倍——这就是「晾衣绳」张力爆炸效应。',
    reveal_preset: '接近水平（张力爆炸）',
  },
  init(): S {
    return { t: 0, p: v(510, 250), sag: 90 }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const mg = params.m * G
    const data: LabData = {}
    let warn = ''

    if (params.mode === 0) {
      // —— 两绳悬挂 ——
      const p = st.p
      // 天花板与右墙
      ctx.set('ceiling', 'line', { x1: 280, y1: 50, x2: 620, y2: 50, stroke: 'currentColor', 'stroke-width': 3 })
      for (let i = 0; i < 10; i++) {
        ctx.set(`ceil-h${i}`, 'line', { x1: 290 + i * 34, y1: 50, x2: 280 + i * 34, y2: 38, stroke: 'currentColor', 'stroke-opacity': 0.35 })
      }
      ctx.set('wall', 'line', { x1: 618, y1: 90, x2: 618, y2: 320, stroke: 'currentColor', 'stroke-width': 3 })
      for (let i = 0; i < 9; i++) {
        ctx.set(`wall-h${i}`, 'line', { x1: 618, y1: 100 + i * 24, x2: 606, y2: 110 + i * 24, stroke: 'currentColor', 'stroke-opacity': 0.35 })
      }
      let { T1, T2 } = tensions(p, mg)
      const u1 = norm(sub(A1, p))
      const u2 = norm(sub(A2, p))
      let slack = false
      if (T2 < 0 || T1 < 0) {
        // 绳只能拉不能推：张力为负说明该绳松弛
        if (T2 < 0) {
          slack = true
          T2 = 0
          T1 = mg / Math.max(Math.abs(u1.y), 0.2)
        } else {
          T1 = 0
          T2 = mg / Math.max(Math.abs(u2.y), 0.2)
        }
      }
      // 两根绳
      ctx.set('rope1', 'line', { x1: A1.x, y1: A1.y, x2: p.x, y2: p.y, stroke: C.ink, 'stroke-width': 2.5 })
      ctx.set('rope2', 'line', { x1: A2.x, y1: A2.y, x2: p.x, y2: p.y, stroke: C.ink, 'stroke-width': 2.5 })
      ctx.set('anchor1', 'circle', { cx: A1.x, cy: A1.y, r: 5, fill: C.ink })
      ctx.set('anchor2', 'rect', { x: A2.x - 6, y: A2.y - 5, width: 12, height: 10, fill: C.ink })
      // 小球（可拖拽）
      const ball = ctx.set('ball', 'circle', { cx: p.x, cy: p.y, r: 20, fill: C.accentDeep, stroke: C.indigoDeep, 'stroke-width': 2 })
      ctx.drag(ball, (pt) => {
        st.p = v(clamp(pt.x, 160, 600), clamp(pt.y, 70, 390))
        ctx.requestRender()
      })
      // 力箭头（u1/u2 已在上方算出）
      const k = 80 / Math.max(mg, 1) // G 固定 80px
      if (opts.showForces) {
        drawArrow(ctx, 'fG', p, add(p, v(0, 80)), { color: C.gravity, label: `G=${fmt(mg, 1)}N` })
        // 张力箭头：方向 u，长度按 T 与 G 同比例（过大截断）
        const l1 = clamp(T1 * k, 0, 150)
        const l2 = clamp(T2 * k, 0, 150)
        drawArrow(ctx, 'fT1', p, add(p, scale(u1, l1)), { color: T1 > 2 * mg ? C.warn : C.tension, label: `T1=${fmt(T1, 1)}N` })
        drawArrow(ctx, 'fT2', p, add(p, scale(u2, l2)), { color: T2 > 2 * mg ? C.warn : C.tension, label: `T2=${fmt(T2, 1)}N` })
        if (opts.showComponents) {
          drawArrow(ctx, 'cT1x', p, add(p, v(u1.x * l1, 0)), { color: C.tension, component: true, width: 2 })
          drawArrow(ctx, 'cT1y', p, add(p, v(0, u1.y * l1)), { color: C.tension, component: true, width: 2 })
          drawArrow(ctx, 'cT2x', p, add(p, v(u2.x * l2, 0)), { color: C.tension, component: true, width: 2 })
          drawArrow(ctx, 'cT2y', p, add(p, v(0, u2.y * l2)), { color: C.tension, component: true, width: 2 })
        } else {
          ctx.remove('cT1x', 'cT1x-head', 'cT1x-label', 'cT1y', 'cT1y-head', 'cT1y-label', 'cT2x', 'cT2x-head', 'cT2x-label', 'cT2y', 'cT2y-head', 'cT2y-label')
        }
        if (opts.showPoints) ctx.set('dot-p', 'circle', { cx: p.x, cy: p.y, r: 4, fill: C.inkStrong })
        else ctx.remove('dot-p')
      } else {
        ctx.remove('fG', 'fG-head', 'fG-label', 'fT1', 'fT1-head', 'fT1-label', 'fT2', 'fT2-head', 'fT2-label', 'cT1x', 'cT1x-head', 'cT1x-label', 'cT1y', 'cT1y-head', 'cT1y-label', 'cT2x', 'cT2x-head', 'cT2x-label', 'cT2y', 'cT2y-head', 'cT2y-label', 'dot-p')
      }
      // 力的三角形（左下角固定区域）：G → T1 → T2 首尾相接自动闭合
      // 以最长边 = 140px 归一缩放，并整体平移/收缩到固定区域内（不画到画面外）
      const kBase = 140 / Math.max(mg, T1, T2, 1)
      let tri = [v(0, 0), scale(v(0, 1), mg * kBase), add(scale(v(0, 1), mg * kBase), scale(u1, T1 * kBase))]
      // 第三边 T2 回到起点（三力平衡自动闭合）；计算包围盒后平移进固定区域
      const BOX = { x0: 38, y0: 252, x1: 218, y1: 406 }
      let minX = Math.min(...tri.map((p) => p.x)), maxX = Math.max(...tri.map((p) => p.x))
      let minY = Math.min(...tri.map((p) => p.y)), maxY = Math.max(...tri.map((p) => p.y))
      const wBox = Math.max(maxX - minX, 1)
      const hBox = Math.max(maxY - minY, 1)
      const shrink = Math.min(1, (BOX.x1 - BOX.x0) / wBox, (BOX.y1 - BOX.y0) / hBox)
      if (shrink < 1) tri = tri.map((p) => scale(p, shrink))
      minX = Math.min(...tri.map((p) => p.x)); maxX = Math.max(...tri.map((p) => p.x))
      minY = Math.min(...tri.map((p) => p.y)); maxY = Math.max(...tri.map((p) => p.y))
      const dx = (BOX.x0 + BOX.x1) / 2 - (minX + maxX) / 2
      const dy = (BOX.y0 + BOX.y1) / 2 - (minY + maxY) / 2
      tri = tri.map((p) => add(p, v(dx, dy)))
      const [triO, gEnd, t1End] = tri
      const t2End = triO // 闭合回起点
      ctx.set('tri-title', 'text', { x: 40, y: 244, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.55, text: '力的三角形（自动闭合）' })
      ctx.set('tri1', 'line', { x1: triO.x, y1: triO.y, x2: gEnd.x, y2: gEnd.y, stroke: C.gravity, 'stroke-width': 2.5 })
      ctx.set('tri2', 'line', { x1: gEnd.x, y1: gEnd.y, x2: t1End.x, y2: t1End.y, stroke: C.tension, 'stroke-width': 2.5 })
      ctx.set('tri3', 'line', { x1: t1End.x, y1: t1End.y, x2: t2End.x, y2: t2End.y, stroke: C.net, 'stroke-width': 2, 'stroke-dasharray': '5 4' })
      // 绳 1 与竖直方向夹角 β（T2 = mg·tanβ 的β）
      const beta = Math.abs((Math.atan2(Math.abs(A1.x - p.x), Math.abs(A1.y - p.y)) * 180) / Math.PI)
      if (slack) {
        warn = '绳 2 松弛（拉力为 0）：把球拖回绳 2 顶点右下方试试'
        ctx.set('warn', 'text', { x: 150, y: 32, 'font-size': 14, fill: C.greenDeep, text: warn })
      } else if (T2 > 2 * mg) {
        warn = `绳很平：β=${fmt(beta, 0)}°，T2=${fmt(T2, 1)}N ≈ ${fmt(T2 / mg, 1)} 倍重力，绳快到极限了！`
        ctx.set('warn', 'text', { x: 150, y: 32, 'font-size': 14, fill: C.warn, text: warn })
      } else {
        ctx.remove('warn')
      }
      data['绳1 张力 T1'] = `${fmt(T1, 2)} N`
      data['绳2 张力 T2'] = `${fmt(T2, 2)} N`
      data['重力 G'] = `${fmt(mg, 2)} N`
      data['绳1 与竖直夹角 β'] = `${fmt(beta, 1)}°`
      data['倍数 T2/G'] = `${fmt(T2 / mg, 2)} 倍`
      if (warn) data['警示'] = '张力爆炸区'
    } else {
      // —— 晾衣绳模式 ——
      const L: V = v(150, 150)
      const R: V = v(510, 150)
      // 清掉两绳模式的图形
      ctx.remove('ceiling', 'wall', 'rope1', 'rope2', 'anchor1', 'anchor2', 'ball', 'tri1', 'tri2', 'tri3', 'tri-title', 'warn')
      ctx.remove('fG', 'fG-head', 'fG-label', 'fT1', 'fT1-head', 'fT1-label', 'fT2', 'fT2-head', 'fT2-label', 'dot-p')
      ctx.remove('cT1x', 'cT1x-head', 'cT1x-label', 'cT1y', 'cT1y-head', 'cT1y-label', 'cT2x', 'cT2x-head', 'cT2x-label', 'cT2y', 'cT2y-head', 'cT2y-label')
      for (let i = 0; i < 10; i++) ctx.remove(`ceil-h${i}`)
      for (let i = 0; i < 9; i++) ctx.remove(`wall-h${i}`)

      const half = (R.x - L.x) / 2
      const mid = v((L.x + R.x) / 2, L.y + st.sag)
      const alpha = (Math.atan2(st.sag, half) * 180) / Math.PI // 每段绳与水平的夹角
      const W = mg
      const T = W / (2 * Math.sin(radOf(Math.max(alpha, 1))))
      ctx.set('rail', 'line', { x1: 110, y1: 150, x2: 550, y2: 150, stroke: 'currentColor', 'stroke-width': 3 })
      for (let i = 0; i < 14; i++) {
        ctx.set(`rail-h${i}`, 'line', { x1: 118 + i * 32, y1: 150, x2: 108 + i * 32, y2: 138, stroke: 'currentColor', 'stroke-opacity': 0.35 })
      }
      ctx.set('rope-l', 'line', { x1: L.x, y1: L.y, x2: mid.x, y2: mid.y, stroke: C.ink, 'stroke-width': 2.5 })
      ctx.set('rope-r', 'line', { x1: R.x, y1: R.y, x2: mid.x, y2: mid.y, stroke: C.ink, 'stroke-width': 2.5 })
      ctx.set('anchor-l', 'circle', { cx: L.x, cy: L.y, r: 5, fill: C.ink })
      ctx.set('anchor-r', 'circle', { cx: R.x, cy: R.y, r: 5, fill: C.ink })
      // 重物（可拖拽改变下垂量）
      const w = ctx.set('weight', 'rect', { x: mid.x - 22, y: mid.y, width: 44, height: 30, rx: 4, fill: C.accentDeep, stroke: C.indigoDeep })
      const onDrag = (pt: { x: number; y: number }) => {
        st.sag = clamp(pt.y - L.y, 8, 230)
        ctx.requestRender()
      }
      ctx.drag(w, onDrag)
      const hit = ctx.set('weight-hit', 'circle', { cx: mid.x, cy: mid.y + 15, r: 38, fill: 'transparent' })
      ctx.drag(hit, onDrag)
      if (opts.showForces) {
        const uL = norm(sub(L, mid))
        const uR = norm(sub(R, mid))
        drawArrow(ctx, 'fG', mid, add(mid, v(0, 90)), { color: C.gravity, label: `W=${fmt(W, 1)}N` })
        drawArrow(ctx, 'fT', mid, add(mid, scale(uL, 90)), { color: T > W * 2 ? C.warn : C.tension, label: `T=${fmt(T, 1)}N` })
        drawArrow(ctx, 'fTr', mid, add(mid, scale(uR, 90)), { color: T > W * 2 ? C.warn : C.tension, label: `T=${fmt(T, 1)}N` })
        if (opts.showComponents) {
          // 每段绳张力的竖直分量（应各承担 W/2）
          drawArrow(ctx, 'cTly', mid, add(mid, v(0, 45)), { color: C.tension, component: true, width: 2 })
          drawArrow(ctx, 'cTry', mid, add(mid, v(0, 45)), { color: C.tension, component: true, width: 2 })
        } else {
          ctx.remove('cTly', 'cTly-head', 'cTly-label', 'cTry', 'cTry-head', 'cTry-label')
        }
      } else {
        ctx.remove('fG', 'fG-head', 'fG-label', 'fT', 'fT-head', 'fT-label', 'fTr', 'fTr-head', 'fTr-label', 'cTly', 'cTly-head', 'cTry', 'cTry-head')
      }
      ctx.set('hint2', 'text', {
        x: 30, y: 40, 'font-size': 14, fill: T > W * 2 ? C.warn : C.greenDeep,
        text: T > W * 2 ? `绳很平：α=${fmt(alpha, 1)}°，T=${fmt(T, 1)}N ≈ ${fmt(T / W, 1)} 倍物重！` : `α=${fmt(alpha, 1)}°，T=${fmt(T, 1)}N（绳越平张力越大）`,
      })
      data['下垂量'] = `${fmt(st.sag, 0)} px`
      data['绳与水平角 α'] = `${fmt(alpha, 1)}°`
      data['每段绳张力 T'] = `${fmt(T, 2)} N`
      data['物重 W'] = `${fmt(W, 2)} N`
      data['倍数 T/W'] = `${fmt(T / W, 2)} 倍`
    }
    return data
  },
}

function radOf(d: number): number {
  return (d * Math.PI) / 180
}
