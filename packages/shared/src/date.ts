// 本地日期工具（前后端共用）：统一「今天」的口径为系统本地时区
// 此前普遍用 new Date().toISOString().slice(0, 10) 取 UTC 日期，东八区每天 0~8 点会取到前一天
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 今天的本地日期（YYYY-MM-DD） */
export function todayLocal(): string {
  return localDateStr()
}

/** 日期字符串加/减天数（按本地时区构造，避免 UTC 偏移导致跨天错位） */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return localDateStr(new Date(y, m - 1, d + days))
}

/** n 天前（或传负数取 n 天后）的本地日期 */
export function daysAgo(n: number): string {
  return addDays(todayLocal(), -n)
}
