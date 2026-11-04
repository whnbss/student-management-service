// 学生详情：看板 / 学情日志 / 课时缴费 / 课表 四个子 Tab
// 桌面端两栏：左（当前 Tab 内容）/ 右（学情看板 + 快捷入口）
import { useCallback, useEffect, useState } from 'react'
import {BarChart3, BookOpen, CalendarClock, Camera, Download, FileText, Image as ImageIcon, Mail, Paperclip, PenLine, Pin, Printer, SquarePen, Trash2, Wallet} from 'lucide-react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { get, post, put, del } from '@/lib/api'
import { useToastStore, useAuthStore } from '@/stores/auth'
import { uploadImage } from '@/lib/image'
import TextbookPicker from '@/components/TextbookPicker'
import { NextKeyText } from '@/components/Kp'
import { aggregateKp, KpMasteryBars, KP_LEGEND, MistakeTrend, ErrorTypeBars } from '@/components/Charts'
import { TieredPracticeModal, ParentReportModal } from '@/components/Practice'
import { printRedoSheet } from '@/lib/print'
import { todayLocal } from '@workbench/shared'
import type { Student, HourPackage, Payment, StudyLog, Schedule, Mistake, Settlement, Handout } from '@workbench/shared'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const LOG_TYPES = ['上课', '作业', '考试', '其他']
// E 批次：讲义白名单与限额（与后端一致，前端先挡一道给即时提示）
const HANDOUT_ACCEPT = '.docx,.doc,.pdf,.pptx,.ppt'
const HANDOUT_EXTS = ['.docx', '.doc', '.pdf', '.pptx', '.ppt']
const HANDOUT_MAX_MB = 30
const HANDOUT_MAX_COUNT = 5

function handoutExtBadge(ext: string): string {
  return ({ '.docx': 'D', '.doc': 'D', '.pdf': 'P', '.pptx': 'S', '.ppt': 'S' } as Record<string, string>)[ext] || 'F'
}

