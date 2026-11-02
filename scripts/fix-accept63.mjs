// 一次性脚本：按验收 #63 催办修 P2-109——#904（气缸抽气-加热-压缩，计算 D5）配图内残缺标注「p=p」。
// 缺陷：SVG 内 <text>p=p</text> 非合法物理标注（疑为模板占位未填充），会误导学生。
// 修法（验收建议）：改为「p₁」（状态 1 气体压强符号，由题干可求，非数值、不泄露答案）。
//
// 全库同类扫描（x=x 残缺形态）发现同一模板缺陷共 10 处 + 相邻 2 类残缺，一并修复：
//   - p=p（6 题）：#904 #180 #483 #806 #807 → p₁；#803 → p
//   - U=U（5 题）：#203 #472 #647 #718 #780 → U（板间/加速电压符号，题干均用 U）
//   - r=rΩ（3 题）：#754 #756 #758 → r（电源内阻符号，题干均用 r）
//   - #230：①「W=W₀ = 2.5 eV」→「W₀=2.5 eV」（W₀ 为题干已知量，保留数值合法）
//           ②「Ek=Eₖ = 1.6 eV」→「Eₖ」（⚠️ 原图直给 1.6 eV = 答案 (2)，属答案泄露，必须删数值）
// 全部仅改 figure 字段，stem/answer/solution 一字不动。
// 用法：node scripts/fix-accept63.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const get = db.prepare('SELECT id, stem, answer, qtype, figure FROM questions WHERE id=?')

// 每题：锚点断言（题干/答案特征）+ 替换规则 [from, to]（均要求恰好出现 1 次）
const PLAN = [
  { id: 904, stemHas: ['p_0=1.0\\times10^{5}', 'U=cT', 'L_1=0.30'], ansHas: ['p_2=p_3=1.1\\times10^{5}', 'Q_{23}=344'], repl: [['>p=p<', '>p₁<']] },
  { id: 180, stemHas: ['保持压强不变', '300\\ \\text{K}'], ansHas: ['A'], repl: [['>p=p<', '>p₁<']] },
  { id: 483, stemHas: ['k=1500', 'S=2.0\\times10^{-3}'], ansHas: ['\\Delta x=0.02', 'W=5.1'], repl: [['>p=p<', '>p₁<']] },
  { id: 803, stemHas: ['N_A=6.0\\times10^{23}', '绝热'], ansHas: ['3\\times10^{-26}'], repl: [['>p=p<', '>p<']] },
  { id: 806, stemHas: ['1.0\\times10^{5}', '2.0\\times10^{-3}'], ansHas: ['C'], repl: [['>p=p<', '>p₁<']] },
  { id: 807, stemHas: ['p_1=1.0\\times10^5', 'V_1=2.0\\times10^{-3}'], ansHas: ['p_2=2.0\\times10^5', 'p_3=4.0\\times10^5'], repl: [['>p=p<', '>p₁<']] },
  { id: 203, stemHas: ['与电源断开', '距离增大为原来的 2 倍'], ansHas: ['A'], repl: [['>U=U<', '>U<']] },
  { id: 472, stemHas: ['与电源断开', '忽略边缘效应'], ansHas: ['B'], repl: [['>U=U<', '>U<']] },
  { id: 647, stemHas: ['德布罗意波长', '加速电压增大为原来的'], ansHas: ['B'], repl: [['>U=U<', '>U<']] },
  { id: 718, stemHas: ['电荷量保持不变', '距离增大为原来的 2 倍'], ansHas: ['B'], repl: [['>U=U<', '>U<']] },
  { id: 780, stemHas: ['直线加速器', '加速电压大小均为 $U$'], ansHas: ['B'], repl: [['>U=U<', '>U<']] },
  { id: 754, stemHas: ['电动势为 $E$', '内阻为 $r$'], ansHas: ['C'], repl: [['>r=rΩ<', '>r<']] },
  { id: 756, stemHas: ['电动势为 $E$', 'R=r'], ansHas: ['B'], repl: [['>r=rΩ<', '>r<']] },
  { id: 758, stemHas: ['电动势为 $E$', '滑动变阻器'], ansHas: ['B'], repl: [['>r=rΩ<', '>r<']] },
  { id: 230, stemHas: ['\\lambda = 300\\ \\text{nm}', 'W_0 = 2.5\\ \\text{eV}'], ansHas: ['约 $4.1\\ \\text{eV}$', '约 $1.6\\ \\text{eV}$'], repl: [['>Ek=Eₖ = 1.6 eV<', '>Eₖ<'], ['>W=W₀ = 2.5 eV<', '>W₀=2.5 eV<']] },
]

