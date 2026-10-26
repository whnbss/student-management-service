// 学生详情：概况 / 学情日志 / 课时缴费 / 课表 四个子 Tab
import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { get, post, del } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import type { Student, HourPackage, Payment, StudyLog, Schedule } from '@workbench/shared'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const LOG_TYPES = ['上课', '作业', '考试', '其他']

type SubTab = 'logs' | 'hours' | 'schedule'

export default function StudentDetail() {
  const { id } = useParams()
  const [student, setStudent] = useState<Student | null>(null)
  const [tab, setTab] = useState<SubTab>('logs')
  const show = useToastStore((s) => s.show)

  const [logs, setLogs] = useState<StudyLog[]>([])
  const [packages, setPackages] = useState<HourPackage[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  // 学情日志表单
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), type: '上课', content: '', next_class_key: '' })
  const [logSaving, setLogSaving] = useState(false)
  // 课时包表单
  const [pkgForm, setPkgForm] = useState({ hours: 10, amount: 0, purchase_date: new Date().toISOString().slice(0, 10), note: '' })
  const [pkgSaving, setPkgSaving] = useState(false)
  // 课表表单
  const [schForm, setSchForm] = useState({ weekday: 1, start_time: '19:00', end_time: '21:00', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, l, p, pay, sch] = await Promise.all([
        get<Student>(`/api/students/${id}`),
        get<StudyLog[]>(`/api/students/${id}/logs`),
        get<HourPackage[]>(`/api/students/${id}/packages`),
        get<Payment[]>(`/api/students/${id}/payments`),
        get<Schedule[]>(`/api/students/${id}/schedules`),
      ])
      setStudent(s)
      setLogs(l)
      setPackages(p)
      setPayments(pay)
      setSchedules(sch)
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id, show])

  useEffect(() => {
    load()
  }, [load])

  const saveLog = async () => {
    if (!logForm.content.trim()) { show('请填写记录内容'); return }
    setLogSaving(true)
    try {
      await post(`/api/students/${id}/logs`, logForm)
      show('已记录')
      setLogForm({ ...logForm, content: '', next_class_key: '' })
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setLogSaving(false)
    }
  }

  const savePackage = async () => {
    setPkgSaving(true)
    try {
      await post(`/api/students/${id}/packages`, pkgForm)
      show('课时包已录入')
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setPkgSaving(false)
    }
  }

  const saveSchedule = async () => {
    try {
      await post(`/api/students/${id}/schedules`, schForm)
      show('已添加排课')
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    }
  }

  const removeLog = async (logId: number) => {
    if (!confirm('确定删除这条学情记录？')) return
    await del(`/api/logs/${logId}`)
    show('已删除')
    load()
  }

  const typeColor = (t: string) => ({
    上课: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    作业: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    考试: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    其他: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[t] || 'bg-slate-200')

  if (loading) return <div className="card p-8 animate-pulse h-40 bg-slate-200/50 dark:bg-slate-800/50" />
  if (!student) return <div className="card p-8 text-center text-sm text-slate-500">学生不存在</div>

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* 头部档案卡 */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xl font-bold shrink-0">
            {student.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{student.name}</h1>
              <span className="text-xs text-slate-400">{student.grade} {student.school}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {student.textbook && `教材：${student.textbook} · `}
              {student.phone && `联系：${student.phone} `}
              {student.parent_wechat && `· 家长：${student.parent_wechat}`}
            </p>
          </div>
          <div className={`text-right num shrink-0 ${student.remaining_hours! <= 3 ? 'text-red-500' : 'text-primary-600'}`}>
            <div className="text-2xl font-bold leading-none">{student.remaining_hours}</div>
            <div className="text-[10px]">剩余课时{student.remaining_hours! <= 3 && ' ⚠️'}</div>
          </div>
        </div>
        {student.note && <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">备注：{student.note}</p>}
      </div>

      {/* 子 Tab */}
      <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl p-1 text-sm">
        {([['logs', '学情日志'], ['hours', '课时缴费'], ['schedule', '课表']] as const).map(([key, label]) => (
          <button
            key={key}
            className={`flex-1 py-2 rounded-lg font-medium ${tab === key ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 学情日志 */}
      {tab === 'logs' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-sm">＋ 新增学情记录（手动速记）</h2>
            <div className="flex gap-2">
              <input type="date" className="input num !w-40" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
              <select className="input !w-28" value={logForm.type} onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}>
                {LOG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea className="input" rows={3} placeholder="本节内容、学生表现、作业布置…" value={logForm.content} onChange={(e) => setLogForm({ ...logForm, content: e.target.value })} />
            <input className="input" placeholder="下次课重点（可选，将出现在今日工作台）" value={logForm.next_class_key} onChange={(e) => setLogForm({ ...logForm, next_class_key: e.target.value })} />
            <button className="btn-primary w-full" disabled={logSaving} onClick={saveLog}>{logSaving ? '保存中…' : '保存记录'}</button>
          </div>

          {logs.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">暂无学情记录</div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="relative pl-6">
                    <div className="absolute left-0 top-2 w-3.5 h-3.5 rounded-full border-2 border-primary-500 bg-white dark:bg-slate-900" />
                    <div className="card p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="num text-xs text-slate-400">{log.date}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${typeColor(log.type)}`}>{log.type}</span>
                        {log.ai_generated === 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">AI 生成</span>}
                        <button className="ml-auto text-xs text-slate-400 hover:text-red-500" onClick={() => removeLog(log.id)}>删除</button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{log.content}</p>
                      {(() => {
                        let imgs: string[] = []
                        try { imgs = JSON.parse(log.images || '[]') } catch { /* 忽略 */ }
                        if (!imgs.length) return null
                        return (
                          <div className="flex gap-2 mt-2 overflow-x-auto">
                            {imgs.map((p, i) => (
                              <img key={i} src={p} className="h-24 rounded-lg border border-slate-200 dark:border-slate-700 object-cover cursor-zoom-in" loading="lazy"
                                onClick={() => window.open(p, '_blank')} />
                            ))}
                          </div>
                        )
                      })()}
                      {log.ai_result && (
                        <details className="mt-2 text-xs">
                          <summary className="text-primary-600 dark:text-primary-400 cursor-pointer">查看 AI 分析详情</summary>
                          <div className="mt-1.5 space-y-1 text-slate-500">
                            {(() => {
                              try {
                                const a = JSON.parse(log.ai_result!)
                                return (
                                  <>
                                    <p>题目判定：{a.items?.map((it: any) => `第${it.no}题${it.verdict}`).join('、') || '无'}</p>
                                    {a.weak_points?.length > 0 && <p>薄弱点：{a.weak_points.map((w: any) => w.point).join('、')}</p>}
                                    {a.overall_comment && <p>总评：{a.overall_comment}</p>}
                                    {a.unrecognized?.length > 0 && <p className="text-amber-500">待确认：{a.unrecognized.join('；')}</p>}
                                  </>
                                )
                              } catch { return <p>（分析结果解析失败）</p> }
                            })()}
                          </div>
                        </details>
                      )}
                      {log.next_class_key && (
                        <p className="text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-primary-600 dark:text-primary-400">
                          📌 下次课重点：{log.next_class_key}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 课时缴费 */}
      {tab === 'hours' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-sm">＋ 录入课时包</h2>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">课时数</label>
                <input type="number" className="input num" min={1} value={pkgForm.hours} onChange={(e) => setPkgForm({ ...pkgForm, hours: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">金额(元)</label>
                <input type="number" className="input num" min={0} value={pkgForm.amount} onChange={(e) => setPkgForm({ ...pkgForm, amount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">购买日期</label>
                <input type="date" className="input num" value={pkgForm.purchase_date} onChange={(e) => setPkgForm({ ...pkgForm, purchase_date: e.target.value })} />
              </div>
            </div>
            <input className="input" placeholder="备注（可选）" value={pkgForm.note} onChange={(e) => setPkgForm({ ...pkgForm, note: e.target.value })} />
            <button className="btn-primary w-full" disabled={pkgSaving} onClick={savePackage}>{pkgSaving ? '保存中…' : '保存课时包（同时记缴费流水）'}</button>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-sm mb-3">课时包（共 {packages.length} 次，累计缴费 ¥{totalPaid.toFixed(2)}）</h2>
            {packages.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">尚无课时包</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {packages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="num font-medium">{p.hours} 课时</span>
                      <span className="text-slate-400 text-xs ml-2 num">{p.purchase_date}</span>
                      {p.note && <span className="text-slate-400 text-xs ml-2">{p.note}</span>}
                    </div>
                    <span className="num">¥{p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-sm mb-3">缴费流水</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">尚无缴费记录</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="num text-green-600 dark:text-green-400 font-medium">+¥{p.amount.toFixed(2)}</span>
                      {p.method && <span className="text-slate-400 text-xs ml-2">{p.method}</span>}
                    </div>
                    <span className="num text-xs text-slate-400">{p.paid_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 课表 */}
      {tab === 'schedule' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-sm">＋ 添加每周固定课</h2>
            <div className="grid grid-cols-4 gap-2">
              <select className="input" value={schForm.weekday} onChange={(e) => setSchForm({ ...schForm, weekday: Number(e.target.value) })}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
              <input type="time" className="input num" value={schForm.start_time} onChange={(e) => setSchForm({ ...schForm, start_time: e.target.value })} />
              <input type="time" className="input num" value={schForm.end_time} onChange={(e) => setSchForm({ ...schForm, end_time: e.target.value })} />
              <button className="btn-primary" onClick={saveSchedule}>添加</button>
            </div>
          </div>
          {schedules.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">还没有固定排课</div>
          ) : (
            <div className="card divide-y divide-slate-100 dark:divide-slate-800">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{WEEKDAYS[s.weekday]}</span>
                    <span className="num text-slate-500 ml-3">{s.start_time} ~ {s.end_time}</span>
                    {s.note && <span className="text-slate-400 text-xs ml-2">{s.note}</span>}
                  </div>
                  <button
                    className="text-xs text-slate-400 hover:text-red-500"
                    onClick={async () => { if (confirm('确定删除这条排课？')) { await del(`/api/students/${id}/schedules/${s.id}`); show('已删除'); load() } }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 px-1">到课签到在「今日」工作台进行，每次到课自动扣 1 课时。</p>
        </div>
      )}
    </div>
  )
}
