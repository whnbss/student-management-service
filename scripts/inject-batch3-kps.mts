// 一次性：给第三批（id>=219，旧后端进程期间入库）补注节名标签
// 依据 logs-batch3.txt 的「✓ 入库 ids」与 batch3-plan.json 的组→节名映射，把计划节名并入 knowledge_points
// 用法：npx tsx scripts/inject-batch3-kps.mts [--dry-run]
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))

const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'batch3-plan.json'), 'utf-8'))
const log = fs.readFileSync(path.join(ROOT, 'logs-batch3.txt'), 'utf-8')

// 解析日志：▶ 行携带「考点 · 题型 · 档位」；✓ 入库行携带 ids → 归属到当前组
type Group = { qtype: string; tier: string; n: number; kps: string[] }
const topicByKey = new Map<string, Group[]>()
for (const t of plan.topics) {
  for (const g of t.groups) {
    const key = `${t.vol}·${t.chapter}|${g.qtype}|${g.tier}`
    topicByKey.set(key, [...(topicByKey.get(key) || []), g])
  }
}
const idKps = new Map<number, string[]>()
let curChapter = ''
let curQtype = ''
let curTier = ''
for (const line of log.split('\n')) {
  const m = line.match(/▶ (.+?)（(高一|高二|高三) · (.+?) · (.+?)\/.+? · \d+ 题）/)
  if (m) { curChapter = m[1]; curQtype = m[3]; curTier = m[4].split('/')[0]; continue }
  const s = line.match(/✓ 入库 (\d+) 题（ids: ([\d,]+)）/)
  if (s) {
    const key = `${curChapter}|${curQtype}|${curTier}`
    const g = topicByKey.get(key)?.[0]
    if (!g) { console.log('⚠ 未匹配到计划组：', key); continue }
    for (const id of s[2].split(',')) idKps.set(Number(id), g.kps)
  }
}

const kpOf = (raw: string): string[] => { try { return JSON.parse(raw || '[]') as string[] } catch { return [] } }
const upd = db.prepare('UPDATE questions SET knowledge_points = ? WHERE id = ?')
let injected = 0
for (const [id, kps] of [...idKps.entries()].sort((a, b) => a[0] - b[0])) {
  const row = db.prepare('SELECT knowledge_points FROM questions WHERE id = ?').get(id) as any
  if (!row) continue
  const cur = kpOf(row.knowledge_points)
  const add = kps.filter((k) => !cur.includes(k))
  if (!add.length) continue
  const next = [...add, ...cur]
  console.log(`#${id} +[${add.join('；')}]`)
  injected++
  if (!DRY) upd.run(JSON.stringify(next), id)
}
console.log(`${DRY ? 'dry-run：' : ''}共 ${idKps.size} 题映射，${injected} 题需注入节名`)
