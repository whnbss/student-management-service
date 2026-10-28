import { checkSolutionArithmetic } from '../packages/shared/src/index.ts'
const s = '$$a=\\frac{F}{m}=\\frac{0.5}{0.2}\\ \\mathrm{m/s^2}=1\\ \\mathrm{m/s^2}$$'
const segs: string[] = []
s.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, (_m, a, b, c) => {
  segs.push(String(a || b || c || ''))
  return _m
})
console.log('segs:', JSON.stringify(segs))
const raw = segs[0]
let t = raw.replace(/\\(times|cdot)/g, '×').replace(/\\div/g, '÷')
t = t.replace(/\\[dt]frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a, b) => `REPL(${a})/(${b})`)
console.log('after frac:', t)
t = t.replace(/\\(mathrm|text)\{[^{}]*\}/g, '').replace(/\\[,;:! ]|\\quad|\\qquad|[{}]/g, '').replace(/\s+/g, '')
console.log('final:', t, '| parts:', JSON.stringify(t.split('=')))
console.log('issues:', JSON.stringify(checkSolutionArithmetic(s)))
