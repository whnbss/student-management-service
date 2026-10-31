// 学生工作台三个视图：我的错题（重做）/ 我的课时 / 我的报告（只读）
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ChevronDown, CircleCheck, FileText as FileTextIcon } from 'lucide-react'
import { get, post } from '@/lib/api'
import { useAuthStore, useToastStore } from '@/stores/auth'
import Katex from '@/components/Katex'
import QuestionFigure from '@/components/QuestionFigure'
import { KpChips } from '@/components/Kp'
import type { Mistake } from '@workbench/shared'
import type { StudentMe } from '@workbench/shared'
import { todayLocal } from '@workbench/shared'

interface Ctx { me: StudentMe | null; reloadMe: () => void }

const STATUS_COLOR: Record<string, string> = {
  '未掌握': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  '已重做一次': 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  '已掌握': 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
}

// ---------------- 我的错题 ----------------
export function StudentMistakes() {
  const show = useToastStore((s) => s.show)
  const [list, setList] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  // 展开的错题 id 集合：「今日待重做」默认展开，避免学生不知道先点题干
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<number | null>(null)
  const today = todayLocal()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const arr = await get<Mistake[]>('/api/student/mistakes')
      setList(arr)
      const d = todayLocal()
      const dueIds = arr.filter((m) => m.redo_due && m.redo_due <= d && m.mastery_status !== '已掌握').map((m) => m.id)
      setExpanded((prev) => new Set([...prev, ...dueIds]))
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { load() }, [load])

  const toggle = (id: number) => setExpanded((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const due = list.filter((m) => m.redo_due && m.redo_due <= today && m.mastery_status !== '已掌握')
  const rest = list.filter((m) => !due.includes(m))

  const redo = async (m: Mistake) => {
    setBusy(m.id)
    try {
      await post(`/api/student/mistakes/${m.id}/redo`)
      show('已提交重做，老师会看到你的进度 💪')
      load()
    } catch (e: any) {
      show(e.message || '操作失败')
    } finally {
      setBusy(null)
    }
  }

  const card = (m: Mistake, isDue: boolean) => (
    <div key={m.id} className={`card p-4 ${isDue ? 'border-red-300 dark:border-red-800' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {isDue && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white">今日待重做</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[m.mastery_status]}`}>{m.mastery_status}</span>
        {m.error_type && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">{m.error_type}</span>}
        {m.redo_due && <span className="num text-xs text-slate-400 ml-auto">下次重做 {m.redo_due}</span>}
      </div>
      <div className="text-sm cursor-pointer" onClick={() => toggle(m.id)}>
        <Katex text={m.stem} />
        {optionsOf(m).length > 0 && (
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5 mt-1">
            {optionsOf(m).map((o, i) => <p key={i}><Katex text={o} /></p>)}
          </div>
        )}
        <QuestionFigure figure={m.figure} />
        {m.image && <img src={m.image} className="mt-2 rounded-lg max-h-40 object-cover" loading="lazy" />}
      </div>
      <div className="mt-2"><KpChips kps={kpOf(m)} /></div>
      {expanded.has(m.id) ? (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm">
          <div><span className="text-xs text-slate-400">正确解法：</span><Katex text={m.correct_solution || '（暂无，上课时听老师讲解）'} /></div>
          <div><span className="text-xs text-slate-400">我的错误：</span><Katex text={m.wrong_solution || '（未记录）'} /></div>
          {m.mastery_status !== '已掌握' && (
            <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={busy === m.id} onClick={() => redo(m)}>
              <CircleCheck className="w-4 h-4 inline-block align-[-2px]" /> {busy === m.id ? '提交中…' : '我已重做（老师会收到通知）'}
            </button>
          )}
        </div>
      ) : (
        <button
          className="mt-2 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400"
          onClick={() => toggle(m.id)}
        >
          点击展开详解{m.mastery_status !== '已掌握' ? ' / 重做' : ''}
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">我的错题</h1>
      {loading ? (
        <div className="card p-8 animate-pulse space-y-3">
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">还没有错题，继续保持！</div>
      ) : (
        <>
          {due.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-red-500 px-1">今日待重做（{due.length}）</h2>
              {due.map((m) => card(m, true))}
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 px-1">全部错题（{list.length}）</h2>
            {rest.map((m) => card(m, false))}
          </section>
        </>
      )}
    </div>
  )
}

// ---------------- 我的课时 ----------------
// 隐私：按次结算（一课一结算）学生端不展示任何费用（单价/金额/合计），只保留上课次数与签到记录
interface HoursData {
  remaining_hours: number
  billing_mode: 'package' | 'per_lesson'
  packages: any[]
  attendance: any[]
  settlements?: { id: number; date: string }[]
}

export function StudentHours() {
  const { me } = useOutletContext<Ctx>()
  const show = useToastStore((s) => s.show)
  const [data, setData] = useState<HoursData | null>(null)

  useEffect(() => {
    get<HoursData>('/api/student/hours').then(setData).catch((e) => show(e.message || '加载失败'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const perLesson = data?.billing_mode === 'per_lesson'
  const low = !perLesson && data ? data.remaining_hours <= 3 : false
  const month = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">我的课时</h1>
      {perLesson ? (
        <div className="card p-5 text-center">
          <div className="text-xs text-slate-400">{month} 本月已上课时</div>
          <div className="text-4xl font-bold num mt-1 text-primary-600 dark:text-primary-300">
            {data ? (data.settlements?.length ?? 0) : '…'}
          </div>
          <p className="text-xs text-slate-400 mt-2">次 · 按次结算 · 一课一记</p>
        </div>
      ) : (
        <div className={`card p-5 text-center ${low ? 'border-red-300 dark:border-red-800' : ''}`}>
          <div className="text-xs text-slate-400">剩余课时</div>
          <div className={`text-4xl font-bold num mt-1 ${low ? 'text-red-500' : 'text-primary-600 dark:text-primary-300'}`}>
            {data ? data.remaining_hours : '…'}
          </div>
          {low && data && (
            <p className="text-xs text-red-500 mt-2">课时即将用完，请联系老师续费</p>
          )}
        </div>
      )}
      {!perLesson && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-2">课时包记录</h2>
          {!data || data.packages.length === 0 ? (
            <p className="text-xs text-slate-400">暂无记录</p>
          ) : (
            <div className="space-y-1.5">
              {data.packages.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm num">
                  <span className="text-slate-500">{p.purchase_date}</span>
                  <span>+{p.hours} 课时</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="card p-4">
        <h2 className="font-semibold text-sm mb-2">最近签到</h2>
        {!data || data.attendance.length === 0 ? (
          <p className="text-xs text-slate-400">暂无记录</p>
        ) : (
          <div className="space-y-1.5">
            {data.attendance.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm num">
                <span className="text-slate-500">{a.date}</span>
                <span className={a.status === '到课' ? 'text-green-600' : a.status === '请假' ? 'text-amber-500' : 'text-red-500'}>{a.status}</span>
                {a.deducted > 0 && <span className="text-slate-400">-1 课时</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {!perLesson && me && me.remaining_hours <= 3 && (
        <div className="rounded-xl px-3 py-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300">
          课时余额不足 3 次，记得提醒家长联系老师续费哦
        </div>
      )}
      {perLesson && (
        <div className="rounded-xl px-3 py-2 text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300">
          你的课时为「一课一结算」：每次上课后按单次课费记账。
        </div>
      )}
    </div>
  )
}

// ---------------- 我的报告（只读） ----------------
export function StudentReports() {
  const show = useToastStore((s) => s.show)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // C4：老师讲义（学生只能看到并下载自己的）
  const [files, setFiles] = useState<any[]>([])
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    get<any[]>('/api/student/reports')
      .then(setRows)
      .catch((e) => show(e.message || '加载失败'))
      .finally(() => setLoading(false))
    get<any[]>('/api/student/report-files').then(setFiles).catch(() => { /* 无讲义静默 */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 讲义下载：带 token 取 blob → 临时链接下载（<a> 无法带 Authorization 头）
  const downloadFile = async (f: any) => {
    try {
      const res = await fetch(f.path + `?token=${encodeURIComponent(token || '')}`)
      if (!res.ok) throw new Error(res.status === 403 ? '无权限访问该讲义' : '下载失败')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = f.filename || f.title || '讲义'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      show(e.message || '下载失败')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">我的报告</h1>
      {/* C4：老师讲义（docx/pdf 等，点击下载打开） */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 px-1">老师讲义{files.length > 0 && `（${files.length}）`}</h2>
        {files.length === 0 ? (
          <div className="card p-4 text-center text-xs text-slate-400">老师还没有上传讲义</div>
        ) : (
          files.map((f) => (
            <div key={f.id} className="card p-4 flex items-center gap-3">
              <FileTextIcon className="w-5 h-5 text-primary-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.title}</p>
                <p className="text-[11px] text-slate-400 num">{String(f.created_at).slice(0, 10)} · {f.filename}{f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ''}</p>
              </div>
              <button className="btn-outline !px-3 !py-1.5 text-xs shrink-0" onClick={() => downloadFile(f)}>下载打开</button>
            </div>
          ))
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500 px-1">阶段报告</h2>
      {loading ? (
        <div className="card p-8 animate-pulse"><div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" /></div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">老师还没有给你生成学习报告</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{r.title}</span>
              <span className="flex-1" />
              {r.expired
                ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400">已过期</span>
                : <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300">可查看</span>}
            </div>
            <p className="text-[11px] text-slate-400 num">生成于 {String(r.created_at).slice(0, 10)}</p>
            {r.report && !r.expired && (
              <div className="space-y-2 text-sm">
                <p className="text-slate-600 dark:text-slate-300">{r.report.summary}</p>
                {r.report.glow?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1">进步</p>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      {r.report.glow.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {r.report.grow?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1">待改进</p>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      {r.report.grow.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {r.report.plan?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-primary-600 mb-1">下阶段计划</p>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                      {r.report.plan.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
      </section>
    </div>
  )
}

function optionsOf(m: Mistake): string[] { try { const a = JSON.parse((m as any).options || '[]'); return Array.isArray(a) ? a.map(String) : [] } catch { return [] } }

function kpOf(m: Mistake): string[] {
  try { return JSON.parse(m.knowledge_points || '[]') as string[] } catch { return [] }
}

// ---------------- 我的学情日志（老师记录的上课/作业流水，学生只读） ----------------
interface StudentLog { id: number; date: string; type: string; content: string; images: string; next_class_key: string; homework: string; created_at: string }

const LOG_TYPE_COLOR: Record<string, string> = {
  '上课': 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300',
  '作业': 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  '考试': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  '其他': 'bg-slate-200 dark:bg-slate-800 text-slate-500',
}

export function StudentLogs() {
  const show = useToastStore((s) => s.show)
  const [rows, setRows] = useState<StudentLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get<StudentLog[]>('/api/student/logs')
      .then(setRows)
      .catch((e) => show(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const imgsOf = (s: string): string[] => { try { return JSON.parse(s || '[]') } catch { return [] } }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">学习日志</h1>
      {loading ? (
        <div className="card p-8 animate-pulse space-y-3">
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">老师还没有记录学习日志</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold num">{r.date}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${LOG_TYPE_COLOR[r.type] || LOG_TYPE_COLOR['其他']}`}>{r.type}</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{r.content}</p>
            {imgsOf(r.images).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {imgsOf(r.images).map((src, i) => (
                  <img key={i} src={src} className="rounded-lg max-h-36 object-cover" loading="lazy" />
                ))}
              </div>
            )}
            {r.next_class_key && (
              <div className="rounded-xl px-3 py-2 text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">
                下次课重点：{r.next_class_key}
              </div>
            )}
            {/* C3：老师布置的下次课作业（填了才显示） */}
            {r.homework && (
              <div className="rounded-xl px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                📝 下次课作业布置：{r.homework}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