let changed = 0
for (const item of PLAN) {
  const q = get.get(item.id)
  if (!q) throw new Error(`#${item.id} 不存在`)
  if (!q.figure) throw new Error(`#${item.id} 预期有配图，中止`)
  // 幂等保护：所有替换目标均已生效则跳过
  if (item.repl.every(([from, to]) => !q.figure.includes(from) && q.figure.includes(to))) {
    console.log(`#${item.id} 已修正，跳过（幂等）`)
    continue
  }
  // 前置断言：题干/答案锚点 + 旧残缺标注存在
  for (const s of item.stemHas) if (!q.stem.includes(s)) throw new Error(`#${item.id} 题干锚点缺失「${s}」，中止`)
  for (const s of item.ansHas) if (!q.answer.includes(s)) throw new Error(`#${item.id} 答案锚点缺失「${s}」，中止`)
  const fig = JSON.parse(q.figure)
  if (fig.kind !== 'svg') throw new Error(`#${item.id} 配图应为 svg，中止`)
  let svg = fig.data
  for (const [from, to] of item.repl) {
    const n = (svg.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
    if (n !== 1) throw new Error(`#${item.id} 锚点「${from}」出现 ${n} 次（预期 1），中止`)
    svg = svg.replace(from, to)
  }
  // 内容断言
  const asserts = [
    [svg !== fig.data, `#${item.id} SVG 未发生替换`],
    [item.repl.every(([, to]) => svg.includes(to)), `#${item.id} 新标注缺失`],
    [item.repl.every(([from]) => !svg.includes(from)), `#${item.id} 旧残缺标注仍残留`],
    // 替换范围外的原有文本标注应保持（气体/温度计/电源 E/金属等首个非属性 text 不动）——抽查关键标签
    [!svg.includes('NaN') && !svg.includes('undefined'), `#${item.id} 渲染含 NaN/undefined`],
    // 防答案泄露：图内不得再出现 eV 数值结论（除题干已知量 W₀）
    [item.id !== 230 || (!svg.includes('1.6 eV') && !svg.includes('4.1 eV') && !svg.includes('6.0×10')), `#${item.id} 疑似答案数值泄露`],
    [q.answer === get.get(item.id).answer, `#${item.id} 答案不应变化`],
  ]
  for (const [ok, msg] of asserts) if (!ok) throw new Error(`断言失败：${msg}`)
  const figJson = JSON.stringify({ kind: 'svg', data: svg })
  if (!DRY) {
    db.prepare('UPDATE questions SET figure=? WHERE id=?').run(figJson, item.id)
    const back = get.get(item.id)
    if (back.answer !== q.answer) throw new Error(`#${item.id} 答案回读不一致`)
    if (JSON.parse(back.figure).data !== svg) throw new Error(`#${item.id} 配图回读不一致`)
    console.log(`#${item.id} 已写库并回读一致（仅 figure 字段）：${item.repl.map(([f, t]) => `${f}→${t}`).join('、')}`)
    changed++
  } else {
    console.log(`#${item.id} dry-run 断言全过，未写库`)
  }
}
console.log(DRY ? 'dry-run 结束，未写库' : `完成，共修正 ${changed} 题`)
