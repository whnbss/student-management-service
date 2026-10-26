// 二维向量与物理工具：所有课件场景共用
export interface V {
  x: number
  y: number
}

export const v = (x: number, y: number): V => ({ x, y })
export const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: V, s: number): V => ({ x: a.x * s, y: a.y * s })
export const dot = (a: V, b: V): number => a.x * b.x + a.y * b.y
export const len = (a: V): number => Math.hypot(a.x, a.y)
export const dist = (a: V, b: V): number => Math.hypot(a.x - b.x, a.y - b.y)
export const norm = (a: V): V => {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l }
}
// 屏幕坐标系 y 向下，角度均以「数学方向」为准：0° 向右、90° 屏幕向下
export const rad = (d: number): number => (d * Math.PI) / 180
export const deg = (r: number): number => (r * 180) / Math.PI
export const fromDeg = (d: number, r = 1): V => ({ x: r * Math.cos(rad(d)), y: r * Math.sin(rad(d)) })
export const angleOf = (a: V): number => deg(Math.atan2(a.y, a.x))

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

// 重力加速度（演示默认值）
export const G = 9.8

// 数值格式化：等宽数字显示，默认保留 2 位小数
export function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

// 矢量配色规范（全课件统一）：
// 重力=红、支持力/法向=蓝、摩擦力=橙、拉力/张力=绿、电场力/安培力/洛伦兹力=紫、合力=黑粗虚线
export const C = {
  gravity: '#ef4444',
  normal: '#3b82f6',
  friction: '#f97316',
  tension: '#10b981',
  field: '#8b5cf6',
  net: '#0f172a',
  accent: '#6366f1',
  warn: '#dc2626',
}

// 求点 p 在线段 a→b 上的投影参数 t（0~1 之外会越界，调用方自行 clamp）
export function projT(p: V, a: V, b: V): number {
  const ab = sub(b, a)
  const l2 = dot(ab, ab) || 1
  return dot(sub(p, a), ab) / l2
}
