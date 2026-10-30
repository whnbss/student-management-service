// #892 裸 LaTeX 空位修复：________{\text{作用}} → ________作用
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')
const r = db.prepare('SELECT stem FROM questions WHERE id=892').get()
const re = /_{2,}\{\\text\{([^}]*)\}\}/g
if (!re.test(r.stem)) { console.log('未找到目标片段（可能已修复）'); process.exit(0) }
const fixed = r.stem.replace(/_{2,}\{\\text\{([^}]*)\}\}/g, (m, s) => '________' + s)
db.prepare('UPDATE questions SET stem=? WHERE id=892').run(fixed)
console.log('892 fixed:', JSON.stringify(fixed.slice(fixed.indexOf('只受') - 5, fixed.indexOf('只受') + 25)))
db.close()
