// 今日工作台：今日课表签到、剩余课时预警、下次课重点
// 桌面端两栏：左（课表+到期重做）/ 右（课时预警+下次课重点+快捷入口）
import { useCallback, useEffect, useState } from 'react'
import {Camera, CircleX, FlaskConical, Pin, Printer, Settings as SettingsIcon, TriangleAlert, Users} from 'lucide-react'
import { Link } from 'react-router-dom'
import { get, post } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import { NextKeyText } from '@/components/Kp'
import { printRedoSheet } from '@/lib/print'
import type { Mistake, TodayInfo } from '@workbench/shared'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function Today() {
  const [info, setInfo] = useState<TodayInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const show = useToastStore((s) => s.show)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInfo(await get<TodayInfo>('/api/today'))
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => {
    load()
  }, [load])

  const sign = async (studentId: number, scheduleId: number, status: string) => {
    try {
      const r = await post<any>('/api/attendance', { student_id: studentId, date: info!.date, status, schedule_id: scheduleId })
      if (status === '到课' && r?.billing_mode === 'per_lesson') {
        show(`已签到，已按次结算记账 ¥${r.settlement_amount || 0}`)
      } else if (status === '到课' && r?.account_suspended) {
        show('已签到扣 1 课时；⚠️ 课时已用完，该学生的学生端登录已自动暂停（续费后自动恢复）')
      } else {
        show(status === '到课' ? '已签到，扣 1 课时' : `已记录${status}`)
      }
      load()
    } catch (e: any) {
      show(e.message || '操作失败')
    }
  }

  // 打印重做单：把今日全部到期错题合成一张「考试卷」（题干+配图+空白作答区，不含解法与错因）
  const printRedo = async () => {
    const due = info?.due_redos || []
    if (!due.length) return
    try {
      const all = await get<Mistake[]>('/api/mistakes')
      const items = due
        .map((d) => all.find((m) => m.id === d.id))
        .filter(Boolean)
        .map((m: any) => {
          let kps: string[] = []
          try { kps = JSON.parse(m.knowledge_points || '[]') } catch { /* 忽略 */ }
          return { stem: m.stem, image: m.image || undefined, student_name: m.student_name, knowledge_points: kps.join('、') }
        })
      if (!items.length) { show('未取到到期错题详情'); return }
      if (!printRedoSheet(items, '到期错题重做练习单')) show('浏览器拦截了弹出窗口')
    } catch (e: any) {
      show(e.message || '取错题详情失败')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">今日</h1>
        <p className="text-sm text-slate-500 num">
          {info ? `${info.date} ${WEEKDAYS[info.weekday]}` : '加载中…'}
        </p>
      </div>

      {/* 拍作业 AI 批改入口 */}
      <Link
        to="/analyze"
        className="flex items-center gap-3 rounded-2xl bg-primary-600 text-white p-4 shadow-lg shadow-primary-600/20 active:scale-[0.99] transition-transform"
      >
        <Camera className="w-9 h-9 text-primary-600" />
        <span className="flex-1">
          <span className="block font-semibold">拍作业 · 智能批改分析</span>
          <span className="block text-xs text-primary-100 mt-0.5">拍照上传 → 智能逐题分析 → 确认入库</span>
        </span>
        <span className="text-lg">→</span>
      </Link>

      {loading && (
        <div className="card p-5 animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      )}

      {info && (
        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0 lg:items-start">
          {/* 左栏：今日课表 + 到期重做 */}
          <div className="min-w-0 space-y-5">
            {/* 今日课表 */}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 mb-2 px-1">今日课表（{info.lessons.length}）</h2>
              {info.lessons.length === 0 ? (
                <div className="card p-8 text-center text-sm text-slate-400">今天没有排课，好好休息 😊</div>
              ) : (
                <div className="space-y-3">
                  {info.lessons.map(({ schedule, student, attendance }) => (
                    <div key={schedule.id} className="card p-4 flex items-center gap-3">
                      <div className="num text-sm font-semibold text-primary-600 w-24">
                        {schedule.start_time}
                        <div className="text-xs text-slate-400 font-normal">{schedule.end_time}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/students/${student.id}`} className="font-medium hover:text-primary-600">
                          {student.name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {student.grade || '未设年级'}
                          {student.billing_mode === 'per_lesson' ? (
                            <span className=" text-violet-500"> · 按次结算</span>
                          ) : student.remaining_hours !== undefined && (
                            <span className={student.remaining_hours <= 3 ? ' text-red-500 num' : ' text-slate-400 num'}>
                              {' '}· 剩 {student.remaining_hours} 课时
                            </span>
                          )}
                        </div>
                      </div>
                      {attendance ? (
                        <span className={`text-xs px-3 py-1.5 rounded-full ${
                          attendance.status === '到课'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : attendance.status === '请假'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                        }`}>{attendance.status}</span>
                      ) : (
                        <div className="flex gap-1.5">
                          <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => sign(student.id, schedule.id, '到课')}>到课</button>
                          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => sign(student.id, schedule.id, '请假')}>请假</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 到期错题重做 */}
            {info.due_redos && info.due_redos.length > 0 && (
              <section>
                <div className="flex items-center mb-2 px-1">
                  <h2 className="text-sm font-semibold text-red-500"><Pin className="w-4 h-4 inline-block align-[-2px]" /> 到期错题重做（{info.due_redos.length}）</h2>
                  <span className="flex-1" />
                  <button className="btn-outline !px-2.5 !py-1 text-[11px]" onClick={printRedo} title="把到期错题合成一张练习单打印（遮答案，留空白作答区）">
                    <Printer className="w-3.5 h-3.5 inline-block align-[-2px]" /> 打印重做单
                  </button>
                </div>
                <div className="space-y-2">
                  {info.due_redos.map((m: any) => (
                    <Link key={m.id} to="/mistakes" className="card p-3.5 flex items-center gap-3 block">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 shrink-0">{m.redo_due}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{m.student_name}</span>
                        <p className="text-xs text-slate-500 truncate">{m.stem}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">去重做 →</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 右栏（桌面端）：课时预警 + 下次课重点 + 快捷入口 */}
          <aside className="min-w-0 space-y-5 lg:sticky lg:top-4">
            {/* 课时预警 */}
            {info.low_hours.length > 0 && (
              <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2"><TriangleAlert className="w-4 h-4 inline-block align-[-2px]" /> 课时预警（剩余 ≤ 3）</h2>
                <div className="flex flex-wrap gap-2">
                  {info.low_hours.map((s) => (
                    <Link key={s.id} to={`/students/${s.id}`} className="text-sm bg-white dark:bg-slate-900 rounded-full px-3 py-1.5 border border-red-200 dark:border-red-800">
                      {s.name} <span className="num text-red-500 font-semibold">{s.remaining_hours}</span> 课时
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 下次课重点（关键词命中课件可点直达） */}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 mb-2 px-1">下次课重点</h2>
              {info.pending_logs.length === 0 ? (
                <div className="card p-8 text-center text-sm text-slate-400">暂无记录，在学生详情中记学情时可填写</div>
              ) : (
                <div className="space-y-3">
                  {info.pending_logs.map((l) => (
                    <div key={l.id} className="card p-4">
                      <Link to={`/students/${l.student_id}`} className="text-sm font-medium hover:text-primary-600">{l.student_name}</Link>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-3">
                        <NextKeyText text={l.next_class_key} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 快捷入口 */}
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-slate-500 mb-2">快捷入口</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Link to="/mistakes" className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"><CircleX className="w-4 h-4 inline-block align-[-2px]" /> 错题本</Link>
                <Link to="/labs" className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"><FlaskConical className="w-4 h-4 inline-block align-[-2px]" /> 物理课件</Link>
                <Link to="/students" className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"><Users className="w-4 h-4 inline-block align-[-2px]" /> 学生管理</Link>
                <Link to="/settings" className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"><SettingsIcon className="w-4 h-4 inline-block align-[-2px]" /> 智能服务配置</Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
