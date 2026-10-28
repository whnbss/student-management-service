// 临时单测：checkSolutionArithmetic 检出能力与误杀回归
import { checkSolutionArithmetic as c } from '../packages/shared/src/index.ts'

const cases: Array<[string, string, number]> = [
  ['244 应检出', '$$a=\\frac{F}{m}=\\frac{0.5}{0.2}\\ \\mathrm{m/s^2}=1\\ \\mathrm{m/s^2}$$', 1],
  ['273 应检出', '故总时间 $t=t_1+t_2=2\\,\\mathrm{s}+1\\,\\mathrm{s}=2.5\\,\\mathrm{s}$。', 1],
  ['正确乘除链 不误杀', '$$F=BIL=0.5\\times2\\times0.5\\ \\mathrm{N}=0.5\\ \\mathrm{N}$$', 0],
  ['正确除法 不误杀', '$$I=\\dfrac{E}{R_{总}}=\\frac{1}{0.5}=2\\ \\mathrm{A}$$', 0],
  ['负数加法 不误杀', '$$W=300+(-216)=84\\ \\mathrm{J}$$', 0],
  ['科学计数 不误杀', '$E_k=1.6\\times10^{-19}\\ \\mathrm{J}$', 0],
  ['四舍五入 不误杀', '$t\\approx 2/3\\approx0.67$', 0],
  ['正确减法 不误杀', '$$\\Delta U=80\\ \\mathrm{J}-84\\ \\mathrm{J}=-4\\ \\mathrm{J}$$', 0],
  ['变量式 不误杀', '$$v=at=2t$$', 0],
  ['整数乘法正确 不误杀', '$$Q=4\\times4\\ \\mathrm{J}=16\\ \\mathrm{J}$$', 0],
  // 验收 #12 后新增：表达式求值升级用例
  ['414 三因子乘积 应检出', '$F=BIL=0.4\\times 2\\times 0.5\\ \\text{N}=0.8\\ \\text{N}$', 1],
  ['414 修正后 三因子 不误杀', '$F=BIL=0.4\\times 2\\times 0.5\\ \\text{N}=0.4\\ \\text{N}$', 0],
  ['427 带乘式 frac 应检出', '$v_1=\\dfrac{P}{F}=\\dfrac{60\\times10^{3}}{4.0\\times10^{3}}=20\\,\\text{m/s}$', 1],
  ['427 修正后 带乘式 frac 不误杀', '$v_1=\\dfrac{P}{F}=\\dfrac{72\\times10^{3}}{3.6\\times10^{3}}=20\\,\\text{m/s}$', 0],
  ['幂运算错误 应检出', '$E=\\frac{1}{2}\\times2\\times2^{2}=3\\ \\text{J}$', 1],
  ['幂运算正确 不误杀', '$E=\\frac{1}{2}\\times2\\times2^{2}=4\\ \\text{J}$', 0],
  ['多段链 应检出', '$$I=\\frac{E}{R}=\\frac{0.4}{0.2}=2\\ \\text{A},\\ F=BIL=0.4\\times2\\times0.5=0.8\\ \\text{N}$$', 1],
]
let fail = 0
for (const [name, input, expectIssues] of cases) {
  const r = c(input)
  const ok = r.length === expectIssues
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name} → ${r.length} issue${r.length ? ': ' + JSON.stringify(r) : ''}`)
}
process.exit(fail ? 1 : 0)
