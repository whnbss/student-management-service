// 输出 38 个 2 题节对应的 册/章/年级，供编写 batch18-plan.json
import Database from 'better-sqlite3'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id, knowledge_points FROM questions').all()
const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
const sections = []
TEXTBOOK.forEach((v) => v.chapters.forEach((ch) => ch.sections.forEach((s) => sections.push(s))))
const secSet = new Set(sections.map(norm))
const count = new Map()
for (const r of rows) {
  let kps = []
  try { kps = JSON.parse(r.knowledge_points || '[]') } catch {}
  const hit = new Set()
  for (const k of kps) if (secSet.has(norm(k))) hit.add(norm(k))
  for (const s of hit) count.set(s, (count.get(s) || 0) + 1)
}
const GRADE_OF = { bxF1: '高一', bxF2: '高一', bxF3: '高二', xxF1: '高二', xxF2: '高二', xxF3: '高三' }
let i = 0
for (const v of TEXTBOOK) {
  for (const ch of v.chapters) {
    for (const s of ch.sections) {
      if ((count.get(norm(s)) || 0) === 2) {
        i++
        console.log(`${i}\t${v.id}\t${v.name}\t${GRADE_OF[v.id]}\t${ch.name}\t${s}`)
      }
    }
  }
}
db.close()
