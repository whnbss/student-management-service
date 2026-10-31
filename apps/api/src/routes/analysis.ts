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
import { getProviders, pickProvider, extractPaperQuestions, solvePaper, reviewSolve, readAnswerSheet, compareAndJudge, analyzePaper } from '../ai'
import type { SheetReadItem, PaperExtractItem } from '@workbench/shared'

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
        // ② 独立求解标准答案（带试卷页原图：纸带读数/图像/装置必须看图）
        const { result: solved0, usage: u2 } = await solvePaper(provider, {
          grade: meta.grade,
          questions: extracted.items,
          images: paperUrls,
        })
        // ②′ 标准答案交叉复核（二审）：只复核选择题（字母级重算收益大、无误伤）；
        // 计算/实验题复核反而易引入新错（实测），保持原解。复核失败降级用原解（不阻塞）
        let solved = solved0
        let u2x: Usage = accUsage()
        const choiceNo = new Set(extracted.items.filter((q) => q.qtype === '选择').map((q) => String(Number(q.no))))
        if (choiceNo.size) {
          try {
            const choiceSolved = solved0.items.filter((s) => choiceNo.has(String(Number(s.no))))
            const rv = await reviewSolve(provider, {
              grade: meta.grade,
              questions: extracted.items.filter((q) => choiceNo.has(String(Number(q.no)))),
              solved: choiceSolved,
            })
            u2x = rv.usage
            const byNo = new Map(rv.result.items.map((s) => [s.no, s]))
            const fixCount = rv.result.items.filter((s) => s.changed && s.answer).length
            solved = {
              items: solved0.items.map((s) => {
                if (!choiceNo.has(String(Number(s.no)))) return s
                const r2 = byNo.get(String(Number(s.no)))
                return r2 && r2.answer ? { ...s, answer: r2.answer, solution: r2.solution || s.solution } : s
              }),
              note: [solved0.note, fixCount ? `选择题答案经交叉复核修正 ${fixCount} 题` : ''].filter(Boolean).join(' '),
            }
            console.log(`[analyze] 选择题答案复核修正 ${fixCount} 题`)
          } catch (e: any) {
            console.error('[analyze] 答案复核失败（降级用原解）:', e.message)
          }
        }
        // ③ 读取答题卡学生作答（有答题卡页才调用）
        let sheet: { items: SheetReadItem[]; unrecognized: string[] } = { items: [], unrecognized: [] }
        let u3: Usage = accUsage()
        if (sheetUrls.length) {
          const r3 = await readAnswerSheet(provider, sheetUrls, meta)
          sheet = r3.result
          u3 = r3.usage
        }
        // ④ 逐题比对判定（带试卷页原图，便于模型核对图题与重绘 figure_spec）
        const { result: analysis, usage: u4 } = await compareAndJudge(provider, {
          grade: meta.grade,
          hasSheet: sheetUrls.length > 0,
          questions: extracted.items,
          solved: solved.items,
          sheet: sheet.items,
          extraNote: [extracted.unrecognized.length ? `试卷页识别说明：${extracted.unrecognized.join('；')}` : '', sheet.unrecognized.length ? `答题卡识别说明：${sheet.unrecognized.join('；')}` : '', solved.note ? `求解说明：${solved.note}` : ''].filter(Boolean).join(' '),
          images: paperUrls,
        })
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
        analysis.items = analysis.items.filter((it) => it.stem)
        const usage = {
          prompt_tokens: u1.prompt_tokens + u2.prompt_tokens + u2x.prompt_tokens + u3.prompt_tokens + u4.prompt_tokens,
          completion_tokens: u1.completion_tokens + u2.completion_tokens + u2x.completion_tokens + u3.completion_tokens + u4.completion_tokens,
          cost: u1.cost + u2.cost + u2x.cost + u3.cost + u4.cost,
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
