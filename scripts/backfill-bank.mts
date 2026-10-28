// 题库分批补题脚本（npx tsx scripts/backfill-bank.mts [批大小=12] [--mix "选择:3,填空:3,实验:2,计算:2"] [--diff "5:3:2"] [--plan <file>]）
// 目标：优先为「0 题覆盖」的教材考点出题，难度梯度 基础:中档:压轴 ≈ 5:3:2（基础 D1-2 / 中档 D3 / 压轴 D4-5），题型四类混合
// 流程：统计覆盖 →（自动模式）选 0 覆盖考点 /（--plan 模式）按计划文件的考点与配比 → 逐组调智能出题（生成+自动二审）→ 只入库二审通过的题（带配图）
// 难度落库口径：基础档收敛到 1~2、中档强制 3、压轴强制 5（避免模型把中档写成 D4、压轴写成 D4 造成梯度断层）
// 注意：本脚本直接操作题库（用户已批的补题任务），不触碰学生/账号/结算数据
import { specToSvg } from '../apps/web/src/lib/figure.ts'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const BASE = 'http://localhost:3210'
const BATCH = Math.max(1, Math.min(20, Number(process.argv[2] || 12)))
let token = ''

// CLI 参数解析：--mix "选择:3,填空:3,实验:2,计算:2"  --diff "5:3:2"  --plan <plan.json>
function argOf(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const MIX_ARG = argOf('--mix')
const DIFF_ARG = argOf('--diff')
const PLAN_ARG = argOf('--plan')
// 压轴/实验组生成持续被二审驳回时，可临时切换供应商/模型跑本批（跑完自动还原用户原配置）：
// --provider <供应商id> --model <模型名>（只临时替换该供应商的 text_model）
const PROVIDER_ARG = argOf('--provider')
const MODEL_ARG = argOf('--model')
let savedProviderState: { providers: unknown; active_id: string } | null = null

// 临时切换当前使用的供应商/模型（脚本结束前 restoreProviders 还原，绝不动用户的 Key 与其它配置）
async function switchProvider(providerId?: string, model?: string) {
  const cur = await req('GET', '/api/settings/ai')
  if (cur.status !== 200 || !cur.data?.providers?.length) throw new Error('读取 AI 配置失败')
  savedProviderState = { providers: cur.data.providers, active_id: cur.data.active_id || '' }
  const providers = (cur.data.providers as any[]).map((p) => ({
    ...p,
    text_model: p.id === providerId && model ? model : p.text_model,
  }))
  if (providerId && !providers.some((p: any) => p.id === providerId)) throw new Error(`供应商 ${providerId} 不存在`)
  const put = await req('PUT', '/api/settings/ai', { providers, active_id: providerId || cur.data.active_id })
  if (put.status !== 200 || !put.data?.ok) throw new Error('切换供应商失败：' + JSON.stringify(put.data))
  console.log(`（已临时切换当前模型 → ${providerId}${model ? ` / ${model}` : ''}）`)
}

async function restoreProviders() {
  if (!savedProviderState) return
  await req('PUT', '/api/settings/ai', { providers: savedProviderState.providers, active_id: savedProviderState.active_id })
  const back = await req('GET', '/api/settings/ai')
  const ok = back.status === 200 && back.data?.active_id === savedProviderState.active_id
  console.log(`（已还原你的智能服务配置，active=${savedProviderState.active_id}${ok ? ' ✓回读确认' : ' ⚠回读不一致，请到设置页检查'}）`)
  savedProviderState = null
}

// 难度档 → level（接口三档）与落库难度收敛规则
const TIER_LEVEL: Record<string, '基础' | '高考' | '竞赛'> = { 基础: '基础', 中档: '高考', 压轴: '竞赛' }
function settleDifficulty(tier: string, modelD: number): number {
  if (tier === '中档') return 3
  if (tier === '压轴') return 5
  return Math.min(2, Math.max(1, modelD || 2)) // 基础：模型给 1~2 内就保留，越界收敛到 2
}

// 题型配比字符串 → ["选择",3] ...；难度配比 "5:3:2" → [5,3,2]
function parseMix(s?: string): Array<[string, number]> | null {
  if (!s) return null
  const out: Array<[string, number]> = []
  for (const part of s.split(/[,，]/)) {
    const [t, n] = part.split(/[:：]/).map((x) => x.trim())
    if (t && Number(n) > 0) out.push([t, Math.floor(Number(n))])
  }
  return out.length ? out : null
}
function parseDiff(s?: string): [number, number, number] | null {
  if (!s) return null
  const p = s.split(/[:：]/).map((x) => Number(x.trim()))
  if (p.length === 3 && p.every((n) => n >= 0)) return [p[0], p[1], p[2]] as [number, number, number]
  return null
}

// 按题型配比 + 难度配比，把总题数展开成（题型×难度档）槽位列表
// 展开规则：先按 5:3:2 循环铺难度档（大题量下近似配比，小题量四舍五入保压轴/中档优先级），再按题型配比轮转分配题型
function expandSlots(total: number, mix: Array<[string, number]> | null, diff: [number, number, number] | null): Array<{ qtype: string; tier: string }> {
  const tiers: string[] = []
  if (diff) {
    const [b, m, z] = diff
    const unit = b + m + z
    let base = Math.round((total * b) / unit)
    let mid = Math.round((total * m) / unit)
    let zh = total - base - mid
    if (zh < 0) { base += zh; zh = 0 }
    if (mid < 0) { base += mid; mid = 0 }
    tiers.push(...Array(base).fill('基础'), ...Array(mid).fill('中档'), ...Array(zh).fill('压轴'))
  } else {
    // 默认 ≈5:3:2
    const zh = Math.max(1, Math.round(total * 0.2))
    const mid = Math.max(1, Math.round(total * 0.3))
    const base = Math.max(0, total - zh - mid)
    tiers.push(...Array(base).fill('基础'), ...Array(mid).fill('中档'), ...Array(zh).fill('压轴'))
  }
  const qtypes: string[] = []
  if (mix && mix.length) {
    for (const [t, n] of mix) qtypes.push(...Array(n).fill(t))
  } else {
    // 默认：计算为主、选择穿插，其余题型轮转（保证四题型混合）
    const rotate = ['计算', '选择', '填空', '实验', '计算', '选择']
    for (let i = 0; i < total; i++) qtypes.push(i < 2 ? (i === 0 ? '计算' : '选择') : rotate[i % rotate.length])
  }
  while (qtypes.length < total) qtypes.push(qtypes[qtypes.length % Math.max(1, qtypes.length)] || '计算')
  const slots: Array<{ qtype: string; tier: string }> = []
  for (let i = 0; i < total; i++) slots.push({ qtype: qtypes[i], tier: tiers[i] })
  return slots
}

// ---------- 同批数据指纹查重（验收 #12 P2-20 长期修法） ----------
// 现有查重只比题干前 40 字，同批两道「数据全同/正确选项逐字相同」的题互不知晓（#419/#420、#424/#427）。
// 指纹 = 题干数字多重集（降序拼接）+ 选择题正确选项原文（去空白）；仅当两题共享知识点时才判重，避免误杀同数字不同考点。
function stemFingerprint(stem: string, answer: string): string {
  const norm = String(stem || '')
    .replace(/\\(?:text|mathrm|mathit|mathbf)\{[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}$]/g, '')
  const nums = (norm.match(/\d+(?:\.\d+)?/g) || []).map(Number).sort((a, b) => b - a).join(',')
  const m = /^\s*([A-D])\s*$/.exec(String(answer || ''))
  let opt = ''
  if (m) {
    const re = new RegExp(`^${m[1]}\\s*[.、．:：]`)
    const line = String(stem || '').split('\n').map((l) => l.trim()).find((l) => re.test(l))
    if (line) opt = line.replace(/\s+/g, '')
  }
  return nums + (opt ? '|' + opt : '')
}
const batchFp = new Map<string, string[]>() // 指纹 → 已入库题的知识点列表

// 返回过滤掉同批指纹重复题后的列表；重复题记入 skipped
function dedupBatchFingerprint(drafts: any[], kps: string[], label: string, out: { skipped: string[] }): any[] {
  const outList: any[] = []
  for (const d of drafts) {
    const fp = stemFingerprint(d.stem, d.answer)
    if (fp && fp !== ',') {
      const prevKps = batchFp.get(fp)
      const myKps: string[] = d.knowledge_points || kps || []
      if (prevKps && prevKps.some((k) => myKps.includes(k))) {
        out.skipped.push(`${label}：同批数据指纹重复（数字组合/正确选项与已入库题相同），未入库`)
        continue
      }
      const list = batchFp.get(fp) || []
      list.push(...myKps)
      batchFp.set(fp, [...new Set(list)])
    }
    outList.push(d)
  }
  return outList
}

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

// 册 → 年级
const GRADE_OF: Record<string, string> = { bxF1: '高一', bxF2: '高一', bxF3: '高二', xxF1: '高二', xxF2: '高二', xxF3: '高三' }

function kpOf(raw: string): string[] {
  try { return JSON.parse(raw || '[]') as string[] } catch { return [] }
}

// 考点是否已被某题覆盖（模糊匹配：任一知识点与节名互为子串）
function covered(kps: string[], section: string): boolean {
  return kps.some((k) => section.includes(k) || k.includes(section))
}

// 计划文件结构：{ topics: [{ vol, chapter, grade, groups: [{ qtype, tier, n, kps, note? }] }] }
type PlanGroup = { qtype: string; tier: string; n: number; kps: string[]; note?: string }
type PlanTopic = { vol: string; chapter: string; grade: string; groups: PlanGroup[] }

// 把（题型×难度档）相同的组内槽位合并成出题调用
function groupSlots(slots: Array<{ qtype: string; tier: string }>): Array<{ qtype: string; tier: string; n: number }> {
  const map = new Map<string, number>()
  for (const s of slots) {
    const k = `${s.qtype}|${s.tier}`
    map.set(k, (map.get(k) || 0) + 1)
  }
  // 固定顺序输出，日志稳定
  const order = ['选择', '填空', '实验', '计算']
  return [...map.entries()]
    .map(([k, n]) => { const [qtype, tier] = k.split('|'); return { qtype, tier, n } })
    .sort((a, b) => order.indexOf(a.qtype) - order.indexOf(b.qtype) || a.tier.localeCompare(b.tier, 'zh'))
}

async function generateAndSave(opts: {
  label: string; grade: string; kps: string[]; qtype: string; tier: string; n: number; note?: string
}, out: { saved: number; skipped: string[]; failed: Array<{ label: string; err: string }> }): Promise<number> {
  const { label, grade, kps, qtype, tier, n, note } = opts
  const level = TIER_LEVEL[tier] || '高考'
  console.log(`\n▶ ${label}（${grade} · ${qtype} · ${tier}/${level} · ${n} 题）…`)
  try {
    const g = await req('POST', '/api/quiz/generate', { kps, count: n, level, qtypes: [qtype], grade, hint: note })
    if (g.status !== 200 || !g.data?.ok) { out.failed.push({ label, err: g.data?.error || `HTTP ${g.status}` }); return 0 }
    let drafts = (g.data.questions || []) as any[]
    const reviews = (g.data.review || []) as any[]
    if (note) console.log(`  附加要求：${note}`)
    // 难度按档位收敛落库（中档→3、压轴→5、基础→1~2）；二审结果与草稿按原始下标配对后再过滤（防下标错位）
    let pairs = drafts.map((d, j) => ({ d, review: reviews[j] })).map(({ d, review }) => ({
      d: { ...d, qtype, difficulty: settleDifficulty(tier, d.difficulty) },
      review,
    }))
    // 缺图守卫：题干出现「如图」但配图渲染为空（模板不存在/参数非法）→ 弃用，保证全库 0 缺图
    const noFig = pairs.filter(({ d }) => /如图|图所示/.test(d.stem || '') && !(d.figure_spec && specToSvg(d.figure_spec)))
    if (noFig.length) out.skipped.push(`${label}：${noFig.length} 题题干称「如图」但配图渲染失败，已弃用`)
    pairs = pairs.filter(({ d }) => !(/如图|图所示/.test(d.stem || '') && !(d.figure_spec && specToSvg(d.figure_spec))))
    const good = dedupBatchFingerprint(pairs.filter(({ review }) => !review || review.pass).map(({ d }) => d), kps, label, out)
    const bad = drafts.length - good.length
    if (bad > 0) out.skipped.push(`${label}：${bad} 题二审未过，已弃用`)
    if (!good.length) { console.log('  二审全部未过，跳过入库'); return 0 }
    const payload = good.map((d) => ({
      ...d,
      grade,
      // 强制注入节名标签（P1-7）：模型标签仅作补充，教材节名原文必须进 knowledge_points
      inject_kps: kps,
      figure: d.figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg(d.figure_spec) }) : '',
    }))
    const b = await req('POST', '/api/questions/bulk', { questions: payload, force: false })
    if (b.status === 200 && b.data?.ok) {
      out.saved += good.length
      console.log(`  ✓ 入库 ${good.length} 题（ids: ${(b.data.ids || []).join(',')}）`)
      return good.length
    } else if (b.data?.ok === false && b.data?.duplicates?.length) {
      out.skipped.push(`${label}：疑似与题库 #${b.data.duplicates[0].id} 重复，未入库`)
      console.log('  ⊘ 疑似重复，未入库')
      return 0
    } else {
      out.failed.push({ label, err: b.data?.error || `HTTP ${b.status}` })
      return 0
    }
  } catch (e: any) {
    out.failed.push({ label, err: e.message })
    return 0
  }
}

