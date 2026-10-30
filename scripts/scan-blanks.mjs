// 填空空位规范扫描（验收 #28 建议②）：统计各题题干中下划线串长度分布
import Database from 'better-sqlite3'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id, qtype, stem FROM questions').all()
const dist = new Map()
const odd = []
for (const r of rows) {
  const runs = [...String(r.stem || '').matchAll(/_{2,}/g)].map((m) => m[0].length)
  if (!runs.length) continue
  const key = runs.join(',')
  dist.set(key, (dist.get(key) || 0) + 1)
  if (runs.some((n) => n !== 8)) odd.push(`#${r.id}(${r.qtype}) [${runs.join(',')}]`)
}
console.log('下划线串长度分布（题数）：', JSON.stringify([...dist.entries()]))
console.log('非 8 下划线的题', odd.length, '个：')
console.log(odd.join('\n'))
db.close()
