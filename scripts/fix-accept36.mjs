// 一次性脚本：按验收 #36 的指令修正欠账问题（P1-19 / P2-59）
// 独立重解自验（每题均从题干条件重新推导，不依赖原解析）：
// - #855（P1-19）：类平抛偏转。y=U₂L²/(4U₁d)，原代入 200×(0.10)²/(4×500×0.02)=2/40=0.05 m（解析误写 0.005 m），
//   0.05>d/2=0.01 → 电子打板不能射出，answer(3)「tanθ=1 且能射出」前提不成立（连锁错）。
//   按监督推荐「改参数保教学意图」：题干 U₂ 200→20 V → y=20×0.01/40=0.005 m<d/2 ✓ 能射出；
//   tanθ=U₂L/(2U₁d)=20×0.10/20=0.1。answer(1) 1.33e7 不变、(2) 0.005 保留、(3) 1→0.1；solution(2)(3) 同步；figure「U=200」→「U=20」。
// - P2-59：8 道选择题 stem 缺选项文本（用户端见题无选项无法作答）：
//   #562/#568/#659/#676/#694/#859/#861 按 answer+解析反推构造 A~D 选项补齐（风格对齐近期批次）；
//   #694 顺带修参数自洽：题干 C=100/π→200/π μF（原解析残稿自述「将题干 C 改为 200/π」但题干未改，
//   致 I₃=I₁ 与 answer B 矛盾 + 残稿元叙述留库），解析重写为干净版；
//   #562 解析 C/D 两行按新选项措辞对齐（原「C 正确…D 正确」却结单选 B，自相矛盾）。
//   #28 answer 为数值、题干为「求比值」计算题 → qtype 选择→计算（监督口径）。
// 长期防护：沿用 cur 回退 + 动态 SET + 空值拒执行（P1-11 教训）；更新后逐题回读断言。
// 用法：node scripts/fix-accept36.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

const patches = []

// ---------- #855：题干 U₂ 200→20 V；answer(3) tanθ=1→0.1；solution(2)(3) 代入同步；figure U=200→U=20 ----------
{
  const cur = db.prepare('SELECT stem, answer, solution, figure FROM questions WHERE id = 855').get()
  if (!cur || !cur.answer) throw new Error('#855 读取失败或 answer 为空，拒绝执行')
  const stem = cur.stem.replace('U_2=200\\ \\text{V}', 'U_2=20\\ \\text{V}')
  const answer = cur.answer
    .replace('(3) $\\tan\\theta=1$', '(3) $\\tan\\theta=0.1$')
  const solution = cur.solution
    // (2) 代入行：200→20（结果 0.005 m 不变）
    .replace('=\\dfrac{200\\times(0.10)^2}{4\\times500\\times0.02}=0.005', '=\\dfrac{20\\times(0.10)^2}{4\\times500\\times0.02}=0.005')
    // (3) 代入行与结果：200→20，1→0.1
    .replace('=\\dfrac{U_2L}{2U_1d}=\\dfrac{200\\times0.10}{2\\times500\\times0.02}=1$', '=\\dfrac{U_2L}{2U_1d}=\\dfrac{20\\times0.10}{2\\times500\\times0.02}=0.1$')
  const figure = cur.figure ? cur.figure.replace('U=200', 'U=20') : cur.figure
  patches.push({
    id: 855, stem, answer, solution, figure,
    expect: (r) =>
      r.stem.includes('U_2=20\\ \\text{V}') && !r.stem.includes('U_2=200') &&
      r.answer.includes('\\tan\\theta=0.1') && !r.answer.includes('\\tan\\theta=1') &&
      r.solution.includes('\\dfrac{20\\times(0.10)^2}') && r.solution.includes('\\dfrac{20\\times0.10}{2\\times500\\times0.02}=0.1') &&
      !r.solution.includes('\\dfrac{200\\times') &&
      (r.figure === null || (r.figure.includes('U=20') && !r.figure.includes('U=200'))),
  })
}

