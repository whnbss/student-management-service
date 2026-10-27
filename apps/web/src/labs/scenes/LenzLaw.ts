// 课件 31：磁铁插拔与楞次定律（选择性必修二 · 电磁感应）
// 拖动条形磁铁插入/拔出线圈（快慢可变），实时 Φ、ΔΦ/Δt、感应电流方向、指针摆动与「来拒去留」
import type { LabScene, LabState, LabData, SceneParams } from '../engine/types'
import { C, clamp, fmt } from '../engine/vec'

// 舞台布局
const COIL_X = 420 // 线圈中心
const MAG_Y = 210
// 磁通函数：磁铁中心距线圈 x（px）→ Φ（任意单位，钟形）
function fluxAt(dx: number): number {
  return Math.exp(-((dx / 110) ** 2))
}

interface S extends LabState {
  magX: number // 磁铁中心横坐标（px）
  xPrev: number // 上一帧位置（算速度）
  vel: number // 拖动速度（px/s，平滑）
  needle: number // 指针角度（平滑）
  auto: boolean // 自动演示中
  lastFlux: number
  lastFluxTime: number // 上次磁通采样时刻（render 中估算变化率，拖动暂停时也实时）
  phiRate: number // Φ 变化率
  currDir: number // 感应电流方向（+1 顺时针 / −1 逆时针 / 0 无）
}

