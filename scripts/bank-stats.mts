// 题库覆盖统计（两种口径）：npx tsx scripts/bank-stats.mts
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'))
const rows = db.prepare('SELECT id, qtype, difficulty, knowledge_points FROM questions ORDER BY id').all() as any[]
const kpOf = (r: string): string[] => { try { return JSON.parse(r || '[]') } catch { return [] } }
const norm = (s: string): string => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
const VOL: Record<string, string> = { bxF1: '必修一', bxF2: '必修二', bxF3: '必修三', xxF1: '选必一', xxF2: '选必二', xxF3: '选必三' }

const sections: Array<{ name: string; vol: string }> = []
TEXTBOOK.forEach((v) => v.chapters.forEach((ch) => ch.sections.forEach((s) => sections.push({ name: s, vol: VOL[v.id] }))))
const secSet = new Set(sections.map((s) => norm(s.name)))

let exactHit = 0
const coveredExact = new Set<string>()
const coveredFuzzy = new Set<string>()
for (const q of rows) {
  const kps = kpOf(q.knowledge_points)
  if (kps.some((k) => secSet.has(norm(k)))) exactHit++
  for (const k of kps) {
    const nk = norm(k)
    for (const s of sections) {
      const n = norm(s.name)
      if (nk === n) coveredExact.add(n)
      if (nk.includes(n) || n.includes(nk)) coveredFuzzy.add(n)
    }
  }
}
const volStats: Record<string, { cov: number; tot: number }> = {}
for (const s of sections) {
  ;(volStats[s.vol] ||= { cov: 0, tot: 0 }).tot++
  if (coveredExact.has(norm(s.name))) volStats[s.vol].cov++
}
console.log(`全库 ${rows.length} 题；节名精确命中 ${exactHit} 题`)
console.log(`覆盖口径：精确 ${coveredExact.size}/${sections.length} 节；互为子串 ${coveredFuzzy.size}/${sections.length} 节`)
for (const [v, o] of Object.entries(volStats)) console.log(`  ${v} ${o.cov}/${o.tot}`)
const byT: Record<string, number> = {}
const byD: Record<number, number> = {}
rows.forEach((q) => { byT[q.qtype] = (byT[q.qtype] || 0) + 1; byD[q.difficulty] = (byD[q.difficulty] || 0) + 1 })
console.log('题型:', JSON.stringify(byT), '难度:', JSON.stringify(byD))
const b4 = rows.filter((q) => q.id >= 267)
const b4hit = b4.filter((q) => kpOf(q.knowledge_points).some((k) => secSet.has(norm(k)))).length
console.log(`第四批 ${b4.length} 题，节名精确对齐 ${b4hit}（${b4.length ? Math.round((b4hit / b4.length) * 100) : 0}%）`)
