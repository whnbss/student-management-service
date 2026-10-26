// 我的：外观（深色模式）、修改密码、AI 供应商配置（多供应商/多 Key/连通性测试/费用估算/用量统计）、关于、备份占位（M4）
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { get, put, post } from '@/lib/api'
import { useToastStore, useAuthStore } from '@/stores/auth'
import type { AiProvider } from '@workbench/shared'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'

interface UsageSummary { model: string; calls: number; prompt_tokens: number; completion_tokens: number; cost: number }
interface UsageRow {
  id: number; provider_name: string; model: string; kind: string
  prompt_tokens: number; completion_tokens: number; cost: number; created_at: string
}
interface SystemInfo { version: string; node: string; port: number; data_dir: string; uploads_dir: string; platform: string }
interface TestOutcome { ok: boolean; text: string }

// 当前月份 YYYY-MM（本地时区）
const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const KIND_LABEL: Record<string, string> = { analyze: '拍照分析', variants: '举一反三', test: '连通测试' }

// 单价输入：内部用字符串草稿，避免受控 Number 丢小数点（输入 "2.5" 中途变 "2." 的问题）
function PriceInput({ value, onCommit, placeholder }: { value: number; onCommit: (n: number) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value ? String(value) : '')
  // 外部值变化（导入/恢复默认/重新加载）时同步草稿
  useEffect(() => { setDraft(value ? String(value) : '') }, [value])
  return (
    <input
      className="input !py-1 !px-2 num !w-20"
      type="text" inputMode="decimal" placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(Number(draft) || 0)}
    />
  )
}

