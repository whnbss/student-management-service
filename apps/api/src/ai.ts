// AI 统一封装：OpenAI 兼容客户端（fetch 实现，无需 SDK）
// - 多供应商配置存 settings（JSON）
// - 输出严格 JSON 校验，失败自动重试 2 次（共 3 次尝试），绝不入库脏数据
// - 每次调用记录 token 用量与费用估算（ai_usage 表）
import { db, getSetting, nowISO } from './db'
import type { AiProvider, AiAnalysisResult, Grade, QuizDraft, QuizLevel, ParentReport, QuizReview, FigureSpec, LessonDiagnosis, LessonPlan } from '@workbench/shared'
import {
  ANALYZE_SYSTEM_PROMPT, analyzeUserPrompt,
  VARIANT_SYSTEM_PROMPT, QUIZ_SYSTEM_PROMPT, quizUserPrompt,
  TIERED_SYSTEM_PROMPT, REPORT_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT, reviewUserPrompt,
  FIX_SYSTEM_PROMPT, fixUserPrompt,
  LESSON_DIAGNOSE_SYSTEM_PROMPT, LESSON_PLAN_SYSTEM_PROMPT,
  sanitizeAiText, sanitizeLatexChinese, FIGURE_TEMPLATES,
} from '@workbench/shared'
import path from 'node:path'
import fs from 'node:fs'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

// ---------- 网络代理支持 ----------
// 公司内网通常禁止直连外网（直连会超时报 fetch failed），必须走 HTTP 代理；
// 代理若做了 HTTPS 中间人签名，还需加载其根证书（NODE_EXTRA_CA_CERTS 或 certs/corporate-ca.pem）。
let proxyAgentCache: { uri: string; agent: ProxyAgent } | null = null

function loadExtraCa(): string[] | undefined {
  const candidates = [
    process.env.NODE_EXTRA_CA_CERTS,
    path.join(process.cwd(), '..', 'certs', 'corporate-ca.pem'),
    path.join(process.cwd(), '..', '..', 'certs', 'corporate-ca.pem'), // apps/api 直接启动时项目根在上两级
    path.join(process.cwd(), 'certs', 'corporate-ca.pem'),
  ].filter(Boolean) as string[]
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) return [fs.readFileSync(f, 'utf8')]
    } catch { /* 读取失败则忽略，走默认证书 */ }
  }
  return undefined
}

function getDispatcher(): ProxyAgent | undefined {
  const setting = (getSetting('ai_proxy') || '').trim()
  const uri =
    setting ||
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy || ''
  if (!uri) return undefined
  if (proxyAgentCache && proxyAgentCache.uri === uri) return proxyAgentCache.agent
  const ca = loadExtraCa()
  const agent = new ProxyAgent({ uri, requestTls: ca ? { ca } : undefined })
  proxyAgentCache = { uri, agent }
  return agent
}

// 把底层网络错误翻译成教师能看懂的中文提示
export function friendlyAiError(e: any): string {
  const cause = String(e?.cause?.code || e?.cause?.message || '')
  const msg = String(e?.message || e || '')
  const all = cause + ' ' + msg
  if (msg.includes('Content Filter') || msg.includes('Access Denied')) {
    return '请求被网络内容过滤拦截（403 Access Denied）：当前网络环境不允许访问该 AI 供应商，请改用其它供应商（如阿里云百炼 DashScope）。'
  }
  if (msg.includes('aborted due to timeout') || msg.includes('Gateway Time-out') || cause.includes('TIMEOUT')) {
    return 'AI 服务器响应超时（可能是图片太大或网关繁忙）。可尝试重新拍照（光线充足、单页拍摄）后再试，或到「我的 → AI 配置」更换供应商/模型。'
  }
  if (msg.includes('request_too_large') || msg.includes('context_length_exceeded') || msg.includes('prompt is too long')) {
    return '请求内容超出模型限制。请重新拍照（尽量单页、光线好）后再试。'
  }
  if (msg.includes('fetch failed') || /UND_ERR_|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET/.test(cause)) {
    return `网络无法连接 AI 服务器（${cause || '连接超时'}）。若电脑需要代理才能上外网，请到「我的 → AI 配置」填写网络代理地址（如 http://proxy.xxx:8080），保存后重试。`
  }
  if (/SELF_SIGNED_CERT|ERR_TLS|CERT_|SSL/i.test(all)) {
    return 'TLS 证书校验失败（常见于公司代理对 HTTPS 做了中间人签名）。请在项目目录运行 certs\\export-ca.ps1 导出公司根证书，并用 start.bat 重启服务。'
  }
  return e?.message || 'AI 调用失败'
}

