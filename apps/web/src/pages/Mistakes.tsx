// 错题本：按状态/知识点分组、重做任务置顶、手动添加、掌握状态流转、举一反三、导出 PDF（打印）
// 桌面端两栏：左列表 / 右按知识点聚合（备课方向针，点击筛选）+ 导出区
import { useCallback, useEffect, useMemo, useState } from 'react'
import {BookOpen, Camera, Search, FlaskConical, FileText, CircleCheck, Pin} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { get, post, put, del } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import Katex from '@/components/Katex'
import TextbookPicker from '@/components/TextbookPicker'
import { KpChips } from '@/components/Kp'
import { aggregateKp, KpMasteryBars, KP_LEGEND } from '@/components/Charts'
import { matchScene } from '@/labs/registry'
import type { Mistake, Student, Question } from '@workbench/shared'
import { ERROR_TYPES, todayLocal } from '@workbench/shared'

const MASTERY = ['未掌握', '已重做一次', '已掌握'] as const
const STATUS_COLOR: Record<string, string> = {
  '未掌握': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  '已重做一次': 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  '已掌握': 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
}

export default function Mistakes() {
  const show = useToastStore((s) => s.show)
  const [list, setList] = useState<Mistake[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStudent, setFilterStudent] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [kpFilter, setKpFilter] = useState('') // 知识点筛选（来自右侧聚合视图点击）
  const [expanded, setExpanded] = useState<number | null>(null)
  const [variants, setVariants] = useState<Record<number, Question[]>>({})
  const [busyVariant, setBusyVariant] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showTbPicker, setShowTbPicker] = useState(false) // 「从教材选择」筛选知识点
  const today = todayLocal()

  // 手动添加表单
  const [form, setForm] = useState({
    student_id: '', stem: '', correct_solution: '', wrong_solution: '',
    error_type: '', knowledge_points: '', chapter: '', difficulty: 3,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filterStudent) qs.set('student_id', filterStudent)
      if (filterStatus) qs.set('status', filterStatus)
      const [m, s] = await Promise.all([
        get<Mistake[]>(`/api/mistakes?${qs.toString()}`),
        get<Student[]>('/api/students'),
      ])
      setList(m)
      setStudents(s)
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filterStudent, filterStatus, show])

  useEffect(() => { load() }, [load])

  // 深链支持：/mistakes?id=xx（题库「来自错题 #id」跳转）→ 自动展开该错题
  const [searchParams] = useSearchParams()
  const focusId = Number(searchParams.get('id')) || null
  useEffect(() => {
    if (focusId) setExpanded(focusId)
  }, [focusId])

  // 知识点筛选在客户端做（列表已全量加载）
  const visibleList = useMemo(
    () => (kpFilter ? list.filter((m) => kpOf(m).includes(kpFilter)) : list),
    [list, kpFilter]
  )
  const dueList = useMemo(() => visibleList.filter((m) => m.redo_due && m.redo_due <= today), [visibleList, today])
  // 全部错题 = 当前筛选下的全部（含到期重做的，到期项同时置顶展示）
  const restList = visibleList

  const redoDone = async (m: Mistake) => {
    try {
      await put(`/api/mistakes/${m.id}`, { redo_done: true })
      show('重做完成，已按艾宾浩斯安排下次重做')
      load()
    } catch (e: any) { show(e.message || '操作失败') }
  }

  const setStatus = async (m: Mistake, status: string) => {
    try {
      await put(`/api/mistakes/${m.id}`, { mastery_status: status })
      show(`已标记${status}`)
      load()
    } catch (e: any) { show(e.message || '操作失败') }
  }

  const remove = async (m: Mistake) => {
    if (!confirm('确定删除这道错题？删除后不可恢复')) return
    await del(`/api/mistakes/${m.id}`)
    show('已删除')
    load()
  }

  // 举一反三：AI 生成变式题
  const genVariants = async (m: Mistake) => {
    setBusyVariant(m.id)
    try {
      const r = await post<{ questions: Question[] }>(`/api/mistakes/${m.id}/variants`)
      setVariants((v) => ({ ...v, [m.id]: r.questions }))
      show(`已生成 ${r.questions.length} 道变式题并存入题库`)
    } catch (e: any) {
      show(e.message || '生成失败')
    } finally {
      setBusyVariant(null)
    }
  }

  const loadVariants = async (m: Mistake) => {
    if (variants[m.id]) return
    try {
      const qs = await get<Question[]>(`/api/mistakes/${m.id}/variants`)
      setVariants((v) => ({ ...v, [m.id]: qs }))
    } catch { /* 忽略 */ }
  }

  const toggle = (m: Mistake) => {
    setExpanded(expanded === m.id ? null : m.id)
    if (expanded !== m.id) loadVariants(m)
  }

  const add = async () => {
    if (!form.student_id) { show('请选择学生'); return }
    if (!form.stem.trim()) { show('请填写题干'); return }
    setSaving(true)
    try {
      await post('/api/mistakes', {
        student_id: Number(form.student_id),
        stem: form.stem,
        correct_solution: form.correct_solution,
        wrong_solution: form.wrong_solution,
        error_type: form.error_type,
        knowledge_points: form.knowledge_points.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
        chapter: form.chapter,
        difficulty: form.difficulty,
      })
      show('已添加错题')
      setShowAdd(false)
      setForm({ ...form, stem: '', correct_solution: '', wrong_solution: '', knowledge_points: '', chapter: '' })
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 导出 PDF：打开打印视图（浏览器打印为 PDF，学生版=不含正确解法）
  const exportPdf = (withAnswer: boolean) => {
    const w = window.open('', '_blank')
    if (!w) { show('浏览器拦截了弹出窗口'); return }
    const items = restList.map((m, i) => `
      <div class="q">
        <div class="no">${i + 1}. ${m.student_name} · ${JSON.parse(m.knowledge_points || '[]').join('、') || '未分类'} · 难度 ${m.difficulty}</div>
        <div class="stem">${m.stem.replace(/</g, '&lt;')}</div>
        ${m.image ? `<img src="${location.origin}${m.image}" style="max-width:100%">` : ''}
        ${withAnswer ? `<div class="ans"><b>正确解法：</b>${(m.correct_solution || '（未填写）').replace(/</g, '&lt;')}</div><div class="ans"><b>学生错误：</b>${(m.wrong_solution || '（未填写）').replace(/</g, '&lt;')}</div>` : ''}
      </div>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>错题集（${withAnswer ? '含答案' : '学生版'}）</title>
      <style>body{font-family:'Microsoft YaHei',sans-serif;max-width:800px;margin:24px auto;padding:0 16px}
      h1{text-align:center;font-size:20px}.q{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}
      .no{color:#666;font-size:12px}.stem{margin:6px 0}.ans{background:#f6f6f6;padding:8px;border-radius:6px;font-size:13px;margin-top:6px}
      @media print{.tip{display:none}}</style></head><body>
      <h1>高中物理错题集（${withAnswer ? '含答案版' : '学生版'}）</h1>
      <div class="tip" style="text-align:center;color:#999;font-size:12px">打印时选择「另存为 PDF」</div>${items || '<p style="text-align:center;color:#999">无错题</p>'}
      <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`)
    w.document.close()
  }

  const card = (m: Mistake, due: boolean) => {
    const kps = kpOf(m)
    return (
      <div key={m.id} className={`card p-4 ${due ? 'border-red-300 dark:border-red-800' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {due && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white">今日重做</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[m.mastery_status]}`}>{m.mastery_status}</span>
          <Link className="text-sm font-medium hover:text-primary-600" to={`/students/${m.student_id}`}>{m.student_name}</Link>
          {m.error_type && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">{m.error_type}</span>}
          {m.source === 'ai_analysis' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">智能抽取</span>}
          <span className="flex-1" />
          {/* 演示该知识点：固定在卡片右上角，知识点命中课件则直达 */}
          <LabLink kps={kps} />
          {m.redo_due && <span className="num text-xs text-slate-400">下次重做 {m.redo_due}</span>}
        </div>
        <div className="text-sm cursor-pointer" onClick={() => toggle(m)}>
          <Katex text={m.stem} />
          {m.image && <img src={m.image} className="mt-2 rounded-lg max-h-40 object-cover" loading="lazy" />}
        </div>
        <div className="mt-2">
          <KpChips kps={kps} />
        </div>

        {expanded === m.id && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm">
            <div><span className="text-xs text-slate-400">正确解法：</span><Katex text={m.correct_solution || '（未填写）'} /></div>
            <div><span className="text-xs text-slate-400">学生错误：</span><Katex text={m.wrong_solution || '（未填写）'} /></div>
            <div className="flex flex-wrap gap-2 pt-1">
              {m.mastery_status !== '已掌握' && (
                <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => redoDone(m)}>
                  <CircleCheck className="w-4 h-4 inline-block align-[-2px]" /> 本次重做完成{m.redo_stage + 1 < 3 ? `（${[3, 7, 15][m.redo_stage]} 天后再次）` : '（进入已掌握）'}
                </button>
              )}
              <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setStatus(m, '已掌握')}>直接标已掌握</button>
              <button className="btn-outline !px-3 !py-1.5 text-xs text-primary-600" disabled={busyVariant === m.id} onClick={() => genVariants(m)}>
                {busyVariant === m.id ? '生成中…' : <><Search className="w-4 h-4 inline-block align-[-2px]" /> 举一反三</>}
              </button>
              <button className="ml-auto text-xs text-slate-400 hover:text-red-500" onClick={() => remove(m)}>删除</button>
            </div>
            {variants[m.id]?.map((q, i) => (
              <div key={q.id ?? i} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="text-xs text-slate-400 mb-1">变式 {i + 1} · 难度 {q.difficulty} · {q.qtype} · 智能生成</div>
                <div className="text-sm"><Katex text={q.stem} /></div>
                <details className="mt-1.5 text-sm">
                  <summary className="text-xs text-primary-600 cursor-pointer">查看答案与解析</summary>
                  <p className="mt-1"><b>答案：</b><Katex text={q.answer} /></p>
                  <p className="mt-1"><b>解析：</b><Katex text={q.solution} /></p>
                  {q.pitfall && <p className="mt-1 text-amber-600 dark:text-amber-400"><b>易错点：</b><Katex text={q.pitfall} /></p>}
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const kpAggs = useMemo(() => aggregateKp(restList), [restList])

  // 右侧操作区（桌面两栏时移到这里；移动端保留头部按钮）
  const actions = (
    <>
      <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={() => exportPdf(false)}><FileText className="w-4 h-4 inline-block align-[-2px]" /> 导出学生版 PDF</button>
      <button className="btn-outline !px-3 !py-1.5 text-xs w-full" onClick={() => exportPdf(true)}><FileText className="w-4 h-4 inline-block align-[-2px]" /> 导出含答案版 PDF</button>
      <button className="btn-primary !px-3 !py-1.5 text-xs w-full" onClick={() => setShowAdd(!showAdd)}>＋ 手动添加错题</button>
      <Link to="/analyze" className="btn-primary !px-3 !py-1.5 text-xs w-full text-center"><Camera className="w-4 h-4 inline-block align-[-2px]" /> 拍照分析</Link>
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">错题本</h1>
        <span className="flex-1" />
        {/* 移动端操作入口（桌面端在右栏） */}
        <div className="flex gap-2 lg:hidden">
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => exportPdf(false)}>导出学生版</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => exportPdf(true)}>导出含答案版</button>
          <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setShowAdd(!showAdd)}>＋ 手动添加</button>
          <Link to="/analyze" className="btn-primary !px-3 !py-1.5 text-xs whitespace-nowrap"><Camera className="w-4 h-4 inline-block align-[-2px]" /> 拍照分析</Link>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        {/* 左栏：筛选 + 列表 */}
        <div className="min-w-0 space-y-4">
          {/* 筛选器 */}
          <div className="flex gap-2 flex-wrap">
            <select className="input !py-2 text-xs" value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)}>
              <option value="">全部学生</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input !py-2 text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">全部状态</option>
              {MASTERY.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="btn-outline !py-2 !px-3 text-xs" onClick={() => setShowTbPicker(true)}>
              <BookOpen className="w-4 h-4 inline-block align-[-2px]" /> 从教材选择
            </button>
            {kpFilter && (
              <button
                className="text-xs px-2.5 py-1 rounded-full bg-primary-600 text-white inline-flex items-center gap-1 self-center"
                onClick={() => setKpFilter('')}
              >
                {kpFilter} ✕
              </button>
            )}
          </div>

          {showAdd && (
            <div className="card p-4 space-y-2.5">
              <h2 className="font-semibold text-sm">＋ 手动添加错题</h2>
              <select className="input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">选择学生…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <textarea className="input" rows={2} placeholder="题干（支持 LaTeX：$F=ma$）" value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} />
              <textarea className="input" rows={2} placeholder="正确解法（可选）" value={form.correct_solution} onChange={(e) => setForm({ ...form, correct_solution: e.target.value })} />
              <textarea className="input" rows={2} placeholder="学生的错误解法（可选）" value={form.wrong_solution} onChange={(e) => setForm({ ...form, wrong_solution: e.target.value })} />
              <div className="flex gap-2">
                <select className="input !w-36" value={form.error_type} onChange={(e) => setForm({ ...form, error_type: e.target.value })}>
                  <option value="">错因（未分类）</option>
                  {ERROR_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <input type="number" min={1} max={5} className="input num !w-20" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} title="难度 1~5" />
              </div>
              <input className="input" placeholder="知识点（顿号分隔，如：牛顿第二定律、摩擦力）" value={form.knowledge_points} onChange={(e) => setForm({ ...form, knowledge_points: e.target.value })} />
              <input className="input" placeholder="章节（可选）" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
              <button className="btn-primary w-full" disabled={saving} onClick={add}>{saving ? '保存中…' : '保存（自动按 1 天后重做排期）'}</button>
            </div>
          )}

          {loading ? (
            <div className="card p-8 animate-pulse space-y-3">
              <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          ) : visibleList.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">
              {kpFilter ? `没有「${kpFilter}」的错题` : '错题本还是空的'}
              {!kpFilter && <><br /><span className="text-xs">通过「拍作业」智能分析自动生成，或在上面手动添加</span></>}
              <div className="mt-3">
                {kpFilter ? (
                  <button className="btn-outline !px-4 !py-2 text-xs" onClick={() => setKpFilter('')}>清除知识点筛选</button>
                ) : (
                  <Link to="/analyze" className="btn-primary !px-4 !py-2 text-xs"><Camera className="w-4 h-4 inline-block align-[-2px]" /> 去拍作业分析</Link>
                )}
              </div>
            </div>
          ) : (
            <>
              {dueList.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-red-500 px-1"><Pin className="w-4 h-4 inline-block align-[-2px]" /> 到期重做（{dueList.length}）</h2>
                  {dueList.map((m) => card(m, true))}
                </section>
              )}
              <section className="space-y-3">
                {/* 全部错题 = 当前筛选下全部错题（含上面置顶的到期项） */}
                <h2 className="text-sm font-semibold text-slate-500 px-1">全部错题（{restList.length}）</h2>
                {restList.map((m) => card(m, !!(m.redo_due && m.redo_due <= today)))}
              </section>
            </>
          )}
        </div>

        {/* 右栏（桌面端）：按知识点聚合 + 导出区 */}
        <aside className="hidden lg:block space-y-4 min-w-0">
          <div className="card p-4">
            <h2 className="font-semibold text-sm mb-1">按知识点聚合</h2>
            <p className="text-[11px] text-slate-400 mb-2">按错题量排序，点击知识点可筛选左侧列表 —— 备课方向针</p>
            {kpFilter && (
              <button
                className="mb-2 text-xs px-2.5 py-1 rounded-full bg-primary-600 text-white inline-flex items-center gap-1"
                onClick={() => setKpFilter('')}
              >
                {kpFilter} ✕
              </button>
            )}
            {KP_LEGEND}
            <div className="mt-3">
              <KpMasteryBars aggs={kpAggs} activeKp={kpFilter} onClickKp={(k) => setKpFilter(kpFilter === k ? '' : k)} />
            </div>
          </div>
          <div className="card p-4 space-y-2">
            <h2 className="font-semibold text-sm mb-1">导出与录入</h2>
            {actions}
          </div>
        </aside>
      </div>

      {/* 「从教材选择」筛选知识点（单选） */}
      {showTbPicker && (
        <TextbookPicker
          mode="single"
          onPick={(s) => setKpFilter(kpFilter === s ? '' : s)}
          onClose={() => setShowTbPicker(false)}
        />
      )}
    </div>
  )
}

// 错题联动：按知识点匹配物理实验室课件，匹配不到则跳课件列表
function LabLink({ kps }: { kps: string[] }) {
  const scene = matchScene(kps)
  if (scene) {
    return (
      <Link className="btn-outline !px-3 !py-1.5 text-xs text-violet-600 shrink-0" to={`/labs/${scene.id}?from=mistake`} title={`打开课件演示：${scene.title}`}>
        <FlaskConical className="w-4 h-4 inline-block align-[-2px]" /> 演示该知识点
      </Link>
    )
  }
  return (
    <Link className="btn-outline !px-3 !py-1.5 text-xs text-slate-400 shrink-0" to="/labs" title="未精确匹配到课件，去实验室挑一个相近的">
      <FlaskConical className="w-4 h-4 inline-block align-[-2px]" /> 演示（去实验室）
    </Link>
  )
}

function kpOf(m: Mistake): string[] {
  try { return JSON.parse(m.knowledge_points || '[]') as string[] } catch { return [] }
}
