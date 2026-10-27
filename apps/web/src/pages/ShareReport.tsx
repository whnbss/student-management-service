// 只读分享页（免登录）：家长凭随机 token 打开的 H5 报告，只读 + 可打印保存
// 数据来自 GET /api/public/share/:token（后端校验 token 与有效期，过期返回 410）
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, Sprout, Wrench, CalendarDays, MessageCircle } from 'lucide-react'

interface ShareData {
  ok: boolean
  title: string
  expires_at: string
  student_name: string
  grade: string
  range: { from: string; to: string }
  report: { summary: string; glow: string[]; grow: string[]; plan: string[]; payment_hint: string }
}

function Sec({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: string }) {
  return (
    <div className="card p-4">
      <h2 className={`flex items-center gap-1.5 text-sm font-semibold mb-2 ${tone}`}>
        {icon} {title}
      </h2>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className="text-sm leading-relaxed flex gap-2">
              <span className={`shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full ${tone.replace('text-', 'bg-')}`} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">（暂无）</p>
      )}
    </div>
  )
}

export default function ShareReport() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading')
  const [data, setData] = useState<ShareData | null>(null)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    fetch(`/api/public/share/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (res.ok && body?.ok) {
          setData(body as ShareData)
          setState('ok')
          document.title = body.title || '学习报告'
        } else {
          setErrMsg(body?.error || `链接无效(${res.status})`)
          setState('gone')
        }
      })
      .catch(() => {
        setErrMsg('无法连接到老师的服务，请确认与老师电脑在同一网络')
        setState('gone')
      })
  }, [token])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-slate-400 text-sm">加载中…</div>
      </div>
    )
  }

  if (state === 'gone') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-6 max-w-sm text-center">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{errMsg}</p>
        </div>
      </div>
    )
  }

  const r = data!.report
  const expiry = new Date(data!.expires_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-6 px-4 print:bg-white print:py-0">
      <div className="max-w-xl mx-auto space-y-3">
        <div className="text-center print:mb-4">
          <h1 className="text-lg font-bold">{data!.student_name} · 物理学习阶段报告</h1>
          <p className="text-xs text-slate-400 mt-1 num">
            {data!.range.from} ~ {data!.range.to}{data!.grade ? ` · ${data!.grade}` : ''} · 只读分享（{expiry} 前有效）
          </p>
        </div>
        {r.summary && (
          <div className="card p-4 bg-primary-50/60 dark:bg-primary-900/20 !border-primary-100 dark:!border-primary-900">
            <p className="text-sm leading-relaxed">{r.summary}</p>
          </div>
        )}
        <Sec icon={<Sprout className="w-4 h-4" />} title="本阶段进步" items={r.glow} tone="text-green-600" />
        <Sec icon={<Wrench className="w-4 h-4" />} title="待改进" items={r.grow} tone="text-amber-600" />
        <Sec icon={<CalendarDays className="w-4 h-4" />} title="下阶段计划" items={r.plan} tone="text-primary-600" />
        {r.payment_hint && (
          <div className="card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold mb-2 text-slate-600 dark:text-slate-300">
              <MessageCircle className="w-4 h-4" /> 课时说明
            </h2>
            <p className="text-sm leading-relaxed">{r.payment_hint}</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 print:hidden">
          <span className="text-[11px] text-slate-400">— 物理学习工作台 · {new Date().toLocaleDateString('zh-CN')} —</span>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 inline-block align-[-2px]" /> 保存 PDF
          </button>
        </div>
      </div>
    </div>
  )
}
