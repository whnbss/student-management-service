// P0-95/P1-94/P1-93（验收 #52 催办 ①②③）：题库抽检物理问题修复
//   ① P0-95：#142 配图为无关电路模板图 → 新增 magnet_coil 模板（条形磁铁插入线圈+电流计）重绘
//   ② P1-94：#142 感应电流方向答案反了——N 极向下插入、向下磁通增大、感应磁场向上，
//      从上往下看由安培定则为逆时针（毕奥-萨伐尔/右手握法/极性自洽三法一致）→ 答案 A→C、解析顺→逆
//   ③ P1-93：#194 第二空碰后共速（v₁=v₂=2m/s）、动能损失 24J 恰为最大值 → 「完全非弹性」
// 幂等：figure 已含线圈/磁铁元素或答案已修正时跳过对应步骤；复测断言内置，失败非零退出
import Database from 'better-sqlite3'
import { specToSvg } from '../packages/shared/src/figure.ts'

const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')

let fail = 0
const assert = (name, cond) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`)
  if (!cond) fail++
}

// ---------- ① P0-95：#142 配图重绘 ----------
{
  const q = db.prepare('SELECT figure FROM questions WHERE id=142').get()
  if (!q) { console.error('未找到 #142'); process.exit(1) }
  const fig = JSON.parse(q.figure)
  const oldSvg = String(fig.data || '')
  if (oldSvg.includes('线圈') && oldSvg.includes('电流计')) {
    console.log('#142 配图已为磁铁+线圈图，跳过重绘（幂等）')
  } else {
    const svg = specToSvg({ template: 'magnet_coil', params: { pole: 'N', label_coil: 'A' } })
    if (!svg.startsWith('<svg')) { console.error('magnet_coil 渲染失败，中止不写入'); process.exit(1) }
    if (svg.includes('电源') || svg.includes('r=0Ω')) { console.error('渲染结果残留电路模板元素，中止不写入'); process.exit(1) }
    db.prepare('UPDATE questions SET figure=? WHERE id=142').run(JSON.stringify({ kind: 'svg', data: svg }))
    console.log('#142 配图已重绘为 magnet_coil（线圈 A + 条形磁铁 N 极朝下 + 电流计 G）')
  }
  // 复测：回读断言
  const after = JSON.parse(db.prepare('SELECT figure FROM questions WHERE id=142').get().figure).data
  assert('#142 复测：figure 含线圈元素', after.includes('线圈'))
  assert('#142 复测：figure 含磁铁 N 极标注', /<text[^>]*>N<\/text>/.test(after))
  assert('#142 复测：figure 含电流计 G', after.includes('G'))
  assert('#142 复测：无「电源」残留', !after.includes('电源'))
  assert('#142 复测：无「r=0Ω」残留', !after.includes('r=0Ω'))
}

// ---------- ② P1-94：#142 答案方向修正 ----------
{
  const q = db.prepare('SELECT answer, solution FROM questions WHERE id=142').get()
  let answer = String(q.answer).trim()
  let solution = String(q.solution)
  if (answer === 'C' && solution.includes('逆时针')) {
    console.log('#142 答案已是 C / 逆时针，跳过（幂等）')
  } else {
    if (!answer.startsWith('A')) { console.error(`#142 answer 非 A（实际 ${answer}），中止不写入`); process.exit(1) }
    answer = 'C'
    const n = (solution.match(/顺时针/g) || []).length
    if (n !== 2) { console.error(`#142 解析「顺时针」出现 ${n} 次（期望 2），中止不写入`); process.exit(1) }
    solution = solution.replaceAll('顺时针', '逆时针').replace('选 A。', '选 C。')
    db.prepare('UPDATE questions SET answer=?, solution=? WHERE id=142').run(answer, solution)
    console.log('#142 答案 A→C，解析两处顺时针→逆时针（安培定则方向说反）')
  }
  // 复测：回读断言
  const after = db.prepare('SELECT answer, solution FROM questions WHERE id=142').get()
  assert('#142 复测：answer=C', String(after.answer).trim() === 'C')
  assert('#142 复测：解析含逆时针 2 处', (String(after.solution).match(/逆时针/g) || []).length === 2)
  assert('#142 复测：解析无顺时针残留', !String(after.solution).includes('顺时针'))
  assert('#142 复测：解析结论「选 C」', String(after.solution).includes('选 C。'))
  assert('#142 复测：作用力方向「向上」保留（安培力部分原本正确）', String(after.solution).includes('向上的排斥力'))
}

// ---------- ③ P1-93：#194 第二空「完全非弹性」 ----------
{
  const q = db.prepare('SELECT answer, solution FROM questions WHERE id=194').get()
  const answer = String(q.answer)
  const solution = String(q.solution)
  if (answer.includes('完全非弹性')) {
    console.log('#194 第二空已是「完全非弹性」，跳过（幂等）')
  } else {
    if (answer.trim() !== '2；非弹性') { console.error(`#194 answer 非「2；非弹性」（实际 ${answer}），中止不写入`); process.exit(1) }
    const newAnswer = '2；完全非弹性'
    // 解析末句：由「有机械能损失→非弹性」升级为「共速+动能损失最大→完全非弹性」
    const newSolution = solution.replace(
      '因为 $E_{k1}<E_{k0}$，碰撞过程中有机械能损失，所以该碰撞为非弹性碰撞。',
      '因为 $E_{k1}<E_{k0}$，碰撞过程中有机械能损失；且碰后两球速度相同（$v_1=v_2=2\\ \\text{m/s}$，共速），动能损失 $\\Delta E_k=E_{k0}-E_{k1}=24\\ \\text{J}$ 恰为碰撞可能损失的最大值，故该碰撞为完全非弹性碰撞。'
    )
    if (newSolution === solution) { console.error('#194 解析末句未匹配，中止不写入'); process.exit(1) }
    db.prepare('UPDATE questions SET answer=?, solution=? WHERE id=194').run(newAnswer, newSolution)
    console.log('#194 第二空「非弹性」→「完全非弹性」，解析补共速+动能损失最大依据')
  }
  // 复测：回读 + 独立复算
  const after = db.prepare('SELECT answer, solution FROM questions WHERE id=194').get()
  assert('#194 复测：answer=「2；完全非弹性」', String(after.answer).trim() === '2；完全非弹性')
  assert('#194 复测：解析含「完全非弹性」', String(after.solution).includes('完全非弹性碰撞'))
  assert('#194 复测：解析含共速依据', String(after.solution).includes('共速'))
  // 独立复算：动量 2×6=2×2+4v₂ → v₂=2；动能 36−12=24J
  const m1 = 2, v0 = 6, v1 = 2, m2 = 4
  const v2 = (m1 * v0 - m1 * v1) / m2
  const Ek0 = 0.5 * m1 * v0 * v0, Ek1 = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2
  assert('#194 复算：v₂=2 m/s、动能损失=24J=½·(m₁m₂/(m₁+m₂))·v₀²', v2 === 2 && Math.abs((Ek0 - Ek1) - 24) < 1e-9)
}

db.close()
process.exit(fail ? 1 : 0)