// ---------- #562：补 A~D 选项（answer=B：位移方向沿斜面；A 速度方向/D 落点/C 时间均构造为错误项） ----------
// 解析 C/D 两行原稿「C 正确」「D 正确」与新选项措辞矛盾，按选项口径改写为「C 错误」「D 错误」
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 562').get()
  if (!cur || !cur.solution) throw new Error('#562 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem +
    '（　　）\nA．小球落在斜面上时，速度方向与水平方向的夹角为 $37^\\circ$\n' +
    'B．小球落在斜面上时，位移方向与水平方向的夹角为 $37^\\circ$\n' +
    'C．增大抛出时的初速度，小球在空中的运动时间变短\n' +
    'D．若初速度为 $v_0=4\\ \\text{m/s}$，小球将落在斜面底端以下（落到水平地面上）'
  const solution = cur.solution
    .replace('斜面足够长，小球始终落在斜面上，故增大水平初速度时运动时间变长，C 正确。',
      '由 $t=\\dfrac{2v_0\\tan\\theta}{g}$ 可知增大初速度时运动时间变长，故 C 错误。')
    .replace('恰好等于抛出点到斜面底端的竖直高度 $h$，小球落在斜面底端，仍在斜面上，D 正确。',
      '恰好等于抛出点到斜面底端的竖直高度 $h$，小球恰好落在斜面底端，仍在斜面上，不会落到斜面以外，故 D 错误。')
    .replace('本题为单选题，正确选项为 B。', '综上，正确选项为 B。')
  patches.push({
    id: 562, stem, solution,
    expect: (r) => /[ABCD][.、．]/.test(r.stem) && r.stem.includes('B．小球落在斜面上时，位移方向') &&
      !r.solution.includes('C 正确') && !r.solution.includes('D 正确') && r.solution.includes('故 D 错误'),
  })
}

// ---------- #568：补 A~D 选项（answer=B：分压接法从零可调） ----------
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 568').get()
  if (!cur || !cur.solution) throw new Error('#568 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem +
    '\nA．应采用限流接法，待测电阻两端电压可在 $0 \\sim 6\\ \\text{V}$ 之间连续调节\n' +
    'B．应采用分压接法，待测电阻两端电压可从零开始连续调节\n' +
    'C．采用限流接法时，待测电阻两端电压最低可调到 $0.5\\ \\text{V}$ 左右\n' +
    'D．滑动变阻器的总阻值越大，分压接法的输出电压调节越平稳'
  const solution = cur.solution.replace('不能从零调到 $0.55\\ \\text{V}$，故 C 错误', '不能调到 $0.5\\ \\text{V}$ 左右，故 C 错误')
  patches.push({
    id: 568, stem, solution,
    expect: (r) => r.stem.includes('B．应采用分压接法') && r.solution.includes('故 C 错误') && r.solution.includes('故 D 错误'),
  })
}

// ---------- #659：补 A~D 选项（answer=A：F=5N 时静摩擦 5N） ----------
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 659').get()
  if (!cur || !cur.solution) throw new Error('#659 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem + '（　　）\n' +
    'A．当 $F=5\\ \\text{N}$ 时，物块受到的摩擦力大小为 $5\\ \\text{N}$\n' +
    'B．当 $F=6\\ \\text{N}$ 时，物块将立即向右加速滑动\n' +
    'C．撤去拉力后，物块立即停止运动\n' +
    'D．撤去拉力后，物块继续滑行的过程中不受摩擦力'
  // 原解析与四个选项口径一致（A 正确 / B 错误 / C「不会立即停止」/ D「不会变为零」），仅结句措辞对齐
  const solution = cur.solution.replace('综上，正确选项为 A。', '符合题意的选项为 A。')
  patches.push({
    id: 659, stem, solution,
    expect: (r) => r.stem.includes('A．当 $F=5') && r.stem.includes('D．撤去拉力后') && r.solution.includes('符合题意的选项为 A'),
  })
}

