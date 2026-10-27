// 统计与经营页：每周/每月课时与收入曲线、学生留存/续费率（纯 SVG 图表，无第三方依赖）
import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Users, Clock, Wallet } from 'lucide-react'
import { get } from '@/lib/api'
import { useToastStore } from '@/stores/auth'

interface Bucket { week?: string; month?: string; label: string; hours: number; income: number }
interface StatsData {
  weekly: Bucket[]
  monthly: Bucket[]
  totals: { total_income: number; total_hours: number }
  students: { total: number; active: number; paused: number; done: number; paid_students: number; renewal_rate: number }
}

/** 双序列折线（课时=靛蓝 / 收入=绿），纯 SVG */
function DualLine({ data, hoursKey = 'hours' }: { data: Bucket[]; hoursKey?: string }) {
  const W = 640, H = 180, PL = 40, PR = 46, PT = 14, PB = 26
  const maxH = Math.max(...data.map((d) => d.hours), 1)
  const maxI = Math.max(...data.map((d) => d.income), 1)
  const n = data.length
  const x = (i: number) => PL + (i / Math.max(1, n - 1)) * (W - PL - PR)
  const yH = (v: number) => H - PB - (v / maxH) * (H - PT - PB)
  const yI = (v: number) => H - PB - (v / maxI) * (H - PT - PB)
  const line = (vals: number[], y: (v: number) => number) =>
    vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const hours = data.map((d) => d.hours)
  const income = data.map((d) => d.income)
  // x 轴刻度：最多 6 个标签
  const tickEvery = Math.max(1, Math.ceil(n / 6))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="课时与收入曲线">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PL} y1={yH(maxH * f)} x2={W - PR} y2={yH(maxH * f)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" strokeDasharray="3 4" />
          <text x={PL - 6} y={yH(maxH * f) + 4} textAnchor="end" fontSize="10" className="fill-slate-400 num">{(maxH * f).toFixed(maxH * f < 10 && f > 0 ? 1 : 0)}</text>
        </g>
      ))}
      {/* 右轴：收入 */}
      {[0.5, 1].map((f) => (
        <text key={f} x={W - PR + 6} y={yI(maxI * f) + 4} fontSize="10" className="fill-emerald-500 num">¥{(maxI * f).toFixed(maxI * f < 10 && f > 0 ? 0 : 0)}</text>
      ))}
      <polyline points={line(hours, yH)} fill="none" className="stroke-primary-500" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(income, yI)} fill="none" className="stroke-emerald-500" strokeWidth="2" strokeDasharray="0" strokeLinejoin="round" strokeLinecap="round" />
      {income.map((v, i) => <circle key={'i' + i} cx={x(i)} cy={yI(v)} r="2.5" className="fill-emerald-500" />)}
      {hours.map((v, i) => <circle key={'h' + i} cx={x(i)} cy={yH(v)} r="2.5" className="fill-primary-500" />)}
      {data.map((d, i) =>
        i % tickEvery === 0 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" className="fill-slate-400 num">{d.label}</text>
        ) : null
      )}
    </svg>
  )
}

function Legend() {
  return (
    <div className="flex gap-4 text-[11px] text-slate-400 mb-1">
      <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-primary-500 inline-block" />课时（次）</span>
      <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />收入（元，右轴）</span>
    </div>
  )
}

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToastStore((s) => s.show)

  useEffect(() => {
    setLoading(true)
    get<StatsData>('/api/stats/overview')
      .then(setData)
      .catch((e) => toast(e.message || '加载统计数据失败'))
      .finally(() => setLoading(false))
  }, [])

  const monthIncome = useMemo(() => data?.monthly.at(-1)?.income ?? 0, [data])
  const monthHours = useMemo(() => data?.monthly.at(-1)?.hours ?? 0, [data])

  if (loading) return <div className="py-10 text-center text-sm text-slate-400">加载中…</div>
  if (!data) return <div className="py-10 text-center text-sm text-slate-400">暂无数据</div>

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 md:text-xl">统计</h1>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-primary-500" strokeWidth={1.8} />
          <div><div className="num text-xl font-bold">{data.totals.total_hours}</div><div className="text-xs text-slate-400">累计课时（次）</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <Wallet className="w-8 h-8 text-emerald-500" strokeWidth={1.8} />
          <div><div className="num text-xl font-bold">¥{data.totals.total_income.toLocaleString('zh-CN')}</div><div className="text-xs text-slate-400">累计收入（元）</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary-400" strokeWidth={1.8} />
          <div><div className="num text-xl font-bold">{monthHours}</div><div className="text-xs text-slate-400">本月课时（次）</div></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <Wallet className="w-8 h-8 text-emerald-400" strokeWidth={1.8} />
          <div><div className="num text-xl font-bold">¥{monthIncome.toLocaleString('zh-CN')}</div><div className="text-xs text-slate-400">本月收入（元）</div></div>
        </div>
      </div>

      {/* 每周曲线 */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-2">最近 12 周 · 课时与收入</h2>
        <Legend />
        <DualLine data={data.weekly} />
      </div>

      {/* 月度趋势 */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-2">近 6 个月 · 课时与收入</h2>
        <Legend />
        <DualLine data={data.monthly} />
      </div>

      {/* 学生留存/续费 */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary-500" />学生留存</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div><div className="num text-2xl font-bold text-primary-600 dark:text-primary-300">{data.students.active}</div><div className="text-xs text-slate-400">在读</div></div>
          <div><div className="num text-2xl font-bold text-amber-500">{data.students.paused}</div><div className="text-xs text-slate-400">停课</div></div>
          <div><div className="num text-2xl font-bold text-slate-400">{data.students.done}</div><div className="text-xs text-slate-400">结课</div></div>
          <div><div className="num text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.students.renewal_rate}%</div><div className="text-xs text-slate-400">续费率（缴费≥2 次占比）</div></div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">续费率 = 缴费记录 ≥ 2 次的学生 / 有过缴费的学生（{data.students.paid_students} 人）。学生总数 {data.students.total} 人。</p>
      </div>
    </div>
  )
}
