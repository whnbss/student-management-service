// 题库页（P1 做实）：筛选器 + 题目卡片 + AI 出题器（含自动二审）+ 组卷器（浏览器打印导出 PDF）
// 桌面端两栏：左（筛选+题目列表）/ 右（AI 出题 + 组卷操作区）
// 组卷：按题型分大题（选择→填空→实验→计算）、组内难度升序、题号连续，可上下调换；含答案版答案集中卷尾
import { useCallback, useEffect, useMemo, useState } from 'react'
import {BookOpen, Bot, FileText, FlaskConical, Image, TriangleAlert} from 'lucide-react'
import { Link } from 'react-router-dom'
import { get, post, put, del } from '@/lib/api'
import { useAuthStore, useToastStore } from '@/stores/auth'
import { compressImage } from '@/lib/image'
import Katex from '@/components/Katex'
import QuestionFigure from '@/components/QuestionFigure'
import TextbookBrowse from '@/components/TextbookBrowse'
import TextbookPicker from '@/components/TextbookPicker'
import { printHtml, buildExamHtml, groupByQtype, DEFAULT_SCORES, QUIZ_SCORES, QTYPE_ORDER } from '@/lib/print'
import type { PaperQuestion } from '@/lib/print'
import { specToSvg } from '@/lib/figure'
import { aggregateKp } from '@/components/Charts'
import { SCENES } from '@/labs/registry'
import type { Question, Mistake, QuizDraft } from '@workbench/shared'
import { todayLocal } from '@workbench/shared'

const QTYPES = ['选择', '填空', '实验', '计算']
const GRADES = ['高一', '高二', '高三']
// C5：难度四档（替换旧 基础/高考/竞赛），与 shared QUIZ_LEVELS 区间一一对应
const LEVELS = ['基础', '中档', '稍难', '压轴'] as const
// 难度文案徽章（1 基础 / 2 较易 / 3 中档 / 4 较难 / 5 压轴）
const DIFF_LABELS = ['', '基础', '较易', '中档', '较难', '压轴']
const DIFF_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
  2: 'bg-lime-100 text-lime-600 dark:bg-lime-900/40 dark:text-lime-300',
  3: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  4: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
  5: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
}



