// P1 内容生产组件：分层练习生成（模仿 Brisk Change Level）+ 家长阶段报告（模仿 MagicSchool Report Card）
// 两者都走既有 AI 管线（/api/practice/tiered、/api/reports/parent），结果先草稿、教师终审后使用
import { useState } from 'react'
import {Printer, ClipboardCopy, Sprout, Wrench, CalendarDays, MessageCircle, Link2} from 'lucide-react'
import { get, post } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import Katex from '@/components/Katex'
import QuestionFigure from '@/components/QuestionFigure'
import { printHtml, questionPrintHtml } from '@/lib/print'
import { specToSvg } from '@/lib/figure'
import type { Student, Mistake, QuizDraft, TieredResult, ParentReport } from '@workbench/shared'

const TIERS = ['基础', '巩固', '拔尖'] as const
const TIER_COLOR: Record<string, string> = {
  '基础': 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
  '巩固': 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  '拔尖': 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <h2 className="font-semibold">{title}</h2>
          <span className="flex-1" />
          <button className="text-slate-400 hover:text-slate-600 text-lg leading-none" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 分层练习：按学生薄弱知识点生成 基础/巩固/拔尖 三档，勾选后合成一人一份练习 PDF */
export function TieredPracticeModal({ student, mistakes, onClose }: { student: Student; mistakes: Mistake[]; onClose: () => void }) {
  const show = useToastStore((s) => s.show)
  const [generating, setGenerating] = useState(false)
  const [tiers, setTiers] = useState<TieredResult | null>(null)
  const [recommended, setRecommended] = useState('')
  const [kpsUsed, setKpsUsed] = useState<string[]>([])
  // 勾选状态：key = `${tier}:${index}`
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const generate = async () => {
    setGenerating(true)
    setTiers(null)
    try {
      const r = await post<{ tiers: TieredResult; recommended_tier: string; kps: string[] }>('/api/practice/tiered', { student_id: student.id })
      setTiers(r.tiers)
      setRecommended(r.recommended_tier)
      setKpsUsed(r.kps)
      // 默认勾选推荐档全部题目
      const p = new Set<string>()
      for (const t of TIERS) r.tiers[t]?.forEach((_, i) => { if (t === r.recommended_tier) p.add(`${t}:${i}`) })
      setPicked(p)
      show(`已生成三档练习，默认选中「${r.recommended_tier}」档（按该生掌握度推荐）`)
    } catch (e: any) {
      show(e.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const pickedList = (): Array<QuizDraft & { tier: string }> => {
    if (!tiers) return []
    const out: Array<QuizDraft & { tier: string }> = []
    for (const t of TIERS) tiers[t]?.forEach((q, i) => { if (picked.has(`${t}:${i}`)) out.push({ ...q, tier: t }) })
    return out
  }

  const printSheet = () => {
    const qs = pickedList()
    if (!qs.length) { show('请先勾选题目'); return }
    const withFig = qs.map((q) => ({ ...q, figure: q.figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg(q.figure_spec) }) : '' }))
    const header = `<h1>分层练习（${student.name}）</h1>
      <div class="namefill">姓名：＿＿＿＿＿＿　日期：＿＿＿＿＿＿</div>
      <div class="info">知识点：${kpsUsed.join('、') || '综合'} · 共 ${withFig.length} 题</div>`
    const body = withFig.map((q, i) => questionPrintHtml(q, i, false, `<span class="tier">${q.tier}</span> · ${q.qtype} · 难度 ${q.difficulty}`)).join('')
    if (!printHtml(`分层练习（${student.name}）`, header + body)) show('浏览器拦截了弹出窗口')
  }

  const saveToBank = async () => {
    const qs = pickedList()
    if (!qs.length) { show('请先勾选题目'); return }
    setSaving(true)
    try {
      // figure_spec → svg 存入 figure；疑似重复时确认后 force 重试
      const payload = qs.map((q) => ({
        ...q,
        figure: q.figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg(q.figure_spec) }) : '',
      }))
      let r = await post<{ ok: boolean; duplicates?: Array<{ index: number; id: number; stem: string }> }>('/api/questions/bulk', { questions: payload, force: false })
      if (r && r.ok === false && r.duplicates?.length) {
        const d = r.duplicates[0]
        if (!confirm(`第 ${d.index + 1} 题疑似与已有题目重复（题库 #${d.id}：${d.stem}…），仍要保存吗？`)) return
        r = await post('/api/questions/bulk', { questions: payload, force: true })
      }
      if (!r?.ok) { show('保存失败'); return }
      show(`已存入题库 ${qs.length} 道题`)
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: string) => {
    setPicked((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  return (
    <ModalShell title="生成分层练习" onClose={onClose}>
      {!tiers && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            将按 <b>{student.name}</b> 的薄弱知识点（未掌握错题优先）生成 基础 / 巩固 / 拔尖 三档各 2~3 题，
            默认勾选按其掌握度推荐的档位，勾选后可合成一人一份练习 PDF。
          </p>
          {mistakes.filter((m) => m.mastery_status !== '已掌握').length === 0 && (
            <p className="text-xs text-amber-500">该生暂无未掌握错题，将按新课进度出题。</p>
          )}
          <button className="btn-primary w-full" disabled={generating} onClick={generate}>
            {generating ? '生成中…（三档题目，约需 30~90 秒）' : '开始生成'}
          </button>
        </div>
      )}
      {tiers && (
        <div className="space-y-4">
          {kpsUsed.length > 0 && <p className="text-xs text-slate-400">薄弱知识点：{kpsUsed.join('、')}</p>}
          {TIERS.map((t) => (
            <div key={t} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOR[t]}`}>{t}</span>
                {t === recommended && <span className="text-[11px] text-primary-500">← 按掌握度推荐</span>}
                <span className="flex-1" />
                <button
                  className="text-[11px] text-primary-600"
                  onClick={() => setPicked((p) => { const n = new Set(p); tiers[t]?.forEach((_, i) => n.add(`${t}:${i}`)); return n })}
                >全选本档</button>
              </div>
              {tiers[t]?.map((q, i) => {
                const key = `${t}:${i}`
                return (
                  <div key={key} className={`rounded-xl p-3 ${picked.has(key) ? 'bg-slate-50 dark:bg-slate-800/60' : 'opacity-50'}`}>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer mb-1">
                      <input type="checkbox" checked={picked.has(key)} onChange={() => toggle(key)} />
                      {q.qtype} · 难度 {q.difficulty}
                    </label>
                    <div className="text-sm"><Katex text={q.stem} /></div>
                    <QuestionFigure figure={q.figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg(q.figure_spec) }) : ''} />
                    <details className="mt-1 text-xs">
                      <summary className="text-primary-600 cursor-pointer">答案与解析</summary>
                      <p className="mt-1"><b>答案：</b><Katex text={q.answer} /></p>
                      <p className="mt-1"><b>解析：</b><Katex text={q.solution} /></p>
                      {q.pitfall && <p className="text-amber-600 dark:text-amber-400"><b>易错点：</b><Katex text={q.pitfall} /></p>}
                    </details>
                  </div>
                )
              })}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button className="btn-primary flex-1 min-w-36" onClick={printSheet}><Printer className="w-4 h-4 inline-block align-[-2px]" /> 合成练习单 PDF（学生版）</button>
            <button className="btn-outline flex-1 min-w-36" disabled={saving} onClick={saveToBank}>{saving ? '保存中…' : '存入题库'}</button>
            <button className="btn-outline !px-3" onClick={() => { setTiers(null); setPicked(new Set()) }}>重新生成</button>
          </div>
          <p className="text-[11px] text-slate-400">学生做完后拍照，回到「拍作业」分析即可回收进闭环</p>
        </div>
      )}
    </ModalShell>
  )
}

/** 家长阶段报告：选时段 → AI 三段式（Glow/Grow/Plan）→ 教师终审 → 打印 PDF / 复制催缴话术 */
export function ParentReportModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const show = useToastStore((s) => s.show)
  const today = new Date().toISOString().slice(0, 10)
  const [preset, setPreset] = useState<'2w' | '1m' | 'custom'>('1m')
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(today)
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<ParentReport | null>(null)
  const [range, setRange] = useState({ from: '', to: '' })
  // H5 只读分享
  const [expires, setExpires] = useState(72) // 有效期（小时）
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const applyPreset = (p: '2w' | '1m' | 'custom') => {
    setPreset(p)
    if (p === '2w') setFrom(new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10))
    if (p === '1m') setFrom(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  }

  const generate = async () => {
    setGenerating(true)
    setShareUrl('') // 重新生成后旧链接内容已过时，需重新生成分享
    try {
      const r = await post<{ report: ParentReport; range: { from: string; to: string } }>('/api/reports/parent', { student_id: student.id, from, to })
      setReport(r.report)
      setRange(r.range)
    } catch (e: any) {
      show(e.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // 三段式 → 换行拼接，放在可编辑 textarea 里
  const linesOf = (arr: string[]) => arr.join('\n')
  const fromLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

  const printReport = () => {
    if (!report) return
    const body = `
      <h1>${student.name} · 物理学习阶段报告</h1>
      <div class="tip">${range.from} ~ ${range.to} · ${student.grade || ''}</div>
      ${report.summary ? `<p style="text-align:center;font-size:14px;margin:12px 0">${report.summary.replace(/</g, '&lt;')}</p>` : ''}
      <div class="sec"><h2>本阶段进步</h2><ul>${fromLines(linesOf(report.glow)).map((s) => `<li>${s.replace(/</g, '&lt;')}</li>`).join('') || '<li>（待补充）</li>'}</ul></div>
      <div class="sec"><h2>待改进</h2><ul>${fromLines(linesOf(report.grow)).map((s) => `<li>${s.replace(/</g, '&lt;')}</li>`).join('') || '<li>（待补充）</li>'}</ul></div>
      <div class="sec"><h2>下阶段计划</h2><ul>${fromLines(linesOf(report.plan)).map((s) => `<li>${s.replace(/</g, '&lt;')}</li>`).join('') || '<li>（待补充）</li>'}</ul></div>
      ${report.payment_hint ? `<div class="sec"><h2>课时说明</h2><p style="font-size:13px;line-height:1.7">${report.payment_hint.replace(/</g, '&lt;')}</p></div>` : ''}
      <div class="tip" style="margin-top:24px">— ${new Date().toLocaleDateString('zh-CN')} · 物理学习报告 —</div>`
    if (!printHtml(`${student.name} 阶段报告`, body)) show('浏览器拦截了弹出窗口')
  }

  const copyHint = async () => {
    if (!report?.payment_hint) { show('本次报告没有生成课时提醒话术'); return }
    try {
      await navigator.clipboard.writeText(report.payment_hint)
      show('已复制到剪贴板，可直接粘贴发给家长')
    } catch {
      show('复制失败，请手动选择文字复制')
    }
  }

  // —— H5 只读分享链接（P2）：随机 token + 有效期，家长免登录查看 ——

  // 分享链接指向前端 /share/:token 页面；本机（localhost）操作时换成后端局域网地址，保证手机能打开
  const buildShareUrl = async (token: string): Promise<string> => {
    let host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      try {
        const sys = await get<{ lan: string }>('/api/settings/system')
        if (sys.lan) host = sys.lan
      } catch { /* 拿不到局域网地址就保持原样 */ }
    }
    return `http://${host}${window.location.port ? ':' + window.location.port : ''}/share/${token}`
  }

  const makeShare = async () => {
    if (!report) return
    setSharing(true)
    try {
      const r = await post<{ token: string; expires_at: string }>('/api/reports/share', {
        student_id: student.id, report, range, expires_hours: expires,
      })
      setShareUrl(await buildShareUrl(r.token))
      setExpiresAt(r.expires_at)
      show('分享链接已生成，复制发给家长即可（到期自动失效）')
    } catch (e: any) {
      show(e.message || '生成分享链接失败')
    } finally {
      setSharing(false)
    }
  }

  const copyShare = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      show('链接已复制，可直接发给家长')
    } catch {
      show('复制失败，请长按链接手动复制')
    }
  }

  return (
    <ModalShell title="生成阶段报告（家长版）" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {([['2w', '近 2 周'], ['1m', '近 1 月'], ['custom', '自定义']] as const).map(([k, label]) => (
            <button
              key={k}
              className={`!px-3 !py-1.5 text-xs rounded-lg border ${preset === k ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
              onClick={() => applyPreset(k)}
            >
              {label}
            </button>
          ))}
          {preset === 'custom' && (
            <>
              <input type="date" className="input num !w-36 !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-slate-400">~</span>
              <input type="date" className="input num !w-36 !py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          {preset !== 'custom' && <span className="text-xs text-slate-400 num">{from} ~ {to}</span>}
        </div>
        <button className="btn-primary w-full" disabled={generating} onClick={generate}>
          {generating ? '生成中…（汇总学情/错题/出勤，约需 20~60 秒）' : report ? '重新生成' : '开始生成'}
        </button>
        <p className="text-[11px] text-slate-400">智能生成仅为草稿，以下内容均可编辑，发送前请终审</p>
      </div>

      {report && (
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="label">一句话总评</label>
            <textarea className="input" rows={2} value={report.summary} onChange={(e) => setReport({ ...report, summary: e.target.value })} />
          </div>
          <div>
            <label className="label"><Sprout className="w-4 h-4 inline-block align-[-2px]" /> 本阶段进步（Glow，每行一条）</label>
            <textarea className="input" rows={4} value={linesOf(report.glow)} onChange={(e) => setReport({ ...report, glow: fromLines(e.target.value) })} />
          </div>
          <div>
            <label className="label"><Wrench className="w-4 h-4 inline-block align-[-2px]" /> 待改进（Grow，每行一条）</label>
            <textarea className="input" rows={4} value={linesOf(report.grow)} onChange={(e) => setReport({ ...report, grow: fromLines(e.target.value) })} />
          </div>
          <div>
            <label className="label"><CalendarDays className="w-4 h-4 inline-block align-[-2px]" /> 下阶段计划（每行一条）</label>
            <textarea className="input" rows={4} value={linesOf(report.plan)} onChange={(e) => setReport({ ...report, plan: fromLines(e.target.value) })} />
          </div>
          <div>
            <label className="label"><MessageCircle className="w-4 h-4 inline-block align-[-2px]" /> 课时提醒话术（可复制发给家长）</label>
            <textarea className="input" rows={2} value={report.payment_hint} onChange={(e) => setReport({ ...report, payment_hint: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-primary flex-1 min-w-32" onClick={printReport}><Printer className="w-4 h-4 inline-block align-[-2px]" /> 导出 PDF</button>
            <button className="btn-outline flex-1 min-w-32" onClick={copyHint}><ClipboardCopy className="w-4 h-4 inline-block align-[-2px]" /> 复制催缴话术</button>
          </div>
          {/* H5 只读分享：随机 token 链接，家长免登录查看，到期自动失效 */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="label"><Link2 className="w-4 h-4 inline-block align-[-2px]" /> 分享给家长（只读 H5 链接）</label>
            <div className="flex gap-2">
              <select className="input !w-28" value={expires} onChange={(e) => setExpires(Number(e.target.value))}>
                <option value={24}>24 小时</option>
                <option value={72}>3 天</option>
                <option value={168}>7 天</option>
                <option value={720}>30 天</option>
              </select>
              <button className="btn-outline flex-1" disabled={sharing} onClick={makeShare}>
                {sharing ? '生成中…' : shareUrl ? '重新生成链接' : '生成分享链接'}
              </button>
            </div>
            {shareUrl && (
              <div className="flex gap-2 items-center">
                <input className="input !py-1.5 text-xs num" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn-primary !px-3 !py-1.5 text-xs shrink-0" onClick={copyShare}>复制</button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              链接免登录、仅能查看本报告，到期自动失效（{shareUrl && expiresAt ? `本次至 ${new Date(expiresAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '生成后见提示'}）。
              家长手机需与电脑连接同一网络（或自行做外网映射后替换地址）。
            </p>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
