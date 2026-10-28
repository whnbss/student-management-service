// 题库分批补题脚本（npx tsx scripts/backfill-bank.mts [批大小=12]）
// 目标：优先为「0 题覆盖」的教材考点出题，难度梯度 基础:中档:压轴 ≈ 5:3:2，题型以 计算/选择 为主
// 流程：统计覆盖 → 选 0 覆盖考点（综合专题优先）→ 逐考点调智能出题（生成+自动二审）→ 只入库二审通过的题（带配图）
// 注意：本脚本直接操作题库（用户已批的补题任务），不触碰学生/账号/结算数据
import { specToSvg } from '../apps/web/src/lib/figure.ts'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const BASE = 'http://localhost:3210'
const BATCH = Math.max(1, Math.min(20, Number(process.argv[2] || 12)))
let token = ''

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

async function main() {
  // 1. 登录
  const r0 = await req('POST', '/api/auth/login', { username: 'teacher', password: 'admin123' })
  if (r0.status !== 200) { console.error('登录失败', r0.status, JSON.stringify(r0.data)); process.exit(1) }
  token = r0.data.token

  // 2. 覆盖统计
  const qs = (await req('GET', '/api/questions')).data as Array<{ id: number; knowledge_points: string; stem: string }>
  const allKps = qs.flatMap((q) => kpOf(q.knowledge_points))
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
  console.log(`题库共 ${qs.length} 题；0 覆盖考点 ${candidates.length} 个`)

  // 3. 选考点：综合专题优先，其次按册/章顺序（高频大题章靠前自然覆盖，因章顺序即教材顺序）
  candidates.sort((a, b) => Number(b.isSynth) - Number(a.isSynth) || a.volIdx - b.volIdx || a.chIdx - b.chIdx)
  // 每考点出 2 题；考点数按批大小取
  const topicsPerQ = 2
  const topicCount = Math.max(1, Math.ceil(BATCH / topicsPerQ))
  const topics = candidates.slice(0, topicCount)
  if (!topics.length) { console.log('没有 0 覆盖考点，无需补题'); return }

  // 4. 难度梯队 基础:中档:压轴 ≈ 5:3:2；题型以 计算 为主、穿插 选择
  const LEVELS = ['基础', '基础', '高考', '基础', '高考', '基础', '竞赛', '高考', '基础', '竞赛'] as const
  let saved = 0
  const skipped: string[] = []
  const failed: Array<{ section: string; err: string }> = []
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i]
    const level = LEVELS[(i * 3) % LEVELS.length]
    const qtype = i % 3 === 2 ? '选择' : '计算'
    console.log(`\n▶ [${i + 1}/${topics.length}] ${t.section}（${t.grade} · ${level} · ${qtype}，2 题）…`)
    try {
      const g = await req('POST', '/api/quiz/generate', { kps: [t.section], count: 2, level, qtypes: [qtype], grade: t.grade })
      if (g.status !== 200 || !g.data?.ok) { failed.push({ section: t.section, err: g.data?.error || `HTTP ${g.status}` }); continue }
      const drafts = (g.data.questions || []) as any[]
      const reviews = (g.data.review || []) as any[]
      // 只入库二审通过的题
      const good = drafts.filter((d, j) => !reviews[j] || reviews[j].pass)
      const bad = drafts.length - good.length
      if (bad > 0) skipped.push(`${t.section}：${bad} 题二审未过，已弃用`)
      if (!good.length) { console.log('  二审全部未过，跳过入库'); continue }
      const payload = good.map((d) => ({
        ...d,
        grade: t.grade,
        figure: d.figure_spec ? JSON.stringify({ kind: 'svg', data: specToSvg(d.figure_spec) }) : '',
      }))
      const b = await req('POST', '/api/questions/bulk', { questions: payload, force: false })
      if (b.status === 200 && b.data?.ok) {
        saved += good.length
        console.log(`  ✓ 入库 ${good.length} 题（ids: ${(b.data.ids || []).join(',')}）`)
      } else if (b.data?.ok === false && b.data?.duplicates?.length) {
        skipped.push(`${t.section}：疑似与题库 #${b.data.duplicates[0].id} 重复，未入库`)
        console.log('  ⊘ 疑似重复，未入库')
      } else {
        failed.push({ section: t.section, err: b.data?.error || `HTTP ${b.status}` })
      }
    } catch (e: any) {
      failed.push({ section: t.section, err: e.message })
    }
  }

  console.log(`\n===== 补题完成 =====`)
  console.log(`本批入题库：${saved} 题；考点 ${topics.length} 个（0 覆盖剩余 ${Math.max(0, candidates.length - topics.length)} 个，后续批次继续）`)
  if (skipped.length) console.log('弃用：\n- ' + skipped.join('\n- '))
  if (failed.length) console.log('失败：\n- ' + failed.map((f) => `${f.section}：${f.err}`).join('\n- '))
}

main()
