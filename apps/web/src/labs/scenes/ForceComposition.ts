// 课件 3：力的合成与分解（高一·必修一）
// 模式一：拖 F1/F2 端点，平行四边形作图 + 合力；模式二：锁定合力，F1 端点自由拖动、F2 = R − F1 平行四边形补全（分力可大于合力）
import type { LabScene, LabState, LabData } from '../engine/types'
import { C, add, angleOf, clamp, fmt, len, norm, sub, v, type V } from '../engine/vec'
import { drawArrow } from '../engine/Arrow'

const O: V = v(250, 290) // 作用点
const SCALE = 1 // 1px = 1N

interface S extends LabState {
  f1: V
  f2: V
  res: V // 模式二的合力
}

export const compositionScene: LabScene = {
  id: 'force-composition',
  title: '力的合成与分解',
  grade: '高一',
  chapter: '必修一 · 力的合成与分解',
  desc: '拖动箭头端点改变两力，看平行四边形与合力；锁定合力拖 F1 自由分解，分力可大于合力',
  tags: ['力的合成', '力的分解', '平行四边形定则', '矢量', '合力'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'mode', label: '模式', min: 0, max: 1, step: 1, unit: '', default: 0,
      options: [
        { value: 0, label: '已知两力 → 求合力' },
        { value: 1, label: '已知合力 → 求分力（锁合力）' },
      ],
    },
    { key: 'resMag', label: '合力大小 |R|', min: 40, max: 260, step: 5, unit: 'N', default: 150, modes: [1], reset: false },
    { key: 'resAng', label: '合力方向', min: -80, max: 80, step: 1, unit: '°', default: 25, modes: [1], reset: false },
  ],
  presets: [
    { name: '互相垂直', params: { mode: 0 }, state: { f1: v(120, 0), f2: v(0, -90) } },
    { name: '锐角合成', params: { mode: 0 }, state: { f1: v(100, -60), f2: v(100, -30) } },
    { name: '分力大于合力', params: { mode: 1, resMag: 120, resAng: 20 }, state: { f1: v(40, -160) } },
  ],
  formulas: [
    '|R| = \\sqrt{F_1^2 + F_2^2 + 2F_1F_2\\cos\\theta}',
    'F_x = |R|\\cos\\alpha \\quad F_y = |R|\\sin\\alpha',
  ],
  keyPoints: [
    '合力不一定大于分力：两分力夹角为钝角（>90°）时分力可以都比合力大',
    '平行四边形定则：合力是以 F1、F2 为邻边的对角线',
    '力的分解不唯一：按实际效果分解（如沿绳、沿斜面）才有物理意义',
  ],
  init(): S {
    return { t: 0, f1: v(120, -60), f2: v(-80, -80), res: v(120, -30) }
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    const mode = params.mode

    // 坐标网格（过作用点）
    for (let i = -2; i <= 3; i++) {
      ctx.set(`gridx${i}`, 'line', { x1: O.x + i * 100, y1: 40, x2: O.x + i * 100, y2: 400, stroke: 'currentColor', 'stroke-opacity': 0.08 })
      ctx.set(`gridy${i}`, 'line', { x1: 20, y1: O.y + i * 100, x2: 620, y2: O.y + i * 100, stroke: 'currentColor', 'stroke-opacity': 0.08 })
    }
    ctx.set('axis-x', 'line', { x1: 30, y1: O.y, x2: 620, y2: O.y, stroke: 'currentColor', 'stroke-opacity': 0.3 })
    ctx.set('axis-y', 'line', { x1: O.x, y1: 40, x2: O.x, y2: 400, stroke: 'currentColor', 'stroke-opacity': 0.3 })

    if (mode === 0) {
      // —— 已知两力求合力 ——
      const R = add(st.f1, st.f2)
      // 平行四边形（虚线边）
      ctx.set('para1', 'line', { x1: st.f1.x + O.x, y1: st.f1.y + O.y, x2: R.x + O.x, y2: R.y + O.y, stroke: C.accent, 'stroke-opacity': 0.5, 'stroke-dasharray': '5 4' })
      ctx.set('para2', 'line', { x1: st.f2.x + O.x, y1: st.f2.y + O.y, x2: R.x + O.x, y2: R.y + O.y, stroke: C.accent, 'stroke-opacity': 0.5, 'stroke-dasharray': '5 4' })
      // 合力：黑色粗虚线
      drawArrow(ctx, 'fR', O, add(O, R), { color: C.net, dashed: true, width: 4, label: `R=${fmt(len(R), 1)}N` })
      // 两个分力（可拖拽端点）
      const e1 = ctx.set('e1', 'circle', { cx: O.x + st.f1.x, cy: O.y + st.f1.y, r: 11, fill: '#fff', stroke: C.gravity, 'stroke-width': 3 })
      const e2 = ctx.set('e2', 'circle', { cx: O.x + st.f2.x, cy: O.y + st.f2.y, r: 11, fill: '#fff', stroke: C.tension, 'stroke-width': 3 })
      drawArrow(ctx, 'f1', O, add(O, st.f1), { color: C.gravity, label: `F1=${fmt(len(st.f1), 1)}N` })
      drawArrow(ctx, 'f2', O, add(O, st.f2), { color: C.tension, label: `F2=${fmt(len(st.f2), 1)}N` })
      ctx.drag(e1, (p) => {
        st.f1 = v(clamp(p.x - O.x, -240, 240), clamp(p.y - O.y, -240, 240))
        ctx.requestRender()
      })
      ctx.drag(e2, (p) => {
        st.f2 = v(clamp(p.x - O.x, -240, 240), clamp(p.y - O.y, -240, 240))
        ctx.requestRender()
      })
      const ang = angleOf(R)
      data['|F1|'] = `${fmt(len(st.f1) * SCALE, 1)} N`
      data['|F2|'] = `${fmt(len(st.f2) * SCALE, 1)} N`
      data['合力 |R|'] = `${fmt(len(R) * SCALE, 1)} N`
      data['合力方向'] = `${fmt(-ang, 1)}°（向上为正）`
      // 合力的正交分解
      if (opts.showComponents) {
        drawArrow(ctx, 'rx', O, add(O, v(R.x, 0)), { color: C.net, component: true, width: 2 })
        drawArrow(ctx, 'ry', O, add(O, v(0, R.y)), { color: C.net, component: true, width: 2 })
        data['Rₓ'] = `${fmt(R.x * SCALE, 1)} N`
        data['Rᵧ'] = `${fmt(-R.y * SCALE, 1)} N（竖直向上）`
      } else {
        ctx.remove('rx', 'rx-head', 'rx-label', 'ry', 'ry-head', 'ry-label')
      }
 ctx.remove('e2-auto', 'r-grip', 'e1-handle', 'hint')
    } else {
      // —— 已知合力求分力：F1 端点自由拖动（大小方向都变），F2 = R − F1 平行四边形补全 ——
      const R = v(params.resMag * Math.cos(-params.resAng * Math.PI / 180) * SCALE, -params.resMag * Math.sin(params.resAng * Math.PI / 180) * SCALE)
      st.res = R
      const F1 = st.f1
      const F2 = sub(R, F1)
      // 合力（锁定，黑色粗虚线，端点可拖拽调大小方向）
      drawArrow(ctx, 'fR', O, add(O, R), { color: C.net, dashed: true, width: 4, label: `R=${fmt(params.resMag, 0)}N` })
      const rGrip = ctx.set('r-grip', 'circle', { cx: O.x + R.x, cy: O.y + R.y, r: 10, fill: '#fff', stroke: C.net, 'stroke-width': 3 })
      ctx.drag(rGrip, (p) => {
        const d = sub(p, O)
        ctx.setParam('resMag', clamp(Math.round(len(d)), 40, 260))
        ctx.setParam('resAng', clamp(Math.round(-angleOf(d)), -80, 80))
        ctx.requestRender()
      })
      // F1（自由拖动端点）与 F2（自动补齐，端点小标记）
      // 手柄外移 26px 再叠一层同方向偏移，避免压住「F1=…」标签
      const e1 = ctx.set('e1', 'circle', { cx: O.x + F1.x, cy: O.y + F1.y, r: 11, fill: '#fff', stroke: C.gravity, 'stroke-width': 3 })
      drawArrow(ctx, 'f1', O, add(O, F1), { color: C.gravity, label: `F1=${fmt(len(F1), 1)}N` })
      drawArrow(ctx, 'f2', O, add(O, F2), { color: C.tension, label: `F2=${fmt(len(F2), 1)}N` })
      ctx.set('e2-auto', 'circle', { cx: O.x + F2.x, cy: O.y + F2.y, r: 7, fill: C.tension, 'fill-opacity': 0.5 })
      // F1 标签外移：把手柄画到箭头端点延长线外
      const dir1 = norm(len(F1) > 1 ? F1 : v(1, -0.4))
      const e1Handle = ctx.set('e1-handle', 'circle', { cx: O.x + F1.x + dir1.x * 26, cy: O.y + F1.y + dir1.y * 26, r: 9, fill: 'transparent', stroke: C.gravity, 'stroke-width': 2, 'stroke-dasharray': '2 3' })
      ctx.drag(e1, (p) => {
        st.f1 = v(clamp(p.x - O.x, -240, 240), clamp(p.y - O.y, -240, 240))
        ctx.requestRender()
      })
      ctx.drag(e1Handle, (p) => {
        st.f1 = v(clamp(p.x - O.x, -240, 240), clamp(p.y - O.y, -240, 240))
        ctx.requestRender()
      })
      // 提示：分力可以大于合力（F1 自由拖动后夹角为钝角时成立）
      const big = Math.max(len(F1), len(F2)) > len(R) * 1.001
      ctx.set('hint', 'text', {
        x: 30, y: 32, 'font-size': 14, fill: big ? C.warn : '#059669',
        text: big ? '看到了吗？分力比合力还大！（两分力夹角越钝分力越大）' : '拖动红色端点改变 F1（大小方向均可），观察分力变化',
      })
      data['|R|（锁定）'] = `${fmt(len(R), 1)} N`
      data['|F1|'] = `${fmt(len(F1), 1)} N`
      data['|F2|'] = `${fmt(len(F2), 1)} N`
      data['F1 与 F2 夹角'] = `${fmt(Math.abs(angleOf(F1) - angleOf(F2)), 1)}°`
      data['结论'] = big ? '分力 > 合力' : '拖 F1 端点试试'
      ctx.remove('para1', 'para2')
      if (opts.showComponents) {
        drawArrow(ctx, 'rx', O, add(O, v(R.x, 0)), { color: C.net, component: true, width: 2 })
        drawArrow(ctx, 'ry', O, add(O, v(0, R.y)), { color: C.net, component: true, width: 2 })
      } else {
        ctx.remove('rx', 'rx-head', 'rx-label', 'ry', 'ry-head', 'ry-label')
      }
    }
    if (opts.showPoints) {
      ctx.set('dot-o', 'circle', { cx: O.x, cy: O.y, r: 5, fill: '#111827' })
    } else {
      ctx.remove('dot-o')
    }
    return data
  },
}