// ---------- 供应商配置 ----------
export const DEFAULT_PROVIDERS: AiProvider[] = [
  {
    id: 'dashscope',
    name: '阿里云百炼',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    api_key: '',
    vision_model: 'qwen-vl-max',
    text_model: 'qwen-plus',
    input_price: 0,
    output_price: 0,
  },
]

export function getProviders(): AiProvider[] {
  const raw = getSetting('ai_providers')
  if (!raw) return DEFAULT_PROVIDERS
  try {
    const list = JSON.parse(raw) as AiProvider[]
    return Array.isArray(list) ? list : DEFAULT_PROVIDERS
  } catch {
    return DEFAULT_PROVIDERS
  }
}

export function saveProviders(list: AiProvider[]) {
  getSetting('ai_providers') // 确保 settings 可用
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('ai_providers', JSON.stringify(list))
}

// ---------- 当前使用模型（用户可自选）----------
// active_provider 存的是用户在设置页选中的供应商 id；分析/变式题都用它，
// 若该供应商不可用（没填 Key 或没模型）则自动回退到第一个可用的，避免直接报错
export function getActiveProviderId(): string {
  return (getSetting('ai_active_provider') || '').trim()
}

export function setActiveProviderId(id: string) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('ai_active_provider', String(id || '').trim())
}

// kind: 'vision' 拍照分析（视觉模型优先、回退文本模型）；'text' 文本任务（变式题等）
export function pickProvider(kind: 'vision' | 'text'): AiProvider | null {
  const providers = getProviders()
  const usable = (p: AiProvider) => !!p.api_key && !!(kind === 'text' ? p.text_model || p.vision_model : p.vision_model || p.text_model)
  const activeId = getActiveProviderId()
  const active = providers.find((p) => p.id === activeId && usable(p))
  if (active) return active
  return providers.find(usable) || null
}

// ---------- 用量记录与费用估算 ----------
export function recordUsage(p: { provider_name: string; model: string; kind: string; prompt_tokens: number; completion_tokens: number; input_price: number; output_price: number }) {
  const cost =
    (p.prompt_tokens / 1_000_000) * (p.input_price || 0) +
    (p.completion_tokens / 1_000_000) * (p.output_price || 0)
  db.prepare(
    'INSERT INTO ai_usage(provider_name, model, kind, prompt_tokens, completion_tokens, cost, created_at) VALUES(?,?,?,?,?,?,?)'
  ).run(p.provider_name, p.model, p.kind, p.prompt_tokens, p.completion_tokens, cost, nowISO())
  return { prompt_tokens: p.prompt_tokens, completion_tokens: p.completion_tokens, cost: Number(cost.toFixed(6)) }
}

// ---------- OpenAI 兼容调用 ----------
interface ChatOptions {
  model: string
  system: string
  user: string
  images?: string[] // base64 data URL 列表（vision）
  temperature?: number
}

interface ChatResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number }
}

