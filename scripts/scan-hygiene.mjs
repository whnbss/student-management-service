// P2-49/50 修复前全库扫描：裸中文下标 + math 外裸 LaTeX 命令（复用 sup28-barelatex 口径，另排除合法 \[...\] 块）
import Database from 'better-sqlite3'
const db = new Database('data/app.db', { readonly: true })
const rows = db.prepare('SELECT id,stem,answer,solution,pitfall FROM questions').all()
const CMD = /\\(?:underline|hspace|dfrac|tfrac|frac|sqrt|times|cdot|approx|text|mathrm|pi|Delta|omega|alpha|beta|theta|mu|lambda)/
// 裸中文下标：单个下划线（非下划线串）后直接跟中文，如 x_子；排除 ________ 填空串（尾部下划线被前一个下划线吞掉）
const CJK = /(?<!_)_(?![_{])[一-龥]/
// 切分 math 块：$$...$$ / $...$ / \[...\]（块级定界符视为合法 math）
function textParts(s) {
  const parts = []
  let last = 0, m
  const re = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[([\s\S]*?)\\\]/g
  while ((m = re.exec(s))) { parts.push(['text', s.slice(last, m.index)]); last = m.index + m[0].length }
  parts.push(['text', s.slice(last)])
  return parts
}
let n1 = 0, n2 = 0
for (const r of rows) {
  for (const [f, v] of Object.entries(r)) {
    const s = String(v || '')
    const cm = s.match(CJK)
    if (cm) { n1 += cm.length; console.log('CJK下标 id', r.id, f, 'ctx:', JSON.stringify(s.slice(Math.max(0, s.search(CJK) - 15), s.search(CJK) + 15))) }
    for (const [t, p] of textParts(s)) {
      const mm = p.match(CMD)
      if (mm) { n2++; console.log('裸LaTeX id', r.id, f, 'ctx:', JSON.stringify(p.slice(Math.max(0, p.search(CMD) - 20), p.search(CMD) + 25))) }
    }
  }
}
console.log('TOTAL cjk-sub:', n1, ' barelatex:', n2)
db.close()
