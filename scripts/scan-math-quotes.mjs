// 全库扫描 math 段内全角引号（KaTeX Unicode warning 隐患）
import Database from 'better-sqlite3'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id,stem,answer,solution,pitfall FROM questions').all()
let n = 0
for (const r of rows) {
  for (const [f, v] of Object.entries(r)) {
    const s = String(v || '')
    const segs = s.match(/\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g) || []
    for (const seg of segs) {
      if (/[‘’“”]/.test(seg)) { n++; console.log('id', r.id, f, JSON.stringify(seg.slice(0, 60))) }
    }
  }
}
console.log('math 内全角引号:', n)
db.close()
