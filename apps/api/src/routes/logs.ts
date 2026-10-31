// 学情日志：时间线 CRUD（M2 扩展：图片 + AI 分析结果落库 + 错题抽取）
// B4 原题还原：错题本存「原题全文 + 选择题选项 + 题图（figure_spec 重绘 SVG，无法重绘时保留原图）」，
// 原题同步存入题库（source='photo'）；变式题只作「举一反三」附加生成，不得替代原题
import type { FastifyInstance } from 'fastify'
import { db, nowISO } from '../db'
import { REDO_INTERVALS, addDays, todayLocal, specToSvg, sanitizeLatexChinese, sanitizeAiText } from '@workbench/shared'

// figure_spec → 题库/错题 figure 列的 JSON 文本（服务端统一渲染 SVG，保证所见即所得）；无 spec 返回空串
function figureJsonOf(spec: any): string {
  if (!spec || !spec.template) return ''
  const svg = specToSvg(spec)
  return svg ? JSON.stringify({ kind: 'svg', data: svg }) : ''
}

// 从确认后的 AI 分析结果抽取错题入库（含艾宾浩斯重做计划：1/3/7/15 天）
// onlyNos：教师勾选确认入库的题号；不传则默认全部错/部分对题目入库
// logImages：本次分析的原图路径列表（错题保留原图——AI 无法重绘的题图至少有照片可回看）
export function extractMistakes(studentId: number, logId: number, analysis: any, onlyNos?: number[], logImages: string[] = []) {
  const items = Array.isArray(analysis?.items) ? analysis.items : []
  const bad = items.filter(
    (it: any) =>
      (it.verdict === '错' || it.verdict === '部分对') &&
      (!Array.isArray(onlyNos) || onlyNos.length === 0 || onlyNos.includes(Number(it.no)))
  )
  const today = todayLocal()
  const due = addDays(today, REDO_INTERVALS[0])
  const ins = db.prepare(`INSERT INTO mistakes(
    student_id, log_id, image, stem, options, figure, correct_solution, wrong_solution, error_type,
    knowledge_points, chapter, difficulty, mastery_status, redo_due, redo_stage, source, created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const it of bad) {
    // B4：stem 用 AI 逐字转录的原题全文；AI 没给出时才回退到评语（旧数据兼容），并在评语里注明「原题待补」
    const stemRaw = sanitizeLatexChinese(sanitizeAiText(it?.stem)).trim()
    const stem = stemRaw || `（原题待补）${sanitizeAiText(it.comment || `第 ${it.no} 题做错`)}`
    const figure = figureJsonOf(it?.figure_spec)
    const image = logImages[0] || '' // 原题照片（与该条学情记录同图）
    ins.run(
      studentId, logId,
      image,
      stem,
      JSON.stringify(Array.isArray(it?.options) ? it.options.map(String) : []),
      figure || (it?.figure_status === '图待补' ? '' : ''),
      sanitizeLatexChinese(sanitizeAiText(it?.reference_answer || '')),
      '',
      String(it.error_type || '其他'),
      JSON.stringify(Array.isArray(it.knowledge_points) ? it.knowledge_points : []),
      '', 3, '未掌握', due, 0, 'ai_analysis', nowISO()
    )
  }
  return bad.length
}

// B4：把确认后的原题存入题库（source='photo'）。
// nos：要入库的题号（教师确认；空数组 = 全部可识别题目）；同一题干前 40 字已存在 photo 题时不重复入库
export function insertPhotoQuestions(studentId: number, analysis: any, nos?: number[]) {
  const items = Array.isArray(analysis?.items) ? analysis.items : []
  const targets = items.filter(
    (it: any) =>
      sanitizeAiText(it?.stem || '').trim() &&
      it.verdict !== '无法识别' &&
      (!Array.isArray(nos) || nos.length === 0 || nos.includes(Number(it.no)))
  )
  if (!targets.length) return 0
  const grade = String((db.prepare('SELECT grade FROM students WHERE id = ?').get(studentId) as any)?.grade ?? '')
  const dupCheck = db.prepare("SELECT id FROM questions WHERE source = 'photo' AND substr(replace(stem, ' ', ''), 1, 40) = ?")
  const ins = db.prepare(`INSERT INTO questions(
    stem, answer, solution, pitfall, knowledge_points, difficulty, qtype, source, mistake_id, grade, figure, created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
  let n = 0
  for (const it of targets) {
    // 选择题：选项拼回题干（题库选择题约定「选项写在题干内」）
    const opts: string[] = Array.isArray(it?.options) ? it.options.map(String).filter(Boolean) : []
    const stem = sanitizeLatexChinese(sanitizeAiText(it.stem)).trim() + (opts.length ? '\n' + opts.join('\n') : '')
    if (dupCheck.get(stem.replace(/\s+/g, '').slice(0, 40))) continue
    ins.run(
      stem,
      sanitizeLatexChinese(sanitizeAiText(it.reference_answer || '')),
      '', // 解析留空：拍照题以错题本的批改信息为准，教师可在题库中补全
      '',
      JSON.stringify(Array.isArray(it.knowledge_points) ? it.knowledge_points.map(String) : []),
      3,
      opts.length ? '选择' : '计算',
      'photo', null, grade,
      figureJsonOf(it?.figure_spec),
      nowISO()
    )
    n++
  }
  return n
}

export default async function logRoutes(app: FastifyInstance) {
  app.get('/api/students/:id/logs', async (req) => {
    const { id } = req.params as { id: string }
    return db.prepare('SELECT * FROM study_logs WHERE student_id = ? ORDER BY date DESC, id DESC').all(id)
  })

  app.post('/api/students/:id/logs', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = (req.body || {}) as {
      date?: string; type?: string; content?: string; next_class_key?: string; homework?: string
      images?: string[]; ai_result?: any; create_mistakes?: boolean; mistake_nos?: number[]
      photo_bank?: boolean // B4：原题是否同步存入题库（默认 true）
      photo_bank_nos?: number[] // B4：存入题库的题号（默认跟随错题勾选）
    }
    if (!b.content || !b.content.trim()) { reply.code(400).send({ error: '记录内容必填' }); return }
    const type = ['上课', '作业', '考试', '其他'].includes(b.type || '') ? b.type! : '其他'
    const images = Array.isArray(b.images) ? b.images : []
    const aiJson = b.ai_result ? JSON.stringify(b.ai_result) : null
    const r = db.prepare(
      `INSERT INTO study_logs(student_id, date, type, content, images, ai_result, ai_generated, next_class_key, homework, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id, b.date || nowISO().slice(0, 10), type, b.content.trim(),
      JSON.stringify(images),
      aiJson, b.ai_result ? 1 : 0, b.next_class_key || '', String(b.homework || '').trim(), nowISO()
    )
    const logId = Number(r.lastInsertRowid)
    // AI 分析结果确认入库时，抽取错/部分对题目进错题本（教师可在错题本中编辑）——B4：原题全文/选项/题图一并入库
    let mistakeCount = 0
    let bankCount = 0
    if (b.ai_result) {
      if (b.create_mistakes !== false) {
        mistakeCount = extractMistakes(Number(id), logId, b.ai_result, b.mistake_nos, images)
      }
      if (b.photo_bank !== false) {
        // 默认跟随错题勾选；教师全选时（photo_bank_nos）以传入为准
        bankCount = insertPhotoQuestions(Number(id), b.ai_result, b.photo_bank_nos ?? b.mistake_nos)
      }
    }
    return { ok: true, id: logId, mistakes_created: mistakeCount, bank_questions_created: bankCount }
  })

  // 编辑学情记录（C3：可事后补填/修改「下次课作业布置」等字段；不传的字段保持不变）
  app.put('/api/logs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const cur = db.prepare('SELECT id FROM study_logs WHERE id = ?').get(id)
    if (!cur) { reply.code(404).send({ error: '学情记录不存在' }); return }
    const b = (req.body || {}) as { content?: string; next_class_key?: string; homework?: string; type?: string; date?: string }
    const sets: string[] = []
    const args: any[] = []
    if (b.content !== undefined) { if (!b.content.trim()) { reply.code(400).send({ error: '记录内容必填' }); return }; sets.push('content = ?'); args.push(b.content.trim()) }
    if (b.next_class_key !== undefined) { sets.push('next_class_key = ?'); args.push(String(b.next_class_key || '').trim()) }
    if (b.homework !== undefined) { sets.push('homework = ?'); args.push(String(b.homework || '').trim()) }
    if (b.type !== undefined && ['上课', '作业', '考试', '其他'].includes(b.type)) { sets.push('type = ?'); args.push(b.type) }
    if (b.date !== undefined && b.date.trim()) { sets.push('date = ?'); args.push(b.date.trim()) }
    if (!sets.length) { reply.code(400).send({ error: '没有要更新的字段' }); return }
    args.push(id)
    db.prepare(`UPDATE study_logs SET ${sets.join(', ')} WHERE id = ?`).run(...args)
    return { ok: true }
  })

  app.delete('/api/logs/:id', async (req) => {
    const { id } = req.params as { id: string }
    db.prepare('DELETE FROM study_logs WHERE id = ?').run(id)
    return { ok: true }
  })
}