export default function Bank() {
  const show = useToastStore((s) => s.show)
  const [list, setList] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fGrade, setFGrade] = useState('')
  const [fQtype, setFQtype] = useState('')
  const [fKp, setFKp] = useState('')
  const [fFav, setFFav] = useState(false)
  const [showFilters, setShowFilters] = useState(false) // 移动端筛选收起

  // 编辑表单（展开卡片后可改）
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ stem: '', answer: '', solution: '', pitfall: '', qtype: '计算', difficulty: 3, knowledge_points: '', figure: '' })
  const [uploadingFig, setUploadingFig] = useState(false)
  const [saving, setSaving] = useState(false)

  // 组卷：勾选的题目 id + 试卷设置（分值按题型、考试时长、大题内手动顺序）
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [showPaper, setShowPaper] = useState(false)
  const [paperTitle, setPaperTitle] = useState('高中物理练习卷')
  const [duration, setDuration] = useState(60)
  const [scoreByType, setScoreByType] = useState<Record<string, number>>({ ...DEFAULT_SCORES })
  const [secOrder, setSecOrder] = useState<Array<{ qtype: string; items: PaperQuestion[] }>>([]) // 预览中可调换的顺序（直接存题目对象）

  // AI 出题器
  const [showGen, setShowGen] = useState(false)
  const [genForm, setGenForm] = useState({ kps: '', count: 5, level: '中档' as (typeof LEVELS)[number], qtypes: ['计算'] as string[], grade: '高一' })
  // C5 同参数去重：上次生成的题干摘要（作为排除项传后端）+ 本次来自教材选择器的知识点（覆盖式管理）
  const [lastStems, setLastStems] = useState<string[]>([])
  const [pickerKps, setPickerKps] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<QuizDraft[]>([])
  // 终稿闭环：后端已自动修复/重生成，这里只展示被弃置的题（附原因），不会有「未解决」状态的草稿
  const [discarded, setDiscarded] = useState<Array<{ reason: string }>>([])
  const [draftPick, setDraftPick] = useState<Set<number>>(new Set())
  const [draftSrc, setDraftSrc] = useState<Set<number>>(new Set()) // 编辑源码模式（默认渲染预览）
  const [mistakeKps, setMistakeKps] = useState<string[]>([]) // 从错题本聚合的知识点，供一键带入
  const [allKps, setAllKps] = useState<string[]>([]) // 全库知识点（筛选器选项不随过滤缩小）
  // 「从教材选择」选择器：'gen'=出题器多选录入 / 'filter'=题库筛选单选 / null=关闭
  const [tbPicker, setTbPicker] = useState<null | 'gen' | 'filter'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q.trim()) qs.set('q', q.trim())
      if (fGrade) qs.set('grade', fGrade)
      if (fQtype) qs.set('qtype', fQtype)
      if (fKp) qs.set('kp', fKp)
      if (fFav) qs.set('favorite', '1')
      const [qs2, mk, kps] = await Promise.all([
        get<Question[]>(`/api/questions?${qs.toString()}`),
        fFav ? Promise.resolve([]) : get<Mistake[]>('/api/mistakes').catch(() => [] as Mistake[]),
        get<{ kps: string[] }>('/api/questions/kps').catch(() => ({ kps: [] })),
      ])
      setList(qs2)
      setAllKps(kps.kps)
      // 错题知识点聚合（只在首次拉取时更新，避免覆盖用户输入）
      if (!fFav) {
        const kps2 = [...aggregateKp(mk).map((a) => a.kp)]
        setMistakeKps((prev) => (prev.length === kps2.length && prev.every((k, i) => k === kps2[i]) ? prev : kps2))
      }
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [q, fGrade, fQtype, fKp, fFav, show])

  useEffect(() => { load() }, [load])

  const kpOptions = useMemo(
    () => (fKp && !allKps.includes(fKp) ? [fKp, ...allKps] : allKps),
    [allKps, fKp]
  )

  // 题干提到「如图」但无配图 → 黄条警告
  const mentionsFigure = (stem: string, figure: string | undefined | null) => /如图|如下图|见图/.test(stem) && !figure

  const toggleFav = async (item: Question) => {
    try {
      await put(`/api/questions/${item.id}`, { favorite: !item.favorite })
      setList((l) => l.map((x) => (x.id === item.id ? { ...x, favorite: !item.favorite ? 1 : 0 } : x)))
    } catch (e: any) { show(e.message || '操作失败') }
  }

  const remove = async (item: Question) => {
    if (!confirm('确定删除这道题？')) return
    await del(`/api/questions/${item.id}`)
    show('已删除')
    setPicked((p) => { const n = new Set(p); n.delete(item.id); return n })
    load()
  }

  const startEdit = (item: Question) => {
    setEditId(item.id)
    setEditForm({
      stem: item.stem, answer: item.answer, solution: item.solution, pitfall: item.pitfall,
      qtype: item.qtype, difficulty: item.difficulty, figure: item.figure || '',
      knowledge_points: (() => { try { return (JSON.parse(item.knowledge_points || '[]') as string[]).join('、') } catch { return '' } })(),
    })
  }

  // 编辑表单：上传题目配图（存 data/uploads/questions/）
  const uploadFigure = async (file: File) => {
    setUploadingFig(true)
    try {
      const blob = await compressImage(file)
      const fd = new FormData()
      fd.append('file', new File([blob], 'figure.jpg', { type: blob.type || 'image/jpeg' }))
      fd.append('folder', 'questions')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.path) throw new Error(data?.error || '图片上传失败')
      setEditForm((f) => ({ ...f, figure: JSON.stringify({ kind: 'img', data: data.path }) }))
      show('配图已上传，保存后生效')
    } catch (e: any) {
      show(e.message || '上传失败')
    } finally {
      setUploadingFig(false)
    }
  }

  const saveEdit = async () => {
    if (!editId) return
    if (!editForm.stem.trim()) { show('题干必填'); return }
    setSaving(true)
    try {
      await put(`/api/questions/${editId}`, {
        ...editForm,
        knowledge_points: editForm.knowledge_points.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
      })
      show('已保存')
      setEditId(null)
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // ---------- AI 出题器 ----------
  const generate = async () => {
    const kps = genForm.kps.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
    if (!kps.length) { show('请填写知识点（或从错题薄弱点带入）'); return }
    setGenerating(true)
    try {
      // 后端终稿闭环：二审未过的题已自动修复/重生成，列表里只有终稿与弃置记录
      // C5：同参数再次生成时把上次题干摘要作为排除项传入，后端注入 prompt 并做相似度去重
      const r = await post<{ questions: QuizDraft[]; discarded?: Array<{ reason: string }> }>('/api/quiz/generate', {
        ...genForm, kps, qtypes: genForm.qtypes,
        avoid_stems: lastStems.slice(0, 30),
      })
      // 记录本次题干摘要，供下次同参数生成时排除重复
      setLastStems(r.questions.map((d) => d.stem.replace(/\s+/g, '').slice(0, 60)).filter(Boolean))
      // 稳定排序：按固定题型顺序渲染（后端已按题型分批生成，这里再兜底排一次）
      const order = r.questions.map((_, i) => i)
      const sorted = order
        .map((i) => ({ i, d: r.questions[i] }))
        .sort((a, b) => {
          const ai = (QTYPE_ORDER as readonly string[]).indexOf(a.d.qtype)
          const bi = (QTYPE_ORDER as readonly string[]).indexOf(b.d.qtype)
          return (ai < 0 ? QTYPE_ORDER.length : ai) - (bi < 0 ? QTYPE_ORDER.length : bi) || a.i - b.i
        })
      const qs = sorted.map((x) => x.d)
      const dis = r.discarded || []
      setDrafts(qs)
      setDiscarded(dis)
      setDraftPick(new Set(qs.map((_, i) => i)))
      setDraftSrc(new Set())
      const autoFixed = qs.filter((d) => d.fix_note).length
      if (!qs.length) {
        show(`本题全部未过终审已弃置（${dis.length} 题），可换个知识点或降低难度重试`)
      } else {
        show(
          dis.length
            ? `已出 ${qs.length} 道终稿（自动修正 ${autoFixed} 道），弃置 ${dis.length} 道（原因见列表上方）`
            : autoFixed
              ? `已出 ${qs.length} 道终稿，其中 ${autoFixed} 道经二审自动修正，请确认后存入题库`
              : `已出 ${qs.length} 道终稿，全部通过二审与数值复核，请确认后存入题库`
        )
      }
    } catch (e: any) {
      show(e.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // 存入题库：figure_spec 先在前端渲染成 SVG 存入 figure；疑似重复时确认后 force 重试
  const doBulk = async (questions: any[], force: boolean) => {
    return post<{ ok: boolean; ids?: number[]; duplicates?: Array<{ index: number; id: number; stem: string }> }>(
      '/api/questions/bulk', { questions, force }
    )
  }

  const saveDrafts = async () => {
    const chosen = drafts.filter((_, i) => draftPick.has(i))
    if (!chosen.length) { show('请至少勾选一道题'); return }
    setSaving(true)
    try {
      const payload = chosen.map((d) => ({
        ...d,
        figure: d.figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg(d.figure_spec) }) : '',
      }))
      const r = await doBulk(payload, false)
      if (r && r.ok === false && r.duplicates?.length) {
        const d = r.duplicates[0]
        const more = r.duplicates.length > 1 ? ` 等 ${r.duplicates.length} 处` : ''
        if (!confirm(`第 ${d.index + 1} 题疑似与已有题目重复（题库 #${d.id}：${d.stem}…）${more}，仍要保存吗？`)) return
        const r2 = await doBulk(payload, true)
        if (!r2?.ok) { show('保存失败'); return }
        show(`已存入题库 ${chosen.length} 道题`)
      } else if (r?.ok) {
        show(`已存入题库 ${chosen.length} 道题`)
      } else {
        show('保存失败')
        return
      }
      setDrafts([])
      setDiscarded([])
      setDraftPick(new Set())
      setDraftSrc(new Set())
      setShowGen(false)
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // ---------- 组卷 ----------
  // secOrder 直接存题目对象：题库题与出题草稿都能进组卷流程（草稿 id 用负数，仅作 key）
  const pickedQuestions = useMemo(() => list.filter((x) => picked.has(x.id)), [list, picked])
  const toPaperQuestion = (q: Question | QuizDraft): PaperQuestion => ({
    id: 'id' in q ? q.id : -1,
    stem: q.stem,
    answer: q.answer,
    solution: q.solution,
    pitfall: q.pitfall,
    qtype: q.qtype,
    difficulty: q.difficulty,
    figure: (q as Question).figure || ((q as QuizDraft).figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg((q as QuizDraft).figure_spec!) }) : ''),
  })

  // 打开预览：按题型大题分组（组内难度升序）初始化顺序；分值/时长恢复通用默认
  const openPaper = () => {
    if (!pickedQuestions.length) { show('请先勾选题目'); return }
    setScoreByType({ ...DEFAULT_SCORES })
    setSecOrder(groupByQtype(pickedQuestions.map(toPaperQuestion)))
    setShowPaper(true)
  }

  // 快速组卷（出题草稿 → 组成试卷）：勾选的草稿一键带入，出题场景默认分值（选择 3/填空 4/实验 8/计算 12）、标题=知识点+日期
  const composeFromDrafts = () => {
    const chosen = drafts.filter((_, i) => draftPick.has(i))
    if (!chosen.length) { show('请先勾选要组卷的题目'); return }
    setScoreByType({ ...QUIZ_SCORES })
    setDuration(45)
    const kps = [...new Set(chosen.flatMap((d) => d.knowledge_points))].slice(0, 2).join('、')
    setPaperTitle(`${kps || '物理'} 练习卷 ${todayLocal().slice(5).replace('-', '/')}`)
    setSecOrder(groupByQtype(chosen.map(toPaperQuestion)))
    setShowPaper(true)
  }

  // 大题内上移/下移
  const moveItem = (qtype: string, id: number, dir: -1 | 1) => {
    setSecOrder((secs) => secs.map((s) => {
      if (s.qtype !== qtype) return s
      const i = s.items.findIndex((x) => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.items.length) return s
      const items = [...s.items]
      ;[items[i], items[j]] = [items[j], items[i]]
      return { ...s, items }
    }))
  }

  // 平铺（含连续题号）
  const flatOrdered = useMemo(() => secOrder.flatMap((s) => s.items), [secOrder])

  const scoreOf = (qq: PaperQuestion) => Math.max(1, scoreByType[qq.qtype] ?? DEFAULT_SCORES[qq.qtype] ?? 5)

  const printPaper = (withAnswer: boolean) => {
    if (!flatOrdered.length) { show('请先勾选题目'); return }
    const { header, body } = buildExamHtml({
      title: paperTitle,
      duration,
      questions: flatOrdered,
      sections: secOrder,
      scoreOf,
      withAnswer,
    })
    if (!printHtml(paperTitle + (withAnswer ? '（含答案）' : '（学生版）'), header + body)) show('浏览器拦截了弹出窗口')
  }

  const togglePick = (id: number) => {
    setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const diffBadge = (d: number) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${DIFF_COLORS[d] || DIFF_COLORS[3]}`}>{d} {DIFF_LABELS[d] || ''}</span>
  )

  const card = (item: Question) => {
    let kps: string[] = []
    try { kps = JSON.parse(item.knowledge_points || '[]') as string[] } catch { /* 忽略 */ }
    return (
      <div key={item.id} className={`card p-4 ${picked.has(item.id) ? 'ring-1 ring-primary-400' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <button
            className={`text-lg leading-none ${item.favorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
            title={item.favorite ? '取消收藏' : '收藏'}
            onClick={() => toggleFav(item)}
          >
            {item.favorite ? '★' : '☆'}
          </button>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">{item.qtype}</span>
          {diffBadge(item.difficulty)}
          {/* 来源追踪：举一反三 → 来自错题 #id 可跳转；出题器 → AI 出题 */}
          {item.mistake_id && (
            <Link
              to={`/mistakes?id=${item.mistake_id}`}
              className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 hover:underline"
              title="查看来源错题"
            >
              来自错题 #{item.mistake_id}
            </Link>
          )}
          {!item.mistake_id && item.source === 'ai_generated' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">智能出题</span>
          )}
          {item.grade && <span className="text-xs text-slate-400">{item.grade}</span>}
          <span className="flex-1" />
          <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={picked.has(item.id)} onChange={() => togglePick(item.id)} />组卷
          </label>
        </div>
        <div className="text-sm cursor-pointer" onClick={() => (editId === item.id ? setEditId(null) : startEdit(item))}>
          <Katex text={item.stem} />
        </div>
        {mentionsFigure(item.stem, item.figure) && (
          <div className="mt-1.5 text-[11px] px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="w-4 h-4 inline-block align-[-2px]" /> 本题提到「如图」但无配图，建议编辑时上传图片或补充文字描述
          </div>
        )}
        <QuestionFigure figure={item.figure} />
        {kps.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {kps.map((k) => (
              <button
                key={k}
                className={`text-[11px] px-2 py-0.5 rounded-full ${fKp === k ? 'bg-primary-600 text-white' : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300'}`}
                onClick={() => setFKp(fKp === k ? '' : k)}
              >
                {k}
              </button>
            ))}
          </div>
        )}
        {editId === item.id && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm">
            <textarea className="input" rows={3} value={editForm.stem} onChange={(e) => setEditForm({ ...editForm, stem: e.target.value })} placeholder="题干（支持 LaTeX）" />
            <QuestionFigure figure={editForm.figure} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="btn-outline !px-3 !py-1.5 cursor-pointer">
                {uploadingFig ? '上传中…' : <><Image className="w-4 h-4 inline-block align-[-2px]" /> 上传配图</>}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingFig} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFigure(f); e.currentTarget.value = '' }} />
              </label>
              {editForm.figure && (
                <button className="text-slate-400 hover:text-red-500" onClick={() => setEditForm({ ...editForm, figure: '' })}>移除配图</button>
              )}
            </div>
            <textarea className="input" rows={2} value={editForm.answer} onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })} placeholder="答案" />
            <textarea className="input" rows={3} value={editForm.solution} onChange={(e) => setEditForm({ ...editForm, solution: e.target.value })} placeholder="解析" />
            <textarea className="input" rows={1} value={editForm.pitfall} onChange={(e) => setEditForm({ ...editForm, pitfall: e.target.value })} placeholder="易错点提示" />
            <div className="flex flex-wrap gap-2">
              <select className="input !w-24" value={editForm.qtype} onChange={(e) => setEditForm({ ...editForm, qtype: e.target.value })}>
                {QTYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input type="number" min={1} max={5} className="input num !w-20" value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: Number(e.target.value) })} title="难度 1~5" />
              <input className="input flex-1 min-w-40" value={editForm.knowledge_points} onChange={(e) => setEditForm({ ...editForm, knowledge_points: e.target.value })} placeholder="知识点（顿号分隔）" />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={saving} onClick={saveEdit}>保存修改</button>
              <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setEditId(null)}>取消</button>
              <button className="ml-auto text-xs text-slate-400 hover:text-red-500" onClick={() => remove(item)}>删除</button>
            </div>
          </div>
        )}
        {editId !== item.id && (item.answer || item.solution) && (
          <details className="mt-2 text-sm">
            <summary className="text-xs text-primary-600 cursor-pointer">查看答案与解析</summary>
            <p className="mt-1.5"><b>答案：</b><Katex text={item.answer || '（未填写）'} /></p>
            <p className="mt-1"><b>解析：</b><Katex text={item.solution || '（未填写）'} /></p>
            {item.pitfall && <p className="mt-1 text-amber-600 dark:text-amber-400"><b>易错点：</b><Katex text={item.pitfall} /></p>}
          </details>
        )}
      </div>
    )
  }

  // 草稿卡：终稿直接展示答案与解析（无需展开验证），自动修正过的题带修正说明
  const draftCard = (d: QuizDraft, i: number) => {
    const figSvg = d.figure_spec ? specToSvg(d.figure_spec) : ''
    const isSrc = draftSrc.has(i)
    return (
      <div key={i} className={`rounded-xl p-3 space-y-1.5 ${draftPick.has(i) ? 'bg-slate-50 dark:bg-slate-800/60' : 'bg-slate-100/50 dark:bg-slate-800/20 opacity-50'}`}>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer flex-wrap">
          <input type="checkbox" checked={draftPick.has(i)} onChange={() => setDraftPick((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })} />
          第 {i + 1} 题 · {d.qtype} · {diffBadge(d.difficulty)}
          {d.fix_note && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" title={d.fix_note}>已自动修正</span>
          )}
          <span className="flex-1" />
          <button className="text-primary-600 hover:underline" onClick={() => setDraftSrc((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })}>
            {isSrc ? '渲染预览' : '编辑源码'}
          </button>
        </label>
        {isSrc ? (
          <>
            <textarea className="input text-xs" rows={3} value={d.stem} onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, stem: e.target.value } : x)))} />
            <textarea className="input text-xs" rows={2} value={d.answer} onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} placeholder="答案" />
            <textarea className="input text-xs" rows={2} value={d.solution} onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, solution: e.target.value } : x)))} placeholder="解析" />
          </>
        ) : (
          <>
            <div className="text-sm"><Katex text={d.stem} /></div>
            {figSvg && <QuestionFigure figure={JSON.stringify({ kind: 'svg', data: figSvg })} />}
            <div className="text-xs space-y-1 border-t border-slate-100 dark:border-slate-700 pt-1.5">
              <p><b>答案：</b><Katex text={d.answer || '（无）'} /></p>
              <p><b>解析：</b><Katex text={d.solution || '（无）'} /></p>
              {d.pitfall && <p className="text-amber-600 dark:text-amber-400"><b>易错点：</b><Katex text={d.pitfall} /></p>}
              {d.fix_note && (
                <details className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  <summary className="cursor-pointer">修正原因</summary>
                  <div className="mt-0.5">{d.fix_note}</div>
                </details>
              )}
            </div>
          </>
        )}
        {mentionsFigure(d.stem, figSvg) && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400"><TriangleAlert className="w-4 h-4 inline-block align-[-2px]" /> 本题提到「如图」但无配图，确认前建议补图或改写题干</div>
        )}
        <input className="input text-xs" value={d.knowledge_points.join('、')} onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, knowledge_points: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) } : x)))} placeholder="知识点（顿号分隔）" />
      </div>
    )
  }

  // 出题表单 + 草稿区（桌面右栏与移动端共用）
  const genPanel = (
    <div className="card p-4 space-y-2.5">
      <h2 className="font-semibold text-sm"><Bot className="w-4 h-4 inline-block align-[-2px]" /> 智能出题库</h2>
      <div className="flex flex-wrap gap-1">
        <span className="text-[11px] text-slate-400 w-full">从错题薄弱点带入：</span>
        {mistakeKps.slice(0, 8).map((k) => (
          <button
            key={k}
            className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 hover:bg-primary-100"
            onClick={() => {
              const cur = genForm.kps.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
              if (!cur.includes(k)) setGenForm({ ...genForm, kps: [...cur, k].join('、') })
            }}
          >
            +{k}
          </button>
        ))}
        {mistakeKps.length === 0 && <span className="text-[11px] text-slate-300">暂无错题知识点</span>}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1 min-w-0" placeholder="知识点（顿号分隔，如：牛顿第二定律、摩擦力）" value={genForm.kps} onChange={(e) => setGenForm({ ...genForm, kps: e.target.value })} />
        <button className="btn-outline !px-3 !py-1.5 text-xs shrink-0" onClick={() => setTbPicker('gen')}>
          <BookOpen className="w-4 h-4 inline-block align-[-2px]" /> 从教材选择
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="input !w-24" value={genForm.grade} onChange={(e) => setGenForm({ ...genForm, grade: e.target.value })}>
          {GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select className="input !w-24" value={genForm.count} onChange={(e) => setGenForm({ ...genForm, count: Number(e.target.value) })}>
          {[5, 10, 20].map((n) => <option key={n} value={n}>{n} 题</option>)}
        </select>
        <select className="input !w-24" value={genForm.level} onChange={(e) => setGenForm({ ...genForm, level: e.target.value as any })}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {QTYPES.map((t) => (
          <label key={t} className="flex items-center gap-1 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={genForm.qtypes.includes(t)}
              onChange={() => setGenForm({ ...genForm, qtypes: genForm.qtypes.includes(t) ? genForm.qtypes.filter((x) => x !== t) : [...genForm.qtypes, t] })}
            />
            {t}
          </label>
        ))}
      </div>
      <button className="btn-primary w-full" disabled={generating} onClick={generate}>{generating ? '生成中…（生成 + 二审 + 自动修复闭环，约需 1~3 分钟）' : '开始生成'}</button>
      <p className="text-[11px] text-slate-400">结果为终稿（自动二审 + 数值复核 + 答案解析一致性校验，未过的题已自动修复或弃置），确认后存入题库（带智能生成标记）</p>

      {drafts.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center">
            <h3 className="text-sm font-semibold">终稿确认（{draftPick.size}/{drafts.length}）</h3>
            <span className="flex-1" />
            <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => { setDrafts([]); setDiscarded([]); setDraftPick(new Set()); setDraftSrc(new Set()) }}>丢弃</button>
          </div>
          {discarded.length > 0 && (
            <details className="text-[11px] rounded-lg bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 text-rose-600 dark:text-rose-300">
              <summary className="cursor-pointer"><TriangleAlert className="w-4 h-4 inline-block align-[-2px]" /> 已弃置 {discarded.length} 道未过终审的题（点开看原因）</summary>
              <div className="mt-1 space-y-0.5">
                {discarded.map((d, k) => <div key={k}>{d.reason}</div>)}
              </div>
            </details>
          )}
          {drafts.map((d, i) => draftCard(d, i))}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={saving || draftPick.size === 0} onClick={saveDrafts}>
              存入题库（{draftPick.size} 题）
            </button>
            <button className="btn-outline flex-1 text-primary-600" disabled={draftPick.size === 0} onClick={composeFromDrafts} title="把勾选的草稿直接带入组卷器（按题型分组、默认分值）">
              <FileText className="w-4 h-4 inline-block align-[-2px]" /> 组成试卷
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // 组卷预览浮层（大题分组 + 上下调换 + 按题型分值 + 考试时长）
  const presentTypes = secOrder.map((s) => s.qtype)
  const paperModal = showPaper && (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setShowPaper(false)}>
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold">组卷预览（{flatOrdered.length} 题）</h2>
        <input className="input" value={paperTitle} onChange={(e) => setPaperTitle(e.target.value)} placeholder="试卷标题" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 shrink-0">考试时长</span>
          <input type="number" min={10} max={180} className="input num !w-20" value={duration} onChange={(e) => setDuration(Math.max(10, Number(e.target.value) || 60))} />
          <span className="text-slate-400">分钟</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">分值</span>
          {presentTypes.map((t) => (
            <label key={t} className="flex items-center gap-1 text-xs">
              {t}
              <input
                type="number" min={1} max={50}
                className="input num !w-16 !py-1"
                value={scoreByType[t] ?? DEFAULT_SCORES[t] ?? 5}
                onChange={(e) => setScoreByType({ ...scoreByType, [t]: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
          ))}
          <span className="text-slate-400 num">满分 {flatOrdered.reduce((s, x) => s + scoreOf(x), 0)} 分</span>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {secOrder.map((sec, si) => {
            const scoreSum = sec.items.reduce((s, qq) => s + scoreOf(qq), 0)
            return (
              <div key={sec.qtype} className="space-y-1">
                <div className="text-xs font-semibold text-slate-500">
                  {'一二三四五六'[si] || si + 1}、{sec.qtype}题（共 {sec.items.length} 题，{scoreSum} 分）· 组内按难度升序
                </div>
                {sec.items.map((item, ii) => (
                  <div key={item.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-sm">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                      <span>{item.qtype} · 难度 {item.difficulty} · {scoreOf(item)} 分</span>
                      <span className="flex-1" />
                      <button className="px-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30" disabled={ii === 0} onClick={() => moveItem(sec.qtype, item.id, -1)} title="上移">↑</button>
                      <button className="px-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30" disabled={ii === sec.items.length - 1} onClick={() => moveItem(sec.qtype, item.id, 1)} title="下移">↓</button>
                    </div>
                    <Katex text={item.stem} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 pt-1">
          <button className="btn-outline flex-1" onClick={() => printPaper(false)}>打印学生版 PDF</button>
          <button className="btn-primary flex-1" onClick={() => printPaper(true)}>打印含答案版 PDF</button>
        </div>
      </div>
    </div>
  )

  // 筛选行（移动端可收起）
  const filterRow = (
    <div className={`${showFilters ? '' : 'hidden sm:flex'} flex-wrap gap-2 sm:flex`}>
      <input className="input !w-44 flex-1 min-w-36" placeholder="搜索题干/答案/解析/知识点…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="input !py-2 text-xs !w-24" value={fGrade} onChange={(e) => setFGrade(e.target.value)}>
        <option value="">全部年级</option>
        {GRADES.map((g) => <option key={g}>{g}</option>)}
      </select>
      <select className="input !py-2 text-xs !w-24" value={fQtype} onChange={(e) => setFQtype(e.target.value)}>
        <option value="">全部题型</option>
        {QTYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
      {kpOptions.length > 0 && (
        <select className="input !py-2 text-xs !w-32" value={fKp} onChange={(e) => setFKp(e.target.value)}>
          <option value="">全部知识点</option>
          {kpOptions.map((k) => <option key={k}>{k}</option>)}
        </select>
      )}
      <button className="btn-outline !py-2 !px-3 text-xs" onClick={() => setTbPicker('filter')}>
        <BookOpen className="w-4 h-4 inline-block align-[-2px]" /> 从教材选择
      </button>
      <label className="flex items-center gap-1 text-xs cursor-pointer select-none px-2">
        <input type="checkbox" checked={fFav} onChange={() => setFFav(!fFav)} />只看收藏
      </label>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">题库</h1>
        <span className="flex-1" />
        {/* 移动端入口 */}
        <button className="btn-outline !px-3 !py-1.5 text-xs sm:hidden" onClick={() => setShowFilters(!showFilters)}>筛选</button>
        <button className="btn-primary !px-3 !py-1.5 text-xs lg:hidden" onClick={() => setShowGen(!showGen)}><Bot className="w-4 h-4 inline-block align-[-2px]" /> 智能出题</button>
      </div>

      {/* 教材目录浏览卡（可当知识地图用） */}
      <TextbookBrowse onPickSection={(s) => setFKp(fKp === s ? '' : s)} />

      <Link to="/labs" className="card p-4 flex items-center gap-3 hover:border-primary-300 dark:hover:border-primary-700 transition-colors block">
        <FlaskConical className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">物理实验室 · 交互课件</div>
          <p className="text-xs text-slate-500 mt-0.5">{SCENES.length} 个可拖拽课件，课堂投屏实时演示</p>
        </div>
        <span className="text-primary-400">→</span>
      </Link>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        {/* 左栏：筛选 + 题目列表 */}
        <div className="min-w-0 space-y-4">
          {filterRow}

          {loading ? (
            <div className="card p-8 animate-pulse space-y-3">
              <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
          ) : list.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">
              题库还是空的
              <br /><span className="text-xs">用右侧「智能出题库」生成，或从错题本「举一反三」补充</span>
              <div className="mt-3 lg:hidden">
                <button className="btn-primary !px-4 !py-2 text-xs" onClick={() => setShowGen(true)}><Bot className="w-4 h-4 inline-block align-[-2px]" /> 智能出题</button>
              </div>
            </div>
          ) : (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 px-1">题目（{list.length}）</h2>
              {list.map(card)}
            </section>
          )}
        </div>

        {/* 右栏（桌面端）：AI 出题器 + 组卷区 */}
        <aside className="hidden lg:block space-y-4 min-w-0">
          {genPanel}
          <div className="card p-4 space-y-2">
            <h2 className="font-semibold text-sm mb-1">组卷</h2>
            <p className="text-[11px] text-slate-400">在左侧勾选题目（已选 {picked.size}），按题型分大题生成可打印试卷</p>
            <button className="btn-primary !px-3 !py-1.5 text-xs w-full" disabled={picked.size === 0} onClick={openPaper}>
              <FileText className="w-4 h-4 inline-block align-[-2px]" /> 组卷预览（{picked.size}）
            </button>
          </div>
        </aside>
      </div>

      {/* 移动端：出题面板抽屉 + 组卷浮动条 */}
      {showGen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end lg:hidden" onClick={() => setShowGen(false)}>
          <div className="bg-white dark:bg-slate-900 w-full rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {genPanel}
          </div>
        </div>
      )}
      {picked.size > 0 && !showPaper && (
        <div className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <button className="btn-primary shadow-lg !px-5 !py-3 rounded-full" onClick={openPaper}><FileText className="w-4 h-4 inline-block align-[-2px]" /> 组卷（{picked.size}）</button>
        </div>
      )}
      {paperModal}

      {/* 「从教材选择」级联选择器（出题器多选录入 / 题库筛选单选） */}
      {tbPicker === 'gen' && (
        <TextbookPicker
          mode="multi"
          initial={pickerKps}
          onConfirm={(picked) => {
            // C5：以本次选择结果「覆盖」教材来源知识点；手动输入/从错题带入的项保留
            const cur = genForm.kps.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
            const manual = cur.filter((k) => !pickerKps.includes(k))
            const merged = [...new Set([...manual, ...picked])]
            setPickerKps([...picked])
            setGenForm((f) => ({ ...f, kps: merged.join('、') }))
            show(`已带入 ${picked.length} 个教材知识点（覆盖上次教材选择，手动输入保留）`)
          }}
          onClose={() => setTbPicker(null)}
        />
      )}
      {tbPicker === 'filter' && (
        <TextbookPicker
          mode="single"
          onPick={(s) => setFKp(fKp === s ? '' : s)}
          onClose={() => setTbPicker(null)}
        />
      )}
    </div>
  )
}
