// B5 智能教案：上传学生错题试卷照片（多张）→ AI 逐题诊断 → 生成结构化错题讲义
// 支持查看历史 / 删除 / 重新生成 / 浏览器打印 PDF（结构严格模仿《高三物理错题讲义》示例）
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Printer, RefreshCw, Trash2, Sparkles } from 'lucide-react'
import { get, post, del } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import { uploadImage } from '@/lib/image'
import { useAuthStore } from '@/stores/auth'
import Katex from '@/components/Katex'
import { texToMathml } from '@/lib/tex'
import type { Student } from '@workbench/shared'
import { todayLocal } from '@workbench/shared'
import type { LessonPlan, LessonDiagnosis } from '@workbench/shared'

interface PlanRow {
  id: number
  student_id: number
  student_name: string
  exam_name: string
  created_at: string
  plan_summary?: { title?: string; subtitle?: string } | null
}

// 浅渲染：文本中的 LaTeX 走 Katex，换行保留
function T({ text }: { text: string }) {
  if (!text) return null
  return <div className="whitespace-pre-wrap leading-relaxed"><Katex text={text} /></div>
}

export default function LessonPlans() {
  const show = useToastStore((s) => s.show)
  const token = useAuthStore((s) => s.token)

  const [rows, setRows] = useState<PlanRow[] | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  // 新建表单
  const [studentId, setStudentId] = useState<number | null>(null)
  const [examName, setExamName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const albumRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  // P1-72：基于已有批改记录生成（推荐——教案与批改错题集同源，不再独立看图另判一套）
  const [logId, setLogId] = useState<number | null>(null)
  const [logOptions, setLogOptions] = useState<Array<{ id: number; label: string }>>([])

  // 详情
  const [detail, setDetail] = useState<{ id: number; student_name: string; exam_name: string; created_at: string; images: string[]; analysis: LessonDiagnosis | null; plan: LessonPlan | null } | null>(null)
  const [regening, setRegening] = useState(false)

  const load = useCallback(async () => {
    try { setRows(await get<PlanRow[]>('/api/lesson-plans')) } catch (e: any) { show(e.message || '加载失败') }
  }, [show])
  useEffect(() => { load() }, [load])
  useEffect(() => { get<Student[]>('/api/students').then(setStudents).catch(() => { /* 忽略 */ }) }, [])
  // 选定学生后拉取其带批改结果的学情记录，供「从批改记录生成」选择
  useEffect(() => {
    setLogId(null); setLogOptions([])
    if (!studentId) return
    get<any[]>(`/api/students/${studentId}/logs`).then((logs) => {
      setLogOptions(
        (logs || []).map((l) => {
          let ai: any = null
          try { ai = typeof l.ai_result === 'string' ? JSON.parse(l.ai_result) : l.ai_result } catch { /* 损坏跳过 */ }
          if (!ai?.items?.length) return null
          return { id: l.id, label: `${String(l.date).slice(0, 10)} · ${l.type || '记录'} · ${String(l.content || '').slice(0, 30)}（批改 ${ai.items.length} 题）` }
        }).filter(Boolean) as Array<{ id: number; label: string }>
      )
    }).catch(() => { /* 忽略 */ })
  }, [studentId])

  const pick = (fl: FileList | null) => {
    if (!fl?.length) return
    const arr = Array.from(fl).filter((f) => f.type.startsWith('image/'))
    setFiles((prev) => [...prev, ...arr].slice(0, 9))
    setPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
  }

  const generate = async () => {
    if (!studentId) { show('请选择学生'); return }
    if (!logId && !files.length) { show('请先拍照/选试卷照片，或选一条已有批改记录'); return }
    setBusy(true)
    try {
      const paths: string[] = []
      for (let i = 0; i < files.length; i++) {
        show(`正在上传第 ${i + 1}/${files.length} 张…`)
        paths.push(await uploadImage(files[i], studentId, token!))
      }
      show(logId ? '正在基于批改结果生成教案（约 1~2 分钟）…' : 'AI 正在逐题诊断并生成教案（约 1~3 分钟）…')
      const r = await post<{ id: number; plan: LessonPlan }>('/api/lesson-plans', {
        student_id: studentId, exam_name: examName, images: paths, log_id: logId || undefined,
      })
      show('教案已生成')
      setFiles([]); setPreviews([]); setExamName(''); setLogId(null)
      await load()
      openDetail(r.id)
    } catch (e: any) {
      show(e.message || '生成失败')
    } finally {
      setBusy(false)
    }
  }

  const openDetail = async (id: number) => {
    try {
      const r = await get<{ ok: boolean; plan: any }>(`/api/lesson-plans/${id}`)
      setDetail(r.plan)
    } catch (e: any) { show(e.message || '加载失败') }
  }

  const regen = async (id: number) => {
    setRegening(true)
    try {
      const r = await post<{ plan: LessonPlan }>(`/api/lesson-plans/${id}/regenerate`)
      setDetail((d) => (d && d.id === id ? { ...d, plan: r.plan } : d))
      show('已重新生成')
    } catch (e: any) { show(e.message || '重新生成失败') } finally { setRegening(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('确定删除这份教案？（诊断记录与图片引用一并删除，原照片不受影响）')) return
    await del(`/api/lesson-plans/${id}`)
    show('已删除')
    if (detail?.id === id) setDetail(null)
    load()
  }

  // 打印：自包含 HTML（LaTeX 预渲染 MathML），浏览器打印/另存 PDF
  const printPlan = (p: LessonPlan, meta: { student_name?: string; exam_name?: string }) => {
    const w = window.open('', '_blank')
    if (!w) { show('浏览器拦截了弹出窗口'); return }
    const tbl = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${texToMathml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const body = `
      <h1>${p.cover?.title || '物理错题讲义'}</h1>
      <div class="info">${texToMathml(p.cover?.subtitle || '')}</div>
      <div class="info">${texToMathml(p.cover?.source || '')}</div>
      <div class="info">${texToMathml(p.cover?.time || '')}</div>
      <div class="info">${texToMathml(p.cover?.composition || '')}</div>
      <div class="info">${meta.student_name ? meta.student_name + ' · ' : ''}${todayLocal()}</div>

      <div class="sec"><h2>一、试卷失分诊断总览</h2></div>
      <div class="stem">${texToMathml(p.overview?.text || '')}</div>
      ${p.overview?.choice_table?.length ? `<p class="tbtitle">表1 选择题错题诊断</p>${tbl(['题号', '情境', '作答', '正解', '漏洞分析'], p.overview.choice_table.map((r) => [r.no, r.context, r.answer, r.correct, r.gap]))}` : ''}
      ${p.overview?.nonchoice_table?.length ? `<p class="tbtitle">表2 非选择题失分诊断</p>${tbl(['题号', '考查点', '作答', '正确', '失分原因'], p.overview.nonchoice_table.map((r) => [r.no, r.kp, r.answer, r.correct, r.gap]))}` : ''}
      ${p.overview?.mainlines?.length ? `<p><b>失分主线：</b></p><ul>${p.overview.mainlines.map((m) => `<li>${texToMathml(m)}</li>`).join('')}</ul>` : ''}
      ${p.overview?.strengths ? `<p><b>优势：</b>${texToMathml(p.overview.strengths)}</p>` : ''}

      <div class="sec"><h2>二、知识框架（本课核心干货）</h2></div>
      ${(p.frameworks || []).map((f, i) => `
        <div class="sec"><h3>框架${['一', '二', '三', '四', '五', '六', '七', '八'][i] || i + 1}　${texToMathml(f.title)}</h3>
        <p class="meta">${texToMathml(f.targets || '')} ${texToMathml(f.priority || '')}</p></div>
        <div class="stem">${(f.content || []).map((c) => texToMathml(c)).join('</div><div class="stem">')}</div>
        ${f.self_check?.length ? `<p class="meta"><b>自查：</b></p><ul>${f.self_check.map((s) => `<li>${texToMathml(s)}</li>`).join('')}</ul>` : ''}
      `).join('')}

      <div class="sec"><h2>三、变形训练题（${(p.variants || []).length} 题，含详解）</h2></div>
      ${(p.variants || []).map((v, i) => `
        <div class="q">
          <div class="no">变式${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][i] || i + 1}（${texToMathml(v.ref || '')}）　${texToMathml(v.topic || '')}</div>
          <div class="stem">【题干】${texToMathml(v.stem)}</div>
          <div class="ans"><b>【解析】</b>${texToMathml(v.solution)}</div>
          ${v.insight ? `<div class="ans"><b>【点睛】</b>${texToMathml(v.insight)}</div>` : ''}
        </div>`).join('')}

      <div class="sec"><h2>四、课后任务</h2></div>
      <div class="stem">${texToMathml(p.homework?.text || '')}</div>
      <ul>${(p.homework?.items || []).map((s) => `<li>${texToMathml(s)}</li>`).join('')}</ul>
    `
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${p.cover?.title || '错题讲义'}</title>
      <style>body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#111;line-height:1.8}
      h1{text-align:center;font-size:22px;margin:10px 0}
      .info{text-align:center;color:#444;font-size:13px;margin:4px 0}
      h2{font-size:17px;border-left:4px solid #4f46e5;padding-left:8px;margin:18px 0 8px;page-break-after:avoid}
      h3{font-size:15px;margin:14px 0 6px;page-break-after:avoid}
      .sec{page-break-inside:avoid;margin:10px 0 4px}
      .meta{color:#666;font-size:12px;margin:2px 0}
      .stem{margin:6px 0;white-space:pre-wrap;font-size:14px;line-height:1.9}
      .ans{background:#f6f6f6;padding:8px;border-radius:6px;font-size:13px;margin-top:6px;white-space:pre-wrap;line-height:1.8}
      .q{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}
      .no{color:#666;font-size:13px}
      .tbtitle{font-weight:bold;margin:10px 0 4px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}
      th,td{border:1px solid #bbb;padding:5px 6px;vertical-align:top;text-align:left}
      th{background:#eef2ff}
      ul{padding-left:22px;margin:6px 0}
      li{margin:3px 0}
      @media print{.noprint{display:none}}
      </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},700)}</script></body></html>`)
    w.document.close()
  }

  // ================= 详情视图 =================
  if (detail) {
    const p = detail.plan
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setDetail(null)}>← 返回列表</button>
          <h1 className="text-lg font-bold flex-1 min-w-0 truncate">{p?.cover?.title || detail.exam_name}</h1>
          <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => p && printPlan(p, { student_name: detail.student_name })}><Printer className="w-4 h-4 inline-block align-[-2px]" /> 打印 / 导出 PDF</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" disabled={regening} onClick={() => regen(detail.id)}><RefreshCw className={`w-4 h-4 inline-block align-[-2px] ${regening ? 'animate-spin' : ''}`} /> {regening ? '重新生成中…' : '重新生成'}</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs !text-red-500 !border-red-200 dark:!border-red-900" onClick={() => remove(detail.id)}><Trash2 className="w-4 h-4 inline-block align-[-2px]" /> 删除</button>
        </div>

        {!p ? <div className="card p-8 text-center text-sm text-slate-400">教案数据缺失</div> : (
          <div className="space-y-4">
            {/* 封面 */}
            <div className="card p-5 text-center space-y-1">
              <h2 className="text-xl font-bold">{p.cover?.title}</h2>
              {p.cover?.subtitle && <p className="text-sm text-slate-500"><Katex text={p.cover.subtitle} /></p>}
              {p.cover?.source && <p className="text-xs text-slate-400"><Katex text={p.cover.source} /></p>}
              {p.cover?.time && <p className="text-xs text-slate-400">{p.cover.time}</p>}
              {p.cover?.composition && <p className="text-xs text-primary-600 dark:text-primary-400">{p.cover.composition}</p>}
            </div>

            {/* 一、失分诊断总览 */}
            <section className="card p-4 space-y-3">
              <h2 className="font-semibold">一、试卷失分诊断总览</h2>
              <T text={p.overview?.text || ''} />
              {p.overview?.choice_table?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">表1 选择题错题诊断</p>
                  <DiagTable head={['题号', '情境', '作答', '正解', '漏洞分析']} rows={p.overview.choice_table.map((r) => [r.no, r.context, r.answer, r.correct, r.gap])} />
                </div>
              )}
              {p.overview?.nonchoice_table?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">表2 非选择题失分诊断</p>
                  <DiagTable head={['题号', '考查点', '作答', '正确', '失分原因']} rows={p.overview.nonchoice_table.map((r) => [r.no, r.kp, r.answer, r.correct, r.gap])} />
                </div>
              )}
              {p.overview?.mainlines?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500">失分主线</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">{p.overview.mainlines.map((m, i) => <li key={i}><Katex text={m} /></li>)}</ul>
                </div>
              )}
              {p.overview?.strengths && <p className="text-sm"><span className="font-semibold text-green-600">优势：</span><Katex text={p.overview.strengths} /></p>}
            </section>

            {/* 二、知识框架 */}
            <section className="card p-4 space-y-3">
              <h2 className="font-semibold">二、知识框架（本课核心干货）</h2>
              {(p.frameworks || []).map((f, i) => (
                <details key={i} open={i === 0} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <summary className="text-sm font-semibold cursor-pointer">{f.title}</summary>
                  <p className="text-xs text-slate-400 mt-1">{f.targets} {f.priority}</p>
                  <div className="mt-2 space-y-2 text-sm">{(f.content || []).map((c, j) => <T key={j} text={c} />)}</div>
                  {f.self_check?.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      <b>自查：</b>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">{f.self_check.map((s, j) => <li key={j}><Katex text={s} /></li>)}</ul>
                    </div>
                  )}
                </details>
              ))}
            </section>

            {/* 三、变形训练题 */}
            <section className="card p-4 space-y-3">
              <h2 className="font-semibold">三、变形训练题（{(p.variants || []).length} 题，含详解）</h2>
              {(p.variants || []).map((v, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                  <p className="text-sm font-semibold">变式{i + 1}（{v.ref}）　<span className="text-slate-500 font-normal">{v.topic}</span></p>
                  <T text={`【题干】${v.stem}`} />
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-sm"><T text={`【解析】${v.solution}`} /></div>
                  {v.insight && <p className="text-xs text-amber-600 dark:text-amber-400"><Katex text={`【点睛】${v.insight}`} /></p>}
                </div>
              ))}
            </section>

            {/* 四、课后任务 */}
            <section className="card p-4 space-y-2">
              <h2 className="font-semibold">四、课后任务</h2>
              <T text={p.homework?.text || ''} />
              <ul className="list-decimal pl-5 text-sm space-y-1">{(p.homework?.items || []).map((s, i) => <li key={i}><Katex text={s} /></li>)}</ul>
            </section>

            {/* 原始诊断（可展开核对） */}
            {(detail.analysis?.items?.length ?? 0) > 0 && (
              <details className="card p-4">
                <summary className="text-sm font-semibold text-slate-500 cursor-pointer">AI 逐题诊断原始结果（核对用，{detail.analysis!.items.length} 题）</summary>
                <div className="mt-2 space-y-2 text-xs">
                  {detail.analysis!.note && <p className="text-amber-500">识别说明：{detail.analysis!.note}</p>}
                  {detail.analysis!.items.map((it, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800 p-2">
                      <p className="font-semibold">第 {it.no} 题（{it.qtype}）· {it.kp}</p>
                      {it.stem && <div className="mt-1"><Katex text={it.stem} /></div>}
                      <p className="mt-1 text-slate-500">学生作答：{it.student_answer || '（卷面未见）'} · 正解：{it.correct_answer || '—'}</p>
                      {it.gap && <p className="text-slate-500">漏洞：{it.gap}</p>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    )
  }

  // ================= 列表 + 新建 =================
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary-500" /> 智能教案</h1>

      {/* 新建 */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm">＋ 上传错题试卷，生成针对性教案</h2>
        <div className="flex gap-2 flex-wrap">
          <select className="input !w-48" value={studentId ?? ''} onChange={(e) => setStudentId(Number(e.target.value) || null)}>
            <option value="">选择学生…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.grade || '未设年级'}）</option>)}
          </select>
          <input className="input flex-1 !min-w-40" placeholder="试卷名称（如：10月检测）" value={examName} onChange={(e) => setExamName(e.target.value)} />
        </div>
        {logOptions.length > 0 && (
          <div>
            <select className="input !w-full" value={logId ?? ''} onChange={(e) => setLogId(Number(e.target.value) || null)}>
              <option value="">基于批改记录生成（推荐）：从该生的拍照批改记录中选择…</option>
              {logOptions.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">选择批改记录后，教案直接采用该次批改的逐题判定与错题集（与批改结果完全一致）；不选则按下方照片重新诊断。</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-outline !py-4" onClick={() => cameraRef.current?.click()}>📷 拍照</button>
          <button className="btn-outline !py-4" onClick={() => albumRef.current?.click()}>🖼️ 相册多选</button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        <input ref={albumRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={p} className="w-full h-full object-cover" />
                <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs" onClick={() => { setFiles((f) => f.filter((_, j) => j !== i)); setPreviews((pp) => pp.filter((_, j) => j !== i)) }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button className="btn-primary w-full" disabled={busy} onClick={generate}>{busy ? '生成中…（逐题诊断 → 教案撰写）' : '开始生成教案'}</button>
        <p className="text-xs text-slate-400">AI 将逐题还原原题并诊断失分原因，生成含「失分诊断总览 / 知识框架 / 变形训练题 / 课后任务」的完整讲义，可一键打印 PDF。试卷照片会传输至所配置的 AI 供应商进行分析。</p>
      </div>

      {/* 历史列表 */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">历史教案</h2>
        {rows === null ? (
          <div className="card p-8 animate-pulse"><div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" /></div>
        ) : rows.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-400">还没有教案，先上传一份试卷照片试试</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="card p-4 flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary-500 shrink-0" />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(r.id)}>
                <p className="text-sm font-medium truncate">{r.plan_summary?.title || r.exam_name}</p>
                <p className="text-xs text-slate-400 num">{r.student_name || '未关联学生'} · {String(r.created_at).slice(0, 16).replace('T', ' ')}</p>
              </div>
              <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => openDetail(r.id)}>查看</button>
              <button className="text-slate-400 hover:text-red-500" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 诊断表（题号/情境/作答/正解/漏洞分析）
function DiagTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>{head.map((h) => <th key={h} className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => <td key={j} className="border border-slate-200 dark:border-slate-700 px-2 py-1.5"><Katex text={c} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