// ---------- #676：补 A~D 选项（answer=BC 多选：t=12s / 沿水流位移 36m） ----------
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 676').get()
  if (!cur || !cur.solution) throw new Error('#676 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem.replace('则下列说法正确的是（　　）', '则下列说法正确的是（　　）\n') +
    'A．小船渡河的时间为 $20\\ \\text{s}$\n' +
    'B．小船渡河的时间为 $12\\ \\text{s}$\n' +
    'C．渡河过程中，小船沿水流方向移动的距离为 $36\\ \\text{m}$\n' +
    'D．小船渡河的实际速度大小为 $8\\ \\text{m/s}$'
  patches.push({
    id: 676, stem, solution: cur.solution,
    expect: (r) => r.stem.includes('A．小船渡河的时间为') && r.stem.includes('D．小船渡河的实际速度大小为 $8'),
  })
}

// ---------- #694：题干 C=100/π→200/π μF（自洽），补 A~D 选项，解析重写为干净版（去残稿元叙述） ----------
// 独立复算：X_L1=2π×50×(1/π)=100 Ω，Z₁=√(100²+100²)=100√2≈141.4 Ω，I₁=U/141.4；
// X_L2=200 Ω，Z₂=100√5≈223.6 Ω，I₂<I₁；X_C=1/(2π×50×200/π×10⁻⁶)=50 Ω，Z₃=√(100²+50²)=50√5≈111.8 Ω，I₃>I₁ → B 正确
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 694').get()
  if (!cur || !cur.solution) throw new Error('#694 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem
    .replace('C=\\dfrac{100}{\\pi}\\ \\mu\\text{F}', 'C=\\dfrac{200}{\\pi}\\ \\mu\\text{F}')
    .replace('则下列判断正确的是', '则下列判断正确的是（　　）\n') +
    'A．$I_2 > I_1$，$I_3 > I_1$\n' +
    'B．$I_2 < I_1$，$I_3 > I_1$\n' +
    'C．$I_2 < I_1$，$I_3 = I_1$\n' +
    'D．$I_2 < I_1$，$I_3 < I_1$'
  const solution =
    '电感线圈的感抗 $X_L=2\\pi fL$，电容器的容抗 $X_C=\\dfrac{1}{2\\pi fC}$。\n' +
    '第一次：$f_1=50\\ \\text{Hz}$，$X_{L1}=2\\pi\\times50\\times\\dfrac{1}{\\pi}=100\\ \\Omega$，总阻抗 $Z_1=\\sqrt{R^2+X_{L1}^2}=\\sqrt{100^2+100^2}=100\\sqrt{2}\\approx141.4\\ \\Omega$，电流 $I_1=\\dfrac{U}{141.4}$。\n' +
    '第二次：$f_2=100\\ \\text{Hz}$，$X_{L2}=2\\pi\\times100\\times\\dfrac{1}{\\pi}=200\\ \\Omega$，总阻抗 $Z_2=\\sqrt{100^2+200^2}=100\\sqrt{5}\\approx223.6\\ \\Omega$，电流 $I_2=\\dfrac{U}{223.6}$，故 $I_2<I_1$。\n' +
    '第三次：换成电容器后 $f=50\\ \\text{Hz}$，$X_C=\\dfrac{1}{2\\pi\\times50\\times\\dfrac{200}{\\pi}\\times10^{-6}}=50\\ \\Omega$，总阻抗 $Z_3=\\sqrt{100^2+50^2}=50\\sqrt{5}\\approx111.8\\ \\Omega$，电流 $I_3=\\dfrac{U}{111.8}$，故 $I_3>I_1$。\n' +
    '综上 $I_2<I_1$、$I_3>I_1$，正确选项为 B。'
  patches.push({
    id: 694, stem, solution,
    expect: (r) => r.stem.includes('C=\\dfrac{200}{\\pi}') && r.stem.includes('B．$I_2 < I_1$，$I_3 > I_1$') &&
      !r.solution.includes('残稿') && !r.solution.includes('将题干中') && r.solution.includes('正确选项为 B'),
  })
}