function handoutSizeText(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

type SubTab = 'board' | 'logs' | 'hours' | 'schedule' | 'handouts'

function kpOf(m: Mistake): string[] {
  try { return JSON.parse(m.knowledge_points || '[]') as string[] } catch { return [] }
}

export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [tab, setTab] = useState<SubTab>('logs')
  const show = useToastStore((s) => s.show)

  const [logs, setLogs] = useState<StudyLog[]>([])
  const [packages, setPackages] = useState<HourPackage[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  // E：该生全部课次讲义（时间线 chips + 「讲义资料」汇总区共用）
  const [handouts, setHandouts] = useState<Handout[]>([])
  const [loading, setLoading] = useState(true)
  // 一课一结算：结算记录（按月过滤）与导账单
  const [settleMonth, setSettleMonth] = useState(todayLocal().slice(0, 7))
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [settleTotal, setSettleTotal] = useState(0)

  // 学情日志表单（C3：homework=下次课作业布置，可选）
  const [logForm, setLogForm] = useState({ date: todayLocal(), type: '上课', content: '', next_class_key: '', homework: '' })
  const [logSaving, setLogSaving] = useState(false)
  // D2：新增学情记录支持图片（上传/粘贴多张，存 /uploads/<学生ID>/<日期>/）
  const [logImages, setLogImages] = useState<string[]>([])
  const [logImgBusy, setLogImgBusy] = useState(false)
  // E：新增学情记录的「教学讲义」待传文件（保存日志时先上传拿 id，再随日志关联）
  const [logHandoutFiles, setLogHandoutFiles] = useState<File[]>([])
  // E：编辑日志时的讲义 id 列表（null=未进入编辑；数组=编辑中，保存时整体替换关联）
  const [logEditHandoutIds, setLogEditHandoutIds] = useState<number[] | null>(null)
  const [logHandoutBusy, setLogHandoutBusy] = useState(false)
  // E：「讲义资料」独立上传
  const [handoutBusy, setHandoutBusy] = useState(false)
  // C3：日志卡内编辑作业布置（补填/修改）
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [logEditForm, setLogEditForm] = useState({ homework: '', next_class_key: '' })
  const [logEditSaving, setLogEditSaving] = useState(false)
  // D2：编辑日志时的图片列表（null=未进入图片编辑；数组=编辑中，保存时整体替换）
  const [logEditImages, setLogEditImages] = useState<string[] | null>(null)
  // D2：图片放大预览（教师端时间线点击放大，替代原来的新开窗口）
  const [lightbox, setLightbox] = useState<string | null>(null)
  // 课时包表单
  const [pkgForm, setPkgForm] = useState({ hours: 10, amount: 0, purchase_date: todayLocal(), note: '' })
  const [pkgSaving, setPkgSaving] = useState(false)
  // 课表表单
  const [schForm, setSchForm] = useState({ weekday: 1, start_time: '19:00', end_time: '21:00', note: '' })
  // P1 弹层：分层练习 / 家长阶段报告
  const [showTiered, setShowTiered] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, l, p, pay, sch, mk, hd] = await Promise.all([
        get<Student>(`/api/students/${id}`),
        get<StudyLog[]>(`/api/students/${id}/logs`),
        get<HourPackage[]>(`/api/students/${id}/packages`),
        get<Payment[]>(`/api/students/${id}/payments`),
        get<Schedule[]>(`/api/students/${id}/schedules`),
        get<Mistake[]>(`/api/mistakes?student_id=${id}`),
        get<Handout[]>(`/api/students/${id}/handouts`),
      ])
      setStudent(s)
      setLogs(l)
      setPackages(p)
      setPayments(pay)
      setSchedules(sch)
      setMistakes(mk)
      setHandouts(hd)
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id, show])

  useEffect(() => {
    load()
  }, [load])

  // 结算记录：按月加载（一课一结算学生）
  const loadSettlements = useCallback(async () => {
    try {
      const r = await get<{ items: Settlement[]; total: number }>(`/api/students/${id}/settlements?month=${settleMonth}`)
      setSettlements(r.items)
      setSettleTotal(r.total)
    } catch { /* 忽略 */ }
  }, [id, settleMonth])

  useEffect(() => {
    loadSettlements()
  }, [loadSettlements])

  // 导出月度账单 CSV（Excel 可直接打开；单元格引号包裹防逗号破列）
  const exportBill = () => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const rows = [['日期', '金额(元)', '备注'], ...[...settlements].reverse().map((s) => [s.date, String(s.amount), s.note || '按次结算'])]
    rows.push([`${settleMonth} 合计`, settleTotal.toFixed(2), ''])
    const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${student?.name || '学生'}-${settleMonth}-课时账单.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 错题重做练习单：把该生到期（redo_due ≤ 今天）的错题合成一张考试卷（遮答案、空白作答区）
  const dueMistakes = mistakes.filter((m) => m.mastery_status !== '已掌握' && m.redo_due && m.redo_due <= todayLocal())
  const printRedo = () => {
    if (!student) return
    if (!dueMistakes.length) { show('该生当前没有到期重做的错题'); return }
    const items = dueMistakes.map((m) => ({
      stem: m.stem,
      image: m.image || undefined,
      student_name: m.student_name,
      knowledge_points: kpOf(m).join('、'),
    }))
    if (!printRedoSheet(items, `${student.name} · 错题重做练习单`)) show('浏览器拦截了弹出窗口')
  }

  // D2：把图片压缩上传到该生名下，追加到指定图片列表（新增表单 / 编辑表单共用）
  const addLogImages = async (fl: FileList | File[], target: 'new' | 'edit') => {
    const arr = Array.from(fl).filter((f) => f.type.startsWith('image/'))
    if (!arr.length) return
    setLogImgBusy(true)
    try {
      const token = useAuthStore.getState().token || ''
      const paths: string[] = []
      for (const f of arr) paths.push(await uploadImage(f, id || '', token))
      if (target === 'new') setLogImages((prev) => [...prev, ...paths])
      else setLogEditImages((prev) => [...(prev || []), ...paths])
    } catch (e: any) {
      show(e.message || '图片上传失败')
    } finally {
      setLogImgBusy(false)
    }
  }

  // D2：内容输入框 Ctrl+V 粘贴截图直接加入图片列表
  const pasteIntoLog = (e: React.ClipboardEvent, target: 'new' | 'edit') => {
    const fs = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith('image/'))
    if (fs.length) { e.preventDefault(); addLogImages(fs, target) }
  }

  // E：把讲义文件上传到该生名下（kind='handout'），返回讲义 id 列表
  const uploadHandoutFiles = async (fl: File[]): Promise<number[]> => {
    const token = useAuthStore.getState().token || ''
    const ids: number[] = []
    for (const f of fl) {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`/api/students/${id}/handouts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || `「${f.name}」上传失败`)
      ids.push(...(data.ids || []))
    }
    return ids
  }

  // E：选择讲义文件（新增表单待传列表 / 编辑表单与「讲义资料」区立即上传）
  const addHandoutFiles = async (fl: FileList | File[], target: 'new' | 'edit' | 'standalone') => {
    const arr = Array.from(fl)
    const bad = arr.find((f) => !HANDOUT_EXTS.includes('.' + (f.name.split('.').pop() || '').toLowerCase()))
    if (bad) { show(`「${bad.name}」格式不支持，只支持 docx / doc / pdf / pptx / ppt`); return }
    const big = arr.find((f) => f.size > HANDOUT_MAX_MB * 1024 * 1024)
    if (big) { show(`「${big.name}」超过 ${HANDOUT_MAX_MB}MB 上限`); return }
    if (target === 'new') {
      if (logHandoutFiles.length + arr.length > HANDOUT_MAX_COUNT) { show(`一次最多 ${HANDOUT_MAX_COUNT} 个讲义文件`); return }
      setLogHandoutFiles((prev) => [...prev, ...arr])
      return
    }
    setLogHandoutBusy(true)
    try {
      const ids = await uploadHandoutFiles(arr)
      if (target === 'edit') setLogEditHandoutIds((prev) => [...(prev || []), ...ids])
      else load()
      show('讲义已上传')
    } catch (e: any) {
      show(e.message || '讲义上传失败')
    } finally {
      setLogHandoutBusy(false)
    }
  }

  // E：下载讲义（带 token 取 blob，文件名用上传时的原始名）
  const downloadHandout = async (h: { id: number; filename: string; title: string }) => {
    try {
      const res = await fetch(`/api/handouts/${h.id}/file`, {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      })
      if (!res.ok) throw new Error(res.status === 404 ? '讲义文件不存在' : '下载失败')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = h.filename || h.title || '讲义'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      show(e.message || '下载失败')
    }
  }

  const saveLog = async () => {
    if (!logForm.content.trim()) { show('请填写记录内容'); return }
    setLogSaving(true)
    try {
      // E：先上传随日志选择的讲义文件拿 id，落库时一并关联
      const handoutIds = logHandoutFiles.length ? await uploadHandoutFiles(logHandoutFiles) : []
      await post(`/api/students/${id}/logs`, { ...logForm, images: logImages, ...(handoutIds.length ? { handout_ids: handoutIds } : {}) })
      show('已记录')
      setLogForm({ ...logForm, content: '', next_class_key: '', homework: '' })
      setLogImages([])
      setLogHandoutFiles([])
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setLogSaving(false)
    }
  }

  // C3：保存日志补填（作业布置/下次课重点）；D2：图片列表有改动时一并提交
  // 打开日志编辑器：图片列表一并初始化（编辑时可增删）
  const openLogEdit = (log: StudyLog) => {
    setEditingLogId(log.id)
    setLogEditForm({ homework: log.homework || '', next_class_key: log.next_class_key || '' })
    let imgs: string[] = []
    try { imgs = JSON.parse(log.images || '[]') } catch { /* 忽略 */ }
    setLogEditImages(Array.isArray(imgs) ? imgs : [])
    // E：讲义关联一并初始化（编辑时可补传/移除，保存时整体替换）
    setLogEditHandoutIds(handouts.filter((h) => h.log_id === log.id).map((h) => h.id))
  }

  const saveLogEdit = async (logId: number) => {
    setLogEditSaving(true)
    try {
      await put(`/api/logs/${logId}`, {
        homework: logEditForm.homework,
        next_class_key: logEditForm.next_class_key,
        ...(logEditImages !== null ? { images: logEditImages } : {}),
        ...(logEditHandoutIds !== null ? { handout_ids: logEditHandoutIds } : {}),
      })
      show('已保存')
      setEditingLogId(null)
      setLogEditImages(null)
      setLogEditHandoutIds(null)
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setLogEditSaving(false)
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

  // 数据重建：按类型清空该生业务数据（危险操作，二次确认后调用 /purge）
  const purge = async (kind: 'mistakes' | 'logs' | 'billing', tip: string) => {
    if (!confirm(`${tip}，删除后不可恢复，确定继续？`)) return
    try {
      await post(`/api/students/${id}/purge`, { [kind]: true })
      show('已清空')
      load()
      loadSettlements()
    } catch (e: any) {
      show(e.message || '操作失败')
    }
  }

  // 删除学生并重建：外键级联清空其全部数据（学情/错题/课时/课表/签到/登录账号），随后回学生列表新建
  const removeStudent = async () => {
    if (!student) return
    if (!confirm(`确定删除学生「${student.name}」？其学情日志、错题、课时缴费、课表、签到与学生登录账号将全部删除，不可恢复`)) return
    if (window.prompt(`请输入学生姓名「${student.name}」以确认删除：`) !== student.name) { show('姓名不匹配，已取消'); return }
    try {
      await del(`/api/students/${id}`)
      show('学生已删除，可重新新建同名学生')
      navigate('/students')
    } catch (e: any) {
      show(e.message || '删除失败')
    }
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
          {student.billing_mode === 'per_lesson' ? (
            <div className="text-right shrink-0">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">一课一结算</span>
              <div className="text-[10px] text-slate-400 num mt-1">¥{student.lesson_price || 0}/课</div>
            </div>
          ) : (
            <div className={`text-right num shrink-0 ${student.remaining_hours! <= 3 ? 'text-red-500' : 'text-primary-600'}`}>
              <div className="text-2xl font-bold leading-none">{student.remaining_hours}</div>
              <div className="text-[10px]">剩余课时{student.remaining_hours! <= 3 && ' ⚠️'}</div>
            </div>
          )}
          <button className="shrink-0 text-slate-400 hover:text-primary-600" title="编辑档案" onClick={() => navigate(`/students?edit=${id}`)}>
            <SquarePen className="w-4 h-4" />
          </button>
        </div>
        {student.note && <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">备注：{student.note}</p>}
        {/* P1 内容生产入口：分层练习 + 家长阶段报告 + 错题重做练习单 */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setShowTiered(true)}><BarChart3 className="w-4 h-4 inline-block align-[-2px]" /> 生成分层练习</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setShowReport(true)}><Mail className="w-4 h-4 inline-block align-[-2px]" /> 生成阶段报告</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={printRedo} title="把该生到期错题合成一张练习单（遮答案、留空白作答区）">
            <Printer className="w-4 h-4 inline-block align-[-2px]" /> 打印重做单{dueMistakes.length > 0 && `（${dueMistakes.length} 题）`}
          </button>
        </div>
      </div>

      {/* 子 Tab */}
      <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl p-1 text-sm">
        {([['board', '学情看板'], ['logs', '学情日志'], ['hours', '课时缴费'], ['schedule', '课表'], ['handouts', '讲义资料']] as const).map(([key, label]) => (
          <button
            key={key}
            className={`flex-1 py-2 rounded-lg font-medium ${tab === key ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* P1 弹层 */}
      {showTiered && <TieredPracticeModal student={student} mistakes={mistakes} onClose={() => setShowTiered(false)} />}
      {showReport && <ParentReportModal student={student} onClose={() => setShowReport(false)} />}

      <div className={tab !== 'board' ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start' : ''}>
        {/* 左栏：当前 Tab 内容 */}
        <div className="min-w-0">
      {/* 学情看板（移动端/选中时整栏展示） */}
      {tab === 'board' && <MasteryBoard mistakes={mistakes} />}

      {/* 讲义资料（E）：该生全部课次讲义汇总（含随日志上传 + 独立上传），学生端可下载 */}
      {tab === 'handouts' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-sm">讲义资料</h2>
            <span className="text-xs text-slate-400 num">共 {handouts.length} 份</span>
            <span className="flex-1" />
            <label className="btn-primary !px-3 !py-1.5 text-xs cursor-pointer">
              {handoutBusy || logHandoutBusy ? '上传中…' : <><Paperclip className="w-4 h-4 inline-block align-[-2px]" /> 上传讲义</>}
              <input type="file" accept={HANDOUT_ACCEPT} multiple className="hidden" disabled={handoutBusy || logHandoutBusy}
                onChange={(e) => { if (e.target.files) addHandoutFiles(e.target.files, 'standalone'); e.currentTarget.value = '' }} />
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            支持 docx / doc / pdf / pptx / ppt，一次 ≤{HANDOUT_MAX_COUNT} 个、单个 ≤{HANDOUT_MAX_MB}MB；随学情日志上传的讲义也汇总在此，学生端「讲义资料」可下载。
          </p>
          {handouts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">还没有讲义。可在此独立上传，或在「学情日志」表单里随记录上传。</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {handouts.map((h) => (
                <div key={h.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-6 h-6 rounded-md bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{handoutExtBadge(h.ext)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{h.title}</p>
                    <p className="text-[11px] text-slate-400 num">
                      {h.ext.replace('.', '').toUpperCase()} · {handoutSizeText(h.size)} · {String(h.created_at).slice(0, 10)}
                      {h.log_date ? ` · 关联课次 ${h.log_date}` : ' · 独立讲义'}
                    </p>
                  </div>
                  <button className="btn-outline !px-3 !py-1.5 text-xs shrink-0" onClick={() => downloadHandout(h)}>
                    <Download className="w-3.5 h-3.5 inline-block align-[-2px]" /> 下载
                  </button>
                  <button
                    className="text-xs text-slate-400 hover:text-red-500 shrink-0"
                    onClick={async () => {
                      if (!confirm(`确定删除讲义「${h.title}」？磁盘文件将一并删除，不可恢复`)) return
                      try { await del(`/api/handouts/${h.id}`); show('讲义已删除'); load() } catch (e: any) { show(e.message || '删除失败') }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 inline-block" /> 删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <textarea className="input" rows={3} placeholder="本节内容、学生表现…（支持 Ctrl+V 直接粘贴截图）" value={logForm.content} onChange={(e) => setLogForm({ ...logForm, content: e.target.value })} onPaste={(e) => pasteIntoLog(e, 'new')} />
            <input className="input" placeholder="下次课重点（可选，将出现在今日工作台）" value={logForm.next_class_key} onChange={(e) => setLogForm({ ...logForm, next_class_key: e.target.value })} />
            <input className="input" placeholder="下次课作业布置（可选，学生端「日志」可见；不填留空）" value={logForm.homework} onChange={(e) => setLogForm({ ...logForm, homework: e.target.value })} />
            {/* D2：图片上传（多选）+ 粘贴截图，保存时随记录写入 study_logs.images */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="btn-outline !px-3 !py-1.5 cursor-pointer">
                {logImgBusy ? '上传中…' : <><ImageIcon className="w-4 h-4 inline-block align-[-2px]" /> 添加图片</>}
                <input type="file" accept="image/*" multiple className="hidden" disabled={logImgBusy} onChange={(e) => { if (e.target.files) addLogImages(e.target.files, 'new'); e.currentTarget.value = '' }} />
              </label>
              <span className="text-slate-400">或在内容框里 Ctrl+V 粘贴截图</span>
            </div>
            {logImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {logImages.map((p, i) => (
                  <div key={p + i} className="relative">
                    <img src={p} className="h-20 rounded-lg border border-slate-200 dark:border-slate-700 object-cover cursor-zoom-in" onClick={() => setLightbox(p)} />
                    <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs" onClick={() => setLogImages((prev) => prev.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            {/* E：教学讲义（可选，随日志保存关联，学生端「讲义资料」可下载） */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="btn-outline !px-3 !py-1.5 cursor-pointer">
                <Paperclip className="w-4 h-4 inline-block align-[-2px]" /> 上传讲义
                <input type="file" accept={HANDOUT_ACCEPT} multiple className="hidden" onChange={(e) => { if (e.target.files) addHandoutFiles(e.target.files, 'new'); e.currentTarget.value = '' }} />
              </label>
              <span className="text-slate-400">docx / doc / pdf / pptx / ppt，≤{HANDOUT_MAX_COUNT} 个，单个 ≤{HANDOUT_MAX_MB}MB</span>
            </div>
            {logHandoutFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {logHandoutFiles.map((f, i) => (
                  <span key={f.name + i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px]">
                    <span className="rounded-sm bg-primary-600 text-white px-1 leading-4 text-[9px] font-bold">{handoutExtBadge('.' + (f.name.split('.').pop() || '').toLowerCase())}</span>
                    <span className="max-w-[10rem] truncate">{f.name}</span>
                    <button className="text-slate-400 hover:text-red-500" title="移除该文件" onClick={() => setLogHandoutFiles((prev) => prev.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <button className="btn-primary w-full" disabled={logSaving || logImgBusy} onClick={saveLog}>{logSaving ? '保存中…' : '保存记录'}</button>
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
                        {log.ai_generated === 1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">智能生成</span>}
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
                                onClick={() => setLightbox(p)} />
                            ))}
                          </div>
                        )
                      })()}
                      {log.ai_result && (
                        <details className="mt-2 text-xs">
                          <summary className="text-primary-600 dark:text-primary-400 cursor-pointer">查看智能分析详情</summary>
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
                          <Pin className="w-3.5 h-3.5 inline-block align-[-2px]" /> 下次课重点：<NextKeyText text={log.next_class_key} />
                        </p>
                      )}
                      {/* E：随日志上传的讲义 chips（格式角标 + 文件名，点击下载） */}
                      <div className="mt-2">
                        <HandoutChips items={handouts.filter((h) => h.log_id === log.id)} onDownload={downloadHandout} />
                      </div>
                      {/* C3：下次课作业布置（可选，学生端「日志」Tab 同步展示） */}
                      {(log.homework || editingLogId === log.id) && (
                        <div className="text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {editingLogId === log.id ? (
                            <div className="space-y-2">
                              <input className="input !text-xs" placeholder="下次课作业布置（留空 = 无作业）" value={logEditForm.homework} onChange={(e) => setLogEditForm({ ...logEditForm, homework: e.target.value })} onPaste={(e) => pasteIntoLog(e, 'edit')} />
                              <input className="input !text-xs" placeholder="下次课重点" value={logEditForm.next_class_key} onChange={(e) => setLogEditForm({ ...logEditForm, next_class_key: e.target.value })} onPaste={(e) => pasteIntoLog(e, 'edit')} />
                              {/* D2：编辑时增删图片（保存时整体替换 study_logs.images） */}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="btn-outline !px-3 !py-1.5 cursor-pointer">
                                  {logImgBusy ? '上传中…' : <><ImageIcon className="w-4 h-4 inline-block align-[-2px]" /> 添加图片</>}
                                  <input type="file" accept="image/*" multiple className="hidden" disabled={logImgBusy} onChange={(e) => { if (e.target.files) addLogImages(e.target.files, 'edit'); e.currentTarget.value = '' }} />
                                </label>
                                <span className="text-slate-400">粘贴截图到上面任一输入框也可（Ctrl+V）</span>
                              </div>
                              {(logEditImages || []).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {(logEditImages || []).map((p, i) => (
                                    <div key={p + i} className="relative">
                                      <img src={p} className="h-16 rounded-lg border border-slate-200 dark:border-slate-700 object-cover cursor-zoom-in" onClick={() => setLightbox(p)} />
                                      <button className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs" title="移除此图" onClick={() => setLogEditImages((prev) => (prev || []).filter((_, j) => j !== i))}>×</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* E：编辑时补传/移除讲义（移除仅解除关联，文件保留变独立讲义） */}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="btn-outline !px-3 !py-1.5 cursor-pointer">
                                  {logHandoutBusy ? '上传中…' : <><Paperclip className="w-4 h-4 inline-block align-[-2px]" /> 上传讲义</>}
                                  <input type="file" accept={HANDOUT_ACCEPT} multiple className="hidden" disabled={logHandoutBusy} onChange={(e) => { if (e.target.files) addHandoutFiles(e.target.files, 'edit'); e.currentTarget.value = '' }} />
                                </label>
                                <span className="text-slate-400">docx / doc / pdf / pptx / ppt</span>
                              </div>
                              {(logEditHandoutIds || []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {(logEditHandoutIds || []).map((hid) => {
                                    const h = handouts.find((x) => x.id === hid)
                                    if (!h) return null
                                    return (
                                      <span key={hid} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px]">
                                        <span className="rounded-sm bg-primary-600 text-white px-1 leading-4 text-[9px] font-bold">{handoutExtBadge(h.ext)}</span>
                                        <span className="max-w-[10rem] truncate">{h.title}</span>
                                        <button className="text-slate-400 hover:text-red-500" title="移除该讲义（解除关联，文件保留）" onClick={() => setLogEditHandoutIds((prev) => (prev || []).filter((x) => x !== hid))}>×</button>
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={logEditSaving} onClick={() => saveLogEdit(log.id)}>{logEditSaving ? '保存中…' : '保存'}</button>
                                <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => { setEditingLogId(null); setLogEditImages(null) }}>取消</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-amber-600 dark:text-amber-400">
                              <PenLine className="w-3.5 h-3.5 inline-block align-[-2px]" /> 下次课作业布置：{log.homework}
                              <button className="ml-2 text-slate-400 hover:text-primary-600 underline" onClick={() => openLogEdit(log)}>编辑</button>
                            </p>
                          )}
                        </div>
                      )}
                      {!log.homework && editingLogId !== log.id && (
                        <button className="text-[11px] text-slate-400 hover:text-primary-600 mt-2" onClick={() => openLogEdit(log)}>＋ 补填作业布置</button>
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
          {/* 一课一结算：结算记录 + 月度账单 */}
          {student.billing_mode === 'per_lesson' && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-sm">按次结算记录</h2>
                <span className="text-xs text-slate-400 num">单次 ¥{student.lesson_price || 0}/课</span>
                <span className="flex-1" />
                <input type="month" className="input num !w-36" value={settleMonth} onChange={(e) => setSettleMonth(e.target.value)} />
                <button className="btn-outline !px-3 !py-1.5 text-xs" disabled={settlements.length === 0} onClick={exportBill}>
                  <Download className="w-4 h-4 inline-block align-[-2px]" /> 导出月度账单
                </button>
              </div>
              <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 px-3 py-2 text-xs text-violet-600 dark:text-violet-300 num">
                {settleMonth} 应收合计：¥{settleTotal.toFixed(2)}（共 {settlements.length} 次课）
              </div>
              {settlements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">本月暂无结算记录（到课签到后自动按次记账）</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                  {settlements.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="num text-slate-500">{s.date}</span>
                      <span className="num font-medium">¥{s.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {student.billing_mode !== 'per_lesson' && (
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
          )}

          <div className="card p-4">
            <h2 className="font-semibold text-sm mb-3">课时包（共 {packages.length} 次，累计缴费 ¥{totalPaid.toFixed(2)}）</h2>
            {student.billing_mode === 'per_lesson' && <p className="text-[11px] text-slate-400 mb-2">该学生为「一课一结算」模式，课时包仅作历史记录，不再自动扣次。</p>}
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
                      {/* B2：教师端可见每包单价（金额/次数） */}
                      {p.hours > 0 && p.amount > 0 && <span className="text-slate-400 text-xs ml-2 num">¥{(p.amount / p.hours).toFixed(2)}/课时</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="num">¥{p.amount.toFixed(2)}</span>
                      <button
                        className="text-xs text-slate-400 hover:text-red-500"
                        onClick={async () => {
                          if (!confirm('确定删除这个课时包？剩余课时会随之减少（已上的课不受影响），删除后不可恢复')) return
                          await del(`/api/students/${id}/packages/${p.id}`)
                          show('课时包已删除')
                          load()
                        }}
                      >
                        删除
                      </button>
                    </div>
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
                    <div className="flex items-center gap-3">
                      <span className="num text-xs text-slate-400">{p.paid_at}</span>
                      <button
                        className="text-xs text-slate-400 hover:text-red-500"
                        onClick={async () => {
                          if (!confirm('确定删除这条缴费流水？仅删除记账记录，课时包不受影响')) return
                          await del(`/api/students/${id}/payments/${p.id}`)
                          show('缴费流水已删除')
                          load()
                        }}
                      >
                        删除
                      </button>
                    </div>
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

        {/* 右栏（桌面端）：学情看板 + 快捷入口（看板 Tab 选中时隐藏，避免重复） */}
        {tab !== 'board' && (
          <aside className="hidden lg:block space-y-4 min-w-0">
            <MasteryBoard mistakes={mistakes} compact />
            <div className="card p-4 space-y-2">
              <h2 className="font-semibold text-sm mb-1">快捷入口</h2>
              <Link to={`/analyze?student=${id}`} className="btn-primary !px-3 !py-1.5 text-xs w-full text-center"><Camera className="w-4 h-4 inline-block align-[-2px]" /> 给该学生拍作业分析</Link>
              <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={() => setShowTiered(true)}><BarChart3 className="w-4 h-4 inline-block align-[-2px]" /> 生成分层练习</button>
              <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={() => setShowReport(true)}><Mail className="w-4 h-4 inline-block align-[-2px]" /> 生成阶段报告</button>
              <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={() => setTab('logs')}><PenLine className="w-4 h-4 inline-block align-[-2px]" /> 记学情流水</button>
              <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={() => setTab('hours')}><Wallet className="w-4 h-4 inline-block align-[-2px]" /> 课时缴费</button>
              <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={printRedo}><Printer className="w-4 h-4 inline-block align-[-2px]" /> 打印重做单</button>
            </div>
          </aside>
        )}
      </div>

      {/* 数据管理（危险操作）：清空重录 / 删除学生重建 */}
      <details className="card p-4">
        <summary className="text-sm font-semibold text-slate-500 cursor-pointer select-none">数据管理（清空重录 / 删除学生）</summary>
        <p className="text-xs text-slate-400 mt-2">误录或想推倒重来时使用；每项都有二次确认，删除后不可恢复。建议先到「我的 → 数据备份」导出一份备份。</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn-outline !px-3 !py-1.5 text-xs !text-red-500 !border-red-200 dark:!border-red-900" disabled={mistakes.length === 0} onClick={() => purge('mistakes', `将清空该生全部错题（${mistakes.length} 道，含其变式题与重做提醒）`)}>清空错题（{mistakes.length}）</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs !text-red-500 !border-red-200 dark:!border-red-900" disabled={logs.length === 0} onClick={() => purge('logs', `将清空该生全部学情日志（${logs.length} 条，含图片记录）`)}>清空学情日志（{logs.length}）</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs !text-red-500 !border-red-200 dark:!border-red-900" disabled={packages.length === 0 && payments.length === 0} onClick={() => purge('billing', '将清空该生课时包、缴费流水、按次结算与签到记录（剩余课时归零，学生端登录将暂停）')}>清空课时与缴费</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs !text-red-600 !border-red-300 font-medium" onClick={removeStudent}>删除该学生（全部数据）</button>
        </div>
      </details>

      {/* D2：图片放大预览（点遮罩或图片关闭） */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  )
}

/** E：讲义 chips（格式角标 + 文件名，点击下载）；时间线卡片与编辑态共用 */
function HandoutChips({ items, onDownload }: { items: Handout[]; onDownload: (h: Handout) => void }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((h) => (
        <button
          key={h.id}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 hover:text-primary-600"
          title={`下载 ${h.filename}`}
          onClick={() => onDownload(h)}
        >
          <span className="rounded-sm bg-primary-600 text-white px-1 leading-4 text-[9px] font-bold">{handoutExtBadge(h.ext)}</span>
          <span className="max-w-[10rem] truncate">{h.title}</span>
          <Paperclip className="w-3 h-3" />
        </button>
      ))}
    </div>
  )
}

/** 学情看板：知识点掌握度条形图 + 30 天错题趋势 + 错因分布；支持「从教材查看」按教材小节定位 */
function MasteryBoard({ mistakes, compact = false }: { mistakes: Mistake[]; compact?: boolean }) {
  const [tbKp, setTbKp] = useState('') // 「从教材查看」选中的知识点（空 = 全部）
  const [showTbPicker, setShowTbPicker] = useState(false)
  const unmastered = mistakes.filter((m) => m.mastery_status === '未掌握').length
  const redone = mistakes.filter((m) => m.mastery_status === '已重做一次').length
  const mastered = mistakes.filter((m) => m.mastery_status === '已掌握').length
  const allAggs = aggregateKp(mistakes)
  const aggs = tbKp ? allAggs.filter((a) => a.kp === tbKp) : allAggs
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm">学情看板</h2>
        <button className="btn-outline !px-2.5 !py-1 text-[11px]" onClick={() => setShowTbPicker(true)}>
          <BookOpen className="w-3.5 h-3.5 inline-block align-[-2px]" /> 从教材查看
        </button>
      </div>
      {tbKp && (
        <button
          className="text-xs px-2.5 py-1 rounded-full bg-primary-600 text-white inline-flex items-center gap-1"
          onClick={() => setTbKp('')}
        >
          {tbKp} ✕
        </button>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 py-2">
          <div className="text-lg font-bold num text-red-500">{unmastered}</div>
          <div className="text-[11px] text-slate-400">未掌握</div>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 py-2">
          <div className="text-lg font-bold num text-amber-500">{redone}</div>
          <div className="text-[11px] text-slate-400">重做中</div>
        </div>
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 py-2">
          <div className="text-lg font-bold num text-green-600">{mastered}</div>
          <div className="text-[11px] text-slate-400">已掌握</div>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-2">知识点掌握度</h3>
        {KP_LEGEND}
        <div className="mt-2">
          <KpMasteryBars aggs={aggs} maxRows={compact ? 6 : 10} activeKp={tbKp} onClickKp={(k) => setTbKp(tbKp === k ? '' : k)} />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-1">错题趋势</h3>
        <MistakeTrend mistakes={mistakes} />
      </div>
      {!compact && <ErrorTypeBars mistakes={mistakes} />}

      {/* 「从教材查看」：按人教版章节树选知识点，定位看板 */}
      {showTbPicker && (
        <TextbookPicker
          mode="single"
          onPick={(s) => setTbKp(tbKp === s ? '' : s)}
          onClose={() => setShowTbPicker(false)}
        />
      )}
    </div>
  )
}
