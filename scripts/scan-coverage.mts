import { TEXTBOOK } from '../packages/shared/src/textbook.ts'
import Database from 'better-sqlite3'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT knowledge_points FROM questions').all() as any[]
const allKps = rows.flatMap((r) => { try { return JSON.parse(r.knowledge_points || '[]') as string[] } catch { return [] } })
const norm = (s: string) => s.replace(/\s+/g, '')
const VOL: Record<string, string> = { bxF1: '必修一', bxF2: '必修二', bxF3: '必修三', xxF1: '选必一', xxF2: '选必二', xxF3: '选必三' }
const out: string[] = []
for (const v of TEXTBOOK) {
  for (const ch of v.chapters) {
    const counts = ch.sections.map((s) => allKps.filter((k) => norm(s).includes(norm(k)) || norm(k).includes(norm(s))).length)
    out.push(VOL[v.id] + ' | ' + ch.name + ' | ' + ch.sections.map((s, i) => s + '=' + counts[i]).join(' ; '))
  }
}
console.log(out.join('\n'))
