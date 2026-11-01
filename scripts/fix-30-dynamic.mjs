// P1-95（验收 #55 催办①）：#30 斜面题「题干/解析/答案」三方不一致——
// 原题干「水平推力 F 缓慢推动…始终相对静止」→ 准静态 N=mgcosθ、f=mgsinθ 均不变，
// 而四个选项全是「增大/减小」组合（无「不变」）；解析先自书「N、f 均不变」后又翻转
// 按 a>0 动力学分析选 B，自相矛盾。
// 修法（催办①推荐路线）：题干改为「使二者一起以水平加速度 a 向右加速运动（相对静止，
// a<g·tanθ）」，与静止时相比判增大/减小 → B 成立；解析删矛盾段，统一按牛顿第二定律
// 正交分解推导 N=mgcosθ+ma·sinθ、f=mgsinθ−ma·cosθ；配图同步改（30°→θ、删 μ=0.3、
// 补 F 推力箭头 + a 加速度箭头 + 斜面体 M 标注）。
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')

const q = db.prepare('SELECT stem, solution, answer, figure, knowledge_points FROM questions WHERE id=30').get()
if (!q) { console.error('未找到 #30'); process.exit(1) }
if (q.stem.includes('匀加速直线运动') && q.stem.includes('$a<g\\tan\\theta$')) {
  console.log('#30 已是修复后版本，跳过（幂等）'); db.close(); process.exit(0)
}

// ---- ① 题干：改为「一起以水平加速度 a 加速」，明确「与静止时相比」判变化 ----
const NEW_STEM = [
  '如图所示，质量为 $M$ 的斜面体放在水平地面上，斜面倾角为 $\\theta$，斜面上放一质量为 $m$ 的物块，物块与斜面始终保持相对静止。',
  '现用水平推力 $F$ 推动斜面体，使二者一起以水平向右的加速度 $a$（$a<g\\tan\\theta$）做匀加速直线运动。',
  '与整体静止时相比，运动中斜面对物块的支持力 $N$ 和静摩擦力 $f$ 的变化情况是（　　）',
  'A. $N$ 增大，$f$ 增大',
  'B. $N$ 增大，$f$ 减小',
  'C. $N$ 减小，$f$ 增大',
  'D. $N$ 减小，$f$ 减小',
].join('\n')

// ---- ② 解析：删「均不变/此路不通」矛盾段，统一动力学推导（实验室系正交分解） ----
const NEW_SOLUTION = [
  '设二者一起以水平加速度 $a$ 向右匀加速运动（$a<g\\tan\\theta$），物块与斜面相对静止。',
  '以物块为研究对象：受重力 $mg$、支持力 $N$（垂直斜面向上）、静摩擦力 $f$（沿斜面向上）。',
  '水平方向：$N\\sin\\theta - f\\cos\\theta = ma$；竖直方向：$N\\cos\\theta + f\\sin\\theta = mg$。',
  '联立解得：$N = mg\\cos\\theta + ma\\sin\\theta$，$f = mg\\sin\\theta - ma\\cos\\theta$。',
  '静止时（$a=0$）：$N_0 = mg\\cos\\theta$，$f_0 = mg\\sin\\theta$。',
  '对比可知：$a>0$ 时 $N$ 增大；因 $a<g\\tan\\theta$，$f = mg\\sin\\theta - ma\\cos\\theta > 0$ 方向不变、大小减小。',
  '故选 B。',
].join('\n')

// ---- ③ 知识点：原「图解法/斜面上的平衡问题」与动力学情境不符，同步修正 ----
const NEW_KPS = JSON.stringify(['共点力平衡（正交分解）', '牛顿第二定律（整体加速的连接体）'])