export async function chat(provider: AiProvider, opts: ChatOptions): Promise<ChatResult> {
  if (!provider.api_key) throw new Error('AI 供应商未配置 API Key，请到「我的 → AI 配置」填写')
  const base = provider.base_url.replace(/\/+$/, '')
  const content: any[] = [{ type: 'text', text: opts.user }]
  for (const img of opts.images || []) {
    content.push({ type: 'image_url', image_url: { url: img } })
  }
  const messages = [
    { role: 'system', content: opts.system },
    { role: 'user', content },
  ]

  // 统一超时：部分网关对大请求会长时间挂起（或 504），必须设上限，否则前端一直「分析中」
  const TIMEOUT_MS = 180_000

  const doFetch = (url: string, stream: boolean, withThinking = true) =>
    undiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.api_key}` },
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.2,
        // 关闭思考模式：思考型模型（GLM/DeepSeek-R 系）对复杂分析任务会先「思考」数千 token，
        // 网关等待首包超时（504）或流被截断，正文永远出不来。关闭后直接输出结果，速度快一个数量级
        ...(withThinking ? { thinking: { type: 'disabled' } } : {}),
        // 默认走流式：部分公司网关（如 APISIX/openresty 前置）对大 body 的非流式请求
        // 会返回 413 prompt too long 或直接挂起超时，流式则正常响应
        stream,
        stream_options: stream ? { include_usage: true } : undefined,
      }),
      dispatcher: getDispatcher(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    } as any)

  let res: Awaited<ReturnType<typeof undiciFetch>>
  try {
    let url = `${base}/chat/completions`
    res = await doFetch(url, true)
    // 兼容 baseURL 少写 /v1 的供应商：404 时自动补 /v1 重试一次
    if (res.status === 404 && !/\/v\d+$/.test(base)) {
      url = `${base}/v1/chat/completions`
      res = await doFetch(url, true)
    }
    // 极少数供应商不认识 thinking 参数：去掉该参数重试一次
    if (res.status === 400 || res.status === 422) {
      const errText = await res.text().catch(() => '')
      if (/thinking|unknown|invalid|unexpected|extra/i.test(errText)) {
        res = await doFetch(url, true, false)
      }
    }
  } catch (e: any) {
    throw new Error(friendlyAiError(e))
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const wrapped = new Error(`AI 接口错误(${res.status})：${text.slice(0, 300)}`)
    throw new Error(friendlyAiError(wrapped))
  }
  const ct = String(res.headers.get('content-type') || '')
  if (ct.includes('text/event-stream')) return await readStream(res)
  // 某些网关忽略 stream 参数，直接返回完整 JSON
  return await readNonStream(res)
}

// 聚合 SSE 流式响应：拼接 delta.content（忽略 reasoning_content 思考过程）
async function readStream(res: Awaited<ReturnType<typeof undiciFetch>>): Promise<ChatResult> {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let raw = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    raw += dec.decode(value, { stream: true })
  }
  let content = ''
  let usage = { prompt_tokens: 0, completion_tokens: 0 }
  for (const line of raw.split('\n')) {
    const l = line.trim()
    if (!l.startsWith('data:')) continue
    const payload = l.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const chunk = JSON.parse(payload)
      const delta = chunk?.choices?.[0]?.delta
      if (typeof delta?.content === 'string') content += delta.content
      if (chunk?.usage?.prompt_tokens) {
        usage = {
          prompt_tokens: chunk.usage.prompt_tokens ?? 0,
          completion_tokens: chunk.usage.completion_tokens ?? 0,
        }
      }
    } catch { /* 跳过无法解析的行 */ }
  }
  if (!content.trim()) throw new Error('AI 返回内容为空')
  return { content, usage }
}

// 读取非流式完整 JSON 响应
async function readNonStream(res: Awaited<ReturnType<typeof undiciFetch>>): Promise<ChatResult> {
  const data: any = await res.json()
  const contentOut = data?.choices?.[0]?.message?.content
  if (typeof contentOut !== 'string' || !contentOut.trim()) throw new Error('AI 返回内容为空')
  return {
    content: contentOut,
    usage: {
      prompt_tokens: data?.usage?.prompt_tokens ?? 0,
      completion_tokens: data?.usage?.completion_tokens ?? 0,
    },
  }
}

// 连通性测试：发一条极短消息
export async function testProvider(provider: AiProvider, model: string): Promise<{ reply: string; usage: ChatResult['usage'] }> {
  const r = await chat(provider, { model, system: '你是连通性测试助手', user: '请只回复：OK' })
  return { reply: r.content.trim().slice(0, 50), usage: r.usage }
}

// ---------- JSON 输出解析与校验 ----------
function extractJson(text: string): string {
  // 兼容模型偶发的 ```json 包裹
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  // 截取首个 { 或 [ 到最后一个 } 或 ]
  const start = Math.min(...['{', '['].map((c) => { const i = t.indexOf(c); return i === -1 ? Infinity : i }))
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (start === Infinity || end === -1) throw new Error('AI 输出中未找到 JSON')
  return t.slice(start, end + 1)
}

const VERDICTS = ['对', '错', '部分对', '未作答', '无法识别']
const ERROR_TYPES = ['概念不清', '公式/模型用错', '计算失误', '审题偏差', '过程不规范', '时间分配问题', '其他']
const SEVERITIES = ['高', '中', '低']

