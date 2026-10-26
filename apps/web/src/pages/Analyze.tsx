// 拍批流程（产品灵魂）：拍照/相册 → 压缩上传 → AI 分析（骨架屏+进度文案）→ 结果编辑逐项确认 → 保存入库
// 流程状态存于全局 store（stores/analyze.ts）：切到其它页面再回来仍停留在上次的分析界面，不丢结果
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import { useAnalyzeStore } from '@/stores/analyze'
import Katex from '@/components/Katex'
import type { Student } from '@workbench/shared'
import { ERROR_TYPES } from '@workbench/shared'

const VERDICTS = ['对', '错', '部分对', '未作答', '无法识别']
const VERDICT_COLOR: Record<string, string> = {
  '对': 'text-green-600 dark:text-green-400',
  '错': 'text-red-500',
  '部分对': 'text-amber-500',
  '未作答': 'text-slate-400',
  '无法识别': 'text-slate-400',
}

export default function Analyze() {
  const navigate = useNavigate()
  const show = useToastStore((s) => s.show)

  // 流程状态全部来自全局 store，页面只是视图
  const step = useAnalyzeStore((s) => s.step)
  const studentId = useAnalyzeStore((s) => s.studentId)
  const files = useAnalyzeStore((s) => s.files)
  const previews = useAnalyzeStore((s) => s.previews)
  const progress = useAnalyzeStore((s) => s.progress)
  const draft = useAnalyzeStore((s) => s.draft)
  const uploadedPaths = useAnalyzeStore((s) => s.uploadedPaths)
  const aiNote = useAnalyzeStore((s) => s.aiNote)
  const mistakeChecked = useAnalyzeStore((s) => s.mistakeChecked)
  const logType = useAnalyzeStore((s) => s.logType)
  const nextKey = useAnalyzeStore((s) => s.nextKey)
  const setStudentId = useAnalyzeStore((s) => s.setStudentId)
  const addFiles = useAnalyzeStore((s) => s.addFiles)
  const removeFile = useAnalyzeStore((s) => s.removeFile)
  const setDraft = useAnalyzeStore((s) => s.setDraft)
  const setMistakeChecked = useAnalyzeStore((s) => s.setMistakeChecked)
  const setLogType = useAnalyzeStore((s) => s.setLogType)
  const setNextKey = useAnalyzeStore((s) => s.setNextKey)
  const start = useAnalyzeStore((s) => s.start)
  const save = useAnalyzeStore((s) => s.save)

  // 仅本页的临时 UI 状态
  const [students, setStudents] = useState<Student[]>([])
  const [editing, setEditing] = useState(false) // 是否进入编辑模式
  const [viewIdx, setViewIdx] = useState<number | null>(null) // 全屏看图
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    get<Student[]>('/api/students').then(setStudents).catch((e) => show(e.message || '加载失败'))
  }, [show])

  const pick = (fl: FileList | null) => {
    if (!fl?.length) return
    addFiles(Array.from(fl).filter((f) => f.type.startsWith('image/')))
  }

  const updItem = (idx: number, patch: Partial<NonNullable<typeof draft>['items'][0]>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : d))

  const student = students.find((s) => s.id === studentId)

  // ---------- 步骤 1：选学生 + 拍照 ----------
  if (step === 'pick') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">拍作业</h1>
        <div className="card p-4 space-y-3">
          <label className="label">选择学生</label>
          <select className="input" value={studentId ?? ''} onChange={(e) => setStudentId(Number(e.target.value) || null)}>
            <option value="">请选择…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}（{s.grade || '未设年级'}）</option>
            ))}
          </select>
          <p className="text-xs text-slate-400">尚未建档？先到「学生」页新增。</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="btn-primary !py-6 text-base" onClick={() => cameraRef.current?.click()}>📷 拍照</button>
          <button className="btn-outline !py-6 text-base" onClick={() => albumRef.current?.click()}>🖼️ 相册多选</button>
        </div>
        {/* HTTP 局域网下不能依赖 getUserMedia，用系统相机 input capture */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        <input ref={albumRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />

        {previews.length > 0 && (
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2">已选 {previews.length} 张（最多 9 张）</h2>
            <div className="grid grid-cols-3 gap-2">
              {previews.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={p} className="w-full h-full object-cover" onClick={() => setViewIdx(i)} />
                  <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs" onClick={() => removeFile(i)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn-primary w-full mt-4" onClick={start}>开始 AI 分析</button>
          </div>
        )}

        {viewIdx !== null && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setViewIdx(null)}>
            <img src={previews[viewIdx]} className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    )
  }

  // ---------- 步骤 2/3：上传与 AI 分析进度（切走再回来也能看到最新进度） ----------
  if (step === 'uploading' || step === 'analyzing') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">AI 分析中</h1>
        <div className="card p-5">
          <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">{progress}</p>
          <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className={`h-full bg-primary-500 rounded-full transition-all ${step === 'analyzing' ? 'w-2/3 animate-pulse' : 'w-1/3'}`} />
          </div>
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">作业图片将传输至 AI 供应商服务器进行分析，数据本身仅存本机。可先切到其它页面，分析完成后回到本页查看结果。</p>
        </div>
      </div>
    )
  }

  // ---------- 步骤 4：结果编辑页逐项确认 ----------
  if (step === 'review' && draft) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold">分析结果确认</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {aiNote} · AI 输出为初稿，请逐项核对后保存
            {student && <> · 学生：<span className="text-slate-500">{student.name}</span></>}
          </p>
        </div>

        <div className="flex gap-2">
          <button className={`btn-outline !px-3 !py-1.5 text-xs ${!editing ? 'opacity-50' : ''}`} onClick={() => setEditing(false)}>查看</button>
          <button className={`btn-outline !px-3 !py-1.5 text-xs ${editing ? 'opacity-50' : ''}`} onClick={() => setEditing(true)}>编辑</button>
          <span className="flex-1" />
          {uploadedPaths.length > 0 && (
            <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setViewIdx(0)}>查看原图</button>
          )}
        </div>

        {/* 逐题判定 */}
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold text-sm">逐题判定（{draft.items.length} 题 · 预估 {draft.paper_meta.score_estimate} 分）</h2>
          {draft.items.length === 0 && <p className="text-sm text-slate-400">未识别到题目</p>}
          {draft.items.map((it, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="num font-semibold">第 {it.no} 题</span>
                {editing ? (
                  <select className="input !w-auto !py-1 !px-2 text-xs" value={it.verdict} onChange={(e) => updItem(idx, { verdict: e.target.value as any })}>
                    {VERDICTS.map((v) => <option key={v}>{v}</option>)}
                  </select>
                ) : (
                  <span className={`text-sm font-medium ${VERDICT_COLOR[it.verdict] || ''}`}>{it.verdict}</span>
                )}
                {(it.verdict === '错' || it.verdict === '部分对') && (
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={mistakeChecked[it.no] ?? true}
                      onChange={(e) => setMistakeChecked({ ...mistakeChecked, [it.no]: e.target.checked })}
                    />
                    存入错题本
                  </label>
                )}
              </div>
              {editing ? (
                <>
                  <div className="flex gap-2 flex-wrap">
                    <select className="input !w-auto !py-1 !px-2 text-xs" value={it.error_type} onChange={(e) => updItem(idx, { error_type: e.target.value as any })}>
                      <option value="">错因（无）</option>
                      {ERROR_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <input className="input flex-1 !py-1 !px-2 text-xs" placeholder="知识点（逗号分隔）" value={it.knowledge_points.join('、')} onChange={(e) => updItem(idx, { knowledge_points: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })} />
                  </div>
                  <textarea className="input !text-xs" rows={2} placeholder="错误步骤定位" value={it.error_step} onChange={(e) => updItem(idx, { error_step: e.target.value })} />
                  <textarea className="input !text-xs" rows={2} placeholder="评语" value={it.comment} onChange={(e) => updItem(idx, { comment: e.target.value })} />
                </>
              ) : (
                <>
                  {it.error_step && <p className="text-xs text-slate-500">错误步骤：{it.error_step}</p>}
                  {it.error_type && <p className="text-xs"><span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500">{it.error_type}</span></p>}
                  {it.knowledge_points.length > 0 && (
                    <p className="text-xs text-slate-400">知识点：{it.knowledge_points.join('、')}</p>
                  )}
                  {it.comment && <p className="text-sm"><Katex text={it.comment} /></p>}
                </>
              )}
            </div>
          ))}
        </section>

        {/* 薄弱点 */}
        <section className="card p-4 space-y-2">
          <h2 className="font-semibold text-sm">薄弱点</h2>
          {draft.weak_points.length === 0 && <p className="text-sm text-slate-400">未发现明显薄弱点</p>}
          {draft.weak_points.map((w, i) => (
            <div key={i} className="text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs mr-2 ${
                w.severity === '高' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                : w.severity === '中' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-slate-200 text-slate-500'
              }`}>{w.severity}</span>
              <Katex text={w.point} className="font-medium" />
              {w.evidence && <p className="text-xs text-slate-400 mt-0.5 ml-1">依据：{w.evidence}</p>}
            </div>
          ))}
        </section>

        {/* 下次课提问建议 */}
        {draft.next_class_questions.length > 0 && (
          <section className="card p-4 space-y-1.5">
            <h2 className="font-semibold text-sm">下次课提问建议</h2>
            {draft.next_class_questions.map((q, i) => (
              <p key={i} className="text-sm text-slate-600 dark:text-slate-300">{i + 1}. <Katex text={q} /></p>
            ))}
          </section>
        )}

        {/* 练习方向建议 */}
        {draft.suggestions.length > 0 && (
          <section className="card p-4 space-y-1.5">
            <h2 className="font-semibold text-sm">练习方向建议</h2>
            {draft.suggestions.map((s, i) => (
              <p key={i} className="text-sm text-slate-600 dark:text-slate-300">{i + 1}. <Katex text={s} /></p>
            ))}
          </section>
        )}

        {/* 识别不清警示 */}
        {draft.unrecognized.length > 0 && (
          <section className="card p-4 border-amber-300 dark:border-amber-700">
            <h2 className="font-semibold text-sm text-amber-600 dark:text-amber-400">⚠️ 以下内容识别不清（严禁编造，已标注待确认）</h2>
            {draft.unrecognized.map((u, i) => <p key={i} className="text-sm text-slate-500 mt-1">{u}</p>)}
          </section>
        )}

        {/* 总评 */}
        <section className="card p-4">
          <h2 className="font-semibold text-sm mb-1">总评</h2>
          <p className="text-sm"><Katex text={draft.overall_comment} /></p>
        </section>

        {/* 保存表单 */}
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-sm">保存为学情记录</h2>
          <div className="flex gap-2">
            <select className="input !w-28" value={logType} onChange={(e) => setLogType(e.target.value)}>
              {['上课', '作业', '考试', '其他'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="input flex-1" placeholder="下次课重点（将出现在今日工作台）" value={nextKey} onChange={(e) => setNextKey(e.target.value)} />
          </div>
          <p className="text-xs text-slate-400">
            将保存 {uploadedPaths.length} 张图片；勾选的错题（{Object.values(mistakeChecked).filter(Boolean).length} 道）自动进入错题本并按 1/3/7/15 天生成重做计划。
          </p>
          <button className="btn-primary w-full" onClick={() => save(() => navigate(`/students/${studentId}`))}>确认保存</button>
        </div>

        {viewIdx !== null && uploadedPaths[viewIdx] && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setViewIdx(null)}>
            <img src={uploadedPaths[viewIdx]} className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    )
  }

  // ---------- 步骤 5：保存中 ----------
  if (step === 'saving') {
    return (
      <div className="card p-10 text-center">
        <div className="animate-pulse text-sm text-slate-500">正在保存学情记录与错题…</div>
      </div>
    )
  }

  return null
}
