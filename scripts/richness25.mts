// 节充实度统计（验收 #26 P3-45：口径统一为「严格精确匹配」）
// 口径：题目 knowledge_points 中出现教材节名原文（归一化比较：去空白/统一破折号/去括号冒号）才计入该节。
// 此前旧版用互为子串的模糊匹配（逐 kp 命中首个节后 break），会把「2 题节」误升格为「≥3 题节」，
// 与监督独立复算（115/220）分歧。归一化脚本（scripts/normalize-kps.mts）保证每题至少带 1 个规范节名后，
// 本脚本即唯一权威口径。--fuzzy 仅作对照参考，不再作为统计依据。
// 用法：npx tsx scripts/richness25.mts [--fuzzy]
import Database from 'better-sqlite3'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const FUZZY = process.argv.includes('--fuzzy')
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT knowledge_points FROM questions').all() as any[]
const all = rows.flatMap((r) => { try { return JSON.parse(r.knowledge_points || '[]') as string[] } catch { return [] } })
const sections: string[] = []
TEXTBOOK.forEach((v: any) => v.chapters.forEach((ch: any) => ch.sections.forEach((s: any) => sections.push(s))))
const norm = (s: string): string => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—').replace(/[（）()：:]/g, '')
const secNorm = new Map(sections.map((s) => [norm(s), s]))

const cnt = new Map<string, number>()
for (const s of sections) cnt.set(s, 0)
for (const k of all) {
  if (FUZZY) {
    for (const s of sections) {
      if (k === s || k.includes(s) || s.includes(k)) { cnt.set(s, (cnt.get(s) || 0) + 1); break }
    }
  } else {
    const s = secNorm.get(norm(k))
    if (s) cnt.set(s, (cnt.get(s) || 0) + 1)
  }
}
let ok = 0
const one: string[] = [], two: string[] = []
for (const [s, n] of cnt) {
  if (n >= 3) { ok++; continue }
  if (n === 1) one.push(s)
  else if (n === 2) two.push(s)
}
console.log(`${FUZZY ? '[对照·模糊口径]' : '[权威·严格精确口径]'} >=3题节: ${ok}/220;  1题节: ${one.length}  2题节: ${two.length}`)
console.log('1题节:\n- ' + one.join('\n- '))
console.log('2题节:\n- ' + two.join('\n- '))