function validateAnalysis(obj: any): AiAnalysisResult {
  if (!obj || typeof obj !== 'object') throw new Error('分析结果不是对象')
  const meta = obj.paper_meta || {}
  const r: AiAnalysisResult = {
    paper_meta: {
      type: ['作业', '试卷', '练习'].includes(meta.type) ? meta.type : '作业',
      grade: (['高一', '高二', '高三'].includes(meta.grade) ? meta.grade : '高一') as Grade,
      score_estimate: Number(meta.score_estimate) || 0,
    },
    items: Array.isArray(obj.items)
      ? obj.items.map((it: any, i: number) => ({
          no: Number(it?.no) || i + 1,
          verdict: VERDICTS.includes(it?.verdict) ? it.verdict : '无法识别',
          error_step: String(it?.error_step || ''),
          error_type: ERROR_TYPES.includes(it?.error_type) ? it.error_type : '',
          knowledge_points: Array.isArray(it?.knowledge_points) ? it.knowledge_points.map(String) : [],
          comment: String(it?.comment || ''),
          // ---- B4 原题还原：逐字题干 / 选项 / 参考答案 / 配图重绘规格（识别不清严禁编造） ----
          stem: sanitizeLatexChinese(sanitizeAiText(it?.stem)).trim(),
          options: Array.isArray(it?.options) ? it.options.map((o: any) => sanitizeLatexChinese(sanitizeAiText(o)).trim()).filter(Boolean) : [],
          reference_answer: sanitizeLatexChinese(sanitizeAiText(it?.reference_answer)).trim(),
          figure_spec: sanitizeFigureSpec(it?.figure_spec),
          figure_status: it?.figure_status === '图待补' ? '图待补' : it?.figure_status === '已重绘' ? '已重绘' : '',
        }))
      : [],
    weak_points: Array.isArray(obj.weak_points)
      ? obj.weak_points.map((w: any) => ({
          point: String(w?.point || ''),
          evidence: String(w?.evidence || ''),
          severity: SEVERITIES.includes(w?.severity) ? w.severity : '中',
        }))
      : [],
    framework: Array.isArray(obj.framework)
      ? obj.framework.map((f: any) => ({
          chapter: String(f?.chapter || ''),
          mastered: Array.isArray(f?.mastered) ? f.mastered.map(String) : [],
          shaky: Array.isArray(f?.shaky) ? f.shaky.map(String) : [],
          missing: Array.isArray(f?.missing) ? f.missing.map(String) : [],
        }))
      : [],
    next_class_questions: Array.isArray(obj.next_class_questions) ? obj.next_class_questions.map(String) : [],
    suggestions: Array.isArray(obj.suggestions) ? obj.suggestions.map(String) : [],
    overall_comment: String(obj.overall_comment || ''),
    unrecognized: Array.isArray(obj.unrecognized) ? obj.unrecognized.map(String) : [],
  }
  return r
}

function validateVariants(obj: any): Array<{ stem: string; answer: string; solution: string; pitfall: string; knowledge_points: string[]; difficulty: number; qtype: string }> {
  const arr = Array.isArray(obj) ? obj : obj?.questions
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('变式题结果不是非空数组')
  return arr.slice(0, 3).map((q: any) => ({
    stem: sanitizeLatexChinese(sanitizeAiText(q?.stem)).trim(),
    answer: sanitizeLatexChinese(sanitizeAiText(q?.answer)).trim(),
    solution: sanitizeLatexChinese(sanitizeAiText(q?.solution)).trim(),
    pitfall: sanitizeLatexChinese(sanitizeAiText(q?.pitfall)).trim(),
    knowledge_points: Array.isArray(q?.knowledge_points) ? q.knowledge_points.map(String) : [],
    difficulty: Math.min(5, Math.max(1, Number(q?.difficulty) || 3)),
    qtype: ['选择', '填空', '实验', '计算'].includes(q?.qtype) ? q.qtype : '计算',
  })).filter((q) => q.stem)
}

// 带重试的 JSON 调用：失败自动重试 2 次（共 3 次）
async function chatJson<T>(provider: AiProvider, opts: ChatOptions, validate: (o: any) => T, kind: string): Promise<{ result: T; usage: ReturnType<typeof recordUsage> }> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await chat(provider, opts)
      const parsed = validate(JSON.parse(extractJson(r.content)))
      const usage = recordUsage({
        provider_name: provider.name,
        model: opts.model,
        kind,
        prompt_tokens: r.usage.prompt_tokens,
        completion_tokens: r.usage.completion_tokens,
        input_price: provider.input_price,
        output_price: provider.output_price,
      })
      return { result: parsed, usage }
    } catch (e: any) {
      lastErr = e
      console.error(`[ai] ${kind} 第 ${attempt + 1} 次尝试失败:`, e.message)
    }
  }
  throw lastErr ? new Error(friendlyAiError(lastErr)) : new Error('AI 调用失败')
}

// ---------- 业务（P1）：AI 出题器 / 分层练习 / 家长阶段报告 ----------

