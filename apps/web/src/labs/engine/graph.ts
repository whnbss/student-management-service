// 图像面板公共绘制辅助：坐标轴 / 网格 / 折线
import type { LabCtx } from './types'

export interface GraphBox {
  x: number
  y: number
  w: number
  h: number
}

/** 绘制坐标轴框（在图像面板上），返回绘图区 */
export function axes(
  ctx: LabCtx,
  box: GraphBox,
  opts: { xLabel: string; yLabel: string; xMax: number; yMax: number; xMin?: number; yMin?: number }
): GraphBox {
  const { x, y, w, h } = box
  const xMin = opts.xMin ?? 0
  const yMin = opts.yMin ?? 0
  // 外框
  ctx.gset('g-frame', 'rect', {
    x, y, w, h, fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.25, rx: 6,
  })
  // 横轴刻度
  for (let i = 1; i <= 4; i++) {
    const tx = x + (w * i) / 4
    ctx.gset(`g-xt${i}`, 'line', { x1: tx, y1: y + h, x2: tx, y2: y + h + 4, stroke: 'currentColor', 'stroke-opacity': 0.5 })
    ctx.gset(`g-xlt${i}`, 'text', {
      x: tx, y: y + h + 14, 'font-size': 11, 'text-anchor': 'middle', fill: 'currentColor',
      'fill-opacity': 0.6,
      text: ((xMin + ((opts.xMax - xMin) * i) / 4)).toFixed(1).replace(/\.0$/, ''),
    })
  }
  // 纵轴刻度
  for (let i = 1; i <= 3; i++) {
    const ty = y + h - (h * i) / 3
    ctx.gset(`g-yt${i}`, 'line', { x1: x - 4, y1: ty, x2: x, y2: ty, stroke: 'currentColor', 'stroke-opacity': 0.5 })
    ctx.gset(`g-ylt${i}`, 'text', {
      x: x - 6, y: ty + 3, 'font-size': 11, 'text-anchor': 'end', fill: 'currentColor',
      'fill-opacity': 0.6,
      text: ((yMin + ((opts.yMax - yMin) * i) / 3)).toFixed(1).replace(/\.0$/, ''),
    })
  }
  // 轴标签
  ctx.gset('g-xlabel', 'text', { x: x + w, y: y + h + 24, 'font-size': 12, 'text-anchor': 'end', fill: 'currentColor', 'fill-opacity': 0.7, text: opts.xLabel })
  ctx.gset('g-ylabel', 'text', { x: x + 2, y: y - 4, 'font-size': 12, fill: 'currentColor', 'fill-opacity': 0.7, text: opts.yLabel })
  return box
}

/** 坐标 → 像素 */
export function gx(box: GraphBox, xMin: number, xMax: number, val: number): number {
  return box.x + ((val - xMin) / (xMax - xMin)) * box.w
}
export function gy(box: GraphBox, yMin: number, yMax: number, val: number): number {
  return box.y + box.h - ((val - yMin) / (yMax - yMin)) * box.h
}

/** 绘制折线（点列 [x, y]，超范围自动截断到绘图区） */
export function polyline(
  ctx: LabCtx,
  id: string,
  pts: [number, number][],
  box: GraphBox,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  color: string
) {
  if (pts.length < 2) {
    ctx.gremove(id)
    return
  }
  const clipped = pts.slice(-400) // 上限防止节点无限增长
  const d = clipped
    .map(([px, py], i) => {
      const X = Math.min(box.x + box.w, Math.max(box.x, gx(box, xMin, xMax, px)))
      const Y = Math.min(box.y + box.h, Math.max(box.y, gy(box, yMin, yMax, py)))
      return `${i === 0 ? 'M' : 'L'}${X.toFixed(1)},${Y.toFixed(1)}`
    })
    .join(' ')
  ctx.gset(id, 'path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' })
}