// ---------- #859：补 A~D 选项（answer=C：U-I 图像截距 E=6V、短路电流 6A） ----------
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 859').get()
  if (!cur || !cur.solution) throw new Error('#859 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem +
    '\nA．$R$ 由 $2\\ \\Omega$ 增大到 $6\\ \\Omega$ 的过程中，电流由 $2\\ \\text{A}$ 减小到 $1\\ \\text{A}$，路端电压由 $4\\ \\text{V}$ 增大到 $5\\ \\text{V}$\n' +
    'B．路端电压增大，是因为电流增大导致内电压增大\n' +
    'C．该电源的 $U$-$I$ 图像纵轴截距为 $6\\ \\text{V}$，斜率大小为 $1\\ \\Omega$，短路电流为 $6\\ \\text{A}$\n' +
    'D．路端电压可以超过 $6\\ \\text{V}$'
  patches.push({
    id: 859, stem, solution: cur.solution,
    expect: (r) => r.stem.includes('C．该电源的 $U$-$I$ 图像纵轴截距为') && r.stem.includes('D．路端电压可以超过'),
  })
}

// ---------- #861：补 A~D 选项（answer=B：T₂ 曲线整体在上方） ----------
{
  const cur = db.prepare('SELECT stem, solution FROM questions WHERE id = 861').get()
  if (!cur || !cur.solution) throw new Error('#861 读取失败或 solution 为空，拒绝执行')
  const stem = cur.stem + '（　　）\n' +
    'A．$T_1 > T_2$\n' +
    'B．温度为 $T_2$ 时，各种波长处的辐射强度都大于温度为 $T_1$ 时的辐射强度\n' +
    'C．温度为 $T_1$ 时，各种波长处的辐射强度都大于温度为 $T_2$ 时的辐射强度\n' +
    'D．波长越短的辐射，其能量子的能量越小'
  // 原解析与选项口径一致：维恩位移（T₁<T₂，A 错）/ T₂ 曲线整体在上方（C 错 B 对）/ ε=hν（D 错），solution 不动
  patches.push({
    id: 861, stem, solution: cur.solution,
    expect: (r) => r.stem.includes('B．温度为 $T_2$ 时，各种波长处的辐射强度都大于') && r.stem.includes('D．波长越短的辐射'),
  })
}

// ---------- #28：qtype 选择 → 计算（answer 为数值、题干为「求比值」，无选项可构造） ----------
{
  const cur = db.prepare('SELECT qtype FROM questions WHERE id = 28').get()
  if (!cur) throw new Error('#28 读取失败，拒绝执行')
  patches.push({ id: 28, qtype: '计算', expect: (r) => r.qtype === '计算' })
}

// ---------- 执行 ----------
if (DRY) {
  console.log('[dry-run] 共', patches.length, '个补丁：', patches.map((p) => '#' + p.id).join(' '))
  process.exit(0)
}

// 逐字段动态 SET：figure 未提供时不写该列（传 null 会清空配图，P1-11 教训）
{
  const updDyn = (fields) => db.prepare(`UPDATE questions SET ${fields.map((f) => `${f}=?`).join(', ')} WHERE id=?`)
  const tx = db.transaction(() => {
    for (const p of patches) {
      const fields = ['stem', 'answer', 'solution', 'qtype', 'figure'].filter((f) => p[f] !== undefined)
      const r = updDyn(fields).run(...fields.map((f) => p[f]), p.id)
      if (r.changes !== 1) throw new Error(`#${p.id} 更新失败（changes=${r.changes}）`)
    }
  })
  tx()
}

// ---------- 逐题回读断言 ----------
let bad = 0
for (const p of patches) {
  const row = db.prepare('SELECT stem, answer, solution, qtype, figure FROM questions WHERE id = ?').get(p.id)
  if (!p.expect(row)) { bad++; console.log(`✗ #${p.id} 回读断言未过`) } else console.log(`✓ #${p.id} 已更新且回读断言通过`)
}
if (bad) { console.log(`共 ${bad} 题断言失败`); process.exit(1) }
console.log('全部补丁落库成功')
