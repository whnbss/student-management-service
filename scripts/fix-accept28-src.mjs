// 修正 fix-accept26-batch16.mjs 中被误写成制表符的 \text（x_{\text{子}}）
import fs from 'node:fs'
const p = 'scripts/fix-accept26-batch16.mjs'
let t = fs.readFileSync(p, 'utf8')
const bad = 'x_{\text{子}}'.replace('\t', '	') // x_{<TAB>ext{子}}
const good = 'x_{\\text{子}}'
const n = (t.match(new RegExp('x_\\{[\\t]ext\\{子\\}', 'g')) || []).length
t = t.replace(/x_\{\text\{子\}\}/g, good).replace(/x_\{[\t]ext\{子\}\}/g, good)
fs.writeFileSync(p, t)
console.log('tab-mangled fixed:', n)
