// C2 拍照分析流水线（两阶段批改）：
//   ① 试卷页 → 视觉逐题转录完整原题
//   ② 文本模型独立求解 → 标准答案与解析
//   ③ 答题卡页 → 视觉读取学生实际作答（红叉只作校验线索）
//   ④ 文本逐题比对（标准答案 vs 学生作答）→ 判定/错因/错题集
// 兼容三种用法：只传试卷页（无作答可比对时全部判「无法识别」并注明）、只传答题卡（降级单阶段
// 判定，题干以答题卡手写为准）、混合传（推荐，逐题比对）。
// 返回结构与旧版完全一致（AiAnalysisResult），编辑页与入库/错题抽取逻辑零改动复用。
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import fs from 'node:fs'
import { UPLOADS_DIR, db, getSetting } from '../db'
import { getProviders, pickProvider, extractPaperQuestions, solvePaper, solvePaperPass2, readAnswerSheet, rereadSheetQuestions, verifyAnswerSheetFull, compareAndJudge, analyzePaper, redrawFigures } from '../ai'
import type { SheetReadItem, PaperExtractItem, PaperSolvedItem } from '@workbench/shared'
import { sampleEquivalent, isEquivClaim, hasJudgeContradiction } from '@workbench/shared'
import { letterSetOf, canonAnswer, splitParts, numsOf, answersAgree, answersClearlyDisagree, subBlanksMisaligned, scrubSpeculation } from '../answerMatch'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
}

// 上传路径 → base64 data URL（含路径穿越防护）
function readDataUrls(paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths.slice(0, 9)) {
    const rel = String(p).replace(/^\/uploads\//, '')
    const abs = path.join(UPLOADS_DIR, rel)
    if (!abs.startsWith(UPLOADS_DIR) || !fs.existsSync(abs)) continue
    const ext = path.extname(abs).toLowerCase()
    const buf = fs.readFileSync(abs)
    out.push(`data:${MIME[ext] || 'image/jpeg'};base64,${buf.toString('base64')}`)
  }
  return out
}

// C2 用量汇总（多步调用合计，费用估算口径与旧版一致）
type Usage = { prompt_tokens: number; completion_tokens: number; cost: number }
function accUsage(): Usage {
  return { prompt_tokens: 0, completion_tokens: 0, cost: 0 }
}

