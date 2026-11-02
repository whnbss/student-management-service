// 题库与组卷（P1）：题目 CRUD / 筛选 / AI 出题器（含自动二审）/ 分层练习 / 家长阶段报告
// AI 生成结果一律先返回草稿，教师在前端逐题编辑确认后才通过 bulk 入库（ai_generated 标记）
import type { FastifyInstance } from 'fastify'
import { db, nowISO, remainingHours } from '../db'
import { pickProvider, generateQuiz, generateTiered, generateParentReport, validateQuizDrafts, reviewQuizDrafts, fixQuizDraft } from '../ai'
import { sanitizeAiText, sanitizeLatexChinese, mergeSectionKps, daysAgo, checkSolutionArithmetic, checkAnswerTraceable, mentionsFigureStem, requiresFigure, QUIZ_LEVEL_ALIASES, normalizeStemForDup, stemGrams } from '@workbench/shared'
import type { QuizDraft, QuizLevel, QuizReview } from '@workbench/shared'

function kpOf(raw: string): string[] {
  try { return JSON.parse(raw || '[]') as string[] } catch { return [] }
}

// 题型固定顺序（与组卷大题顺序一致）：选择 → 填空 → 实验 → 计算
const QTYPE_SEQ = ['选择', '填空', '实验', '计算'] as const

// 把总题数按所选题型分配：题型按固定顺序排，前面的题型优先多 1 题；非标准题型兜底排最后
function allocateCounts(count: number, qtypes: string[]): Array<{ qtype: string; n: number }> {
  const ordered = QTYPE_SEQ.filter((t) => qtypes.includes(t))
  const extra = qtypes.filter((t) => !(QTYPE_SEQ as readonly string[]).includes(t))
  const all = [...ordered, ...extra]
  if (!all.length) return []
  const base = Math.floor(count / all.length)
  let rem = count % all.length
  return all
    .map((qtype) => ({ qtype, n: base + (rem-- > 0 ? 1 : 0) }))
    .filter((x) => x.n > 0)
}

// figure 列校验：必须是 {"kind":"svg"|"img","data":"..."} 形态的 JSON（svg 内联、img 为 uploads 相对路径），非法返回空串
function sanitizeFigureJson(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw !== 'string') return ''
  let f: any
  try { f = JSON.parse(raw) } catch { return '' }
  if (!f || typeof f !== 'object') return ''
  if (f.kind === 'svg' && typeof f.data === 'string' && f.data.startsWith('<svg') && f.data.length < 100_000) {
    return JSON.stringify({ kind: 'svg', data: f.data })
  }
  if (f.kind === 'img' && typeof f.data === 'string' && f.data.startsWith('/uploads/') && f.data.length < 300) {
    return JSON.stringify({ kind: 'img', data: f.data })
  }
  return ''
}

// 查重（D4 增强）：① 同知识点 + 题干前 40 字（去空白）相同；② 题干打码规范化相似度 ≥ 0.85
// （忽略数值/LaTeX/空格差异——「同模板换数值」的语义重复也能拦住）→ 视为疑似重复
function normStem(s: string): string {
  return s.replace(/\s+/g, '').slice(0, 40)
}
const DUP_SIM_THRESHOLD = 0.85
function findDuplicates(drafts: Array<{ stem: string; knowledge_points: string[] }>): Array<{ index: number; id: number; stem: string; similarity?: number; reason?: string }> {
  const existing = db.prepare('SELECT id, stem, knowledge_points FROM questions').all() as any[]
  const out: Array<{ index: number; id: number; stem: string; similarity?: number; reason?: string }> = []
  // 草稿 grams 预计算（≤30 条 × 库内 ≤数千条，Jaccard 纯内存可接受）
  const draftGrams = drafts.map((d) => stemGrams(normalizeStemForDup(d.stem)))
  const jaccard = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0
    let inter = 0
    for (const g of a) if (b.has(g)) inter++
    return inter / (a.size + b.size - inter)
  }
  for (let i = 0; i < drafts.length; i++) {
    const kps = new Set(drafts[i].knowledge_points)
    const prefix = normStem(drafts[i].stem)
    let hit: any = null
    let similarity: number | undefined
    let reason = ''
    if (prefix) {
      hit = existing.find((e) => {
        if (!e.stem || normStem(e.stem) !== prefix) return false
        const ek = kpOf(e.knowledge_points)
        return ek.some((k) => kps.has(k))
      })
      if (hit) reason = '题干与库内题完全一致'
    }
    if (!hit) {
      // 相似度扫描：取相似度最高的一条库内题（不限知识点——跨知识点的重复更该提示）
      let best: any = null
      let bestSim = 0
      for (const e of existing) {
        if (!e.stem) continue
        const sim = jaccard(draftGrams[i], stemGrams(normalizeStemForDup(e.stem)))
        if (sim >= DUP_SIM_THRESHOLD && sim > bestSim) { best = e; bestSim = sim }
      }
      if (best) { hit = best; similarity = Math.round(bestSim * 1000) / 1000; reason = `题干相似度 ${(bestSim * 100).toFixed(0)}%（忽略数值/公式书写差异）` }
    }
    if (hit) out.push({ index: i, id: hit.id, stem: String(hit.stem).slice(0, 60), similarity, reason })
  }
  return out
}

