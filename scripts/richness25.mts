// 临时统计：节充实度（>=3题节 / 1题节 / 2题节）
import Database from 'better-sqlite3'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT knowledge_points FROM questions').all() as any[]
const all = rows.flatMap((r) => { try { return JSON.parse(r.knowledge_points || '[]') } catch { return [] } })
const sections: string[] = []
TEXTBOOK.forEach((v: any) => v.chapters.forEach((ch: any) => ch.sections.forEach((s: any) => sections.push(s))))
const cnt = new Map<string, number>()
for (const s of sections) cnt.set(s, 0)
for (const k of all) {
  for (const s of sections) {
    if (k === s || k.includes(s) || s.includes(k)) { cnt.set(s, (cnt.get(s) || 0) + 1); break }
  }
}
let ok = 0
const one: string[] = [], two: string[] = []
for (const [s, n] of cnt) {
  if (n >= 3) { ok++; continue }
  if (n === 1) one.push(s)
  else two.push(s)
}
console.log('>=3题节:', ok, '/220;  1题节:', one.length, ' 2题节:', two.length)
console.log('1题节:\n- ' + one.join('\n- '))
console.log('2题节:\n- ' + two.join('\n- '))
