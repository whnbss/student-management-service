// 一次性修复脚本（验收 #7 要求）：P1-8 / P2-15 / P2-16
// P1-8 #244：第(1)问 a=0.5/0.2 应为 2.5 m/s²（库中误写 1 m/s²），更新 answer 与 solution
// P2-15 #220：与 #219 题干同源重复（仅选项互换），整体改写为不同设问角度的同考点题
// P2-16 #222：等温膨胀 W1=300J 后等压压缩 W2 应≈W1/(2ln2)≈216J 才自洽（原 200J），改数据并同步重算答案/解析/易错点
// 用法：node scripts/fix-accept7.mjs；只动 questions 表，不触碰学生/账号数据
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const dbPath = fileURLToPath(new URL('../data/app.db', import.meta.url))
const db = new Database(dbPath)

const updText = db.prepare('UPDATE questions SET stem = ?, answer = ?, solution = ?, pitfall = ? WHERE id = ?')
let changed = 0

// ---------- P1-8：#244 加速度算术错误（0.5/0.2 = 2.5，非 1） ----------
{
  const q = db.prepare('SELECT answer, solution FROM questions WHERE id = 244').get()
  const answer = q.answer.replace('a=1\\ \\mathrm{m/s^2}', 'a=2.5\\ \\mathrm{m/s^2}')
  const solution = q.solution.replace('=\\frac{0.5}{0.2}\\ \\mathrm{m/s^2}=1\\ \\mathrm{m/s^2}', '=\\frac{0.5}{0.2}\\ \\mathrm{m/s^2}=2.5\\ \\mathrm{m/s^2}')
  if (answer === q.answer || solution === q.solution) {
    console.error('✗ #244 定位替换失败（answer 或 solution 原文与预期不符），中止以免误改')
    process.exit(1)
  }
  // 只改 answer/solution 两列（stem/pitfall 原样写回）
  const cur = db.prepare('SELECT stem, pitfall FROM questions WHERE id = 244').get()
  updText.run(cur.stem, answer, solution, cur.pitfall, 244)
  changed++
  console.log('✓ #244 第(1)问加速度 1 → 2.5 m/s²（answer + solution 已同步）')
}

// ---------- P2-15：#220 改写（原与 #219 同源重复） ----------
{
  const stem = '关于热传递与内能的变化，下列说法正确的是（　　）\nA. 温度高的物体，内能一定比温度低的物体大\nB. 热量总是自发地从高温物体传向低温物体，与两物体内能的大小无关\nC. 气体从外界吸收热量，其内能一定增大\nD. 物体对外界做功，其内能一定减少'
  const answer = 'B'
  const solution = '热传递的方向由温度高低决定：热量总是自发地从高温物体传向低温物体，与内能大小无必然联系（例如一小块高温铁屑的内能可能小于一大桶温水的内能），故 B 正确、A 错误。\nC 错误：由热力学第一定律 $\\Delta U=W+Q$，吸收热量 $Q>0$，但若同时对外做功 $W<0$ 且 $|W|>Q$，则 $\\Delta U<0$，内能可能减少。\nD 错误：物体对外做功 $W<0$，但若同时吸收热量 $Q>|W|$，则 $\\Delta U>0$，内能可能增加。'
  const pitfall = '易把「热传递方向由温度差决定」误记为「由内能大小决定」；判断内能变化必须同时考虑做功与热传递两条途径，由 $\\Delta U=W+Q$ 综合符号运算，只看其一必错。'
  updText.run(stem, answer, solution, pitfall, 220)
  changed++
  console.log('✓ #220 已整体改写（正确选项 B：热传递方向由温度决定，与 #219 不再同源）')
}

// ---------- P2-16：#222 等压段功自洽性（W2: 200 → 216 J，ΔU 重算为 −4 J） ----------
{
  const q = db.prepare('SELECT stem, answer, solution, pitfall FROM questions WHERE id = 222').get()
  const stem = q.stem.replace('外界对气体做功 $W_2=200\\ \\mathrm{J}$', '外界对气体做功 $W_2=216\\ \\mathrm{J}$')
  const answer = '减少 $4\\ \\mathrm{J}$（即 $\\Delta U=-4\\ \\mathrm{J}$）'
  const solution = [
    '取气体为研究对象，规定气体吸热 $Q>0$、气体对外界做功 $W_{\\text{对外}}>0$，热力学第一定律写作 $\\Delta U=Q-W_{\\text{对外}}$。',
    '第一步：求整个过程气体对外界做的总功。等温膨胀中气体对外做功 $W_1=300\\ \\mathrm{J}$，即对外做功 $+300\\ \\mathrm{J}$；等压压缩中外界对气体做功 $216\\ \\mathrm{J}$，即气体对外做功 $-216\\ \\mathrm{J}$。故整个过程气体对外做的总功 $W_{\\text{对外}}=300\\ \\mathrm{J}+(-216\\ \\mathrm{J})=84\\ \\mathrm{J}$。',
    '第二步：代入热力学第一定律。已知整个过程吸热 $Q=80\\ \\mathrm{J}$，则 $\\Delta U=Q-W_{\\text{对外}}=80\\ \\mathrm{J}-84\\ \\mathrm{J}=-4\\ \\mathrm{J}$。',
    '第三步：说明符号意义。$\\Delta U<0$ 表示气体内能减少，减少量为 $4\\ \\mathrm{J}$。',
    '自洽性核对：等温膨胀 $V_0\\to 2V_0$ 有 $W_1=nRT_0\\ln2=300\\ \\mathrm{J}$；等压压缩发生在压强减半后的状态，外界做功 $W_2=\\frac{p_0}{2}V_0=\\frac{nRT_0}{2}=\\frac{W_1}{2\\ln2}\\approx216\\ \\mathrm{J}$，与题给数据一致。',
  ].join('\n')
  const pitfall = '易错点：①把“外界对气体做功 $216\\ \\mathrm{J}$”直接当作气体对外做功 $+216\\ \\mathrm{J}$ 代入，导致总功算成 $516\\ \\mathrm{J}$；②混淆 $\\Delta U=Q+W$ 与 $\\Delta U=Q-W$ 两种符号约定，须先明确 $W$ 是“外界对气体做功”还是“气体对外做功”；③只由等温过程误判内能不变，忽略等压压缩阶段温度降低使内能减少。'
  if (stem === q.stem) { console.error('✗ #222 stem 定位替换失败，中止'); process.exit(1) }
  updText.run(stem, answer, solution, pitfall, 222)
  changed++
  console.log('✓ #222 W2 200→216 J（数据自洽），ΔU 重算为 −4 J（answer/solution/pitfall 已同步）')
}

if (changed !== 3) { console.error(`✗ 预期改 3 题实际 ${changed}，中止`); process.exit(1) }

// ---------- 回读复核 ----------
for (const id of [220, 222, 244]) {
  const q = db.prepare('SELECT id, answer FROM questions WHERE id = ?').get(id)
  console.log(`回读 #${id}: ${q.answer.slice(0, 60)}`)
}
console.log('===== 修复完成 =====')