// 终稿机器硬校验（不依赖 AI 的确定性校验，未过一律不允许出现在草稿列表）：
// ① 解析内部数值复核（checkSolutionArithmetic）② 答案↔解析一致性
// ③ B1 配图铁律：计算/实验题必须配图，选择/填空含情境线索必须配图（纯概念题豁免）；「如图」⇒ 必须有 figure_spec
function finalMachineIssues(q: QuizDraft): string[] {
  const issues: string[] = []
  for (const i of checkSolutionArithmetic(q.solution || '')) {
    issues.push(`数值复核未过：${i.expr} 应等于 ${i.expect}，解析写的是 ${i.got}`)
  }
  for (const s of checkAnswerTraceable(q.answer || '', q.solution || '', q.stem || '')) issues.push(s)
  if (mentionsFigureStem(q.stem) && !q.figure_spec) issues.push('题干出现「如图」但没有配图（缺少 figure_spec）')
  if (requiresFigure(q.stem, q.qtype) && !q.figure_spec) {
    issues.push('配图铁律未过：本题涉及计算/情境（' + q.qtype + '），必须给出 figure_spec 配图；仅纯概念判断题才允许无图')
  }
  return issues
}

// 终稿闭环：对未过审的题目自动修复（最多 2 次）→ 仍失败整题重生成 1 次 → 仍失败弃置并计数。
// 返回值里的 questions 全部是终稿（机器校验 0 问题），被弃置的题附原因，绝不把「未解决」状态抛给教师
async function closeTheLoop(
  provider: NonNullable<ReturnType<typeof pickProvider>>,
  result: QuizDraft[],
  aiReview: QuizReview[] | null,
  ctx: { kps: string[]; level: QuizLevel; grade: string; hint?: string }
): Promise<{ finals: QuizDraft[]; discarded: Array<{ reason: string }> }> {
  const finals: QuizDraft[] = []
  const discarded: Array<{ reason: string }> = []
  for (let i = 0; i < result.length; i++) {
    const q0 = result[i]
    const aiIssues = aiReview && aiReview[i] && aiReview[i].pass === false ? aiReview[i].issues : []
    let cur = q0
    let issues = [...aiIssues, ...finalMachineIssues(q0)]
    if (!issues.length) { finals.push(q0); continue }
    // —— 修复流程：共 2 次（失败重试 1 次）——
    let fixErr = ''
    for (let attempt = 0; attempt < 2 && issues.length; attempt++) {
      try {
        const { result: fr } = await fixQuizDraft(provider, cur, issues)
        // 修正稿锁回本批题型并重新注入节名（防模型改写知识点/题型）
        const f2: QuizDraft = { ...fr.draft, qtype: cur.qtype, knowledge_points: mergeSectionKps(ctx.kps, fr.draft.knowledge_points) }
        const fIssues = finalMachineIssues(f2)
        if (!fIssues.length) {
          finals.push({ ...f2, fix_note: fr.fix_note || '已按二审问题自动修正' })
          issues = []
          break
        }
        cur = f2
        issues = fIssues
      } catch (e: any) {
        fixErr = e.message
        console.error(`[quiz] 第 ${i + 1} 题修复第 ${attempt + 1} 次失败:`, e.message)
      }
    }
    if (!issues.length) continue
    // —— 重新生成该题 1 次 ——
    const why = issues.join('；') + (fixErr ? `（修复调用失败：${fixErr}）` : '')
    try {
      const { result: rg } = await generateQuiz(provider, { kps: ctx.kps, qtypes: [cur.qtype], count: 1, level: ctx.level, grade: ctx.grade, hint: ctx.hint })
      if (rg[0]) {
        const q2: QuizDraft = { ...rg[0], qtype: cur.qtype, knowledge_points: mergeSectionKps(ctx.kps, rg[0].knowledge_points) }
        const rIssues = finalMachineIssues(q2)
        if (!rIssues.length) {
          finals.push({ ...q2, fix_note: '修复未通过，已整题重新生成' })
          continue
        }
        discarded.push({ reason: `第 ${i + 1} 题（重新生成后仍未过 ${rIssues.join('；')}）` })
      } else {
        discarded.push({ reason: `第 ${i + 1} 题（${why}）：重新生成未返回题目` })
      }
    } catch (e: any) {
      discarded.push({ reason: `第 ${i + 1} 题（${why}）：重新生成失败（${e.message}）` })
    }
  }
  return { finals, discarded }
}

