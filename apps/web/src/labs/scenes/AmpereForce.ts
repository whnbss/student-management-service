// 课件 27：安培力与左手定则（必修三 · 磁场）
// B 方向（⊥/⊙）、I 方向可切换，F=BIL 实时；导线在导轨上真实启动运动
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const RAIL_Y = 260
const WIRE_X0 = 200
const WIRE_X1 = 440
const PX_PER_M = 60

interface S extends LabState {
  x: number // 导线位移（m，向右为正）
  vel: number
}

/** 安培力方向：屏幕坐标 y 向下。B 沿 z（into=−z 页面内 / out=+z），I 沿 x（±）。
 * F = I L × B → F_y = −(I_x)(B_z)·(L 方向)……直接用右手系算：F = I·(L̂×B)，
 * L̂=±x̂，B=∓ẑ → F 沿 ±ŷ。结果：I 向右(+x)、B 进纸(−z) → F=+x×(−z)=+y… 手算：
 * x̂×(−ẑ)=+ŷ？ x̂×ẑ=−ŷ，故 x̂×(−ẑ)=+ŷ（屏幕向下）。以 left-hand-rule 中文口诀校对：
 * 左手：磁感线穿掌心（B 进纸→掌心朝屏幕外），四指指 I（向右），拇指向上 → 屏幕向上（−y）。
 */
function ampereDirY(iDir: number, bDir: number): number {
  // 返回 F 的屏幕 y 分量符号：+1 向下 / −1 向上 / 0
  // 约定 iDir: +1 向右 / −1 向左；bDir: +1 进纸(⊗) / −1 出纸(⊙)
  // 物理结论：I 向右 + B 进纸 → F 向上（屏幕 −y）
  return -iDir * bDir
}

