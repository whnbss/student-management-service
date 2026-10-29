// 空节清单（0 题覆盖的教材节，精确口径）
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'), { readonly: true })
const rows = db.prepare('SELECT knowledge_points FROM questions').all() as any[]
const kpOf = (r: string): string[] => { try { return JSON.parse(r || '[]') } catch { return [] } }
const norm = (s: string): string => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
const VOL: Record<string, string> = { bxF1: '必修一', bxF2: '必修二', bxF3: '必修三', xxF1: '选必一', xxF2: '选必二', xxF3: '选必三' }
const covered = new Set<string>()
for (const r of rows) for (const k of kpOf(r.knowledge_points)) covered.add(norm(k))
const zeros: string[] = []
TEXTBOOK.forEach((v) => v.chapters.forEach((ch) => ch.sections.forEach((s) => { if (!covered.has(norm(s))) zeros.push(VOL[v.id] + '·' + s) })))
console.log(`空节 ${zeros.length} 个：`)
console.log(zeros.join('\n'))
