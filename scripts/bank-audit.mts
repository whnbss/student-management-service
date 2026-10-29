// 题库一键体检（验收 #13 建议②长期修法）：npm run bank-audit 等价于 npx tsx scripts/bank-audit.mts
// 合并口径：总数与分布 + 覆盖（精确节名）+ 缺图 + 字面 \n（后非字母）+ 字段非空（P1-11：answer 不得为空）+ 数值复核
// 补题批后必跑，报告贴评论；任一硬校验失败 exit 1
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'
import { checkSolutionArithmetic } from '../packages/shared/src/index.ts'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'), { readonly: true })
const rows = db.prepare('SELECT id, stem, answer, solution, pitfall, qtype, difficulty, figure, knowledge_points FROM questions ORDER BY id').all() as any[]
const kpOf = (r: string): string[] => { try { return JSON.parse(r || '[]') } catch { return [] } }
const norm = (s: string): string => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
const BS = String.fromCharCode(92)
const LIT = new RegExp(BS + BS + 'n(?![a-zA-Z])', 'g') // 字面 反斜杠+n，后非字母

let hardFail = 0
// ---------- 1. 字段非空（P1-11 长期修法：answer 非空为硬校验） ----------
const emptyIds: string[] = []
for (const r of rows) {
  const miss: string[] = []
  if (!String(r.stem ?? '').trim()) miss.push('stem')
  if (!String(r.answer ?? '').trim()) miss.push('answer')
  if (!String(r.solution ?? '').trim()) miss.push('solution')
  if (miss.length) emptyIds.push(`#${r.id}(${miss.join('/')})`)
}
if (emptyIds.length) { hardFail++; console.log(`✗ 字段非空：${emptyIds.length} 题缺失 → ${emptyIds.join(' ')}`) }
else console.log(`✓ 字段非空：${rows.length} 题 stem/answer/solution 全部非空`)

// ---------- 2. 缺图守卫 ----------
const noFig = rows.filter((r) => /如图|图所示/.test(String(r.stem || '')) && !String(r.figure || '').trim())
if (noFig.length) { hardFail++; console.log(`✗ 缺图：${noFig.length} 题题干称「如图」但 figure 为空 → ${noFig.map((r) => '#' + r.id).join(' ')}`) }
else console.log('✓ 缺图：0 题（题干称「如图」的题均有配图）')

// ---------- 3. 字面 \n（后非字母） ----------
const litIds: string[] = []
let litTotal = 0
for (const r of rows) {
  for (const f of ['stem', 'answer', 'solution', 'pitfall']) {
    LIT.lastIndex = 0
    const n = (String(r[f] ?? '').match(LIT) || []).length
    if (n) { litTotal += n; litIds.push(`#${r.id}.${f}×${n}`) }
  }
}
if (litTotal) { hardFail++; console.log(`✗ 字面 \\n：${litTotal} 处 → ${litIds.join(' ')}`) }
else console.log('✓ 字面 \\n：0 处')

// ---------- 4. 数值复核（表达式求值，全库 solution 扫描） ----------
const flagged: string[] = []
for (const r of rows) {
  const issues = checkSolutionArithmetic(String(r.solution ?? ''))
  if (issues.length) flagged.push(`#${r.id} ${issues.map((i: any) => i.msg || JSON.stringify(i)).join('；').slice(0, 120)}`)
}
if (flagged.length) { hardFail++; console.log(`✗ 数值复核：${flagged.length} 题标记（需人工复算确认）\n- ` + flagged.join('\n- ')) }
else console.log(`✓ 数值复核：全库 ${rows.length} 题 0 标记`)

// ---------- 5. 分布与覆盖 ----------
const byT: Record<string, number> = {}
const byD: Record<number, number> = {}
for (const r of rows) { byT[r.qtype] = (byT[r.qtype] || 0) + 1; byD[r.difficulty] = (byD[r.difficulty] || 0) + 1 }
console.log(`总数 ${rows.length}；题型 ${Object.entries(byT).map(([k, v]) => `${k}${v}`).join('/')}；难度 D1-2 ${(byD[1] || 0) + (byD[2] || 0)}/D3 ${byD[3] || 0}/D4-5 ${(byD[4] || 0) + (byD[5] || 0)}（D5 ${byD[5] || 0}）`)

const VOL: Record<string, string> = { bxF1: '必修一', bxF2: '必修二', bxF3: '必修三', xxF1: '选必一', xxF2: '选必二', xxF3: '选必三' }
const sections: string[] = []
TEXTBOOK.forEach((v) => v.chapters.forEach((ch) => ch.sections.forEach((s) => sections.push(s))))
const secSet = new Set(sections.map(norm))
const coveredExact = new Set<string>()
for (const r of rows) for (const k of kpOf(r.knowledge_points)) if (secSet.has(norm(k))) coveredExact.add(norm(k))
console.log(`覆盖（精确）：${coveredExact.size}/${sections.length}（${Math.round((coveredExact.size / sections.length) * 1000) / 10}%）`)

console.log(hardFail ? `\n===== bank-audit 结论：${hardFail} 项硬校验未过 =====` : '\n===== bank-audit 结论：全部硬校验通过 =====')
process.exit(hardFail ? 1 : 0)