export default function Settings() {
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const show = useToastStore((s) => s.show)
  const logout = useAuthStore((s) => s.logout)

  // 外观
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref())

  // AI 配置（表单状态）
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [activeId, setActiveId] = useState('') // 用户自选的「当前使用模型」（供应商 id）
  const [proxy, setProxy] = useState('')
  const [privacyNotice, setPrivacyNotice] = useState('') // 隐私提示：以后端返回为唯一数据源
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, TestOutcome>>({})
  const [aiSaving, setAiSaving] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [exportNoKey, setExportNoKey] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  // 最近一次加载的已保存快照：用于未保存修改检测
  const savedRef = useRef('')
  const dirty = JSON.stringify({ providers, activeId, proxy }) !== savedRef.current

  // 用量统计
  const [month, setMonth] = useState(currentMonth())
  const [usage, setUsage] = useState<UsageSummary[]>([])
  const [usageRows, setUsageRows] = useState<UsageRow[]>([])
  const [showRows, setShowRows] = useState(false)

  // 系统信息（关于卡片）
  const [system, setSystem] = useState<SystemInfo | null>(null)

  const loadAi = useCallback(async () => {
    try {
      const r = await get<{ providers: AiProvider[]; active_id?: string; proxy?: string; privacy_notice?: string }>('/api/settings/ai')
      setProviders(r.providers)
      setActiveId(r.active_id || '')
      setProxy(r.proxy || '')
      setPrivacyNotice(r.privacy_notice || '')
      savedRef.current = JSON.stringify({ providers: r.providers, activeId: r.active_id || '', proxy: r.proxy || '' })
    } catch (e: any) { show(e.message || '加载 AI 配置失败') }
  }, [show])

  const loadUsage = useCallback(async (m: string) => {
    try {
      const r = await get<{ summary: UsageSummary[]; rows: UsageRow[] }>(`/api/settings/ai/usage?month=${m}`)
      setUsage(r.summary)
      setUsageRows(r.rows || [])
    } catch { /* 静默 */ }
  }, [])

  useEffect(() => { loadAi(); loadUsage(month) }, [loadAi, loadUsage, month])
  useEffect(() => { get<SystemInfo>('/api/settings/system').then(setSystem).catch(() => {}) }, [])

  // 未保存修改保护：刷新/关闭标签页前提示
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // 未保存修改保护：站内路由跳转拦截（依赖 data router）
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('有未保存的修改，确定要离开本页吗？')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  const change = async () => {
    if (!oldPassword || !newPassword) { show('请填写完整'); return }
    if (newPassword !== confirmPassword) { show('两次输入的新密码不一致'); return }
    setSaving(true)
    try {
      await put('/api/settings/password', { old_password: oldPassword, new_password: newPassword })
      show('密码已修改，请重新登录')
      // 修改成功后强制重新登录
      setTimeout(() => { logout(); window.location.href = '/login' }, 800)
    } catch (e: any) {
      show(e.message || '修改失败')
    } finally {
      setSaving(false)
    }
  }

  const updProvider = (idx: number, patch: Partial<AiProvider>) =>
    setProviders((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)))

  const addProvider = () => {
    setProviders((ps) => [
      ...ps,
      {
        id: crypto.randomUUID(), name: '新供应商', base_url: '', api_key: '',
        vision_model: '', text_model: '', input_price: 0, output_price: 0,
      },
    ])
  }

  const isUsable = (p?: AiProvider) => !!p && !!p.api_key && !!(p.vision_model || p.text_model)

  // 删除供应商：命中「当前使用」时立即同步保存，避免后端残留旧 active_id
  const delProvider = async (idx: number, p: AiProvider) => {
    if (!window.confirm(`确定删除供应商「${p.name}」吗？`)) return
    const rest = providers.filter((_, j) => j !== idx)
    setProviders(rest)
    if (activeId === p.id) {
      setActiveId('')
      try {
        await put('/api/settings/ai', { providers: rest, proxy, active_id: '' })
        show('已删除并保存')
        savedRef.current = JSON.stringify({ providers: rest, activeId: '', proxy })
        return
      } catch (e: any) {
        show(e.message || '同步保存失败，请手动点保存')
      }
    }
  }

  const saveAi = async () => {
    // 保存前校验「当前使用」必须指向可用（有 Key 且有模型）的供应商，否则回退为空
    let active = activeId
    if (active && !isUsable(providers.find((p) => p.id === active))) {
      active = ''
      setActiveId('')
      show('「当前使用」所选供应商缺 Key 或模型，已改为自动选择')
    }
    setAiSaving(true)
    try {
      await put('/api/settings/ai', { providers, proxy, active_id: active })
      show('AI 配置已保存')
      loadAi()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setAiSaving(false)
    }
  }

  // 连通性测试：直接用表单当前内容（未保存也能测），不再只传 provider_id
  const test = async (p: AiProvider, kind: 'vision' | 'text') => {
    const key = `${p.id}:${kind}`
    if (!p.base_url.trim()) { show('请先填写 Base URL'); return }
    const model = kind === 'text' ? p.text_model || p.vision_model : p.vision_model || p.text_model
    if (!model) { show('请先填写模型名（视觉或文本至少一个）'); return }
    setTesting(key)
    setTestResult((r) => ({ ...r, [key]: { ok: false, text: '测试中…' } }))
    try {
      const r = await post<{ reply: string }>('/api/settings/ai/test', { provider: { ...p }, kind })
      setTestResult((s) => ({ ...s, [key]: { ok: true, text: `✅ 连通正常：${r.reply}` } }))
      loadUsage(month)
    } catch (e: any) {
      setTestResult((s) => ({ ...s, [key]: { ok: false, text: `❌ ${e.message || '失败'}` } }))
    } finally {
      setTesting(null)
    }
  }

  // 恢复默认供应商配置
  const resetAi = async () => {
    if (!window.confirm('确定恢复默认 AI 配置吗？现有供应商列表（含 Key）将被覆盖。')) return
    try {
      await post('/api/settings/ai/reset')
      show('已恢复默认配置')
      setTestResult({})
      loadAi()
    } catch (e: any) {
      show(e.message || '恢复失败')
    }
  }

  // 导出配置为 ai-config.json（可选不含 Key）
  const exportConfig = async () => {
    try {
      const r = await get<{ providers: AiProvider[]; proxy: string }>('/api/settings/ai/export')
      const data = {
        providers: (r.providers || []).map((p) => ({ ...p, api_key: exportNoKey ? '' : p.api_key })),
        proxy: r.proxy || '',
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'ai-config.json'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      show(e.message || '导出失败')
    }
  }

  // 导入配置：读取文件回填表单，不自动保存
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const obj = JSON.parse(await f.text())
      if (!Array.isArray(obj.providers)) { show('配置文件格式不对：缺少 providers 数组'); return }
      const list: AiProvider[] = obj.providers.map((p: any, i: number) => ({
        id: String(p?.id || crypto.randomUUID()),
        name: String(p?.name || '').trim() || `供应商${i + 1}`,
        base_url: String(p?.base_url || '').trim(),
        api_key: String(p?.api_key || '').trim(),
        vision_model: String(p?.vision_model || '').trim(),
        text_model: String(p?.text_model || '').trim(),
        input_price: Number(p?.input_price) || 0,
        output_price: Number(p?.output_price) || 0,
      }))
      setProviders(list)
      setProxy(String(obj.proxy || ''))
      const wanted = String(obj.active_id || '')
      setActiveId(wanted && list.some((p) => p.id === wanted) ? wanted : '')
      show('已导入到表单，请检查后点「保存 AI 配置」生效')
      setTestResult({})
    } catch {
      show('文件解析失败，请选择本系统导出的 ai-config.json')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">我的</h1>

      {/* 外观（深色模式三选一） */}
      <div className="card p-4 flex items-center gap-3">
        <span className="text-sm font-semibold">外观</span>
        <span className="flex-1" />
        <div className="flex gap-1.5">
          {([['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']] as [ThemePref, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setTheme(v); setThemePref(v) }}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                theme === v
                  ? 'bg-primary-600 text-white'
                  : 'border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* AI 供应商配置 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center">
          <h2 className="font-semibold text-sm">AI 供应商配置</h2>
          <span className="flex-1" />
          <button className="text-xs text-primary-600" onClick={addProvider}>＋ 添加供应商</button>
        </div>

        {/* 未保存修改提示条 */}
        {dirty && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl px-3 py-2">
            <span className="flex-1">有未保存的修改</span>
            <button className="underline" onClick={loadAi}>放弃修改</button>
          </div>
        )}

        {/* 隐私提示：以后端返回为唯一数据源 */}
        {privacyNotice && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
            ⚠️ {privacyNotice}
          </p>
        )}

        <div className="space-y-1">
          <input className="input !py-1.5 text-xs" placeholder="网络代理地址（公司内网无法直连外网时必填，如 http://proxy.xxx:8080）" value={proxy} onChange={(e) => setProxy(e.target.value)} />
          <p className="text-[11px] text-slate-400">拍照分析报「fetch failed / 无法连接」多半是网络直连被拦截，填入代理地址后保存重试。</p>
        </div>

        {/* 当前使用模型：用户自选，拍照分析与变式题都用它 */}
        <div className="space-y-1">
          <label className="label">当前使用模型（拍照分析、举一反三都用这个）</label>
          <select
            className="input"
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
          >
            <option value="">自动（第一个可用的供应商）</option>
            {providers.map((p) => {
              const usable = isUsable(p)
              return (
                <option key={p.id} value={p.id} disabled={!usable}>
                  {p.name}（{p.vision_model || p.text_model || '未填模型'}）{!usable ? ' — 不可用（缺 Key 或模型）' : ''}
                </option>
              )
            })}
          </select>
          <p className="text-[11px] text-slate-400">切换后点「保存 AI 配置」生效；所选供应商缺 Key 或模型时不可选。</p>
        </div>

        {providers.map((p, i) => {
          const out = testResult[`${p.id}:vision`]
          const outT = testResult[`${p.id}:text`]
          return (
            <div key={p.id} className={`rounded-xl border p-3 space-y-2 ${p.id === activeId ? 'border-primary-400 dark:border-primary-500' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex gap-2 items-center">
                <input className="input flex-1 !py-1.5 text-xs" placeholder="显示名（如 阿里云百炼）" value={p.name} onChange={(e) => updProvider(i, { name: e.target.value })} />
                {p.id === activeId && <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 text-[11px]">当前使用</span>}
                <button className="text-xs text-slate-400 hover:text-red-500 px-2" onClick={() => delProvider(i, p)}>删除</button>
              </div>
              {/* 宽屏双列：Base URL 与 API Key 并排 */}
              <div className="grid md:grid-cols-2 gap-2">
                <input className="input !py-1.5 text-xs" placeholder="Base URL（OpenAI 兼容，如 https://dashscope.aliyuncs.com/compatible-mode/v1）" value={p.base_url} onChange={(e) => updProvider(i, { base_url: e.target.value })} />
                <input className="input !py-1.5 text-xs num" type={showKeys ? 'text' : 'password'} placeholder="API Key" value={p.api_key} onChange={(e) => updProvider(i, { api_key: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <input className="input !py-1.5 text-xs flex-1" placeholder="视觉/多模态模型（如 qwen-vl-max；留空则用文本模型）" value={p.vision_model} onChange={(e) => updProvider(i, { vision_model: e.target.value })} />
                <input className="input !py-1.5 text-xs flex-1" placeholder="文本模型（如 qwen-plus）" value={p.text_model} onChange={(e) => updProvider(i, { text_model: e.target.value })} />
              </div>
              <div className="flex gap-2 text-xs items-center">
                <label className="text-slate-400 shrink-0">单价(元/百万tokens)</label>
                <PriceInput value={p.input_price} placeholder="输入" onCommit={(n) => updProvider(i, { input_price: n })} />
                <PriceInput value={p.output_price} placeholder="输出" onCommit={(n) => updProvider(i, { output_price: n })} />
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button className="btn-outline !px-3 !py-1.5 text-xs" disabled={testing === `${p.id}:vision`} onClick={() => test(p, 'vision')}>
                  测试视觉/多模态
                </button>
                <button className="btn-outline !px-3 !py-1.5 text-xs" disabled={testing === `${p.id}:text`} onClick={() => test(p, 'text')}>
                  测试文本模型
                </button>
              </div>
              {(out || outT) && (
                <div className="text-[11px] break-all space-y-0.5">
                  {out && <p className={out.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{out.text}</p>}
                  {outT && <p className={outT.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{outT.text}</p>}
                </div>
              )}
            </div>
          )
        })}

        {/* 底部操作：保存主按钮 + 显示 Key / 恢复默认 outline 等宽 */}
        <div className="flex gap-2">
          <button className="btn-primary flex-1 max-w-[220px]" disabled={aiSaving} onClick={saveAi}>{aiSaving ? '保存中…' : '保存 AI 配置'}</button>
          <button className="btn-outline flex-1 !px-3 text-xs" onClick={() => setShowKeys(!showKeys)}>{showKeys ? '隐藏 Key' : '显示 Key'}</button>
          <button className="btn-outline flex-1 !px-3 text-xs" onClick={resetAi}>恢复默认</button>
        </div>

        {/* 配置导出/导入 */}
        <div className="flex gap-2 items-center flex-wrap text-xs">
          <label className="flex items-center gap-1.5 text-slate-500">
            <input type="checkbox" checked={exportNoKey} onChange={(e) => setExportNoKey(e.target.checked)} />
            导出不含 Key
          </label>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={exportConfig}>导出配置</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>导入配置</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />
        </div>

        {/* 月度用量：可切换月份 + 可折叠明细 */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500">AI 用量（费用按单价估算，未填单价则显示 0）</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <button className="px-1.5 text-slate-500 hover:text-primary-600" onClick={() => { setMonth(shiftMonth(month, -1)); setShowRows(false) }}>‹</button>
              <span className="num text-slate-600 dark:text-slate-300">{month}</span>
              <button
                className="px-1.5 text-slate-500 hover:text-primary-600 disabled:opacity-30"
                disabled={month >= currentMonth()}
                onClick={() => { setMonth(shiftMonth(month, 1)); setShowRows(false) }}
              >›</button>
            </div>
          </div>
          {usage.length === 0 ? (
            <p className="text-xs text-slate-400">该月暂无调用</p>
          ) : (
            <div className="space-y-1">
              {usage.map((u) => {
                const pt = u.prompt_tokens ?? 0
                const ct = u.completion_tokens ?? 0
                const cost = u.cost ?? 0
                return (
                  <div key={u.model} className="flex items-center justify-between text-xs num">
                    <span>{u.model}</span>
                    <span className="text-slate-400">{u.calls} 次 · {pt + ct} tokens · ¥{cost.toFixed(4)}</span>
                  </div>
                )
              })}
            </div>
          )}
          {usageRows.length > 0 && (
            <div>
              <button className="text-[11px] text-primary-600" onClick={() => setShowRows(!showRows)}>
                {showRows ? '收起明细 ▴' : `展开明细（${usageRows.length} 条）▾`}
              </button>
              {showRows && (
                <div className="mt-1.5 overflow-x-auto">
                  <table className="w-full text-[11px] num whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-400 text-left">
                        <th className="pr-3 font-normal py-1">时间</th>
                        <th className="pr-3 font-normal py-1">供应商</th>
                        <th className="pr-3 font-normal py-1">模型</th>
                        <th className="pr-3 font-normal py-1">用途</th>
                        <th className="pr-3 font-normal py-1 text-right">输入</th>
                        <th className="pr-3 font-normal py-1 text-right">输出</th>
                        <th className="font-normal py-1 text-right">费用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageRows.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                          <td className="pr-3 py-1">{String(r.created_at).slice(5, 16).replace('T', ' ')}</td>
                          <td className="pr-3 py-1">{r.provider_name}</td>
                          <td className="pr-3 py-1">{r.model}</td>
                          <td className="pr-3 py-1">{KIND_LABEL[r.kind] || r.kind}</td>
                          <td className="pr-3 py-1 text-right">{r.prompt_tokens ?? 0}</td>
                          <td className="pr-3 py-1 text-right">{r.completion_tokens ?? 0}</td>
                          <td className="py-1 text-right">¥{(r.cost ?? 0).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-sm">修改登录密码</h2>
        <input type="password" className="input" placeholder="原密码" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
        <input type="password" className="input" placeholder="新密码（至少 6 位）" value={newPassword} onChange={(e) => setNew(e.target.value)} />
        <input type="password" className="input" placeholder="确认新密码" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} />
        <button className="btn-primary w-full" disabled={saving} onClick={change}>{saving ? '保存中…' : '确认修改'}</button>
      </div>

      <div className="card p-5 space-y-2 opacity-60">
        <h2 className="font-semibold text-sm">数据备份与恢复</h2>
        <p className="text-xs text-slate-500">M4 里程碑交付：一键导出 zip（SQLite + uploads）与恢复。</p>
      </div>

      <div className="card p-5 space-y-1">
        <h2 className="font-semibold text-sm mb-1">关于</h2>
        <p className="text-xs text-slate-500">教学管理工作台 v{__APP_VERSION__} · M2（图片上传 + AI 分析 + 错题本 + 举一反三）</p>
        {system && (
          <div className="text-xs text-slate-500 num space-y-0.5 mt-2">
            <p>后端端口：{system.port}</p>
            <p className="break-all">数据目录：{system.data_dir}</p>
            <p className="break-all">图片目录：{system.uploads_dir}</p>
            <p>运行环境：Node {system.node} · {system.platform}</p>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">本地部署，学生数据仅存本机。调用外部 AI 分析作业图片时会将图片传输至所配置的 AI 供应商。</p>
      </div>

      <button
        className="btn-outline w-full !text-red-500"
        onClick={() => {
          if (!window.confirm('确定退出登录吗？')) return
          logout()
          window.location.href = '/login'
        }}
      >
        退出登录
      </button>
    </div>
  )
}
