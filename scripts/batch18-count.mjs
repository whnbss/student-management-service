// 核算当前各教材节覆盖（严格精确口径），列出 2 题节清单供第十八批补题
import Database from 'better-sqlite3'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id, knowledge_points FROM questions').all()
const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
const sections = []
TEXTBOOK.forEach((v) => v.chapters.forEach((ch) => ch.sections.forEach((s) => sections.push(s))))
const count = new Map()
const secSet = new Set(sections.map(norm))
for (const r of rows) {
  let kps = []
  try { kps = JSON.parse(r.knowledge_points || '[]') } catch {}
  const hit = new Set()
  for (const k of kps) if (secSet.has(norm(k))) hit.add(norm(k))
  for (const s of hit) count.set(s, (count.get(s) || 0) + 1)
}
const bySec = sections.map((s) => [s, count.get(norm(s)) || 0])
const c1 = bySec.filter(([, n]) => n <= 1)
const c2 = bySec.filter(([, n]) => n === 2)
console.log('节总数', sections.length, '| 0/1题节:', c1.length, '| 2题节:', c2.length, '| ≥3题节:', bySec.filter(([, n]) => n >= 3).length)
console.log('\n== 2题节（', c2.length, '个）==')
c2.forEach(([s, n], i) => console.log(i + 1, s, n))
console.log('\n== ≤1题节 ==')
c1.forEach(([s, n]) => console.log(s, n))
db.close()
