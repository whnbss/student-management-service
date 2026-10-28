// 残留核查 + 同节名题干相似度抽查（验收 #7 复测要求）
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'))
const one = (sql: string) => (db.prepare(sql).get() as any).c
console.log('questions:', one('SELECT COUNT(*) c FROM questions'))
console.log('notifications:', one('SELECT COUNT(*) c FROM notifications'))
console.log('shares:', one('SELECT COUNT(*) c FROM shares'))
console.log('settlements:', one('SELECT COUNT(*) c FROM settlements'))
console.log('students:', db.prepare('SELECT id, name FROM students').all())
console.log('accounts:', db.prepare('SELECT username FROM accounts').all())

// 同节名题干两两相似度：归一化后最长公共前缀比例 > 0.6 或前 40 字相同 → 报警
const rows = db.prepare('SELECT id, stem, knowledge_points FROM questions ORDER BY id').all() as any[]
const kpOf = (r: string): string[] => { try { return JSON.parse(r || '[]') } catch { return [] } }
const norm = (s: string) => String(s || '').replace(/\s+/g, '')
function sim(a: string, b: string): number {
  const x = norm(a); const y = norm(b)
  if (!x || !y) return 0
  let i = 0
  while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++
  return i / Math.min(x.length, y.length)
}
let dupPairs = 0
for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    const ki = new Set(kpOf(rows[i].knowledge_points))
    if (!kpOf(rows[j].knowledge_points).some((k) => ki.has(k))) continue
    const s = sim(rows[i].stem, rows[j].stem)
    if (s > 0.6) {
      dupPairs++
      console.log(`疑似相似 #${rows[i].id}/#${rows[j].id} 前缀相似度 ${s.toFixed(2)}：${norm(rows[i].stem).slice(0, 30)} | ${norm(rows[j].stem).slice(0, 30)}`)
    }
  }
}
console.log(`===== 同节名题干相似度抽查：报警 ${dupPairs} 对 =====`)