// figure_spec 校验：模板名必须在白名单内，params 收敛为 number|string
function sanitizeFigureSpec(raw: any): { template: string; params: Record<string, number | string> } | null {
  if (!raw || typeof raw !== 'object' || typeof raw.template !== 'string') return null
  const t = raw.template.trim()
  if (!(FIGURE_TEMPLATES as readonly string[]).includes(t)) return null
  const params: Record<string, number | string> = {}
  const p = raw.params
  if (p && typeof p === 'object') {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' && Number.isFinite(v)) params[k] = v
      else if (typeof v === 'string' && v.trim()) params[k] = v.trim().slice(0, 30)
    }
  }
  return { template: t, params }
}

// 出题/分层练习共用的题目草稿校验（题干必填，难度收敛 1~5，题型白名单，文本清洗字面 \n 与裸中文上下标，figure_spec 白名单）
export function validateQuizDrafts(arr: any, max = 30): QuizDraft[] {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('出题结果不是非空数组')
  return arr.slice(0, max).map((q: any) => ({
    stem: sanitizeLatexChinese(sanitizeAiText(q?.stem)).trim(),
    answer: sanitizeLatexChinese(sanitizeAiText(q?.answer)).trim(),
    solution: sanitizeLatexChinese(sanitizeAiText(q?.solution)).trim(),
    pitfall: sanitizeLatexChinese(sanitizeAiText(q?.pitfall)).trim(),
    knowledge_points: Array.isArray(q?.knowledge_points) ? q.knowledge_points.map((k: any) => String(k)) : [],
    difficulty: Math.min(5, Math.max(1, Number(q?.difficulty) || 3)),
    qtype: ['选择', '填空', '实验', '计算'].includes(q?.qtype) ? q.qtype : '计算',
    figure_spec: sanitizeFigureSpec(q?.figure_spec),
  })).filter((q) => q.stem)
}

// AI 出题器：按知识点/题型/数量/难度档命题，返回草稿（教师编辑确认后才入库）
export async function generateQuiz(
  provider: AiProvider,
  p: { kps: string[]; qtypes: string[]; count: number; level: QuizLevel; grade: string; hint?: string }
): Promise<{ result: QuizDraft[]; usage: ReturnType<typeof recordUsage> }> {
  return chatJson(
    provider,
    { model: provider.text_model || provider.vision_model, system: QUIZ_SYSTEM_PROMPT, user: quizUserPrompt(p), temperature: 0.7 },
    (o) => validateQuizDrafts(o, p.count + 5),
    'quiz'
  )
}

// 二审质检：对生成的题目草稿做第二次 AI 调用挑错（数值自洽/情境几何/超纲/解析含试错/缺图）
// 返回与 drafts 一一对应的审查结果；fixed 有值时为修正稿（前端展示 issues 并可采纳 fixed）
export async function reviewQuizDrafts(
  provider: AiProvider,
  drafts: QuizDraft[]
): Promise<{ result: QuizReview[]; usage: ReturnType<typeof recordUsage> }> {
  const validate = (obj: any): QuizReview[] => {
    if (!Array.isArray(obj) || obj.length === 0) throw new Error('二审结果不是非空数组')
    return obj.slice(0, drafts.length).map((r: any) => {
      const issues = Array.isArray(r?.issues) ? r.issues.map((s: any) => sanitizeAiText(s)).filter(Boolean) : []
      let fixed: QuizDraft | null = null
      const fixedValidated = r?.fixed ? validateQuizDrafts([r.fixed], 1) : []
      if (fixedValidated[0]) {
        fixed = { ...fixedValidated[0], figure_spec: sanitizeFigureSpec(r.fixed?.figure_spec) ?? fixedValidated[0].figure_spec ?? null }
      }
      return { pass: !!r?.pass || (issues.length === 0 && !fixed), issues, fixed }
    })
  }
  return chatJson(
    provider,
    { model: provider.text_model || provider.vision_model, system: REVIEW_SYSTEM_PROMPT, user: reviewUserPrompt(drafts), temperature: 0.1 },
    validate,
    'review'
  )
}

// 二审闭环修复：把未过审的题目草稿与问题清单喂回模型，输出完整修正稿（自动修复用，教师只看到终稿）
export async function fixQuizDraft(
  provider: AiProvider,
  q: QuizDraft,
  issues: string[]
): Promise<{ result: { draft: QuizDraft; fix_note: string }; usage: ReturnType<typeof recordUsage> }> {
  const validate = (obj: any): { draft: QuizDraft; fix_note: string } => {
    const arr = validateQuizDrafts([obj], 1)
    if (!arr.length) throw new Error('修正稿题干无效')
    return { draft: arr[0], fix_note: sanitizeAiText(String(obj?.fix_note || '')).trim().slice(0, 200) }
  }
  return chatJson(
    provider,
    { model: provider.text_model || provider.vision_model, system: FIX_SYSTEM_PROMPT, user: fixUserPrompt(q, issues), temperature: 0.3 },
    validate,
    'quiz-fix'
  )
}

