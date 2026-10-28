// 一次性存量对齐脚本（P1-7 + P2-12，验收 #6 要求）：
// 1) 知识点标签对齐教材节名：模型自由发挥的碎片标签若与某教材节名互为子串（归一后），
//    则把节名原文注入该题 knowledge_points（保留原标签）；半角/全角破折号不一致也一并归一
//    → 保证教材目录筛选（精确匹配节名）能命中、覆盖统计不失真
// 2) LaTeX 裸中文上下标清洗：题干/答案/解析/易错点里 $v_甲$、$W_{电}$ 这类裸中文包上 \text{}
// 用法：npx tsx scripts/align-kps.mts [--dry-run]；只动 questions 表，不触碰学生/账号数据
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { alignKpToSection, sanitizeLatexChinese } from '../packages/shared/src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))

function kpOf(raw: string): string[] {
  try { return JSON.parse(raw || '[]') as string[] } catch { return [] }
}
// 比较用归一（与 shared 的 kpNorm 同口径：去空白、统一破折号）
function kpNorm(s: string): string {
  return String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
}

const rows = db.prepare('SELECT id, stem, answer, solution, pitfall, knowledge_points FROM questions ORDER BY id').all() as any[]
let kpsChanged = 0
let latexChanged = 0
let sectionsInjected = 0
let alignedQuestions = 0
const detail: string[] = []

const updKps = db.prepare('UPDATE questions SET knowledge_points = ? WHERE id = ?')
const updText = db.prepare('UPDATE questions SET stem = ?, answer = ?, solution = ?, pitfall = ? WHERE id = ?')

for (const q of rows) {
  const oldKps = kpOf(q.knowledge_points)
  // 1) 节名对齐：每个标签尝试映射教材节名，命中则注入（原标签保留，归一去重）
  const nextKps: string[] = []
  const seen = new Set<string>()
  const injected: string[] = []
  for (const k of oldKps) {
    const key = kpNorm(k)
    if (!key || seen.has(key)) continue
    seen.add(key)
    nextKps.push(k)
    const sec = alignKpToSection(k)
    if (sec && !seen.has(kpNorm(sec))) {
      seen.add(kpNorm(sec))
      nextKps.push(sec)
      injected.push(`${k} → ${sec}`)
      sectionsInjected++
    }
  }
  // 2) LaTeX 中文下标清洗
  const t = {
    stem: sanitizeLatexChinese(q.stem),
    answer: sanitizeLatexChinese(q.answer),
    solution: sanitizeLatexChinese(q.solution),
    pitfall: sanitizeLatexChinese(q.pitfall),
  }
  const textChanged = t.stem !== q.stem || t.answer !== q.answer || t.solution !== q.solution || t.pitfall !== q.pitfall
  const kpsNew = JSON.stringify(nextKps)
  const kpsChangedHere = kpsNew !== q.knowledge_points

  if (!kpsChangedHere && !textChanged) continue
  alignedQuestions++
  detail.push(`#${q.id}${injected.length ? ' 节名[' + injected.join('；') + ']' : ''}${textChanged ? ' +LaTeX中文清洗' : ''}`)
  if (DRY) continue
  if (kpsChangedHere) { updKps.run(kpsNew, q.id); kpsChanged++ }
  if (textChanged) { updText.run(t.stem, t.answer, t.solution, t.pitfall, q.id); latexChanged++ }
}

console.log(`===== 存量对齐${DRY ? '（dry-run 预览，未写入）' : '完成'} =====`)
console.log(`涉及题目 ${alignedQuestions} / ${rows.length}`)
console.log(`注入教材节名 ${sectionsInjected} 处（写入 ${kpsChanged} 题）；LaTeX 中文上下标清洗（写入 ${latexChanged} 题）`)
for (const d of detail) console.log('- ' + d)

// 复测口径：对齐后统计「含至少一个教材节名」的题数
const rows2 = db.prepare('SELECT knowledge_points FROM questions').all() as any[]
const sections = new Set(rows2.flatMap((r) => kpOf(r.knowledge_points)))
let withSection = 0
for (const r of rows2) {
  const kps = kpOf(r.knowledge_points)
  if (kps.some((k) => sections.has(k))) withSection++
}
console.log(`对齐后：${rows2.length} 题中 ${withSection} 题含教材节名标签`)
