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

// 矢量配色规范（全课件统一，语义色，随深色模式自动切换）：
// 力：重力=红、支持力/法向=蓝、摩擦力=橙、拉力/张力=绿、电场力/安培力/洛伦兹力=紫、合力=黑粗虚线
// 结构：ink=主线条/文字、muted=次要文字、faint=辅助线/斜纹、surface=仪表/把手白底、fill=物体默认填充
// 浅色值与历史硬编码完全一致（浅色模式视觉零变化）；深色值统一提亮保证对比度
export interface LabPalette {
  // 力矢量
  gravity: string
  normal: string
  friction: string
  tension: string
  field: string
  net: string
  accent: string
  warn: string
  // 线条与文字
  ink: string
  ink2: string
  inkStrong: string
  muted: string
  faint: string
  line: string
  line2: string
  paper: string
  surface: string
  // 物体填充与高亮
  fill: string
  fillAmber: string
  fillYellow: string
  yellow: string
  accentDeep: string
  indigoLight: string
  indigo800: string
  indigoDeep: string
  navy: string
  blueDeep: string
  blue: string
  sky: string
  skyDeep: string
  skyLight: string
  skyLighter: string
  greenDeep: string
  greenInk: string
  redDeep: string
  redInk: string
  amber: string
  amberDeep: string
  amberLight: string
  yellowDeep: string
  yellow600: string
  lime: string
  limeFill: string
  violetDeep: string
  // 恒定色（不随主题变化）：dash=路面标线/深底上的白字，lead=必须保持深色的物体（仪表屏底/暗屏）
  dash: string
  lead: string
  lead2: string
}

const LIGHT: LabPalette = {
  gravity: '#ef4444',
  normal: '#3b82f6',
  friction: '#f97316',
  tension: '#10b981',
  field: '#8b5cf6',
  net: '#0f172a',
  accent: '#6366f1',
  warn: '#dc2626',
  ink: '#334155',
  ink2: '#475569',
  inkStrong: '#111827',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#cbd5e1',
  line2: '#e2e8f0',
  paper: '#f8fafc',
  surface: '#ffffff',
  fill: '#c7d2fe',
  fillAmber: '#fde68a',
  fillYellow: '#fef9c3',
  yellow: '#fde047',
  accentDeep: '#4f46e5',
  indigoLight: '#818cf8',
  indigo800: '#3730a3',
  indigoDeep: '#312e81',
  navy: '#1e293b',
  blueDeep: '#1d4ed8',
  blue: '#2563eb',
  sky: '#0ea5e9',
  skyDeep: '#0284c7',
  skyLight: '#38bdf8',
  skyLighter: '#7dd3fc',
  greenDeep: '#059669',
  greenInk: '#065f46',
  redDeep: '#b91c1c',
  redInk: '#991b1b',
  amber: '#f59e0b',
  amberDeep: '#b45309',
  amberLight: '#fbbf24',
  yellowDeep: '#a16207',
  yellow600: '#ca8a04',
  lime: '#a3e635',
  limeFill: '#ecfccb',
  violetDeep: '#7c3aed',
  dash: '#ffffff',
  lead: '#0f172a',
  lead2: '#1e293b',
}

const DARK: LabPalette = {
  gravity: '#f87171',
  normal: '#60a5fa',
  friction: '#fb923c',
  tension: '#34d399',
  field: '#a78bfa',
  net: '#e2e8f0',
  accent: '#818cf8',
  warn: '#f87171',
  ink: '#cbd5e1',
  ink2: '#94a3b8',
  inkStrong: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#64748b',
  line: '#475569',
  line2: '#334155',
  paper: '#0f172a',
  surface: '#1e293b',
  fill: '#4338ca',
  fillAmber: '#b45309',
  fillYellow: '#854d0e',
  yellow: '#facc15',
  accentDeep: '#818cf8',
  indigoLight: '#a5b4fc',
  indigo800: '#a5b4fc',
  indigoDeep: '#a5b4fc',
  navy: '#e2e8f0',
  blueDeep: '#93c5fd',
  blue: '#60a5fa',
  sky: '#38bdf8',
  skyDeep: '#38bdf8',
  skyLight: '#7dd3fc',
  skyLighter: '#7dd3fc',
  greenDeep: '#34d399',
  greenInk: '#6ee7b7',
  redDeep: '#f87171',
  redInk: '#f87171',
  amber: '#fbbf24',
  amberDeep: '#fbbf24',
  amberLight: '#fcd34d',
  yellowDeep: '#fbbf24',
  yellow600: '#facc15',
  lime: '#a3e635',
  limeFill: '#3f6212',
  violetDeep: '#a78bfa',
  dash: '#ffffff',
  lead: '#0f172a',
  lead2: '#1e293b',
}

// 当前主题调色板（html.dark 切换时由 syncLabPalette 更新；LabFrame 监听变化后重绘）
let current: LabPalette = LIGHT

export function isDarkLabTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

/** 同步语义色到当前主题（主题切换处调用；返回是否发生变化） */
export function syncLabPalette(): boolean {
  const next = isDarkLabTheme() ? DARK : LIGHT
  if (next === current) return false
  current = next
  return true
}

// C 为代理：任何属性读取都取「当前主题」的色值，场景代码零改动即适配深色
export const C: LabPalette = new Proxy({} as LabPalette, {
  get: (_, key: string) => (current as unknown as Record<string, string>)[key] ?? '',
})

// 求点 p 在线段 a→b 上的投影参数 t（0~1 之外会越界，调用方自行 clamp）
export function projT(p: V, a: V, b: V): number {
  const ab = sub(b, a)
  const l2 = dot(ab, ab) || 1
  return dot(sub(p, a), ab) / l2
}