export default async function questionRoutes(app: FastifyInstance) {
  // ---------- 题目列表：多条件筛选（搜索覆盖 题干/答案/解析/知识点） ----------
  // D3：传 page 参数 → 服务端分页（返回 {items,total,page,page_size,pages}），不再全量返回；
  // 不传 page → 兼容旧调用方（全局搜索等）仍返回数组
  app.get('/api/questions', async (req) => {
    const q = req.query as {
      q?: string; grade?: string; qtype?: string; kp?: string
      min_diff?: string; max_diff?: string; favorite?: string
      page?: string; page_size?: string
    }
    let where = ' WHERE 1=1'
    const args: any[] = []
    if (q.q) {
      where += ' AND (stem LIKE ? OR answer LIKE ? OR solution LIKE ? OR knowledge_points LIKE ?)'
      const like = `%${q.q}%`
      args.push(like, like, like, like)
    }
    if (q.grade) { where += ' AND grade = ?'; args.push(q.grade) }
    if (q.qtype) { where += ' AND qtype = ?'; args.push(q.qtype) }
    if (q.min_diff) { where += ' AND difficulty >= ?'; args.push(Number(q.min_diff)) }
    if (q.max_diff) { where += ' AND difficulty <= ?'; args.push(Number(q.max_diff)) }
    if (q.favorite === '1') { where += ' AND favorite = 1' }
    // D3：知识点筛选下沉到 SQL（knowledge_points 是 JSON 数组文本，按「"kp"」整元素精确匹配，分页下语义与旧内存过滤一致）
    if (q.kp) { where += ' AND knowledge_points LIKE ?'; args.push(`%"${q.kp.replace(/"/g, '')}"%`) }
    if (q.page !== undefined) {
      const page = Math.max(1, Number(q.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(q.page_size) || 20))
      const total = (db.prepare(`SELECT COUNT(*) AS n FROM questions${where}`).get(...args) as any).n
      const items = db
        .prepare(`SELECT * FROM questions${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
        .all(...args, pageSize, (page - 1) * pageSize) as any[]
      return { ok: true, items, total, page, page_size: pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
    }
    return db.prepare(`SELECT * FROM questions${where} ORDER BY id DESC`).all(...args) as any[]
  })

  // ---------- 知识点全库去重列表（筛选器选项来自全库，不随当前过滤缩小） ----------
  app.get('/api/questions/kps', async () => {
    const rows = db.prepare('SELECT knowledge_points FROM questions').all() as any[]
    const s = new Set<string>()
    for (const r of rows) for (const k of kpOf(r.knowledge_points)) s.add(k)
    return { ok: true, kps: [...s].sort((a, b) => a.localeCompare(b, 'zh')) }
  })

  // ---------- D4：全库重复检测 ----------
  // 三类口径：精确重复（题干+答案规范化后相同）/ 近似重复（打码规范化后 高置信：Jaccard≥0.85 或包含度≥0.9，
  // 忽略数值/LaTeX/空格差异）/ 疑似同模板（包含度≥0.8 但未达高置信——实测「同模板换数值+个别场景词不同」
  // 的语义重复落在这个区间，字符相似度给不出更高置信，标记为「需人工判断」交教师裁决，不强行归组）。
  // 跨知识点重复：命中对里知识点完全不相交（同一题被标到不同知识点）。
  // 高置信对用并查集聚簇；疑似对按对输出（不做传递合并，防长链把不相关题串成巨组）。
  app.get('/api/questions/duplicates', async () => {
    const HIGH_JACCARD = 0.85
    const HIGH_CONTAIN = 0.9
    const SUSPECT_CONTAIN = 0.8
    const SUSPECT_JACCARD = 0.6
    const rows = db.prepare('SELECT id, stem, answer, knowledge_points, qtype, difficulty, favorite, created_at FROM questions ORDER BY id').all() as any[]
    const norms = rows.map((r) => normalizeStemForDup(r.stem))
    const rawNorms = rows.map((r) => String(r.stem || '').replace(/\s+/g, ''))
    const ansNorms = rows.map((r) => normalizeStemForDup(r.answer))
    const grams = norms.map((n) => stemGrams(n))
    const kps = rows.map((r) => kpOf(r.knowledge_points))
    const jaccardOf = (a: Set<string>, b: Set<string>) => {
      if (!a.size || !b.size) return 0
      let inter = 0
      for (const g of a) if (b.has(g)) inter++
      return inter / (a.size + b.size - inter)
    }
    const parent = rows.map((_, i) => i)
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    const union = (x: number, y: number) => { const a = find(x), b = find(y); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b) }
    interface Pair { i: number; j: number; sim: number; exact: boolean; crossKp: boolean; high: boolean }
    const pairs: Pair[] = []
    for (let i = 0; i < rows.length; i++) {
      if (!norms[i]) continue
      for (let j = i + 1; j < rows.length; j++) {
        if (!norms[j]) continue
        const exact = rawNorms[i] === rawNorms[j] && ansNorms[i] === ansNorms[j] && rawNorms[i].length > 0
        let inter = 0
        for (const g of grams[i]) if (grams[j].has(g)) inter++
        const jac = inter / (grams[i].size + grams[j].size - inter)
        const cont = inter / Math.min(grams[i].size, grams[j].size)
        const high = jac >= HIGH_JACCARD || cont >= HIGH_CONTAIN
        const suspect = jac >= SUSPECT_JACCARD || cont >= SUSPECT_CONTAIN
        if (!exact && !high && !suspect) continue
        if (exact || high) union(i, j)
        const crossKp = kps[i].length > 0 && kps[j].length > 0 && !kps[i].some((k: string) => kps[j].includes(k))
        pairs.push({ i, j, sim: Math.round(Math.max(jac, cont) * 1000) / 1000, exact, crossKp, high: exact || high })
      }
    }
    const toItems = (idxs: number[]) => idxs.map((i) => ({
      id: rows[i].id,
      stem: String(rows[i].stem || '').slice(0, 80),
      answer: String(rows[i].answer || '').slice(0, 40),
      knowledge_points: kps[i],
      qtype: rows[i].qtype,
      difficulty: rows[i].difficulty,
      favorite: rows[i].favorite,
      created_at: rows[i].created_at,
    }))
    const kindOf = (ps: Pair[]) => {
      if (ps.some((p) => p.exact)) return '精确重复'
      if (ps.some((p) => p.crossKp)) return '跨知识点重复'
      return ps.every((p) => !p.high) ? '疑似同模板' : '近似重复'
    }
    // 高置信聚簇（size>1 才是重复组）
    const clusters = new Map<number, number[]>()
    for (let i = 0; i < rows.length; i++) {
      const root = find(i)
      const arr = clusters.get(root) || []
      arr.push(i)
      clusters.set(root, arr)
    }
    const highMembers = new Set<number>()
    const groups: Array<{ kind: string; max_similarity: number; items: ReturnType<typeof toItems> }> = []
    for (const members of [...clusters.values()].filter((m) => m.length > 1)) {
      members.forEach((i) => highMembers.add(i))
      const ps = pairs.filter((p) => members.includes(p.i) && members.includes(p.j))
      groups.push({ kind: kindOf(ps), max_similarity: Math.max(1, ...ps.map((p) => p.sim)), items: toItems(members) })
    }
    // 疑似对：不与高置信组重复输出（同对两端已在同一高置信组里就不再单列）
    for (const p of pairs.filter((p) => !p.high)) {
      if (find(p.i) === find(p.j) && highMembers.has(p.i) && highMembers.has(p.j)) continue
      groups.push({ kind: kindOf([p]), max_similarity: p.sim, items: toItems([p.i, p.j]) })
    }
    groups.sort((a, b) => (a.kind === '精确重复' ? -1 : 1) - (b.kind === '精确重复' ? -1 : 1) || b.max_similarity - a.max_similarity)
    return { ok: true, groups, total_questions: rows.length }
  })

  // ---------- D4：批量删除（重复检测「保留一题删其余」用；单接口事务，附实际删除数） ----------
  app.post('/api/questions/bulk-delete', async (req, reply) => {
    const b = (req.body || {}) as { ids?: unknown }
    const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))] : []
    if (!ids.length) { reply.code(400).send({ error: 'ids 必须是非空数组' }); return }
    const del = db.prepare('DELETE FROM questions WHERE id = ?')
    let deleted = 0
    const tx = db.transaction(() => {
      for (const id of ids) deleted += del.run(id).changes
    })
    tx()
    return { ok: true, deleted, requested: ids.length }
  })

  // ---------- 手动添加单题 ----------
  app.post('/api/questions', async (req, reply) => {
    const b = (req.body || {}) as any
    if (!b.stem || !String(b.stem).trim()) { reply.code(400).send({ error: '题干必填' }); return }
    const r = db.prepare(`INSERT INTO questions(
      stem, answer, solution, pitfall, knowledge_points, difficulty, qtype, source, mistake_id, grade, figure, created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      sanitizeLatexChinese(sanitizeAiText(b.stem)).trim(), sanitizeLatexChinese(sanitizeAiText(b.answer)), sanitizeLatexChinese(sanitizeAiText(b.solution)), sanitizeLatexChinese(sanitizeAiText(b.pitfall)),
      JSON.stringify(Array.isArray(b.knowledge_points) ? b.knowledge_points : []),
      Math.min(5, Math.max(1, Number(b.difficulty) || 3)),
      String(b.qtype || '计算'), String(b.source || 'manual'), b.mistake_id || null, String(b.grade || ''),
      sanitizeFigureJson(b.figure), nowISO()
    )
    return { ok: true, id: r.lastInsertRowid }
  })

  // ---------- 批量入库：AI 出题 / 分层练习确认后的题目（打 ai_generated 标记） ----------
  // 查重：同知识点 + 题干前 40 字相同 → 未带 force 时返回疑似重复列表，前端确认后带 force 重新提交
  app.post('/api/questions/bulk', async (req, reply) => {
    const b = (req.body || {}) as { questions?: unknown; source?: string; force?: boolean }
    if (!Array.isArray(b.questions) || b.questions.length === 0) { reply.code(400).send({ error: 'questions 必须是非空数组' }); return }
    let drafts
    try {
      drafts = validateQuizDrafts(b.questions, 30)
    } catch (e: any) {
      reply.code(400).send({ error: e.message || '题目数据不合法' }); return
    }
    if (!drafts.length) { reply.code(400).send({ error: '没有题干有效的题目' }); return }
    if (!b.force) {
      const duplicates = findDuplicates(drafts)
      if (duplicates.length) { return { ok: false, duplicates } }
    }
    const source = 'ai_generated'
    const ins = db.prepare(`INSERT INTO questions(
      stem, answer, solution, pitfall, knowledge_points, difficulty, qtype, source, mistake_id, grade, figure, created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    const figs = Array.isArray(b.questions) ? (b.questions as any[]) : []
    const ids: number[] = []
    for (let i = 0; i < drafts.length; i++) {
      const fig = sanitizeFigureJson(figs[i]?.figure)
      // 强制注入节名标签：出题/补题时传入的教材节名（inject_kps）必须进入 knowledge_points，
      // 模型自由发挥的碎片标签只作补充，保证教材目录筛选与覆盖统计不漏题
      const injectKps = Array.isArray(figs[i]?.inject_kps) ? figs[i].inject_kps.map(String).filter(Boolean) : []
      const kps = mergeSectionKps(injectKps, drafts[i].knowledge_points)
      const r = ins.run(
        drafts[i].stem, drafts[i].answer, drafts[i].solution, drafts[i].pitfall, JSON.stringify(kps),
        drafts[i].difficulty, drafts[i].qtype, source, figs[i]?.mistake_id ?? null, String(figs[i]?.grade || ''),
        fig, nowISO()
      )
      ids.push(Number(r.lastInsertRowid))
    }
    // 数值复核只作非阻塞警告（教师已人工终审勾选，入库不拦，仅提示哪些题解析里疑似有算术 slip）
    const arithmetic_warnings = drafts
      .map((d, i) => ({ index: i, id: ids[i], issues: checkSolutionArithmetic(d.solution || '') }))
      .filter((x) => x.issues.length)
    return { ok: true, ids, arithmetic_warnings }
  })

  // ---------- 编辑 / 收藏 ----------
  app.put('/api/questions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const cur = db.prepare('SELECT id FROM questions WHERE id = ?').get(id)
    if (!cur) { reply.code(404).send({ error: '题目不存在' }); return }
    const b = (req.body || {}) as any
    const fields = ['stem', 'answer', 'solution', 'pitfall', 'qtype', 'grade'] as const
    const sets: string[] = []
    const args: any[] = []
    for (const f of fields) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); args.push(sanitizeLatexChinese(sanitizeAiText(b[f]))) }
    }
    if (b.knowledge_points !== undefined) {
      sets.push('knowledge_points = ?')
      args.push(JSON.stringify(Array.isArray(b.knowledge_points) ? b.knowledge_points : []))
    }
    if (b.difficulty !== undefined) { sets.push('difficulty = ?'); args.push(Math.min(5, Math.max(1, Number(b.difficulty) || 3))) }
    if (b.favorite !== undefined) { sets.push('favorite = ?'); args.push(b.favorite ? 1 : 0) }
    if (b.figure !== undefined) { sets.push('figure = ?'); args.push(sanitizeFigureJson(b.figure)) }
    if (!sets.length) { reply.code(400).send({ error: '没有要更新的字段' }); return }
    args.push(id)
    db.prepare(`UPDATE questions SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    return { ok: true }
  })

  app.delete('/api/questions/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM questions WHERE id = ?').run(id)
    return { ok: true }
  })

  // ---------- AI 出题器：生成草稿 + 自动二审（不入库，前端确认后走 bulk） ----------
  // 出题按题型分批：按「选择→填空→实验→计算」固定顺序逐题型单独生成，保证输出顺序与试卷大题一致（双保险之一，前端另有稳定排序兜底）
  app.post('/api/quiz/generate', async (req, reply) => {
    const b = (req.body || {}) as { kps?: unknown; qtypes?: unknown; count?: unknown; level?: unknown; grade?: unknown; hint?: unknown; avoid_stems?: unknown }
    const kps = Array.isArray(b.kps) ? b.kps.map(String).map((s) => s.trim()).filter(Boolean) : []
    if (!kps.length) { reply.code(400).send({ error: '请至少填写一个知识点' }); return }
    const qtypes = Array.isArray(b.qtypes) && b.qtypes.length ? b.qtypes.map(String) : ['计算']
    // 题量放宽为 1~20（界面仍提供 5/10/20 档，脚本按题型配比精确补题时可用任意数量）
    const rawCount = Number(b.count)
    const count = Number.isFinite(rawCount) ? Math.min(20, Math.max(1, Math.round(rawCount))) : 5
    // C5：难度四档 基础/中档/稍难/压轴；旧档名（高考/竞赛）经别名映射保持兼容
    const levelKey = String(b.level || '中档')
    const level: QuizLevel = (levelKey in QUIZ_LEVEL_ALIASES ? QUIZ_LEVEL_ALIASES[levelKey] : (['基础', '中档', '稍难', '压轴'] as const).includes(levelKey as any) ? (levelKey as QuizLevel) : '中档')
    // C5 同参数去重：前端传入上次生成的题干摘要（最多 30 条，各截前 80 字）
    const avoidStems = Array.isArray(b.avoid_stems)
      ? b.avoid_stems.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 30)
      : []
    const provider = pickProvider('text')
    if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
    try {
      // 总题数按题型分配（前面的题型优先多 1 题），逐批生成并拼接
      const batches = allocateCounts(count, qtypes)
      const result: Awaited<ReturnType<typeof generateQuiz>>['result'] = []
      let prompt_tokens = 0
      let completion_tokens = 0
      let cost = 0
      // C5：多样性种子（每次调用随机，同参数再次生成不再产出相同题）
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      for (const { qtype, n } of batches) {
        const { result: qs, usage } = await generateQuiz(provider, {
          kps, qtypes: [qtype], count: n, level, grade: String(b.grade || ''),
          hint: typeof b.hint === 'string' ? b.hint.slice(0, 500) : undefined,
          avoid: avoidStems.length ? avoidStems.map((s) => s.slice(0, 80)) : undefined,
          seed,
        })
        // 强制落本批题型（防止模型返回的 qtype 与批次不符），并把传入的节名原文注入知识点
        result.push(...qs.map((q) => ({ ...q, qtype, knowledge_points: mergeSectionKps(kps, q.knowledge_points) })))
        prompt_tokens += usage.prompt_tokens || 0
        completion_tokens += usage.completion_tokens || 0
        cost += usage.cost || 0
      }
      // C5 相似度去重（后端硬兜底）：与排除项/批内其它题做字符 3-gram Jaccard 相似度，
      // ≥ 0.5 视为高度雷同 → 直接移除（附说明），保证「同参数再次生成必须出新题」
      const dropSimilar = (drafts: QuizDraft[]): Array<{ q: QuizDraft; why: string }> => {
        if (!avoidStems.length && drafts.length < 2) return []
        const norm = (s: string) => s.replace(/[\s\\$，。、：；！？（）()【】\[\]{}"'’“]/g, '').slice(0, 200)
        const grams = (s: string) => {
          const t = norm(s)
          const out = new Set<string>()
          for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3))
          return out
        }
        const jac = (a: Set<string>, b: Set<string>) => {
          if (!a.size || !b.size) return 0
          let inter = 0
          for (const g of a) if (b.has(g)) inter++
          return inter / (a.size + b.size - inter)
        }
        const avoidGrams = avoidStems.map(grams)
        const kept: QuizDraft[] = []
        const dropped: Array<{ q: QuizDraft; why: string }> = []
        for (const q of drafts) {
          const g = grams(q.stem)
          const hitAvoid = avoidGrams.findIndex((ag) => jac(g, ag) >= 0.5)
          if (hitAvoid >= 0) { dropped.push({ q, why: `与上次生成的题干高度雷同（已按去重规则移除：${avoidStems[hitAvoid].slice(0, 40)}…）` }); continue }
          const hitBatch = kept.findIndex((k) => jac(g, grams(k.stem)) >= 0.6)
          if (hitBatch >= 0) { dropped.push({ q, why: `与本批第 ${hitBatch + 1} 题高度雷同（已按去重规则移除）` }); continue }
          kept.push(q)
        }
        return dropped
      }
      const usage = { prompt_tokens, completion_tokens, cost }
      // 自动二审：逐题挑错（数值自洽/情境几何/超纲/解析含试错/缺图）。二审失败不阻塞出题，降级为无审查结果
      let aiReview: QuizReview[] | null = null
      let review_usage = null
      try {
        const r2 = await reviewQuizDrafts(provider, result)
        aiReview = r2.result
        review_usage = r2.usage
      } catch (e: any) {
        console.error('[quiz] 二审失败（已降级为不审查，机器硬校验兜底）:', e.message)
      }
      // 终稿闭环（用户验收口径）：草稿列表不允许出现「未解决」状态——
      // 二审/机器校验未过的题自动修复（2 次）→ 重生成（1 次）→ 仍失败弃置并计数；
      // 「如图」无图、答案与解析脱节都在机器硬校验里拦截
      const { finals: closed, discarded } = await closeTheLoop(provider, result, aiReview, {
        kps, level, grade: String(b.grade || ''), hint: typeof b.hint === 'string' ? b.hint.slice(0, 500) : undefined,
      })
      if (discarded.length) console.log(`[quiz] 终稿闭环弃置 ${discarded.length} 题:`, discarded.map((d) => d.reason).join(' | '))
      // C5：终稿相似度去重（对修复/重生成后的终稿再兜底一次）
      const simDropped = dropSimilar(closed)
      const finals = closed.filter((q) => !simDropped.some((d) => d.q === q))
      for (const d of simDropped) discarded.push({ reason: d.why })
      if (simDropped.length) console.log(`[quiz] 相似度去重移除 ${simDropped.length} 题`)
      // review 字段保留兼容（backfill 脚本按 review.pass 过滤）：终稿全部通过硬校验
      const review: QuizReview[] = finals.map(() => ({ pass: true, issues: [], fixed: null }))
      return { ok: true, questions: finals, usage, review, review_usage, discarded }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || 'AI 出题失败' })
    }
  })

  // ---------- 分层练习：按学生薄弱点生成三档练习草稿 ----------
  app.post('/api/practice/tiered', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: unknown; kps?: unknown }
    const sid = Number(b.student_id)
    if (!sid) { reply.code(400).send({ error: '缺少学生' }); return }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    const provider = pickProvider('text')
    if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }

    // 薄弱知识点：未掌握/重做中的错题知识点优先；教师显式传入 kps 时以传入为准
    let kps = Array.isArray(b.kps) ? b.kps.map(String).filter(Boolean) : []
    const mistakes = db.prepare('SELECT * FROM mistakes WHERE student_id = ? ORDER BY created_at DESC').all(sid) as any[]
    if (!kps.length) {
      const cnt = new Map<string, number>()
      for (const m of mistakes) {
        if (m.mastery_status === '已掌握') continue
        for (const k of kpOf(m.knowledge_points)) cnt.set(k, (cnt.get(k) || 0) + 1)
      }
      kps = [...cnt.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 5).map(([k]) => k)
    }
    // 掌握度 → 推荐默认档：未掌握占比高推基础，掌握良好推拔尖
    const total = mistakes.length
    const unmastered = mistakes.filter((m) => m.mastery_status === '未掌握').length
    const mastered = mistakes.filter((m) => m.mastery_status === '已掌握').length
    const recommended = total === 0 ? '基础' : unmastered / Math.max(total, 1) > 0.4 ? '基础' : mastered / Math.max(total, 1) > 0.6 ? '拔尖' : '巩固'
    const masteryNote = total
      ? `共 ${total} 道错题，未掌握 ${unmastered}、重做中 ${total - unmastered - mastered}、已掌握 ${mastered}；高频薄弱点：${[...new Set(mistakes.filter((m) => m.mastery_status !== '已掌握').flatMap((m) => kpOf(m.knowledge_points)))].slice(0, 5).join('、') || '无'}`
      : '暂无错题记录，按新课进度出题'

    try {
      const { result, usage } = await generateTiered(provider, { kps, grade: student.grade, mastery_note: masteryNote })
      // 传入/推导出的节名注入每档草稿的知识点（同 quiz/generate，保证教材筛选可命中）
      for (const t of ['基础', '巩固', '拔尖'] as const) {
        result[t] = result[t].map((q) => ({ ...q, knowledge_points: mergeSectionKps(kps, q.knowledge_points) }))
      }
      return { ok: true, tiers: result, recommended_tier: recommended, kps, usage }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || '生成分层练习失败' })
    }
  })

  // ---------- 家长阶段报告：基于学情/错题/出勤生成三段式报告草稿 ----------
  app.post('/api/reports/parent', async (req, reply) => {
    const b = (req.body || {}) as { student_id?: unknown; from?: unknown; to?: unknown }
    const sid = Number(b.student_id)
    if (!sid) { reply.code(400).send({ error: '缺少学生' }); return }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(sid) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }
    const provider = pickProvider('text')
    if (!provider) { reply.code(400).send({ error: '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写' }); return }
    // 时段：默认最近一个月
    const to = String(b.to || nowISO().slice(0, 10))
    const from = String(b.from || daysAgo(30))
    const logs = db
      .prepare('SELECT date, type, content, next_class_key FROM study_logs WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC')
      .all(sid, from, to) as any[]
    const mistakes = db
      .prepare('SELECT knowledge_points, error_type, mastery_status, stem FROM mistakes WHERE student_id = ? AND created_at BETWEEN ? AND ?')
      .all(sid, `${from}T00:00:00`, `${to}T23:59:59`) as any[]
    const att = db
      .prepare("SELECT status, COUNT(*) AS n FROM attendance WHERE student_id = ? AND date BETWEEN ? AND ? GROUP BY status")
      .all(sid, from, to) as any[]
    const attendance = { 到课: 0, 请假: 0, 缺勤: 0 } as Record<string, number>
    for (const a of att) attendance[a.status] = a.n
    try {
      const { result, usage } = await generateParentReport(provider, {
        student: { name: student.name, grade: student.grade, textbook: student.textbook },
        range: { from, to },
        logs,
        mistakes: mistakes.map((m) => ({ knowledge_points: kpOf(m.knowledge_points), error_type: m.error_type, mastery_status: m.mastery_status, stem: m.stem })),
        attendance: attendance as any,
        remaining_hours: remainingHours(sid),
      })
      return { ok: true, report: result, range: { from, to }, usage }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || '生成家长报告失败' })
    }
  })
}
