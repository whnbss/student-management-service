// 轻量图表：纯 div/SVG 实现（不引第三方图表库），用于学情看板
import { useMemo } from 'react'
import type { Mistake } from '@workbench/shared'

export interface KpAgg {
  kp: string
  unmastered: number // 未掌握
  redone: number // 已重做一次
  mastered: number // 已掌握
}

/** 知识点聚合：按错题数降序（一题多知识点会在每个知识点下各计一次） */
export function aggregateKp(mistakes: Mistake[]): KpAgg[] {
  const map = new Map<string, KpAgg>()
  for (const m of mistakes) {
    let kps: string[] = []
    try { kps = JSON.parse(m.knowledge_points || '[]') } catch { /* 忽略 */ }
    for (const kp of kps.length ? kps : ['未分类']) {
      const a = map.get(kp) || { kp, unmastered: 0, redone: 0, mastered: 0 }
      if (m.mastery_status === '未掌握') a.unmastered++
      else if (m.mastery_status === '已重做一次') a.redone++
      else a.mastered++
      map.set(kp, a)
    }
  }
  return [...map.values()].sort(
    (x, y) => y.unmastered + y.redone + y.mastered - (x.unmastered + x.redone + x.mastered)
  )
}

export const KP_LEGEND = (
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-red-500 inline-block" />未掌握</span>
    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-400 inline-block" />重做中</span>
    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-green-500 inline-block" />已掌握</span>
  </div>
)

/** 知识点维度堆叠条形图：未掌握(红)/重做中(黄)/已掌握(绿)，点击知识点可触发筛选 */
export function KpMasteryBars({ aggs, maxRows = 8, onClickKp, activeKp }: {
  aggs: KpAgg[]
  maxRows?: number
  onClickKp?: (kp: string) => void
  activeKp?: string
}) {
  if (!aggs.length) return <p className="text-xs text-slate-400 text-center py-4">暂无错题数据</p>
  const rows = aggs.slice(0, maxRows)
  const max = Math.max(...rows.map((a) => a.unmastered + a.redone + a.mastered))
  return (
    <div className="space-y-2.5">
      {rows.map((a) => {
        const total = a.unmastered + a.redone + a.mastered
        const name = (
          <span className={`truncate ${activeKp === a.kp ? 'text-primary-600 dark:text-primary-300 font-semibold' : ''}`}>{a.kp}</span>
        )
        return (
          <div key={a.kp}>
            <div className="flex items-center justify-between text-xs mb-1 gap-2">
              {onClickKp ? (
                <button className="truncate text-left hover:text-primary-600 dark:hover:text-primary-300" onClick={() => onClickKp(a.kp)} title={`筛选「${a.kp}」的错题`}>
                  {name}
                </button>
              ) : (
                name
              )}
              <span className="num text-slate-400 shrink-0">{total} 题</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              <div className="bg-red-500" style={{ width: `${(a.unmastered / max) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(a.redone / max) * 100}%` }} />
              <div className="bg-green-500" style={{ width: `${(a.mastered / max) * 100}%` }} />
            </div>
          </div>
        )
      })}
      {aggs.length > maxRows && (
        <p className="text-[11px] text-slate-400 text-right">还有 {aggs.length - maxRows} 个知识点未显示</p>
      )}
    </div>
  )
}

/** 最近 N 天错题新增趋势（小折线，SVG） */
export function MistakeTrend({ mistakes, days = 30 }: { mistakes: Mistake[]; days?: number }) {
  const { counts, max, total } = useMemo(() => {
    const counts = new Array(days).fill(0) as number[]
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
    for (const m of mistakes) {
      const d = (m.created_at || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
      const diff = Math.floor((today.getTime() - new Date(d + 'T00:00:00').getTime()) / 86400000)
      const idx = days - 1 - diff
      if (idx >= 0 && idx < days) counts[idx]++
    }
    return { counts, max: Math.max(...counts, 1), total: counts.reduce((s, c) => s + c, 0) }
  }, [mistakes, days])

  const W = 300
  const H = 72
  const pts = counts.map((c, i) => `${(i / (days - 1)) * W},${H - 6 - (c / max) * (H - 16)}`).join(' ')

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>最近 30 天错题新增：{total} 题</span>
        <span className="num">单日峰值 {max === 1 && total === 0 ? 0 : max}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" role="img" aria-label="最近 30 天错题趋势">
        {/* 基线 */}
        <line x1="0" y1={H - 6} x2={W} y2={H - 6} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
        <polyline points={pts} fill="none" className="stroke-primary-500" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {/* 非零点小圆点 */}
        {counts.map((c, i) =>
          c > 0 ? (
            <circle key={i} cx={(i / (days - 1)) * W} cy={H - 6 - (c / max) * (H - 16)} r="2.5" className="fill-primary-500" vectorEffect="non-scaling-stroke" />
          ) : null
        )}
      </svg>
      <div className="flex justify-between text-[11px] text-slate-400 num">
        <span>{days} 天前</span>
        <span>今天</span>
      </div>
    </div>
  )
}

/** 错因分布（横向条），备课参考 */
export function ErrorTypeBars({ mistakes }: { mistakes: Mistake[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of mistakes) {
      const k = m.error_type || '未标注'
      map.set(k, (map.get(k) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [mistakes])
  if (!rows.length) return null
  const max = rows[0][1]
  return (
    <div className="space-y-1.5">
      {rows.map(([k, n]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-slate-500">{k}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="num text-slate-400 w-8 text-right">{n}</span>
        </div>
      ))}
    </div>
  )
}