// 分层练习：三档各 2~3 题
function validateTiered(obj: any): { '基础': QuizDraft[]; '巩固': QuizDraft[]; '拔尖': QuizDraft[] } {
  if (!obj || typeof obj !== 'object') throw new Error('分层练习结果不是对象')
  const tiers = ['基础', '巩固', '拔尖'] as const
  const out: any = {}
  for (const t of tiers) {
    const arr = obj[t] || obj[t === '基础' ? 'basic' : t === '巩固' ? 'consolidate' : 'advanced']
    out[t] = validateQuizDrafts(arr, 5)
  }
  return out
}

export async function generateTiered(
  provider: AiProvider,
  p: { kps: string[]; grade: string; mastery_note: string }
): Promise<{ result: { '基础': QuizDraft[]; '巩固': QuizDraft[]; '拔尖': QuizDraft[] }; usage: ReturnType<typeof recordUsage> }> {
  const user = `知识点：${p.kps.join('、') || '（教师未指定，请覆盖该生主要薄弱点）'}
学生年级：${p.grade || '高一'}
学生当前掌握情况：${p.mastery_note || '（无记录）'}
请按约定 JSON 结构输出三档练习。`
  return chatJson(provider, { model: provider.text_model || provider.vision_model, system: TIERED_SYSTEM_PROMPT, user, temperature: 0.7 }, validateTiered, 'tiered')
}

// 家长阶段报告：基于学情日志 + 错题 + 出勤数据生成三段式报告草稿
function validateReport(obj: any): ParentReport {
  if (!obj || typeof obj !== 'object') throw new Error('报告结果不是对象')
  const lines = (v: any) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [])
  const r: ParentReport = {
    summary: String(obj.summary || '').trim(),
    glow: lines(obj.glow),
    grow: lines(obj.grow),
    plan: lines(obj.plan),
    payment_hint: String(obj.payment_hint || '').trim(),
  }
  if (!r.glow.length && !r.grow.length && !r.plan.length) throw new Error('报告三段式内容为空')
  return r
}

