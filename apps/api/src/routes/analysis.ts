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
import { getProviders, pickProvider, extractPaperQuestions, solvePaper, solvePaperPass2, readAnswerSheet, rereadSheetQuestions, verifyAnswerSheetFull, compareAndJudge, analyzePaper } from '../ai'
import type { SheetReadItem, PaperExtractItem, PaperSolvedItem } from '@workbench/shared'

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

// ---------- 答案一致性判定（C2 三票表决用） ----------
// 选择题：提取 A~D 字母集合（答案串较短时）；其它题：提取全部数值（含 LaTeX 里的数字），2% 容差配对
function letterSetOf(s: string): string[] | null {
  const clean = String(s || '').replace(/\s+/g, '')
  if (!clean || clean.length > 60) return null
  const letters = [...new Set(clean.replace(/[^ABCD]/g, '').split(''))]
  if (!letters.length || letters.length > 4) return null
  // 至少要有一个字母紧邻答案语境（如「C」「AD」「答案：C」），纯叙述文字不算
  return /^[^A-Za-z]{0,6}[ABCD]/.test(clean) || /^(答案|选)[^A-Za-z]{0,3}[ABCD]/.test(clean) ? letters.sort() : null
}
function numsOf(s: string): number[] {
  const t = String(s || '').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, ' ')
  const out: number[] = []
  const re = /-?\d+(?:\.\d+)?(?:\s*[eE]\s*(-?\d+)|\s*[×x*]\s*10\s*\^?\s*\{?(-?\d+)\}?)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const base = parseFloat(m[0].replace(/[×x*]\s*10\s*\^?\s*\{?-?\d+\}?$/, '').replace(/\s+/g, ''))
    if (!isFinite(base)) continue
    const exp = m[1] || m[2]
    out.push(exp ? base * Math.pow(10, parseInt(exp)) : base)
    if (out.length > 12) break
  }
  return out
}
function answersAgree(a: string, b: string, qtype: string): boolean {
  const na = String(a || '').trim(); const nb = String(b || '').trim()
  if (!na || !nb) return false
  if (qtype === '选择') {
    const la = letterSetOf(na); const lb = letterSetOf(nb)
    if (la && lb) return la.join('') === lb.join('')
  }
  const xs = numsOf(na); const ys = numsOf(nb)
  if (xs.length && ys.length) {
    if (xs.length !== ys.length) return false
    const used = new Set<number>()
    for (const x of xs) {
      const hit = ys.findIndex((y, i) => !used.has(i) && (Math.abs(x - y) <= 0.02 * Math.max(Math.abs(x), Math.abs(y), 1e-9)))
      if (hit < 0) return false
      used.add(hit)
    }
    return true
  }
  return na.replace(/\s+/g, '') === nb.replace(/\s+/g, '')
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
          // 四次独立复解票（强模型纯文本，不同温度去相关；失败降级跳过该票）
          const votes: Array<Map<string, PaperSolvedItem>> = [v0]
          const temps = [0.0, 0.2, 0.5, 0.7]
          for (let ti = 0; ti < temps.length; ti++) {
            const vm = new Map<string, PaperSolvedItem>()
            try {
              const pr = await solvePaperPass2(provider, { grade: meta.grade, questions: extracted.items, temperature: temps[ti] })
              if (ti === 0) u2x = pr.usage
              else if (ti === 1) u2b = pr.usage
              else u2d = pr.usage
              for (const s of pr.result.items) vm.set(String(Number(s.no)), s)
              votes.push(vm)
            } catch (e: any) {
              console.error(`[analyze] 复解票${ti + 1}失败（跳过）:`, e.message)
            }
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
                const g = groups.find((g) => answersAgree(g.rep.answer, v.answer, q.qtype))
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
            if (la && lb) it.verdict = la.join('') === lb.join('') ? '对' : '错'
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