async function main() {
  // 1. 登录
  const r0 = await req('POST', '/api/auth/login', { username: 'teacher', password: 'admin123' })
  if (r0.status !== 200) { console.error('登录失败', r0.status, JSON.stringify(r0.data)); process.exit(1) }
  token = r0.data.token

  // 临时切换供应商/模型（--provider/--model，结束时还原）
  if (PROVIDER_ARG || MODEL_ARG) await switchProvider(PROVIDER_ARG, MODEL_ARG)

  // 2. 覆盖统计
  const qs = (await req('GET', '/api/questions')).data as Array<{ id: number; knowledge_points: string; stem: string }>
  const allKps = qs.flatMap((q) => kpOf(q.knowledge_points))
  console.log(`题库共 ${qs.length} 题`)

  const out = { saved: 0, skipped: [] as string[], failed: [] as Array<{ label: string; err: string }> }
  let planGroups: Array<{ label: string; grade: string; kps: string[]; qtype: string; tier: string; n: number; note?: string }> = []

  if (PLAN_ARG) {
    // ---- 计划模式：按计划文件逐考点逐组出题 ----
    const fs = await import('node:fs')
    const plan = JSON.parse(fs.readFileSync(PLAN_ARG, 'utf-8')) as { topics: PlanTopic[] }
    for (const t of plan.topics) {
      for (const g of t.groups) {
        planGroups.push({
          label: `${t.vol}·${t.chapter}`,
          grade: t.grade || GRADE_OF[t.vol] || '高一',
          kps: g.kps,
          qtype: g.qtype,
          tier: g.tier,
          n: g.n,
          note: g.note,
        })
      }
    }
  } else {
    // ---- 自动模式：选 0 覆盖考点，按 --mix/--diff 配比展开槽位 ----
    const candidates: Array<{ section: string; grade: string; isSynth: boolean; volIdx: number; chIdx: number }> = []
    TEXTBOOK.forEach((v, volIdx) => {
      v.chapters.forEach((ch, chIdx) => {
        for (const s of ch.sections) {
          const n = allKps.filter((k) => covered([k], s)).length
          if (n === 0) {
            candidates.push({ section: s, grade: GRADE_OF[v.id] || '高一', isSynth: s.startsWith('综合专题'), volIdx, chIdx })
          }
        }
      })
    })
    console.log(`0 覆盖考点 ${candidates.length} 个`)
    candidates.sort((a, b) => Number(b.isSynth) - Number(a.isSynth) || a.volIdx - b.volIdx || a.chIdx - b.chIdx)
    const topics = candidates.slice(0, Math.max(1, BATCH))
    if (!topics.length) { console.log('没有 0 覆盖考点，无需补题'); return }
    const mix = parseMix(MIX_ARG)
    const diff = parseDiff(DIFF_ARG)
    for (const t of topics) {
      const slots = expandSlots(2, mix, diff) // 每考点默认 2 题，配比展开
      for (const grp of groupSlots(slots)) {
        planGroups.push({ label: t.section, grade: t.grade, kps: [t.section], qtype: grp.qtype, tier: grp.tier, n: grp.n })
      }
    }
  }

  // 逐组出题；组内一题未入库（二审全拒/缺图/失败）时自动重试，最多 3 次尝试（重试附加更严格的命题纪律）
  // 中途任何异常也要保证还原用户的智能服务配置
  const RETRY_HINT = '前次草稿被二审驳回。请务必：先在解析中完整严格推导（禁止近似估算下结论、禁止过程性试错文字），再核对每个数值与单位；若用「如图」必须给出完整可绘图的 figure_spec 参数。'
  const GLOBAL_HINT = '题干第一句直接从物理情境开始，禁止以知识点或节名开头，不得出现与题目无关的标题行。'
  try {
    for (const g of planGroups) {
      let got = 0
      for (let attempt = 1; attempt <= 3 && got < g.n; attempt++) {
        const note = [g.note, ...(attempt > 1 ? [RETRY_HINT] : []), GLOBAL_HINT].filter(Boolean).join(' ')
        if (attempt > 1) console.log(`  ↻ 第 ${attempt} 次重试（还差 ${g.n - got} 题）`)
        got += await generateAndSave({ ...g, n: g.n - got, note }, out)
      }
    }
  } finally {
    await restoreProviders()
  }

  // 3. 终态分布统计（全库）
  const qs2 = (await req('GET', '/api/questions')).data as Array<{ id: number; qtype: string; difficulty: number }>
  const byT: Record<string, number> = {}
  const byD: Record<number, number> = {}
  for (const q of qs2) { byT[q.qtype] = (byT[q.qtype] || 0) + 1; byD[q.difficulty] = (byD[q.difficulty] || 0) + 1 }
  const d12 = (byD[1] || 0) + (byD[2] || 0)
  console.log(`\n===== 补题完成 =====`)
  console.log(`本批入题库：${out.saved} 题`)
  console.log(`全库题型分布：${Object.entries(byT).map(([k, v]) => `${k} ${v}`).join(' / ')}`)
  console.log(`全库难度分布：D1-2 ${d12} / D3 ${byD[3] || 0} / D4-5 ${(byD[4] || 0) + (byD[5] || 0)}（D5 真压轴 ${byD[5] || 0}）`)
  if (out.skipped.length) console.log('弃用：\n- ' + out.skipped.join('\n- '))
  if (out.failed.length) console.log('失败：\n- ' + out.failed.map((f) => `${f.label}：${f.err}`).join('\n- '))
}

main()