export const lenzScene: LabScene = {
  id: 'lenz-law',
  title: '磁铁插拔与楞次定律',
  grade: '高二',
  chapter: '选择性必修二 · 电磁感应',
  desc: '拖磁铁插入/拔出线圈：Φ、ΔΦ/Δt、感应电流方向、指针摆动与「来拒去留」实时演示',
  tags: ['楞次定律', '电磁感应', '磁通量', '感应电流', '来拒去留'],
  view: { w: 640, h: 420 },
  params: [
    {
      key: 'drive', label: '驱动方式', min: 0, max: 1, step: 1, unit: '', default: 1,
      options: [{ value: 0, label: '手动拖磁铁' }, { value: 1, label: '自动插拔演示' }],
    },
    { key: 'speed', label: '自动演示速度', min: 0.5, max: 3, step: 0.5, unit: '×', default: 1.5, modes: [1], reset: false },
    { key: 'N', label: '线圈匝数 N', min: 1, max: 20, step: 1, unit: '匝', default: 8, reset: false },
  ],
  presets: [
    { name: '慢插（小电流）', params: { drive: 1, speed: 0.5, N: 8 } },
    { name: '快插（大电流）', params: { drive: 1, speed: 3, N: 8 } },
    { name: '手动拖动', params: { drive: 0, speed: 1.5, N: 8 } },
    { name: '匝数加倍（电流更大）', params: { drive: 1, speed: 1.5, N: 16 } },
  ],
  formulas: [
    '\\Phi = B \\cdot S',
    '\\varepsilon = -N\\frac{\\Delta\\Phi}{\\Delta t}',
    '\\text{楞次定律：感应电流的效果总是阻碍磁通量变化（来拒去留）}',
  ],
  keyPoints: [
    '感应电流的方向：阻碍磁通量的变化（增反减同）',
    '「来拒去留」：插入时排斥、拔出时吸引——楞次定律的力学表现',
    '插入快慢只影响感应电流大小（ΔΦ/Δt），不改变方向',
  ],
  init(): S {
    return { magX: 120, xPrev: 120, vel: 0, needle: 0, auto: true, lastFlux: 0, lastFluxTime: 0, phiRate: 0, currDir: 0 }
  },
  step(dt, params, state) {
    const st = state as S
    st.auto = params.drive === 1
    if (st.auto) {
      // 自动插拔：正弦往复（从远处插入再拔出）
      st.t = (st.t ?? 0) + dt * params.speed
      st.magX = COIL_X - 150 - Math.cos(st.t * 1.2) * 140
      if (st.magX > COIL_X + 40) st.magX = COIL_X + 40
    }
    // 速度（平滑）
    const instV = (st.magX - st.xPrev) / dt
    st.vel = st.vel * 0.8 + instV * 0.2
    st.xPrev = st.magX
  },
  render(ctx, params, state, opts): LabData {
    const st = state as S
    const data: LabData = {}
    void opts

    // 磁通量变化率（按真实时间估算，拖动暂停时也实时刷新）
    const fluxNow = fluxAt(Math.abs(COIL_X - st.magX))
    const nowMs = performance.now()
    if (st.lastFluxTime > 0 && nowMs > st.lastFluxTime) {
      const rate = (fluxNow - st.lastFlux) / ((nowMs - st.lastFluxTime) / 1000)
      st.phiRate = st.phiRate * 0.7 + rate * 0.3
    }
    st.lastFlux = fluxNow
    st.lastFluxTime = nowMs
    // 感应电流方向：Φ 增大 → 感应磁场反向（增反），N 极在左 → 记为逆时针；Φ 减小（减同）→ 顺时针
    st.currDir = Math.abs(st.phiRate) < 0.002 ? 0 : st.phiRate > 0 ? -1 : 1

    // 指针（平滑摆动，正比 |ΔΦ/Δt|·N）
    const target = clamp(st.phiRate * 260 * params.N * 0.5, -40, 40)
    st.needle = st.needle * 0.85 + target * 0.15

    // 导线：线圈 → 灵敏电流计
    const gY = 360
    ctx.set('wire1', 'path', { d: `M${COIL_X - 26},240 C${COIL_X - 40},320 360,${gY} 330,${gY}`, fill: 'none', stroke: '#334155', 'stroke-width': 2 })
    ctx.set('wire2', 'path', { d: `M${COIL_X + 26},240 C${COIL_X + 40},320 470,${gY} 440,${gY}`, fill: 'none', stroke: '#334155', 'stroke-width': 2 })

    // 灵敏电流计
    ctx.set('meter', 'rect', { x: 300, y: gY - 34, width: 170, height: 52, rx: 10, fill: '#f8fafc', stroke: '#64748b', 'stroke-width': 2 })
    ctx.set('meter-l', 'text', { x: 385, y: gY - 20, 'font-size': 13, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.5, text: '灵敏电流计（G）' })
    // 表盘刻度
    ctx.set('meter-axis', 'line', { x1: 330, y1: gY, x2: 440, y2: gY, stroke: 'currentColor', 'stroke-opacity': 0.3 })
    for (let i = -3; i <= 3; i++) {
      ctx.set(`mk${i}`, 'line', { x1: 385 + i * 18, y1: gY - 4, x2: 385 + i * 18, y2: gY + (i === 0 ? 6 : 4), stroke: 'currentColor', 'stroke-opacity': 0.4 })
    }
    // 指针（围绕枢轴 385,gY 摆动）
    const ang = (st.needle * Math.PI) / 180
    ctx.set('needle', 'line', { x1: 385, y1: gY, x2: 385 + Math.sin(ang) * 26, y2: gY - Math.cos(ang) * 26, stroke: '#dc2626', 'stroke-width': 2.5, 'stroke-linecap': 'round' })

    // 线圈（多匝椭圆，右侧竖直）
    for (let i = 0; i < 4; i++) {
      ctx.set(`coil${i}`, 'ellipse', { cx: COIL_X, cy: 210, rx: 26 + i * 2, ry: 92 - i * 3, fill: 'none', stroke: '#b45309', 'stroke-width': 2.2, 'stroke-opacity': 0.85 })
    }
    ctx.set('coil-l', 'text', { x: COIL_X, y: 320, 'font-size': 13, 'text-anchor': 'middle', fill: '#b45309', text: `N=${params.N} 匝` })

    // 线圈上的感应电流方向箭头（顺/逆时针：屏幕上取上缘箭头方向表示）
    if (st.currDir !== 0) {
      const topY = 210 - 92 + 8
      const dirRight = st.currDir > 0 // 顺时针：上缘向右
      const x1 = COIL_X - 20
      const x2 = COIL_X + 20
      ctx.set('curr-arrow', 'line', { x1, y1: topY, x2: x2, y2: topY, stroke: '#059669', 'stroke-width': 3 })
      ctx.set('curr-head', 'polygon', {
        points: dirRight ? `${x2 + 8},${topY} ${x2 - 8},${topY - 5} ${x2 - 8},${topY + 5}` : `${x1 - 8},${topY} ${x1 + 8},${topY - 5} ${x1 + 8},${topY + 5}`,
        fill: '#059669',
      })
      ctx.set('curr-l', 'text', { x: COIL_X, y: topY - 10, 'font-size': 13, 'text-anchor': 'middle', fill: '#059669', text: st.currDir > 0 ? '感应电流（顺时针）' : '感应电流（逆时针）' })
    } else {
      ctx.remove('curr-arrow', 'curr-head', 'curr-l')
    }

    // 条形磁铁（N 红右端 / S 蓝左端，可拖）
    const mw = 130
    const mx = st.magX
    ctx.set('mag-n', 'rect', { x: mx - mw / 2 + mw / 2, y: MAG_Y - 16, width: mw / 2, height: 32, fill: '#ef4444', rx: 4 })
    ctx.set('mag-s', 'rect', { x: mx - mw / 2, y: MAG_Y - 16, width: mw / 2, height: 32, fill: '#3b82f6', rx: 4 })
    ctx.set('mag-n-t', 'text', { x: mx + mw / 4, y: MAG_Y + 5, 'font-size': 13, 'text-anchor': 'middle', fill: '#fff', text: 'N' })
    ctx.set('mag-s-t', 'text', { x: mx - mw / 4, y: MAG_Y + 5, 'font-size': 13, 'text-anchor': 'middle', fill: '#fff', text: 'S' })
    const magHit = ctx.set('mag-hit', 'rect', { x: mx - mw / 2, y: MAG_Y - 30, width: mw, height: 60, fill: 'transparent' })
    ctx.drag(magHit, (p) => {
      st.auto = false
      st.magX = clamp(p.x, 60, COIL_X + 60)
      ctx.setParam('drive', 0)
      ctx.requestRender()
    })

    // 磁感线（磁铁周围，从 N 出到 S）
    for (let i = 0; i < 3; i++) {
      const ry = 40 + i * 34
      const bow = 30 + i * 16
      ctx.set(`mfl${i}`, 'path', {
        d: `M${mx + mw / 2 - 6},${MAG_Y - 10 - i * 10} C${mx + 90 + bow},${MAG_Y - 60 - i * 14} ${COIL_X + 60},${MAG_Y - 70 - i * 10} ${COIL_X + 34},${MAG_Y - 12 - i * 8}`,
        fill: 'none', stroke: C.field, 'stroke-opacity': 0.3, 'stroke-width': 1.2, 'stroke-dasharray': '5 4',
      })
    }

    // 「来拒去留」提示
    const inside = Math.abs(COIL_X - mx) < 100
    let lenzText = ''
    if (inside && Math.abs(st.vel) > 8) lenzText = st.vel > 0 ? '插入中：线圈排斥磁铁（来拒）' : '拔出中：线圈吸引磁铁（去留）'
    ctx.set('tip', 'text', {
      x: 44, y: 40, 'font-size': 13, fill: lenzText ? C.warn : 'currentColor', 'fill-opacity': lenzText ? 1 : 0.55,
      text: lenzText || (st.auto ? '自动插拔演示中（可拖磁铁接管）' : '拖动磁铁：插入/拔出线圈，观察指针与电流方向'),
    })
    ctx.set('tip2', 'text', {
      x: 44, y: 60, 'font-size': 13, fill: 'currentColor', 'fill-opacity': 0.45,
      text: '插得越快 |ΔΦ/Δt| 越大 → 指针偏转越大；方向由「增反减同」判断',
    })

    data['磁通量 Φ（相对值）'] = fmt(fluxAt(Math.abs(COIL_X - mx)) * 100, 1) + ' %'
    data['Φ 变化率 ΔΦ/Δt'] = `${fmt(Math.abs(st.phiRate) * 1000, 2)} mWb/s`
    data['感应电动势 ε=−N·ΔΦ/Δt'] = st.currDir === 0 ? '0' : `${fmt(Math.abs(st.phiRate) * params.N * 100, 2)}（方向：${st.currDir > 0 ? '顺时针' : '逆时针'}）`
    data['感应电流方向'] = st.currDir === 0 ? '无（磁通量不变）' : st.currDir > 0 ? '顺时针' : '逆时针'
    data['指针偏转'] = Math.abs(st.needle) < 1.5 ? '居中' : st.needle > 0 ? '右偏' : '左偏'
    data['楞次定律表现'] = lenzText || '静止（无相互作用）'
    return data
  },
}
