// 课件 35：分子动理论与布朗运动（选择性必修三 · 热学）
// 密封盒内分子无规则热运动（速率∝√T），花粉颗粒被分子碰撞做布朗运动并留下轨迹
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt, type V } from '../engine/vec'

const BOX = { x: 40, y: 68, w: 560, h: 326 } // 密封盒画满舞台（顶部留提示行）
const N_MOL = 70 // 分子数：60+ 保证视觉密度
const BASE_SPEED = 62 // 300K 时的分子速率 px/s
const UM_PER_PX = 1 // 位移换算假设：舞台 1px ≈ 1μm（给位移以物理量级）

interface Molecule {
  x: number
  y: number
  dx: number // 单位方向向量
  dy: number
}

interface S extends LabState {
  t: number
  mols: Molecule[]
  pollen: { x: number; y: number; vx: number; vy: number }
  trail: string // 布朗轨迹 path d
  trailPts: V[]
}

function randDir(): { dx: number; dy: number } {
  const a = Math.random() * Math.PI * 2
  return { dx: Math.cos(a), dy: Math.sin(a) }
}

export const brownianScene: LabScene = {
  id: 'brownian',
  title: '分子动理论与布朗运动',
  grade: '高三',
  chapter: '选择性必修三 · 热学',
  desc: '分子无规则热运动撞击花粉颗粒：调温度看分子速率与布朗运动的剧烈程度变化',
  tags: ['分子动理论', '布朗运动', '热运动', '温度', '平均动能'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'T', label: '温度 T', min: 100, max: 600, step: 10, unit: 'K', default: 300, reset: false },
  ],
  presets: [
    { name: '常温 300K', params: { T: 300 } },
    { name: '低温 120K', params: { T: 120 } },
    { name: '高温 600K', params: { T: 600 } },
  ],
  formulas: [
    '\\overline{E_k} = \\tfrac{3}{2}kT\\ \\text{（温度是分子平均动能的标志）}',
    '\\bar{v} \\propto \\sqrt{T}',
    '\\text{布朗运动：颗粒越小、温度越高越剧烈}',
  ],
  keyPoints: [
    '布朗运动是悬浮颗粒的无规则运动，直接原因是大数分子撞击的不平衡，间接反映液体/气体分子的无规则热运动',
    '温度是分子平均动能的标志：温度越高，分子平均速率越大，布朗运动越剧烈',
    '布朗颗粒越大，各方向撞击越容易抵消，布朗运动越不明显（不是不运动）',
  ],
  init(): S {
    const mols: Molecule[] = []
    for (let i = 0; i < N_MOL; i++) {
      mols.push({
        x: BOX.x + 20 + Math.random() * (BOX.w - 40),
        y: BOX.y + 20 + Math.random() * (BOX.h - 40),
        ...randDir(),
      })
    }
    return {
      t: 0,
      mols,
      pollen: { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2, vx: 0, vy: 0 },
      trail: '',
      trailPts: [],
    }
  },
  step(dt, params, state) {
    const st = state as S
    st.t += dt
    const speed = BASE_SPEED * Math.sqrt(params.T / 300)
    // 分子：匀速直线 + 碰壁反弹（方向不变、速率由温度统一控制）
    for (const m of st.mols) {
      m.x += m.dx * speed * dt
      m.y += m.dy * speed * dt
      if (m.x < BOX.x + 6) { m.x = BOX.x + 6; m.dx = Math.abs(m.dx) }
      if (m.x > BOX.x + BOX.w - 6) { m.x = BOX.x + BOX.w - 6; m.dx = -Math.abs(m.dx) }
      if (m.y < BOX.y + 6) { m.y = BOX.y + 6; m.dy = Math.abs(m.dy) }
      if (m.y > BOX.y + BOX.h - 6) { m.y = BOX.y + BOX.h - 6; m.dy = -Math.abs(m.dy) }
    }
    // 花粉颗粒：受分子碰撞的随机冲量 + 介质阻尼（速度缓慢衰减）
    st.pollen.vx += (Math.random() - 0.5) * speed * 1.6 * dt
    st.pollen.vy += (Math.random() - 0.5) * speed * 1.6 * dt
    st.pollen.vx *= 1 - 1.4 * dt
    st.pollen.vy *= 1 - 1.4 * dt
    st.pollen.x += st.pollen.vx * dt * 8
    st.pollen.y += st.pollen.vy * dt * 8
    // 限制在盒内（碰壁后反向）
    if (st.pollen.x < BOX.x + 18 || st.pollen.x > BOX.x + BOX.w - 18) {
      st.pollen.x = clamp(st.pollen.x, BOX.x + 18, BOX.x + BOX.w - 18)
      st.pollen.vx = -st.pollen.vx
    }
    if (st.pollen.y < BOX.y + 18 || st.pollen.y > BOX.y + BOX.h - 18) {
      st.pollen.y = clamp(st.pollen.y, BOX.y + 18, BOX.y + BOX.h - 18)
      st.pollen.vy = -st.pollen.vy
    }
    // 轨迹（保留最近 240 个点）
    st.trailPts.push({ x: st.pollen.x, y: st.pollen.y })
    if (st.trailPts.length > 240) st.trailPts.shift()
    st.trail = st.trailPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  },
  render(ctx, params, state): LabData {
    const st = state as S
    const data: LabData = {}

    // 密封盒
    ctx.set('box', 'rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.4, rx: 8, 'stroke-width': 2 })

    // 布朗轨迹
    if (st.trail) {
      ctx.set('trail', 'path', { d: st.trail, fill: 'none', stroke: C.warn, 'stroke-opacity': 0.55, 'stroke-width': 1.2 })
    }

    // 分子（小圆点）
    for (let i = 0; i < st.mols.length; i++) {
      const m = st.mols[i]
      ctx.set(`m${i}`, 'circle', { cx: m.x, cy: m.y, r: 3.5, fill: C.normal, 'fill-opacity': 0.75 })
    }

    // 花粉颗粒（大颗粒，可拖动摆放）
    const pl = ctx.set('pollen', 'circle', { cx: st.pollen.x, cy: st.pollen.y, r: 15, fill: '#f59e0b', stroke: '#b45309', 'stroke-width': 2 })
    ctx.drag(pl, (p) => {
      st.pollen.x = clamp(p.x, BOX.x + 18, BOX.x + BOX.w - 18)
      st.pollen.y = clamp(p.y, BOX.y + 18, BOX.y + BOX.h - 18)
      st.trailPts = []
      ctx.requestRender()
    })
    ctx.set('pollen-l', 'text', { x: st.pollen.x, y: st.pollen.y - 24, 'font-size': 13, 'text-anchor': 'middle', fill: C.warn, text: '花粉颗粒（可拖）' })

    // 温度计提示
    ctx.set('tip', 'text', {
      x: 46, y: 40, 'font-size': 13, fill: C.warn,
      text: `T=${fmt(params.T, 0)}K：分子平均速率为 300K 基准的 ${fmt(Math.sqrt(params.T / 300), 2)} 倍 —— ${params.T > 400 ? '撞击更猛烈，布朗运动显著加剧' : params.T < 200 ? '撞击微弱，布朗运动趋于平缓' : '布朗运动清晰可见'}`,
    })
    ctx.set('tip2', 'text', { x: 46, y: 58, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '蓝点=分子（速率∝√T）；橙点=花粉；红线=布朗运动轨迹' })

    // 数据面板用物理量纲表述（以 300K 为基准 1.00；禁止 px/s 这类像素量纲）
    data['温度 T'] = `${fmt(params.T, 0)} K`
    data['分子平均速率'] = `${fmt(Math.sqrt(params.T / 300), 2)} × v̄(300K)（∝√T）`
    data['分子平均动能'] = `${fmt(params.T / 300, 2)} × Ēₖ(300K)（Eₖ∝T）`
    data['布朗粒子位移'] = st.trailPts.length > 1 ? `${fmt(Math.hypot(st.pollen.x - st.trailPts[0].x, st.pollen.y - st.trailPts[0].y) * UM_PER_PX, 0)} μm（累计路程远大于位移）` : '—'
    data['观察要点'] = '颗粒运动无规则，永不停歇'
    return data
  },
}