export default async function analysisRoutes(app: FastifyInstance) {
  app.post('/api/analyze', async (req, reply) => {
    const b = (req.body || {}) as {
      student_id?: number
      // 新格式：[{ path, role: 'paper' | 'sheet' }]；旧格式 string[]（默认视为试卷页）
      images?: Array<string | { path: string; role?: string }>
    }
    if (!b.student_id || !Array.isArray(b.images) || b.images.length === 0) {
      reply.code(400).send({ error: '缺少学生或图片' }); return
    }
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(b.student_id) as any
    if (!student) { reply.code(404).send({ error: '学生不存在' }); return }

    // 按角色分组读取图片：paper=试卷题目页，sheet=答题卡作答页
    const paperPaths: string[] = []
    const sheetPaths: string[] = []
    for (const raw of b.images.slice(0, 9)) {
      const item = typeof raw === 'string' ? { path: raw, role: 'paper' } : raw
      const role = item.role === 'sheet' ? 'sheet' : 'paper'
      ;(role === 'sheet' ? sheetPaths : paperPaths).push(String(item.path))
    }
    const paperUrls = readDataUrls(paperPaths)
    const sheetUrls = readDataUrls(sheetPaths)
    if (!paperUrls.length && !sheetUrls.length) {
      reply.code(400).send({ error: '图片文件不存在或已失效' }); return
    }

    const provider = pickProvider('vision')
    if (!provider) {
      const hasKey = getProviders().some((p) => p.api_key)
      reply.code(400).send({
        error: hasKey
          ? '拍照分析需要一家「填了 API Key 和模型」的供应商（视觉模型或支持多模态输入的文本模型均可，如 qwen-vl-max / GLM-4V）。请到「我的 → AI 配置」完善后重试'
          : '尚未配置 AI 供应商 API Key，请到「我的 → AI 配置」填写',
      })
      return
    }
    const meta = { grade: student.grade || '', textbook: student.textbook || getSetting('default_textbook') || '人教版' }

    try {
      // ---------- 混合/只传试卷页：两阶段批改 ----------
      if (paperUrls.length) {
        // ① 逐题转录原题（试卷页）。按页分批转录：单页单次调用，输出量小、不漏题、不截断
        //   （实测整卷一次转录时模型对选择题页偷懒返回空题干）
        const extracted = { paper_name: '', items: [] as PaperExtractItem[], unrecognized: [] as string[] }
        let u1: Usage = accUsage()
        for (const pageUrl of paperUrls) {
          const r1 = await extractPaperQuestions(provider, [pageUrl], meta)
          extracted.paper_name = extracted.paper_name || r1.result.paper_name
          extracted.items.push(...r1.result.items)
          extracted.unrecognized.push(...r1.result.unrecognized)
          u1.prompt_tokens += r1.usage.prompt_tokens || 0
          u1.completion_tokens += r1.usage.completion_tokens || 0
          u1.cost += r1.usage.cost || 0
        }
        // ①′ 原卷配图重绘（验收#43 ②）：有插图的题按模板库选模板补 figure_spec，
        // 模板不能还原的如实标「图待补」，严禁硬套模板编造；失败不阻塞批改
        const figureItems = extracted.items.filter((q) => q.has_figure || /如图/.test(q.stem))
        const figureSpecMap = new Map<string, { template: string; params: Record<string, number | string> }>()
        if (figureItems.length) {
          try {
            const rf = await redrawFigures(provider, { grade: meta.grade, items: figureItems, images: paperUrls })
            u1.prompt_tokens += rf.usage.prompt_tokens || 0
            u1.completion_tokens += rf.usage.completion_tokens || 0
            u1.cost += rf.usage.cost || 0
            for (const f of rf.result.items) {
              if (f.status === '已重绘' && f.template) figureSpecMap.set(String(Number(f.no)), { template: f.template, params: f.params })
            }
            console.log(`[analyze] 配图重绘：${figureItems.length} 题有插图，成功重绘 ${figureSpecMap.size} 题`)
          } catch (e: any) {
            console.error('[analyze] 配图重绘失败（跳过，不影响批改）:', e.message)
          }
        }
        // ② 独立求解标准答案（带试卷页原图：纸带读数/图像/装置必须看图）
        const { result: solved0, usage: u2 } = await solvePaper(provider, {
          grade: meta.grade,
          questions: extracted.items,
          images: paperUrls,
        })
        // ②′ 五票表决（P0-71）：初解(主视觉模型看图) + 四次独立复解(强模型纯文本、逐选项排除、不同温度)，
        // 严格多数票（>可用票数一半）一致才采纳；多数分歧 → 标「待确认」不强行判定（识别不清进待确认，
        // 严禁硬给一个可能错的标准答案）。注意：不做「给初解答案让它复核」的锚定式复核——实测复核会被
        // 初解答案带偏（复核票与初解高度相关），多次独立复解的去相关性更好
        let solved = solved0
        let u2x: Usage = accUsage()
        let u2b: Usage = accUsage()
        let u2d: Usage = accUsage()
        // 待确认题号集合：票数无严格多数的题，后续比对阶段强制标「无法识别/待确认」
        const pendingNos = new Set<string>()
        // 每题的候选答案摘要（票N=答案），用于待确认 comment 与清单展示
        const votesMemo = new Map<string, string[]>()
        {
          const v0 = new Map(solved0.items.map((s) => [String(Number(s.no)), s]))
          // 四次独立复解票（强模型纯文本，不同温度去相关；失败降级跳过该票）。
          // 验收#43建议：复解票跨供应商分配——4 张复解票按 2+2 分给另一家已配置供应商
          //（异构模型 ensemble 去相关）；只有一家可用时回退主供应商（行为不变）。
          // 备选供应商调用失败时同票回退主供应商再试一次，避免票数无谓减员
          const altProvider = getProviders().find((p) => p.id !== provider.id && p.api_key && (p.text_model || p.vision_model)) || provider
          const votes: Array<Map<string, PaperSolvedItem>> = [v0]
          const temps = [0.0, 0.2, 0.5, 0.7]
          for (let ti = 0; ti < temps.length; ti++) {
            const vm = new Map<string, PaperSolvedItem>()
            const chain = ti % 2 === 1 && altProvider.id !== provider.id ? [altProvider, provider] : [provider]
            let done = false; let lastErr: any = null
            for (const pv of chain) {
              try {
                const pr = await solvePaperPass2(pv, { grade: meta.grade, questions: extracted.items, temperature: temps[ti] })
                if (ti === 0) u2x = pr.usage
                else if (ti === 1) u2b = pr.usage
                else u2d = pr.usage
                for (const s of pr.result.items) vm.set(String(Number(s.no)), s)
                votes.push(vm)
                done = true
                if (pv.id !== provider.id) console.log(`[analyze] 复解票${ti + 1} 由备选供应商「${pv.name}」承担`)
                break
              } catch (e: any) {
                lastErr = e
                console.error(`[analyze] 复解票${ti + 1}（供应商「${pv.name}」）失败:`, e.message)
              }
            }
            if (!done) console.error(`[analyze] 复解票${ti + 1}失败（跳过）:`, lastErr?.message)
          }
          // 表决：按答案一致性分组，取「严格多数」（超过可用票数一半）组；无多数 → 待确认。
          // 空答案的票不计入（复解对复杂计算题可能只给解题过程没给 answer——那属于该票弃权，不算分歧票）
          const votesOf = (no: string) => votes.map((vm) => vm.get(no)).filter((v): v is PaperSolvedItem => !!v && !!String(v.answer || '').trim())
          const final = new Map<string, PaperSolvedItem>()
          for (const q of extracted.items) {
            const no = String(Number(q.no))
            const vs = votesOf(no)
            votesMemo.set(no, votes.map((vm, i) => vm.get(no) && String(vm.get(no)!.answer || '').trim() && `票${i}=${vm.get(no)!.answer.slice(0, 60)}`).filter(Boolean) as string[])
            if (q.qtype === '选择') {
              console.log(`[analyze] 第${no}题五票：${votes.map((vm, i) => `票${i}=${vm.get(no)?.answer || '—'}`).join(' / ')}`)
            }
            if (vs.length) {
              const groups: Array<{ rep: PaperSolvedItem; members: PaperSolvedItem[] }> = []
              for (const v of vs) {
                const g = groups.find((g) => answersAgree(g.rep.answer, v.answer, q.qtype, sampleEquivalent))
                if (g) g.members.push(v)
                else groups.push({ rep: v, members: [v] })
              }
              groups.sort((a, b) => b.members.length - a.members.length)
              const top = groups[0]
              const need = Math.floor(vs.length / 2) + 1 // 严格多数：5票需3，4票需3，3票需2，2票需2
              if (top.members.length >= need) {
                // 多数票采纳（组内优先采初解票，保留其看图得到的解析/配图）
                final.set(no, top.members.includes(v0.get(no)!) ? v0.get(no)! : top.rep)
                continue
              }
            }
            // 无严格多数 → 待确认，不强行判定（candidates 信息进比对说明与待确认清单）
            pendingNos.add(no)
            const cands = votes.map((vm, i) => vm.get(no) && `票${i}=${vm.get(no)!.answer}`).filter(Boolean)
            console.log(`[analyze] 第${no}题票数无多数 → 待确认（${cands.join('，')}）`)
          }
          solved = {
            items: extracted.items.map((q) => final.get(String(Number(q.no)))).filter(Boolean) as PaperSolvedItem[],
            note: [solved0.note, `标准答案经五票表决（初解/复解一~四，不同温度独立复解），无多数分歧的题标「待确认」不强行判定`].filter(Boolean).join(' '),
          }
        }
        // ③ 读取答题卡学生作答（有答题卡页才调用；逐页读取提高识别保真度）
        let sheet: { items: SheetReadItem[]; unrecognized: string[] } = { items: [], unrecognized: [] }
        let u3: Usage = accUsage()
        if (sheetUrls.length) {
          for (const pageUrl of sheetUrls) {
            try {
              const r3 = await readAnswerSheet(provider, [pageUrl], meta)
              u3.prompt_tokens += r3.usage.prompt_tokens || 0
              u3.completion_tokens += r3.usage.completion_tokens || 0
              u3.cost += r3.usage.cost || 0
              sheet.unrecognized.push(...r3.result.unrecognized)
              for (const it of r3.result.items) {
                const key = String(Number(it.no))
                const prev = sheet.items.find((x) => String(Number(x.no)) === key)
                if (prev) Object.assign(prev, it)
                else sheet.items.push(it)
              }
            } catch (e: any) {
              console.error('[analyze] 答题卡页读取失败（跳过该页）:', e.message)
            }
          }
          // ③′ 手写/填涂逐题回看复核：把第一轮读到的结果连同原图再发一遍，要求逐位核对
          //（根号内数字、小数点、字母）——纯手写识别单次调用错读率不低，二次回看显著提升保真度；
          // 复核优先用**另一家**视觉供应商（不同模型族错读去相关，两轮不一致才有表决意义）
          const altProvider = getProviders().find((p) => p.id !== provider.id && p.api_key && (p.vision_model || p.text_model)) || provider
          const firstPassItems = sheet.items.map((s) => ({ ...s }))
          if (sheet.items.length) {
            try {
              const firstPass = sheet.items.map((s) => `第${s.no}题：学生作答=${s.student_answer}${s.per_blank.length ? `（逐空：${s.per_blank.map((b) => `${b.key}=${b.answer}`).join('，')}）` : ''}${s.handwritten_note ? `；手写：${s.handwritten_note.slice(0, 200)}` : ''}`).join('\n')
              const vr = await verifyAnswerSheetFull(altProvider, {
                grade: meta.grade,
                firstPass,
                images: sheetUrls,
              })
              u3.prompt_tokens += vr.usage.prompt_tokens || 0
              u3.completion_tokens += vr.usage.completion_tokens || 0
              u3.cost += vr.usage.cost || 0
              for (const it of vr.result.items) {
                const key = String(Number(it.no))
                const prev = sheet.items.find((x) => String(Number(x.no)) === key)
                if (prev && (it.student_answer || it.handwritten_note)) Object.assign(prev, it)
                else if (!prev) sheet.items.push(it)
              }
              console.log(`[analyze] 答题卡二次回看复核完成（${vr.result.items.length} 题）`)
            } catch (e: any) {
              console.error('[analyze] 答题卡二次复核失败（用第一轮结果）:', e.message)
            }
          }
          // ③″ 填涂三票表决：两轮读到的选择题字母不一致 → targeted 放大重读终裁
          //（填涂框读错是随机错误，两轮不一致时第三次定向重读最可靠）
          {
            const qTypeOf = (no: string) => extracted.items.find((q) => String(Number(q.no)) === no)?.qtype
            const disagree: string[] = []
            for (const fp of firstPassItems) {
              const no = String(Number(fp.no))
              const cur = sheet.items.find((x) => String(Number(x.no)) === no)
              if (!cur || qTypeOf(no) !== '选择') continue
              const la = letterSetOf(fp.student_answer)
              const lb = letterSetOf(cur.student_answer)
              if (la && lb && la.join('') !== lb.join('')) disagree.push(no)
            }
            if (disagree.length) {
              try {
                console.log(`[analyze] 填涂两轮不一致，targeted 重读题号：${disagree.join('、')}`)
                const rr = await rereadSheetQuestions(provider, sheetUrls, disagree, meta)
                u3.prompt_tokens += rr.usage.prompt_tokens || 0
                u3.completion_tokens += rr.usage.completion_tokens || 0
                u3.cost += rr.usage.cost || 0
                for (const it of rr.result.items) {
                  const key = String(Number(it.no))
                  const prev = sheet.items.find((x) => String(Number(x.no)) === key)
                  if (prev) Object.assign(prev, it)
                  else sheet.items.push(it)
                }
              } catch (e: any) {
                console.error('[analyze] 填涂重读失败（用第二轮结果）:', e.message)
              }
            }
          }
        }
        // ④ 逐题比对判定（带试卷页原图，便于模型核对图题与重绘 figure_spec）
        const { result: analysis, usage: u4 } = await compareAndJudge(provider, {
          grade: meta.grade,
          hasSheet: sheetUrls.length > 0,
          questions: extracted.items,
          solved: solved.items,
          sheet: sheet.items,
          extraNote: [extracted.unrecognized.length ? `试卷页识别说明：${extracted.unrecognized.join('；')}` : '', sheet.unrecognized.length ? `答题卡识别说明：${sheet.unrecognized.join('；')}` : '', solved.note ? `求解说明：${solved.note}` : '', pendingNos.size ? `第${[...pendingNos].join('、')}题标准答案存在多解分歧已标待确认——这些题一律输出 verdict=「无法识别」并在 comment 注明「标准答案待确认」，不得自行判定对错` : ''].filter(Boolean).join(' '),
          images: paperUrls,
        })
        // ④′⁻ 臆测禁令清洗（P3-86，验收#48）：比对模型偶发写出「填空错位/串行/抄错行」类
        // 未经核实的归因，会被教案/讲评原样引用误导教师——统一改写为「待人工核对」，
        // 再进入后续判定校正（校正读取 note 文本，先清洗避免臆测词干扰）
        {
          let scrubbed = 0
          const scrubText = (s: string) => {
            const t = scrubSpeculation(s)
            if (t !== s) scrubbed++
            return t
          }
          for (const it of analysis.items) {
            it.comment = scrubText(String(it.comment || ''))
            it.error_step = scrubText(String(it.error_step || ''))
            for (const sa of Array.isArray(it.sub_answers) ? it.sub_answers : []) {
              if (sa?.note) sa.note = scrubText(String(sa.note))
            }
          }
          if (scrubbed) console.log(`[analyze] 臆测禁令清洗：${scrubbed} 处臆测性归因已改写为待人工核对`)
        }
        // ④′ 选择题判定机器裁定：标准答案字母集合 vs 学生填涂字母集合直接比对（不受模型比对偶发影响）；
        // 判「对」但卷面有红叉 → targeted 放大重读后再裁一次
        {
          const stdBy = new Map(solved.items.map((s) => [String(Number(s.no)), s]))
          const sheetBy = new Map(sheet.items.map((s) => [String(Number(s.no)), s]))
          const choiceOf = (no: string) => extracted.items.find((q) => String(Number(q.no)) === no && q.qtype === '选择')
          const rejudge = (it: any, no: string) => {
            const s = stdBy.get(no); const sh = sheetBy.get(no)
            if (!s || !sh || !choiceOf(no)) return
            const la = letterSetOf(s.answer); const lb = letterSetOf(sh.student_answer)
            if (!la || !lb) return
            it.verdict = la.join('') === lb.join('') ? '对' : '错'
            // P2-75：机器裁定后清洗比对模型残留文案——「判对却残留误选C/正确为D」式矛盾
            // 描述会误导教师；判对的题错误步骤/错因一并清空（判对不存在错误步骤）
            const text = `${it.comment || ''}${it.error_step || ''}`
            if (it.verdict === '对' && (/误选|错选|正确为|正确的是|正确答案|选错|不正确|应选/.test(text) || it.error_step || it.error_type)) {
              it.error_step = ''
              it.error_type = ''
              it.comment = `机器裁定：学生填涂 ${lb.join('')} 与标准答案 ${la.join('')} 一致，判对`
            } else if (it.verdict === '错' && /判对|答对|正确无误|完全正确|填涂与标准答案一致/.test(text)) {
              it.comment = `机器裁定：学生填涂 ${lb.join('')} 与标准答案 ${la.join('')} 不一致，判错`
            }
          }
          const conflicts: string[] = []
          for (const it of analysis.items) {
            const no = String(Number(it.no))
            const sh = sheetBy.get(no)
            if (sh) it.student_answer = sh.student_answer || it.student_answer
            rejudge(it, no)
            if (it.verdict === '对' && sh?.red_x) conflicts.push(no)
          }
          if (conflicts.length) {
            try {
              console.log(`[analyze] 红叉线索与「对」判定冲突，targeted 复核题号：${conflicts.join('、')}`)
              const rr = await rereadSheetQuestions(provider, sheetUrls, conflicts, meta)
              u3.prompt_tokens += rr.usage.prompt_tokens || 0
              u3.completion_tokens += rr.usage.completion_tokens || 0
              u3.cost += rr.usage.cost || 0
              for (const it of rr.result.items) {
                const key = String(Number(it.no))
                const prev = sheet.items.find((x) => String(Number(x.no)) === key)
                if (prev) Object.assign(prev, it)
                else sheet.items.push(it)
              }
              for (const it of analysis.items) {
                const no = String(Number(it.no))
                if (conflicts.includes(no)) rejudge(it, no)
              }
            } catch (e: any) {
              console.error('[analyze] 红叉冲突复核失败（保持原判定）:', e.message)
            }
          }
        }
        // ④′² 判定后置机器校正（P1-78 扩展 → P1-81/P1-82/P2-80，验收 #45/#46 实测驱动）：
        //   P2-80：等价自认判定加否定表述排除（先抹「不等价/非等价/并非等价」再测），合法「错」不再误翻；
        //   P1-78：verdict=错 且 note 自认「代数等价」→ 改对并清洗文案（书写形式差异不是扣分点）；
        //   P1-82：verdict=错 但数值抽样证实两侧表达式等价（各代 3 组取值）→ 同样救回「对」，
        //          不依赖模型自认（#45 的 12(5)：模型只写「表达式错误」未自认等价）；
        //   P1-81：verdict=对 但 note 自书「判错/错误/不等于/不一致/≠」（#45 的 12(4)：学生「小于」
        //          vs 标准「大于」被判对，学生虚增得分）→ 改错；数值抽样证实等价的例外——保留「对」只清洗文案。
        //   含逐空的题校正后按逐空重算整题 verdict（全对→对、全错→错、有对有错→部分对）
        {
          const fixSub = (sa: any): boolean => {
            const note = String(sa?.note || '')
            const equiv = sampleEquivalent(sa?.student, sa?.correct)
            // 错→对：数值抽样证实等价（P1-82，优先）或 note 自认等价（P1-78，P2-80 已排除否定表述）
            if (sa?.verdict === '错' && (equiv === true || isEquivClaim(note))) {
              sa.verdict = '对'
              sa.note = `代数等价校正：${equiv === true ? '数值抽样证实两侧表达式各代 3 组取值一致' : '学生作答与标准答案数学等价（仅书写形式不同）'}，判对${note ? `（原note：${note.slice(0, 80)}）` : ''}`
              return true
            }
            // 对→错：note 自书判错/不一致却 verdict=对（P1-81）
            if (sa?.verdict === '对' && hasJudgeContradiction(note)) {
              if (equiv === true) {
                // 数学上确实等价——保留「对」，只清洗误导性 note
                sa.note = `代数等价校正：学生作答与标准答案数学等价，判对（原note：${note.slice(0, 80)}）`
              } else {
                sa.verdict = '错'
                sa.note = `矛盾校正：note 自书「判错/不一致」与 verdict=对 矛盾，机器改判错${note ? `（原note：${note.slice(0, 80)}）` : ''}`
              }
              return true
            }
            return false
          }
          const stdAnswerOf = new Map(solved.items.map((s) => [String(Number(s.no)), s.answer]))
          const fixItem = (it: any) => {
            const subs = Array.isArray(it.sub_answers) ? it.sub_answers : []
            let fixedSub = 0
            for (const sa of subs) if (fixSub(sa)) fixedSub++
            // 整题层（无逐空时）：对 整题作答 vs 标准答案（取求解答案原文，避开「（解析…）」尾巴）做同样校正。
            // 整题层「对→错」向只认强矛盾词「判错」——整题 comment 是叙述文字，宽关键词误伤面大
            if (!subs.length && (it.verdict === '对' || it.verdict === '错')) {
              const correct = String(stdAnswerOf.get(String(Number(it.no))) || it.reference_answer || '')
              const text = `${it.comment || ''}${it.error_step || ''}`
              const equiv = sampleEquivalent(it.student_answer, correct)
              if (it.verdict === '错' && (equiv === true || isEquivClaim(text))) {
                it.verdict = '对'
                it.error_step = ''
                it.error_type = ''
                it.comment = `代数等价校正：${equiv === true ? '数值抽样证实两侧表达式各代 3 组取值一致' : '学生作答与标准答案数学等价（仅书写形式不同）'}，判对（原判定文案：${String(it.comment || '').slice(0, 80)}）`
                console.log(`[analyze] 判定后置校正：第${it.no}题 → 对`)
              } else if (it.verdict === '对' && /判错/.test(text) && equiv !== true) {
                it.verdict = '错'
                it.comment = `矛盾校正：判定文案自书「判错」与 verdict=对 矛盾，机器改判错（原文案：${String(it.comment || '').slice(0, 80)}）`
                console.log(`[analyze] 判定后置校正：第${it.no}题 → 错`)
              }
            }
            // 逐空重算：校正后全对→对、全错→错、有对有错→部分对（只动 对/错/部分对 三态）
            if (fixedSub > 0 && subs.length && ['对', '错', '部分对'].includes(it.verdict)) {
              const vs: string[] = subs.map((sa: any) => String(sa?.verdict || ''))
              if (vs.length && vs.every((v: string) => v === '对')) {
                it.verdict = '对'
                it.error_step = ''
                it.error_type = ''
                it.comment = `代数等价校正：逐空均判对`
              } else if (vs.length && vs.every((v: string) => v === '错' || v === '未作答')) {
                it.verdict = '错'
              } else if (vs.some((v: string) => v === '对') && vs.some((v: string) => v === '错' || v === '未作答')) {
                it.verdict = '部分对'
              }
            }
            if (fixedSub > 0) console.log(`[analyze] 判定后置校正：第${it.no}题 ${fixedSub} 空被机器校正 → ${it.verdict}`)
          }
          for (const it of analysis.items) fixItem(it)
        }
        // 后处理兜底：比对模型偷懒没抄全的题干/答案，用转录与求解结果回填（严禁「（题干缺失）」式占位直出）
        const stemOf = (no: number) => extracted.items.find((q) => Number(q.no) === no)
        const ansOf = (no: number) => solved.items.find((s) => Number(s.no) === no)
        for (const it of analysis.items) {
          const q = stemOf(it.no)
          if (q) {
            if (!it.stem || /题干缺失|无法比对/.test(it.stem)) it.stem = q.stem
            if (!it.options.length && q.options.length) it.options = q.options
            if (!it.stem) { it.stem = ''; it.verdict = '无法识别' }
          }
          const s = ansOf(it.no)
          if (s && (!it.reference_answer || /题干缺失|无法比对/.test(it.reference_answer))) it.reference_answer = s.answer + (s.solution ? `（解析：${s.solution.slice(0, 200)}）` : '')
        }
        // ④″ 待确认题强制落标（P0-71）：标准答案五票无多数的题——无论比对模型给了什么判定，
        // 一律改「无法识别」+ comment 注明分歧候选，进待确认清单，不强行判定（严禁硬给可能错的标准答案）
        if (pendingNos.size) {
          for (const it of analysis.items) {
            const no = String(Number(it.no))
            if (!pendingNos.has(no)) continue
            const q = stemOf(it.no)
            const cands = votesMemo.get(no) || []
            it.verdict = '无法识别'
            it.sub_answers = []
            it.comment = `标准答案存在多解分歧，已标待确认，请人工核对卷面后判定（候选：${cands.join('；')}）`
            it.reference_answer = `待确认（模型候选：${cands.join('；')}）`
            it.error_step = ''
            it.error_type = ''
          }
          analysis.unrecognized.push(...[...pendingNos].map((no) => `第${no}题：标准答案多解分歧（${votesMemo.get(no)?.join('；') || '候选见逐题说明'}），未强行判定，待人工确认`))
          console.log(`[analyze] ${pendingNos.size} 题标准答案无多数 → 已标待确认`)
        }
        // ④⁗ 展示层/判定层同源校验（P1-84）：判定实际采用的是五票表决答案（solved.items），
        // 但展示给教师的 items.reference_answer 可能是比对模型自己写的另一份答案——两者不一致时
        //（#47 的 Q7：展示层 C、判定层用 B 判「对」，教师看到的标准答案与判定依据不符），
        // 不得静默判定，该题一律进待确认交人工；一致的同源改写，杜绝展示与判定口径分裂。
        {
          const votedOf = new Map(solved.items.map((s) => [String(Number(s.no)), s]))
          const qtypeOf = (no: number) => String(extracted.items.find((q) => Number(q.no) === no)?.qtype || '')
          const clip = (s: string) => String(s || '').slice(0, 60)
          let crossFlagged = 0
          for (const it of analysis.items) {
            const no = String(Number(it.no))
            if (pendingNos.has(no)) continue
            const s = votedOf.get(no)
            if (!s || !String(s.answer || '').trim()) continue
            const shown = String(it.reference_answer || '')
            const voted = String(s.answer)
            if (shown && answersClearlyDisagree(shown, voted, qtypeOf(Number(it.no)), sampleEquivalent)) {
              it.verdict = '无法识别'
              it.sub_answers = []
              it.error_step = ''
              it.error_type = ''
              it.comment = `标准答案展示层与判定层不一致，已标待确认，请人工核对卷面后判定（展示：${clip(shown)}；判定用：${clip(voted)}）`
              it.reference_answer = `待确认（展示层：${clip(shown)}；判定层：${clip(voted)}）`
              analysis.unrecognized.push(`第${it.no}题：标准答案展示层（${clip(shown)}）与判定层（${clip(voted)}）不一致，未静默判定，待人工确认`)
              crossFlagged++
              console.log(`[analyze] 第${it.no}题展示层/判定层答案不一致 → 改待确认（展示=${clip(shown)}，判定=${clip(voted)}）`)
            } else {
              // 同源：展示层改写为判定实际采用的表决答案（解析尾巴照旧回填）
              it.reference_answer = voted + (s.solution ? `（解析：${s.solution.slice(0, 200)}）` : '')
            }
          }
          if (crossFlagged) console.log(`[analyze] ${crossFlagged} 题展示层/判定层不一致 → 已标待确认`)
        }
        // ④⁵ 空位对齐校验（P1-88，验收#48）：比对层 sub_answers 必须与标准答案逐空一一对应。
        // 读卡/比对层把两空内容合并成一条（#48 的 12(4)(5)）或漏空时，逐空判定不可信：
        // 某空判定行丢失、P1-82 等价救回失效、note 臆测连锁发生（P3-86 同象）。
        // 发现空数/空位不符 → 整题转待确认，不静默采信错位的逐空判定
        {
          const stdOf = new Map(solved.items.map((s) => [String(Number(s.no)), s]))
          const sheetOf = new Map(sheet.items.map((s) => [String(Number(s.no)), s]))
          let misaligned = 0
          for (const it of analysis.items) {
            const no = String(Number(it.no))
            if (it.verdict === '无法识别' || pendingNos.has(no)) continue
            const s = stdOf.get(no)
            if (!s) continue
            const why = subBlanksMisaligned(s.per_blank || [], Array.isArray(it.sub_answers) ? it.sub_answers : [], sheetOf.get(no)?.per_blank)
            if (!why) continue
            const stdText = (s.per_blank || []).map((b) => `${b.key}=${b.answer}`).join('，')
            it.verdict = '无法识别'
            it.sub_answers = []
            it.error_step = ''
            it.error_type = ''
            it.comment = `空位对齐失败（${why}），逐空判定不可信，已转待确认，请人工核对卷面（标准逐空：${stdText.slice(0, 120)}）`
            it.reference_answer = `待确认（标准逐空：${stdText.slice(0, 120)}）`
            analysis.unrecognized.push(`第${it.no}题：${why}，逐空判定不可信，待人工确认`)
            misaligned++
            console.log(`[analyze] 第${it.no}题${why} → 改待确认`)
          }
          if (misaligned) console.log(`[analyze] ${misaligned} 题空位不齐 → 已标待确认`)
        }
        // ④‴ 配图落标：重绘成功的题把 figure_spec 写进分析结果（figure_status=已重绘）；
        // 原题有图但模板不能还原/重绘失败的标「图待补」，不编造
        for (const it of analysis.items) {
          const q = stemOf(it.no)
          if (!q || !(q.has_figure || /如图/.test(q.stem))) continue
          const spec = figureSpecMap.get(String(Number(it.no)))
          if (spec) { it.figure_spec = spec; it.figure_status = '已重绘' }
          else if (!it.figure_spec) it.figure_status = '图待补'
        }
        analysis.items = analysis.items.filter((it) => it.stem)
        const usage = {
          prompt_tokens: u1.prompt_tokens + u2.prompt_tokens + u2x.prompt_tokens + u2b.prompt_tokens + u2d.prompt_tokens + u3.prompt_tokens + u4.prompt_tokens,
          completion_tokens: u1.completion_tokens + u2.completion_tokens + u2x.completion_tokens + u2b.completion_tokens + u2d.completion_tokens + u3.completion_tokens + u4.completion_tokens,
          cost: u1.cost + u2.cost + u2x.cost + u2b.cost + u2d.cost + u3.cost + u4.cost,
        }
        return { ok: true, analysis, usage, provider: provider.name, pipeline: 'two-phase' as const }
      }

      // ---------- 只传答题卡（无试卷页）：降级单阶段判定 ----------
      const { result: analysis, usage } = await analyzePaper(provider, sheetUrls, {
        name: student.name,
        grade: meta.grade,
        textbook: meta.textbook,
      })
      return { ok: true, analysis, usage, provider: provider.name, pipeline: 'sheet-only' as const }
    } catch (e: any) {
      reply.code(502).send({ error: e.message || 'AI 分析失败' })
    }
  })
}
