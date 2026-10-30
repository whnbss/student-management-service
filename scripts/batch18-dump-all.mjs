// 导出第十八批 40 题全文供独立重解自验
import Database from 'better-sqlite3'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id,qtype,difficulty,stem,answer,solution,pitfall,figure,knowledge_points FROM questions WHERE id BETWEEN 867 AND 906 ORDER BY id').all()
for (const r of rows) {
  let fig = '无'
  try { const f = JSON.parse(r.figure || 'null'); fig = f && f.kind ? `SVG(${String(f.data).length}B)` : '无' } catch {}
  console.log(`\n######## id=${r.id} [${r.qtype}/D${r.difficulty}/图:${fig}] kp=${r.knowledge_points}`)
  console.log('【题干】', r.stem)
  console.log('【答案】', r.answer)
  console.log('【解析】', r.solution)
  if (r.pitfall) console.log('【易错】', r.pitfall)
}
db.close()