// ---- ④ 配图：30°→θ、删 μ=0.3、补 F 推力箭头 + a 加速度箭头 + M 标注 ----
let svg = String(JSON.parse(q.figure).data || '')
if (!svg.includes('30°') || !svg.includes('μ=0.3')) { console.error('未匹配到原配图锚点（30°/μ=0.3），中止不写入'); process.exit(1) }
const FONT = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const DEFS = '<defs><marker id="ah30" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#334155"/></marker><marker id="ah30r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ef4444"/></marker></defs>'
const ADD = [
  // F：水平推力箭头（推斜面体左下角，向右）
  '<line x1="22" y1="190" x2="55" y2="190" stroke="#334155" stroke-width="2" marker-end="url(#ah30)"/>',
  `<text x="30" y="181" font-size="14" fill="#334155" text-anchor="middle" ${FONT}>F</text>`,
  // a：整体水平向右加速度箭头（装置上方）
  '<line x1="150" y1="50" x2="200" y2="50" stroke="#ef4444" stroke-width="2" marker-end="url(#ah30r)"/>',
  `<text x="208" y="55" font-size="14" fill="#ef4444" text-anchor="start" ${FONT}>a</text>`,
  // M：斜面体标注（多边形内部）
  `<text x="228" y="172" font-size="14" fill="#334155" text-anchor="middle" ${FONT}>M</text>`,
].join('')
svg = svg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto">', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto">' + DEFS)
svg = svg.replace('<text x="100" y="178" font-size="14" fill="#ef4444" text-anchor="middle" ' + FONT + '>30°</text>', '<text x="100" y="178" font-size="14" fill="#ef4444" text-anchor="middle" ' + FONT + '>θ</text>')
svg = svg.replace(/<text x="180" y="222"[\s\S]*?<\/text>/, '')
svg = svg.replace('</svg>', ADD + '</svg>')

// ---- ⑤ 独立复算自检：公式代入数值验证水平/竖直两方向同时成立 ----
// θ=30°, g=10, m=1, a=2（a<10·tan30°≈5.77 ✓）：N=10·cos30°+2·sin30°, f=10·sin30°−2·cos30°
const th = Math.PI / 6, g = 10, m = 1, a = 2
const N = m * g * Math.cos(th) + m * a * Math.sin(th)
const f = m * g * Math.sin(th) - m * a * Math.cos(th)
const hErr = Math.abs((N * Math.sin(th) - f * Math.cos(th)) - m * a)
const vErr = Math.abs((N * Math.cos(th) + f * Math.sin(th)) - m * g)
if (hErr > 1e-9 || vErr > 1e-9) { console.error(`复算失败：水平误差 ${hErr}，竖直误差 ${vErr}`); process.exit(1) }
if (!(N > m * g * Math.cos(th) && f > 0 && f < m * g * Math.sin(th))) { console.error('复算失败：N 应增大且 0<f<f₀（题设 a<g·tanθ）'); process.exit(1) }
console.log(`复算通过：θ=30°,a=2 → N=${N.toFixed(3)}（增大）, f=${f.toFixed(3)}（减小且>0），两方向方程闭合`)

// ---- ⑥ 写库 ----
db.prepare('UPDATE questions SET stem=?, solution=?, knowledge_points=?, figure=? WHERE id=30')
  .run(NEW_STEM, NEW_SOLUTION, NEW_KPS, JSON.stringify({ kind: 'svg', data: svg }))

// ---- ⑦ 回读断言 ----
const r = db.prepare('SELECT stem, solution, answer, knowledge_points FROM questions WHERE id=30').get()
const ok = r.stem.includes('匀加速直线运动') && r.stem.includes('$a<g\\tan\\theta$')
  && r.solution.includes('ma\\sin\\theta') && r.solution.includes('ma\\cos\\theta')
  && !r.solution.includes('均不变') && !r.solution.includes('此路不通')
  && r.answer === 'B' && r.knowledge_points.includes('牛顿第二定律')
if (!ok) { console.error('回读断言失败'); process.exit(1) }
const fig2 = JSON.parse(db.prepare('SELECT figure FROM questions WHERE id=30').get().figure).data
if (!fig2.includes('>θ<') || fig2.includes('μ=0.3') || !fig2.includes('>F<') || !fig2.includes('>a<') || !fig2.includes('>M<')) { console.error('配图断言失败'); process.exit(1) }
console.log('#30 修复完成：题干改匀加速+相对静止+a<g·tanθ，解析统一动力学推导（矛盾段已删），知识点同步，配图 θ/F/a/M 齐、μ 残留已除，答案 B 不变')
db.close()
