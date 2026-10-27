// 课件 12：追及相遇问题（高一·必修一）
// A 车追 B 车：v0/a 可调，实时两 v-t 曲线，标注当前间距与全程最小间距
// 镜头跟随 A 车平移（路面标尺滚动），任意时刻两车可分辨不重叠
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, add, clamp, fmt, v } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'
import { axes, gx, gy, polyline } from '../engine/graph'

const ROAD_Y = 300
const START_X = 70
const PX_PER_M = 5 // 像素/米
const T_MAX = 12 // 仿真时长 s
const SAMPLE = 0.25
const CAR_W = 20 // 车长像素（≈4.4m，避免两车重叠遮蔽）
const CAR_H = 14

interface S extends LabState {
  t: number
  xA: number
  xB: number
  vA: number
  vB: number
  ptsA: [number, number][]
  ptsB: [number, number][]
  nextSample: number
  minGap: number // 全程最小间距（追上之前）
  minGapT: number
  passed: boolean // A 已超过 B
}

export const catchUpScene: LabScene = {
  id: 'catch-up',
  title: '追及相遇问题',
  grade: '高一',
  chapter: '必修一 · 匀变速直线运动',
  desc: '两车 v0、a 可调：双 v-t 曲线对比，实时间距与最小间距标注，镜头跟车判断能否追上',
  tags: ['追及相遇', '匀变速直线运动', '相对运动', 'v-t 图像'],
  view: { w: 640, h: 420 },
  usesGraph: true,
  params: [
    { key: 'vA', label: 'A 车初速 vA', min: 0, max: 30, step: 0.5, unit: 'm/s', default: 20, reset: false },
    { key: 'aA', label: 'A 车加速度 aA', min: -4, max: 4, step: 0.1, unit: 'm/s²', default: -2, reset: false },
    { key: 'vB', label: 'B 车初速 vB', min: 0, max: 30, step: 0.5, unit: 'm/s', default: 10, reset: false },
    { key: 'aB', label: 'B 车加速度 aB', min: -4, max: 4, step: 0.1, unit: 'm/s²', default: 0, reset: false },
    { key: 'd0', label: '初始间距 d0', min: 0, max: 60, step: 1, unit: 'm', default: 20 },
  ],
  presets: [
    { name: '能追上（匀减速追匀速）', params: { vA: 20, aA: -2, vB: 10, aB: 0, d0: 20 } },
    { name: '恰好追上', params: { vA: 20, aA: -2.5, vB: 10, aB: 0, d0: 20 } },
    { name: '追不上（减速太狠）', params: { vA: 15, aA: -3, vB: 10, aB: 0, d0: 20 } },
    { name: '双双加速（后车更强）', params: { vA: 5, aA: 2, vB: 15, aB: 0.5, d0: 30 } },
  ],
  formulas: [
    'x_A = v_{A0}t + \\tfrac{1}{2}a_A t^2',
    'x_B = v_{B0}t + \\tfrac{1}{2}a_B t^2 + d_0',
    '\\Delta x = d_0 \\Rightarrow \\text{追上}',
  ],
  keyPoints: [
    '追上/不相撞的临界条件：速度相等时恰好到达同一位置（v-t 图上两线相交处间距最小）',
    '匀减速追匀速：vA 减到 vB 之前没追上，之后就再也追不上了',
    '相对运动观点：以 B 为参考系，A 以 vA−vB、aA−aB 做匀变速',
  ],
  challenge: {
    question: 'A 车以 20 m/s 匀减速（a = −2 m/s²）追前方 20 m 处以 10 m/s 匀速行驶的 B 车，能追上吗？',
    options: ['能追上', '追不上（距离先减后增）', '恰好追不上', '无法判断'],
    answer: 0,
    explanation: '以 B 为参考系：相对初速 10 m/s、相对加速度 −2 m/s²。追上条件 10t − t² = 20 有解（t ≈ 2.8 s），A 能追上；若把 d0 加大到超过 25 m 就追不上了——试拖 d0 看看临界。',
    reveal_preset: '能追上（匀减速追匀速）',
  },
  init(params: SceneParams): S {
    return {
      t: 0,
      xA: 0,
      xB: params.d0,
      vA: params.vA,
      vB: params.vB,
      ptsA: [[0, params.vA]],
      ptsB: [[0, params.vB]],
      nextSample: SAMPLE,
      minGap: params.d0,
      minGapT: 0,
      passed: false,
    }
  },
  step(dt, params, state) {
    const st = state as S
    if (st.t >= T_MAX) return
    st.t += dt
    if (st.vA > 0 || params.aA > 0) st.vA = Math.max(0, st.vA + params.aA * dt)
    if (st.vB > 0 || params.aB > 0) st.vB = Math.max(0, st.vB + params.aB * dt)
    st.xA += st.vA * dt
    st.xB += st.vB * dt
    const gap = st.xB - st.xA
    if (gap >= 0 && gap < st.minGap) {
      st.minGap = gap
      st.minGapT = st.t
    }
    if (gap <= 0) st.passed = true
    if (st.t >= st.nextSample) {
      const tt = Number(st.t.toFixed(2))
      st.ptsA.push([tt, st.vA])
      st.ptsB.push([tt, st.vB])
      st.nextSample += SAMPLE
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}

    // 镜头跟随：让 A 车尽量留在画面内（世界坐标 → 屏幕坐标统一减 cam 米）
    const axWorld = st.xA * PX_PER_M
    const cam = Math.max(0, axWorld - 220) // A 车超过画面 290px 后镜头开始平移
    const sx = (worldM: number) => START_X + worldM * PX_PER_M - cam

    // 路面（全宽）+ 每 10m 一个标尺刻度（随镜头滚动，学生可读位移）
    ctx.set('road', 'rect', { x: 40, y: ROAD_Y + 16, width: 560, height: 10, fill: C.faint, rx: 3 })
    for (let i = 0; i < 14; i++) {
      ctx.set(`dash${i}`, 'line', { x1: 50 + i * 40, y1: ROAD_Y + 21, x2: 66 + i * 40, y2: ROAD_Y + 21, stroke: C.dash, 'stroke-opacity': 0.5, 'stroke-width': 2 })
    }
    const firstTick = Math.floor(cam / PX_PER_M / 10) * 10
    for (let m = firstTick; m <= firstTick + 130; m += 10) {
      if (m < 0) continue
      const X = sx(m)
      if (X < 40 || X > 604) continue
      ctx.set(`mk${m}`, 'line', { x1: X, y1: ROAD_Y + 26, x2: X, y2: ROAD_Y + 34, stroke: 'currentColor', 'stroke-opacity': 0.45 })
      ctx.set(`mkl${m}`, 'text', { x: X, y: ROAD_Y + 46, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.5, text: `${m}m` })
    }
    // 起点线（随镜头移动）
    const startSX = sx(0)
    if (startSX > 40 && startSX < 604) {
      ctx.set('startline', 'line', { x1: startSX, y1: ROAD_Y - 40, x2: startSX, y2: ROAD_Y + 16, stroke: 'currentColor', 'stroke-opacity': 0.3, 'stroke-dasharray': '4 4' })
      ctx.set('startl', 'text', { x: startSX, y: ROAD_Y - 46, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.4, text: '起点' })
    } else ctx.remove('startline', 'startl')

    // 两车分车道绘制（A 下车道 / B 上车道）：任意时刻两车都不重叠遮挡，间距用标尺读数
    // A 车不再可拖：初始间距只通过 B 车拖拽或 d0 滑块设置
    const ax = sx(st.xA)
    const bx = sx(st.xB)
    const LANE_A = ROAD_Y - 2 // A 车道（下）
    const LANE_B = ROAD_Y - 30 // B 车道（上）
    ctx.set('lane-dash', 'line', { x1: 40, y1: ROAD_Y - 16, x2: 600, y2: ROAD_Y - 16, stroke: C.dash, 'stroke-opacity': 0.35, 'stroke-width': 1.5, 'stroke-dasharray': '8 8' })
    ctx.set('carA', 'rect', { x: ax - CAR_W / 2, y: LANE_A, width: CAR_W, height: CAR_H, rx: 4, fill: C.accent, stroke: C.indigo800, 'stroke-width': 1.5 })
    ctx.set('carA-t', 'text', { x: ax, y: LANE_A + 11.5, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: 'A' })
    const carB = ctx.set('carB', 'rect', { x: bx - CAR_W / 2, y: LANE_B, width: CAR_W, height: CAR_H, rx: 4, fill: C.normal, stroke: C.blueDeep, 'stroke-width': 1.5 })
    ctx.set('carB-t', 'text', { x: bx, y: LANE_B + 11.5, 'font-size': 13, 'text-anchor': 'middle', fill: C.dash, text: 'B' })
    ctx.drag(carB, (p) => {
      if ((st.t ?? 0) > 0) return
      const d = clamp((p.x - START_X + cam) / PX_PER_M, 0, 60)
      ctx.setParam('d0', Math.round(d))
    })

    // 间距标注（车 A 前沿 → 车 B 前沿）
    const gap = st.xB - st.xA
    if (gap > 0 && bx - ax > 10) {
      const y0 = ROAD_Y - 44
      ctx.set('gapline', 'line', { x1: ax, y1: y0, x2: bx, y2: y0, stroke: C.net, 'stroke-width': 1.5 })
      ctx.set('gapt1', 'line', { x1: ax, y1: y0 - 5, x2: ax, y2: y0 + 5, stroke: C.net, 'stroke-width': 1.5 })
      ctx.set('gapt2', 'line', { x1: bx, y1: y0 - 5, x2: bx, y2: y0 + 5, stroke: C.net, 'stroke-width': 1.5 })
      ctx.set('gaplabel', 'text', { x: (ax + bx) / 2, y: y0 - 8, 'font-size': 13, 'text-anchor': 'middle', fill: C.net, text: `${fmt(gap, 1)} m` })
    } else {
      ctx.remove('gapline', 'gapt1', 'gapt2', 'gaplabel')
    }

    // 速度箭头
    if (opts.showForces) {
      drawArrow(ctx, 'va', v(ax, LANE_A + 7), add(v(ax, LANE_A + 7), v(st.vA * 4, 0)), { color: C.accent, label: `vA=${fmt(st.vA, 1)}` })
      drawArrow(ctx, 'vb', v(bx, LANE_B - 10), add(v(bx, LANE_B - 10), v(st.vB * 4, 0)), { color: C.normal, label: `vB=${fmt(st.vB, 1)}` })
    } else {
      ctx.remove('va', 'va-head', 'va-label', 'vb', 'vb-head', 'vb-label')
    }

    // 结论提示
    const tips: string[] = []
    if (st.passed) tips.push('A 已追上/超过 B')
    else if ((st.t ?? 0) >= T_MAX) tips.push('时间到仍未追上')
    if (st.minGap < params.d0 && !st.passed) tips.push(`最小间距 ${fmt(st.minGap, 1)} m（t=${fmt(st.minGapT, 1)}s 时速度相等处最近）`)
    ctx.set('tip', 'text', { x: 70, y: 40, 'font-size': 13, fill: C.warn, text: tips.join('；') })

    // v-t 双曲线
    if (ctx.gw) {
      const box = { x: 44, y: 24, w: ctx.gw - 70, h: ctx.gh - 66 }
      // 量程按当前参数的理论峰值自适应（匀加速到 T_MAX 的最大速度），避免半板空白或曲线被裁
      const vPeak = Math.max(
        params.vA + (params.aA > 0 ? params.aA * T_MAX : 0),
        params.vB + (params.aB > 0 ? params.aB * T_MAX : 0),
        1
      )
      const vMax = Math.ceil(vPeak * 1.15)
      axes(ctx, box, { xLabel: 't/s', yLabel: 'v/(m/s)', xMax: T_MAX, yMax: vMax })
      polyline(ctx, 'g-va', st.ptsA, box, 0, T_MAX, 0, vMax, C.accent)
      polyline(ctx, 'g-vb', st.ptsB, box, 0, T_MAX, 0, vMax, C.normal)
      ctx.gset('g-legend', 'text', { x: box.x + 8, y: box.y + 14, 'font-size': 13, fill: C.accent, text: '— A 车' })
      ctx.gset('g-legend2', 'text', { x: box.x + 60, y: box.y + 14, 'font-size': 13, fill: C.normal, text: '— B 车' })
      // 速度相等时刻（间距极值点）：两线交点竖直虚线
      if (!st.passed && st.minGapT > 0 && st.minGapT < T_MAX) {
        const X = gx(box, 0, T_MAX, st.minGapT)
        ctx.gset('g-min', 'line', { x1: X, y1: box.y, x2: X, y2: box.y + box.h, stroke: C.warn, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.7 })
        ctx.gset('g-minlabel', 'text', { x: X + 4, y: box.y + 26, 'font-size': 13, fill: C.warn, text: '速度相等' })
      }
    }
    data['时间 t'] = `${fmt(st.t, 2)} s`
    data['A 车速度'] = `${fmt(st.vA, 2)} m/s`
    data['B 车速度'] = `${fmt(st.vB, 2)} m/s`
    data['当前间距'] = `${fmt(Math.abs(gap), 2)} m`
    data['全程最小间距'] = `${fmt(st.minGap, 2)} m`
    data['状态'] = st.passed ? '已追上' : (st.t ?? 0) >= T_MAX ? '未追上' : '追赶中'
    return data
  },
}
