// 一次性脚本：验收 #28 P2-49/P2-50 渲染卫生修复（直接操作 data/app.db，只改 questions 指定字段）
// P2-49：#820 solution 3 处裸中文下标 x_子 → x_{\text{子}}
// P2-50：math 定界符外裸 LaTeX 命令 → 统一改纯文本下划线「________」（含验收点名的
//        #865/#847/#863 与存量同模式 #221/#249/#301/#338/#645/#675/#697/#751/#768）
import Database from 'better-sqlite3'

const db = new Database('data/app.db')
const changed = []

// ---- P2-49：#820 裸中文下标 ----
const q820 = db.prepare('SELECT solution FROM questions WHERE id=820').get()
if (q820 && q820.solution.includes('x_子')) {
  const fixed = q820.solution.replaceAll('x_子', 'x_{\\text{子}}')
  db.prepare('UPDATE questions SET solution=? WHERE id=820').run(fixed)
  changed.push('#820 solution x_子×3 → x_{\\text{子}}')
}

// ---- P2-50：math 外裸 LaTeX → 纯文本下划线 + 后缀并入正文 ----
// `______{\text{X}}` → `________X`（下划线统一 8 个，后缀以普通文本接在空位后，语义不变）
const suffixFix = (s) => s.replace(/_{2,}\{\\text\{([^}]*)\}\}/g, (_m, suffix) => '________' + suffix)
// `\underline{\hspace{2cm}}` / `\underline{\quad\quad}` → `________`
const ulFix = (s) => s.replace(/\\underline\{(?:\\(?:hspace\{[^}]*\}|quad|qquad)\s*)+\}/g, '________')

const targets = [221, 249, 301, 338, 645, 675, 697, 751, 768, 847, 863, 865]
const get = db.prepare('SELECT id, stem FROM questions WHERE id=?')
const upd = db.prepare('UPDATE questions SET stem=? WHERE id=?')
for (const id of targets) {
  const row = get.get(id)
  if (!row) continue
  const fixed = suffixFix(ulFix(row.stem))
  if (fixed !== row.stem) {
    upd.run(fixed, id)
    changed.push(`#${id} stem 清除 math 外裸 LaTeX`)
  }
}

console.log('修复完成：')
for (const c of changed) console.log(' -', c)
if (!changed.length) console.log('（无需改动，可能已修复）')
db.close()