export async function generateParentReport(
  provider: AiProvider,
  data: {
    student: { name: string; grade: string; textbook: string }
    range: { from: string; to: string }
    logs: Array<{ date: string; type: string; content: string; next_class_key: string }>
    mistakes: Array<{ knowledge_points: string[]; error_type: string; mastery_status: string; stem: string }>
    attendance: { 到课: number; 请假: number; 缺勤: number }
    remaining_hours: number
  }
): Promise<{ result: ParentReport; usage: ReturnType<typeof recordUsage> }> {
  // 数据瘦身：日志单条截断、限量，控制 token 成本
  const logLines = data.logs.slice(0, 40).map((l) => `- ${l.date}[${l.type}] ${l.content.slice(0, 160)}${l.next_class_key ? `（下次课重点：${l.next_class_key.slice(0, 60)}）` : ''}`).join('\n') || '（该时段无学情记录）'
  const kpCount = new Map<string, number>()
  for (const m of data.mistakes) for (const k of m.knowledge_points) kpCount.set(k, (kpCount.get(k) || 0) + 1)
  const kpTop = [...kpCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}×${n}`).join('、') || '无'
  const errCount = new Map<string, number>()
  for (const m of data.mistakes) if (m.error_type) errCount.set(m.error_type, (errCount.get(m.error_type) || 0) + 1)
  const errTop = [...errCount.entries()].map(([k, n]) => `${k}×${n}`).join('、') || '无'
  const mastery = {
    未掌握: data.mistakes.filter((m) => m.mastery_status === '未掌握').length,
    已重做一次: data.mistakes.filter((m) => m.mastery_status === '已重做一次').length,
    已掌握: data.mistakes.filter((m) => m.mastery_status === '已掌握').length,
  }
  const user = `学生：${data.student.name}（${data.student.grade}，${data.student.textbook || '人教版'}）
报告时段：${data.range.from} ~ ${data.range.to}
出勤：到课 ${data.attendance.到课} 次、请假 ${data.attendance.请假} 次、缺勤 ${data.attendance.缺勤} 次
错题：共 ${data.mistakes.length} 道（未掌握 ${mastery.未掌握} / 重做中 ${mastery.已重做一次} / 已掌握 ${mastery.已掌握}）
高频薄弱知识点：${kpTop}
错因分布：${errTop}
剩余课时：${data.remaining_hours}${data.remaining_hours <= 3 ? '（偏少，可在 payment_hint 中得体提醒）' : ''}
学情记录：
${logLines}
请按约定 JSON 结构输出家长阶段报告。`
  return chatJson(provider, { model: provider.text_model || provider.vision_model, system: REPORT_SYSTEM_PROMPT, user, temperature: 0.4 }, validateReport, 'report')
}

// ---------- 业务：作业图片分析 ----------
export async function analyzePaper(
  provider: AiProvider,
  images: string[], // base64 data URL
  student: { name: string; grade: string; textbook: string }
): Promise<{ result: AiAnalysisResult; usage: ReturnType<typeof recordUsage> }> {
  if (!images.length) throw new Error('没有可分析的图片')
  // 模型选择：视觉模型优先；未填视觉模型时回退到文本模型（部分文本模型实际支持多模态输入，交给供应商自行报错）
  return chatJson(
    provider,
    {
      model: provider.vision_model || provider.text_model,
      system: ANALYZE_SYSTEM_PROMPT,
      user: analyzeUserPrompt(student.grade, student.textbook) + ` 学生姓名：${student.name}。`,
      images,
      temperature: 0.1,
    },
    validateAnalysis,
    'analyze'
  )
}

// ---------- 业务：错题举一反三 ----------
export async function generateVariants(
  provider: AiProvider,
  mistake: { stem: string; correct_solution: string; error_type: string; knowledge_points: string[]; difficulty: number }
): Promise<{ result: Array<{ stem: string; answer: string; solution: string; pitfall: string; knowledge_points: string[]; difficulty: number; qtype: string }>; usage: ReturnType<typeof recordUsage> }> {
  const user = `原错题信息：
- 题干：${mistake.stem}
- 正确解法：${mistake.correct_solution || '（未填写）'}
- 错因：${mistake.error_type || '未分类'}
- 知识点：${mistake.knowledge_points.join('、') || '未标注'}
- 难度：${mistake.difficulty}（1~5）
请出 2~3 道变式题。`
  return chatJson(
    provider,
    { model: provider.text_model, system: VARIANT_SYSTEM_PROMPT, user, temperature: 0.7 },
    validateVariants,
    'variants'
  )
}

// ---------- 业务（B5）：智能教案 —— 试卷照片逐题诊断 → 结构化错题讲义 ----------
const txtArr = (v: any): string[] => (Array.isArray(v) ? v.map((x) => sanitizeAiText(String(x))).filter(Boolean) : [])

function validateDiagnosis(obj: any): LessonDiagnosis {
  if (!obj || typeof obj !== 'object') throw new Error('诊断结果不是对象')
  const items = Array.isArray(obj.items) ? obj.items : []
  if (!items.length) throw new Error('诊断结果没有题目')
  return {
    paper_name: sanitizeAiText(obj.paper_name || '').trim(),
    paper_note: sanitizeAiText(obj.paper_note || '').trim(),
    items: items.map((it: any, i: number) => ({
      no: sanitizeAiText(String(it?.no ?? i + 1)).trim(),
      qtype: it?.qtype === '选择' ? '选择' : '非选择',
      stem: sanitizeLatexChinese(sanitizeAiText(it?.stem || '')).trim(),
      options: txtArr(it?.options),
      context: sanitizeAiText(it?.context || '').trim(),
      kp: sanitizeAiText(it?.kp || '').trim(),
      student_answer: sanitizeAiText(it?.student_answer || '').trim(),
      correct_answer: sanitizeLatexChinese(sanitizeAiText(it?.correct_answer || '')).trim(),
      solution: sanitizeLatexChinese(sanitizeAiText(it?.solution || '')).trim(),
      gap: sanitizeAiText(it?.gap || '').trim(),
    })),
    note: sanitizeAiText(obj.note || '').trim(),
  }
}

function validateLessonPlan(obj: any): LessonPlan {
  if (!obj || typeof obj !== 'object') throw new Error('教案结果不是对象')
  const cover = obj.cover || {}
  const ov = obj.overview || {}
  const table = (arr: any) =>
    (Array.isArray(arr) ? arr : []).map((r: any) => ({
      no: sanitizeAiText(r?.no || ''),
      context: sanitizeAiText(r?.context || ''),
      kp: sanitizeAiText(r?.kp || ''),
      answer: sanitizeLatexChinese(sanitizeAiText(r?.answer || '')),
      correct: sanitizeLatexChinese(sanitizeAiText(r?.correct || '')),
      gap: sanitizeAiText(r?.gap || ''),
    })).filter((r: any) => r.no)
  const frameworks = (Array.isArray(obj.frameworks) ? obj.frameworks : []).map((f: any) => ({
    title: sanitizeAiText(f?.title || '').trim(),
    targets: sanitizeAiText(f?.targets || '').trim(),
    priority: sanitizeAiText(f?.priority || '').trim(),
    content: txtArr(f?.content),
    self_check: txtArr(f?.self_check),
  })).filter((f: any) => f.title && f.content.length)
  const variants = (Array.isArray(obj.variants) ? obj.variants : []).map((v: any) => ({
    ref: sanitizeAiText(v?.ref || '').trim(),
    topic: sanitizeAiText(v?.topic || '').trim(),
    stem: sanitizeLatexChinese(sanitizeAiText(v?.stem || '')).trim(),
    solution: sanitizeLatexChinese(sanitizeAiText(v?.solution || '')).trim(),
    insight: sanitizeAiText(v?.insight || '').trim(),
  })).filter((v: any) => v.stem)
  const hw = obj.homework || {}
  const plan: LessonPlan = {
    cover: {
      title: sanitizeAiText(cover.title || '').trim() || '物理错题讲义',
      subtitle: sanitizeAiText(cover.subtitle || '').trim(),
      source: sanitizeAiText(cover.source || '').trim(),
      time: sanitizeAiText(cover.time || '').trim(),
      composition: sanitizeAiText(cover.composition || '').trim(),
    },
    overview: {
      text: sanitizeAiText(ov.text || '').trim(),
      choice_table: table(ov.choice_table),
      nonchoice_table: table(ov.nonchoice_table),
      mainlines: txtArr(ov.mainlines),
      strengths: sanitizeAiText(ov.strengths || '').trim(),
    },
    frameworks,
    variants,
    homework: { text: sanitizeAiText(hw?.text || '').trim(), items: txtArr(hw?.items) },
  }
  // 结构底线：诊断表与变式题是讲义的灵魂，缺失即失败（触发重试）
  if (!plan.overview.choice_table.length && !plan.overview.nonchoice_table.length) throw new Error('教案缺少失分诊断表')
  if (plan.variants.length < 3) throw new Error('教案变形训练题不足 3 道')
  return plan
}

// 第一步：视觉模型逐题诊断试卷照片
export async function diagnosePaper(
  provider: AiProvider,
  images: string[],
  meta: { grade: string; examName: string }
): Promise<{ result: LessonDiagnosis; usage: ReturnType<typeof recordUsage> }> {
  if (!images.length) throw new Error('没有可诊断的图片')
  return chatJson(
    provider,
    {
      model: provider.vision_model || provider.text_model,
      system: LESSON_DIAGNOSE_SYSTEM_PROMPT,
      user: `学生年级：${meta.grade || '未知'}。试卷名称：${meta.examName || '（未命名，按卷面识别）'}。\n请逐题诊断这批试卷照片并按约定 JSON 结构输出。`,
      images,
      temperature: 0.1,
    },
    validateDiagnosis,
    'lesson-diagnose'
  )
}

// 第二步：文本模型生成完整教案（结构模仿示例错题讲义 docx）
export async function generateLessonPlan(
  provider: AiProvider,
  p: { diagnosis: LessonDiagnosis; grade: string; today: string }
): Promise<{ result: LessonPlan; usage: ReturnType<typeof recordUsage> }> {
  const d = p.diagnosis
  const lines = d.items.map((it) =>
    `【第${it.no}题·${it.qtype}】考查点：${it.kp || '（未标注）'}；学生作答：${it.student_answer || '（卷面未见）'}；正解：${it.correct_answer || '（待定）'}；关键步骤：${(it.solution || '').slice(0, 300)}；漏洞分析：${(it.gap || '').slice(0, 200)}\n原题：${(it.stem || '').slice(0, 400)}${it.options.length ? '\n选项：' + it.options.join(' | ') : ''}`
  ).join('\n\n')
  const user = `学生年级：${p.grade || '未知'}
试卷：${d.paper_name || '（未命名）'}${d.paper_note ? `（${d.paper_note}）` : ''}
今天日期：${p.today}
逐题诊断结果：
${lines}
${d.note ? `识别说明：${d.note}` : ''}
请按约定 JSON 结构输出完整教案（cover/overview/frameworks/variants/homework 五部分齐全）。`
  return chatJson(
    provider,
    { model: provider.text_model || provider.vision_model, system: LESSON_PLAN_SYSTEM_PROMPT, user, temperature: 0.4 },
    validateLessonPlan,
    'lesson-plan'
  )
}
