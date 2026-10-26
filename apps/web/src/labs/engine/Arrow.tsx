// 统一矢量箭头：命令式绘制（动画帧内直接改 SVG 属性）+ 小型 React 图标组件
import { C, len, sub, type V } from './vec'
import type { LabCtx } from './types'

export interface ArrowOpts {
  color?: string
  /** 线宽基准（px），粗细随矢量大小微缩放 */
  width?: number
  /** 标签文字（如 "G=19.6N"） */
  label?: string
  /** 虚线（合力） */
  dashed?: boolean
  /** 分量虚线样式 */
  component?: boolean
  fontSize?: number
}

/**
 * 在舞台 ctx 上绘制/更新一根箭头（按 id 保留节点）。
 * 箭头端部为实心三角，矢量过短时自动隐藏标签。
 */
export function drawArrow(
  ctx: LabCtx,
  id: string,
  from: V,
  to: V,
  opts: ArrowOpts = {}
) {
  const d = sub(to, from)
  const l = len(d)
  const color = opts.color ?? C.net
  const baseW = opts.width ?? 3
  const w = baseW * (l > 120 ? 1.15 : l > 40 ? 1 : 0.85)
  if (l < 2) {
    ctx.remove(id, `${id}-head`, `${id}-label`)
    return
  }
  // 矢量过短（投影看不清）：只画一个标记点 + 标签，不画箭杆
  if (l < 12) {
    ctx.set(id, 'circle', { cx: to.x, cy: to.y, r: 3, fill: color })
    ctx.remove(`${id}-head`)
    if (opts.label) {
      const ux = d.x / l
      const uy = d.y / l
      ctx.set(`${id}-label`, 'text', {
        x: to.x + ux * 14, y: to.y + uy * 14,
        'font-size': opts.fontSize ?? 13, fill: color, 'text-anchor': 'middle', 'dominant-baseline': 'middle', text: opts.label,
      })
    } else ctx.remove(`${id}-label`)
    return
  }
  const ux = d.x / l
  const uy = d.y / l
  // 箭头端部略缩进，避免遮住落点
  const headLen = Math.min(14, Math.max(8, l * 0.18))
  const tipX = to.x
  const tipY = to.y
  const bx = tipX - ux * headLen
  const by = tipY - uy * headLen
  const dash = opts.dashed ? '7 5' : opts.component ? '4 4' : undefined

  ctx.set(id, 'line', {
    x1: from.x, y1: from.y, x2: bx, y2: by,
    stroke: color, 'stroke-width': w, 'stroke-linecap': 'round',
    ...(dash ? { 'stroke-dasharray': dash } : {}),
  })
  // 端部三角
  const px = -uy
  const py = ux
  const hw = headLen * 0.42
  ctx.set(`${id}-head`, 'polygon', {
    points: `${tipX},${tipY} ${bx + px * hw},${by + py * hw} ${bx - px * hw},${by - py * hw}`,
    fill: color,
  })
  if (opts.label) {
    const off = 10 + w
    ctx.set(`${id}-label`, 'text', {
      x: tipX + ux * off + px * off * 0.6,
      y: tipY + uy * off + py * off * 0.6,
      'font-size': opts.fontSize ?? 13,
      fill: color,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      text: opts.label,
    })
  } else {
    ctx.remove(`${id}-label`)
  }
}

/** 列表/按钮里使用的小箭头图标（React 组件） */
export function ArrowIcon({ color = C.net }: { color?: string }) {
  return (
    <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden>
      <line x1="1" y1="6" x2="14" y2="6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="20,6 12,2 12,10" fill={color} />
    </svg>
  )
}
