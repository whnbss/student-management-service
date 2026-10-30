// #872 全角引号残留修复（math 内 r' 被写成全角 r’）
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')
const r = db.prepare('SELECT solution FROM questions WHERE id=872').get()
const fixed = r.solution.replaceAll('‘', "'").replaceAll('’', "'")
db.prepare('UPDATE questions SET solution=? WHERE id=872').run(fixed)
console.log('872 全角引号已替换')
db.close()