export const ampereScene: LabScene = {
  id: 'ampere-force',
  title: '安培力与左手定则',
  grade: '高二',
  chapter: '必修三 · 磁场',
  desc: '切换 B（⊗/⊙）与 I 方向，左手定则判断 F；导线在导轨上真实启动运动',
  tags: ['安培力', '左手定则', '磁场', '通电导线'],
  view: { w: 640, h: 420 },
  params: [
    { key: 'B', label: '磁感应强度 B', min: 0, max: 1, step: 0.05, unit: 'T', default: 0.5, reset: false },
    { key: 'I', label: '电流 I', min: 0, max: 5, step: 0.1, unit: 'A', default: 2, reset: false },
    {
      key: 'bDir', label: 'B 方向', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '垂直纸面向里 ⊗' }, { value: 1, label: '垂直纸面向外 ⊙' }],
    },
    {
      key: 'iDir', label: '电流方向', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [{ value: 0, label: '向右 →' }, { value: 1, label: '向左 ←' }],
    },
    { key: 'm', label: '导线质量 m', min: 0.05, max: 0.5, step: 0.05, unit: 'kg', default: 0.2, reset: false },
  ],
  presets: [
    { name: 'B⊗ · I→（F 向上）', params: { B: 0.5, I: 2, bDir: 0, iDir: 0, m: 0.2 } },
    { name: 'B⊗ · I←（F 向下）', params: { B: 0.5, I: 2, bDir: 0, iDir: 1, m: 0.2 } },
    { name: 'B⊙ · I→（F 向下）', params: { B: 0.5, I: 2, bDir: 1, iDir: 0, m: 0.2 } },
    { name: '轻导线（猛冲）', params: { B: 1, I: 5, bDir: 0, iDir: 0, m: 0.05 } },
  ],
  formulas: [
    'F = BIL',
    '\\text{左手定则：磁感线穿掌心，四指指 } I \\text{，拇指即 } F',
    'a = F/m',
  ],
  keyPoints: [
    'F⊥B 且 F⊥I：安培力垂直于 B 与 I 决定的平面',
    'B 与 I 平行（θ=0 或 180°）时安培力为零',
    '左手定则：磁感线穿掌心、四指指电流方向，大拇指即安培力方向',
  ],
  init(): S {
    return { x: 0, vel: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    const F = params.B * params.I * 0.4 // L=0.4m
    const a = F / params.m
    st.vel += a * dt
    st.x += st.vel * dt
    const lim = (WIRE_X1 - WIRE_X0 + 80) / PX_PER_M
    if (st.x > lim) {
      st.x = lim
      st.vel = 0 // 撞到右端缓冲
    }
    if (st.x < -(WIRE_X0 - 80) / PX_PER_M) {
      st.x = -(WIRE_X0 - 80) / PX_PER_M
      st.vel = 0
    }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const L = 0.4 // 导线有效长度 m
    const F = params.B * params.I * L
    const dirY = ampereDirY(params.iDir === 0 ? 1 : -1, params.bDir === 0 ? 1 : -1)
    const a = F / params.m
    const moving = F > 0.001

    // 磁场区域背景（B 符号阵列）
    ctx.set('b-zone', 'rect', { x: 80, y: 130, width: 480, height: 190, fill: C.field, 'fill-opacity': params.B > 0 ? 0.06 : 0.02 })
    if (params.B > 0.001) {
      const sym = params.bDir === 0 ? '×' : '•'
      let idx = 0
      for (let gy2 = 150; gy2 <= 300; gy2 += 34) {
        for (let gx2 = 104; gx2 <= 544; gx2 += 44) {
          ctx.set(`b${idx}`, 'text', { x: gx2, y: gy2, 'font-size': 13, 'text-anchor': 'middle', fill: C.field, 'fill-opacity': clamp(params.B * 0.9, 0.15, 0.9), text: sym })
          idx++
        }
      }
      for (let i = idx; i < 60; i++) ctx.remove(`b${i}`)
    } else {
      for (let i = 0; i < 60; i++) ctx.remove(`b${i}`)
    }
    ctx.set('b-label', 'text', { x: 90, y: 122, 'font-size': 13, fill: C.field, text: `B=${fmt(params.B, 2)}T ${params.bDir === 0 ? '⊗（向里）' : '⊙（向外）'}` })

    // 导轨
    ctx.set('rail-t', 'line', { x1: 100, y1: RAIL_Y - 26, x2: 560, y2: RAIL_Y - 26, stroke: '#94a3b8', 'stroke-width': 5 })
    ctx.set('rail-b', 'line', { x1: 100, y1: RAIL_Y + 26, x2: 560, y2: RAIL_Y + 26, stroke: '#94a3b8', 'stroke-width': 5 })
    ctx.set('rail-l', 'text', { x: 100, y: RAIL_Y + 46, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.5, text: '导轨（间距 0.4m）' })

    // 导线（随运动平移，红色竖杆）
    const wx = (WIRE_X0 + WIRE_X1) / 2 + st.x * PX_PER_M
    const wire = ctx.set('wire', 'line', { x1: wx, y1: RAIL_Y - 26, x2: wx, y2: RAIL_Y + 26, stroke: '#dc2626', 'stroke-width': 6, 'stroke-linecap': 'round' })
    ctx.set('wire-l', 'text', { x: wx, y: RAIL_Y - 36, 'font-size': 13, 'text-anchor': 'middle', fill: '#dc2626', text: params.iDir === 0 ? 'I→' : '←I' })
    ctx.drag(wire, () => {
      // 拖导线 = 归零位置（演示准备）
      st.x = 0
      st.vel = 0
      ctx.requestRender()
    })

    // 电流流入/流出导轨的引线与电源省略（示意即可）

    // 安培力箭头
    if (opts.showForces && moving) {
      const k = 90 / Math.max(F, 1e-6)
      const p = { x: wx, y: RAIL_Y }
      drawArrow(ctx, 'fF', p, { x: p.x, y: p.y + dirY * F * k }, { color: C.field, label: `F=BIL=${fmt(F, 2)}N` })
      if (opts.showPoints) ctx.set('dot-w', 'circle', { cx: wx, cy: RAIL_Y, r: 3, fill: '#111827' })
      else ctx.remove('dot-w')
    } else {
      ctx.remove('fF', 'fF-head', 'fF-label', 'dot-w')
    }

    // 左手定则判断提示
    const fText = moving ? (dirY < 0 ? '向上' : '向下') : '无（B=0 或 I=0）'
    ctx.set('tip', 'text', {
      x: 44, y: 52, 'font-size': 13, fill: moving ? C.accent : 'currentColor', 'fill-opacity': moving ? 1 : 0.5,
      text: `左手定则判断：F ${fText}（B${params.bDir === 0 ? '⊗' : '⊙'}，I ${params.iDir === 0 ? '向右' : '向左'}）`,
    })
    ctx.set('tip2', 'text', {
      x: 44, y: 72, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.45,
      text: '点「播放」看导线启动；拖导线可归位重来',
    })

    data['安培力 F=BIL'] = `${fmt(F, 3)} N`
    data['F 方向'] = fText
    data['加速度 a=F/m'] = `${fmt(a, 2)} m/s²`
    data['速度 v'] = `${fmt(st.vel, 2)} m/s`
    data['位移 x'] = `${fmt(st.x, 2)} m`
    data['导线质量 m'] = `${fmt(params.m, 2)} kg`
    return data
  },
}
