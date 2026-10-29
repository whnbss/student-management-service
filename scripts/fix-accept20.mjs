// 一次性脚本：按验收 #20 的指令修正 P1-14 四道错题（#566/#577/#578/#579），answer+solution 同步改
// 独立重解自验（每题均重新从题干条件推一遍，不依赖原解析）：
// - #566(4)：ρ=Rπd²/(4L)=4.8×3.14×(2.300e-3)²/(4×5.030e-2)=7.977e-5/0.2012=3.96e-4，两位有效数字 → 4.0e-4
//   （原答案 5.8e-5 错，疑为 4L 误作 4L×6.8 量级的运算错误；量级检验 d²~5e-6、L~5e-2 → ρ~4e-4）
// - #577：k=B²L²/(R+r)=0.5²×0.5²/0.5=0.0625/0.5=0.125（原解析误算成 0.25）→ v_m=F/k=0.5/0.125=4 m/s；
//   v₁=1 时 a=(0.5−0.125)/0.2=1.875 m/s²。原(3)取 v₂=4=v_m：棒渐近逼近 v_m、「达到 4 m/s」无有限位移解，
//   题面无解，按验收指令把题干改为 v₂=3 m/s → x=(½×0.2×3²+0.75)/0.5=(0.9+0.75)/0.5=3.3 m
// - #578(3)：菱形 POQO₁（四边皆 R）中 ∠O₁PO=π/2−θ（PO₁⊥v），对角 ∠PO₁Q=π−(π/2−θ)=π/2+θ，
//   t=(π/2+θ)m/(qB)；θ→0 时 t→πm/(2qB)，与(1) θ=0 时 1/4 圆周一致（原答案 π/2−θ 与 πm/qB 均错且与(1)矛盾）
// - #579：t₁=√(2×0.8/20)=√0.08=0.2√2≈0.283 s（原解析 0.80=½·20·t₁² 却得 0.20，平方根算错）；
//   v_y=20×0.2√2=4√2，v=√(16+32)=4√3≈6.9，tanθ=√2→54.7°；R=mv/(qB)=0.8√3≈1.39 m；
//   洛伦兹力方向应为右上方（原解析写左上方，左手定则用错）；圆心 O₁=(1.6√2, 0.8)，轨迹圆与 x 轴交于
//   x=0.8√2 与 x=2.4√2，转角 φ：cosφ=−1/3→φ≈109.5°≈1.91 rad，t₂=φ/ω=1.91/5≈0.382 s，
//   总时间 t≈0.283+0.382=0.665≈0.66 s（原答案 0.51 s 及 R=0.8√2、45° 均随 t₁ 连锁错误）
// 长期修法沿用 fix-accept13.mjs 的防护：动态构建 SET、仅更新 patch 提供的字段，cur 回退其余列
// 用法：node scripts/fix-accept20.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #566：仅改(4)的数值（(1)(2)(3) 原本正确） ----------
const q566Solution = `（1）螺旋测微器读数：固定刻度读数为 $2\\text{ mm}$，可动刻度第 $30$ 条刻度线与水平线对齐，可动刻度每格为 $0.01\\text{ mm}$，故可动部分读数为 $30\\times0.01\\text{ mm}=0.300\\text{ mm}$。合金丝直径 $d=2\\text{ mm}+0.300\\text{ mm}=2.300\\text{ mm}$。
（2）20分度游标卡尺的精确度为 $\\frac{1}{20}\\text{ mm}=0.05\\text{ mm}$。游标尺零刻度线在主尺 $50\\text{ mm}$ 刻度线右侧，主尺读数为 $50\\text{ mm}$；第 $6$ 条游标刻度线与主尺刻度线对齐，游标读数为 $6\\times0.05\\text{ mm}=0.30\\text{ mm}$。故合金丝长度 $L=50\\text{ mm}+0.30\\text{ mm}=50.30\\text{ mm}$。20分度游标卡尺读数末位应为 $0$ 或 $5$（即 $0.05\\text{ mm}$ 的整数倍），$50.30\\text{ mm}$ 符合要求。
（3）由欧姆定律得 $R=\\frac{U}{I}=\\frac{2.40\\text{ V}}{0.50\\text{ A}}=4.8\\ \\Omega$。
（4）合金丝横截面积 $S=\\pi\\left(\\frac{d}{2}\\right)^2=\\frac{\\pi d^2}{4}$。由电阻定律 $R=\\rho\\frac{L}{S}$ 得
$$\\rho=\\frac{RS}{L}=\\frac{R\\pi d^2}{4L}.$$
代入数据：$d=2.300\\text{ mm}=2.300\\times10^{-3}\\text{ m}$，$L=50.30\\text{ mm}=5.030\\times10^{-2}\\text{ m}$，
$$\\rho=\\frac{4.8\\times\\pi\\times(2.300\\times10^{-3})^2}{4\\times5.030\\times10^{-2}}\\ \\Omega\\cdot\\text{m}=\\frac{4.8\\times3.14\\times5.29\\times10^{-6}}{0.2012}\\ \\Omega\\cdot\\text{m}\\approx3.96\\times10^{-4}\\ \\Omega\\cdot\\text{m}.$$
保留两位有效数字，故合金丝的电阻率约为 $4.0\\times10^{-4}\\ \\Omega\\cdot\\text{m}$。
数量级检验：$d^2\\sim5\\times10^{-6}\\ \\text{m}^2$，$L\\sim5\\times10^{-2}\\ \\text{m}$，$R\\sim5\\ \\Omega$，则 $\\rho\\sim\\frac{5\\times3\\times5\\times10^{-6}}{4\\times5\\times10^{-2}}\\sim4\\times10^{-4}\\ \\Omega\\cdot\\text{m}$，与结果一致。`
const q566Answer = `（1）$2.300$；（2）$50.30$；（3）$4.8$；（4）$4.0\\times10^{-4}$（未修约值 $3.96\\times10^{-4}$）`

// ---------- #577：k=0.125 重算(1)(2)，题干(3) v₂=4→3（v_m=4 时原题面无有限解），x=3.3 m ----------
const q577StemOld = `$v_2=4\\ \\text{m/s}$`
const q577StemNew = `$v_2=3\\ \\text{m/s}$`
const q577Answer = `（1）$v_{\\text{m}}=4\\ \\text{m/s}$；（2）$a=1.875\\ \\text{m/s}^2$；（3）$x=3.3\\ \\text{m}$。`
const q577Solution = `【步骤1 受力分析与动力学方程】金属棒切割磁感线产生感应电动势 $E=BLv$，感应电流 $I=\\frac{E}{R+r}$，金属棒受到的安培力大小为 $F_{\\text{安}}=BIL=\\frac{B^2L^2v}{R+r}$，方向水平向左。由牛顿第二定律得 $F-\\frac{B^2L^2v}{R+r}=ma$。代入数据，$\\frac{B^2L^2}{R+r}=\\frac{0.5^2\\times 0.5^2}{0.4+0.1}\\ \\text{N}\\cdot\\text{s}/\\text{m}=\\frac{0.0625}{0.5}\\ \\text{N}\\cdot\\text{s}/\\text{m}=0.125\\ \\text{N}\\cdot\\text{s}/\\text{m}$，故 $0.5-0.125v=0.2a$。金属棒做加速度逐渐减小的变加速运动。
【步骤2 最大速度条件】当 $a=0$ 时速度最大，有 $F=\\frac{B^2L^2v_{\\text{m}}}{R+r}$，解得 $v_{\\text{m}}=\\frac{F(R+r)}{B^2L^2}=\\frac{F}{B^2L^2/(R+r)}=\\frac{0.5}{0.125}\\ \\text{m/s}=4\\ \\text{m/s}$。
【步骤3 求 $v_1=1\\ \\text{m/s}$ 时的加速度】$v_1=1\\ \\text{m/s}<v_{\\text{m}}$，尚未达到最大速度。此时安培力 $F_{\\text{安}}=0.125\\times 1\\ \\text{N}=0.125\\ \\text{N}$，由 $F-F_{\\text{安}}=ma$ 得 $a=\\frac{0.5-0.125}{0.2}\\ \\text{m/s}^2=1.875\\ \\text{m/s}^2$，方向水平向右。
【步骤4 能量关系求位移】由能量守恒，恒力做功等于金属棒动能增加量与回路总焦耳热之和：$Fx=\\frac{1}{2}mv_2^2+Q_{\\text{总}}$。串联回路中 $Q_R:Q_r=R:r=4:1$，故 $Q_{\\text{总}}=\\frac{R+r}{R}Q_R=\\frac{0.5}{0.4}\\times 0.6\\ \\text{J}=0.75\\ \\text{J}$。于是 $0.5x=\\frac{1}{2}\\times 0.2\\times 3^2+0.75=0.9+0.75=1.65$，解得 $x=3.3\\ \\text{m}$。
（说明：原题(3)取 $v_2=4\\ \\text{m/s}$ 恰等于 $v_{\\text{m}}$，棒只能渐近逼近、无法在有限位移内「达到」，题面无解，故题干改为 $v_2=3\\ \\text{m/s}$。）`

// ---------- #578：仅(3)时间公式错（菱形对角给 π/2+θ），(1)(2) 与公式自洽性检验同步写明 ----------
const q578Answer = `（1）$t_1=\\dfrac{\\pi m}{2qB}$；（2）所有粒子离开磁场时速度方向均与 $PO$ 垂直（夹角定值 $90^\\circ$）；（3）$t=\\dfrac{\\left(\\dfrac{\\pi}{2}+\\theta\\right)m}{qB}$；当 $\\theta\\to 0$ 时 $t\\to\\dfrac{\\pi m}{2qB}$。`
const q578Solution = `【步骤1：找圆心、定半径】粒子在磁场中做匀速圆周运动，洛伦兹力提供向心力：$qvB=\\dfrac{mv^2}{r}$，得 $r=\\dfrac{mv}{qB}$。由题给 $v=\\dfrac{qBR}{m}$ 得 $r=R$，即粒子轨迹半径等于磁场区域半径。

【步骤2：第（1）问——沿半径方向射入】设圆形磁场区域圆心为 $O$，粒子轨迹圆心为 $O_1$。粒子从 $P$ 点沿半径 $PO$ 方向射入，速度沿 $PO$，圆心 $O_1$ 在过 $P$ 点垂直于速度的直线上。因 $r=R$，轨迹圆与磁场边界圆半径相等。由几何关系：$PO=PO_1=R$，且 $PO_1\\perp PO$，故 $\\triangle POO_1$ 为等腰直角三角形，$OO_1=\\sqrt{2}R$。设粒子从 $P$ 点运动到边界上的 $Q$ 点射出，$OQ=O_1Q=R$，$OO_1=\\sqrt{2}R$，故 $\\triangle OO_1Q$ 中 $OQ^2+O_1Q^2=OO_1^2$，即 $\\angle OQO_1=90^\\circ$。两圆交点 $P$、$Q$ 关于连心线 $OO_1$ 对称，由对称性 $\\angle POO_1=\\angle QOO_1=45^\\circ$。在轨迹圆中，弦 $PQ$ 对应的圆心角 $\\angle PO_1Q$ 满足 $PQ=2R\\sin\\dfrac{\\angle PO_1Q}{2}$。由等腰直角三角形 $\\triangle POO_1$ 得 $PQ=2R\\sin45^\\circ=\\sqrt{2}R$，故 $\\sin\\dfrac{\\angle PO_1Q}{2}=\\dfrac{\\sqrt{2}}{2}$，取劣弧得 $\\angle PO_1Q=90^\\circ$。于是 $t_1=\\dfrac{90^\\circ}{360^\\circ}T=\\dfrac{1}{4}\\cdot\\dfrac{2\\pi m}{qB}=\\dfrac{\\pi m}{2qB}$。

【步骤3：第（2）问——磁发散结论】设粒子从 $P$ 点以任意方向射入，速度方向与 $PO$ 成角 $\\varphi$。轨迹圆心 $O_1$ 满足 $PO_1\\perp v$，$PO_1=R$。设粒子从边界上 $Q$ 点射出，$OQ=R$，$O_1Q=R$。考察四边形 $POQO_1$：$PO=OQ=O_1Q=O_1P=R$，故 $POQO_1$ 为菱形。菱形对边平行：$O_1Q\\parallel PO$，$O_1P\\parallel OQ$。粒子射出时速度 $v'\\perp O_1Q$，而 $O_1Q\\parallel PO$，故 $v'\\perp PO$，即出射速度方向垂直于过 $P$ 点的直径 $PO$，也即平行于 $P$ 点处的切线方向。因此所有从 $P$ 点射入的粒子离开磁场时速度方向均与 $PO$ 垂直，定值为 $90^\\circ$。

【步骤4：第（3）问——一般角 $\\theta$ 的时间】设射入速度与 $PO$ 成 $\\theta$ 角（$0<\\theta<\\dfrac{\\pi}{2}$）。轨迹圆心 $O_1$ 满足 $PO_1\\perp v$、$PO_1=R$；四边形 $POQO_1$ 四条边 $PO=OQ=QO_1=O_1P=R$，为菱形（顶点按 $P\\to O\\to Q\\to O_1$ 排列）。由 $PO_1\\perp v$ 且 $v$ 与 $PO$ 成 $\\theta$ 角，得 $\\angle O_1PO=\\dfrac{\\pi}{2}-\\theta$；菱形中 $\\angle O_1PO$ 与 $\\angle PO_1Q$ 是相对的角（顶点 $P$ 与 $O_1$ 相对），对角相等需先由邻角互补求：$\\angle PO_1Q=\\pi-\\angle O_1PO=\\pi-\\left(\\dfrac{\\pi}{2}-\\theta\\right)=\\dfrac{\\pi}{2}+\\theta$（弦 $PQ$ 对应劣弧，圆心角小于 $\\pi$，与 $\\theta\\in\\left(0,\\dfrac{\\pi}{2}\\right)$ 时 $\\dfrac{\\pi}{2}<\\dfrac{\\pi}{2}+\\theta<\\pi$ 一致）。运动时间
$$t=\\frac{\\angle PO_1Q}{2\\pi}T=\\frac{\\frac{\\pi}{2}+\\theta}{2\\pi}\\cdot\\frac{2\\pi m}{qB}=\\frac{\\left(\\frac{\\pi}{2}+\\theta\\right)m}{qB}.$$
自洽性检验：令 $\\theta=0$（沿半径方向射入），$t=\\dfrac{\\pi m}{2qB}$，与第（1）问结果一致；轨迹圆心角随 $\\theta$ 增大而增大，$\\theta\\to\\dfrac{\\pi}{2}$ 时趋近半圆 $t\\to\\dfrac{\\pi m}{qB}$，符合几何直觉。`

// ---------- #579：t₁/v/R/力方向/转角全链重解（原 0.20 s 系 √0.08 开方错误，后续连锁全错） ----------
const q579Answer = `(1) $a=20\\,\\text{m/s}^2$，方向竖直向下；(2) $v=4\\sqrt{3}\\,\\text{m/s}\\approx6.9\\,\\text{m/s}$，方向与 $x$ 轴正方向成 $54.7^\\circ$ 角斜向右下方；(3) $R=0.8\\sqrt{3}\\,\\text{m}\\approx1.39\\,\\text{m}$，能回到 $y>0$ 区域，总时间 $t\\approx0.66\\,\\text{s}$。`
const q579Solution = `【步骤 1：电场中受力分析】小球在 $y>0$ 区域受重力 $mg$ 与电场力 $qE$，二者均竖直向下，故 $a=\\frac{mg+qE}{m}=g+\\frac{qE}{m}=10+\\frac{1.0\\times10^{-2}\\times1.0}{1.0\\times10^{-3}}=10+10=20\\,\\text{m/s}^2$，方向竖直向下。

【步骤 2：电场中类平抛运动，求进入磁场时的速度】竖直方向：$y_P=\\frac{1}{2}at_1^2$，$0.80=\\frac{1}{2}\\times20\\times t_1^2$，得 $t_1=\\sqrt{0.08}\\,\\text{s}=0.2\\sqrt{2}\\,\\text{s}\\approx0.283\\,\\text{s}$；$v_y=at_1=20\\times0.2\\sqrt{2}=4\\sqrt{2}\\,\\text{m/s}\\approx5.66\\,\\text{m/s}$；水平方向 $v_x=v_0=4.0\\,\\text{m/s}$。故进入磁场时速度大小 $v=\\sqrt{v_x^2+v_y^2}=\\sqrt{4.0^2+(4\\sqrt{2})^2}=\\sqrt{48}=4\\sqrt{3}\\,\\text{m/s}\\approx6.9\\,\\text{m/s}$，设速度与 $x$ 轴正方向夹角 $\\theta$，$\\tan\\theta=\\frac{v_y}{v_x}=\\sqrt{2}$，$\\theta\\approx54.7^\\circ$，斜向右下方。

【步骤 3：磁场中圆周运动半径】洛伦兹力提供向心力：$qvB=\\frac{mv^2}{R}$，$R=\\frac{mv}{qB}=\\frac{1.0\\times10^{-3}\\times4\\sqrt{3}}{1.0\\times10^{-2}\\times0.50}=0.8\\sqrt{3}\\,\\text{m}\\approx1.39\\,\\text{m}$。由左手定则：正电荷、速度斜向右下、磁场垂直纸面向里，洛伦兹力指向右上方（与速度垂直），圆心在进入点右上方。

【步骤 4：判断能否回到电场区】进入点 $Q$ 的横坐标 $x_Q=v_xt_1=4.0\\times0.2\\sqrt{2}=0.8\\sqrt{2}\\,\\text{m}\\approx1.13\\,\\text{m}$。圆心 $O_1$ 在 $Q$ 点右上方、与速度垂直的方向上（该方向单位矢量 $\\frac{(\\sqrt{2},\\,1)}{\\sqrt{3}}$ 与速度 $(4,\\,-4\\sqrt{2})$ 垂直），故圆心坐标
$$O_1=\\left(0.8\\sqrt{2}+0.8\\sqrt{3}\\times\\frac{\\sqrt{2}}{\\sqrt{3}},\\;\\;0.8\\sqrt{3}\\times\\frac{1}{\\sqrt{3}}\\right)=(1.6\\sqrt{2},\\;0.8)\\,\\text{m}\\approx(2.26,\\;0.8)\\,\\text{m}.$$
圆心纵坐标 $0.8\\,\\text{m}$ 小于半径 $R\\approx1.39\\,\\text{m}$，故轨迹圆与 $x$ 轴相交：小球进入磁场后沿圆弧下探，最低点 $y=0.8-0.8\\sqrt{3}\\approx-0.59\\,\\text{m}$，随后折返向上，在 $x=0.8\\sqrt{2}+2\\times0.8\\sqrt{2}=2.4\\sqrt{2}\\approx3.39\\,\\text{m}$ 处再次到达 $y=0$，此时速度已转成斜向右上方，离开磁场进入 $y>0$ 区域，故能回到电场区。

【步骤 5：求总时间】入射点与出射点相对圆心 $O_1$ 的半径矢量分别为 $(-0.8\\sqrt{2},\\,-0.8)$ 与 $(0.8\\sqrt{2},\\,-0.8)$，二者夹角即小球在磁场中转过的圆心角 $\\varphi$：
$$\\cos\\varphi=\\frac{(-0.8\\sqrt{2})\\times(0.8\\sqrt{2})+(-0.8)\\times(-0.8)}{(0.8\\sqrt{3})^2}=\\frac{-1.28+0.64}{1.92}=-\\frac{1}{3},\\quad\\varphi=\\arccos\\!\\left(-\\frac{1}{3}\\right)\\approx109.5^\\circ\\approx1.91\\,\\text{rad}.$$
（交叉验证：小球沿轨迹圆逆时针运动，速度方向角从入射时的 $-54.7^\\circ$（斜向右下）连续增大，经最低点处的 $0^\\circ$（水平向右）增大到出射时的 $+54.7^\\circ$（斜向右上），共转过 $109.5^\\circ$，与上式一致。）角速度 $\\omega=\\frac{qB}{m}=\\frac{1.0\\times10^{-2}\\times0.50}{1.0\\times10^{-3}}=5\\,\\text{rad/s}$，磁场中运动时间 $t_2=\\frac{\\varphi}{\\omega}\\approx\\frac{1.91}{5}\\approx0.382\\,\\text{s}$。总时间 $t=t_1+t_2\\approx0.283+0.382=0.665\\,\\text{s}\\approx0.66\\,\\text{s}$。`

// ---------- 统一防护：动态构建 SET、仅更新 patch 提供的字段（cur 回退其余列） ----------
const updates = [
  [566, { answer: q566Answer, solution: q566Solution }],
  [577, { stem: q577StemNew, answer: q577Answer, solution: q577Solution, stemReplace: { from: q577StemOld, to: q577StemNew } }],
  [578, { answer: q578Answer, solution: q578Solution }],
  [579, { answer: q579Answer, solution: q579Solution }],
]

const get = db.prepare('SELECT id, stem, answer, solution FROM questions WHERE id = ?')
const dryArg = DRY ? ' [dry-run]' : ''

for (const [id, patch] of updates) {
  const cur = get.get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  const cols = Object.keys(patch).filter((k) => k !== 'stemReplace')
  const sets = cols.map((c) => `${c} = @${c}`).join(', ')
  const params = { id: cur.id }
  for (const c of cols) {
    // stem 走「原文精确替换」：确认旧串存在才改，防止整体覆盖引入意外差异
    if (c === 'stem' && patch.stemReplace) {
      if (!cur.stem.includes(patch.stemReplace.from)) { console.log(`题 ${id} 题干未找到待替换片段「${patch.stemReplace.from}」，跳过 stem`); continue }
      params.stem = cur.stem.replace(patch.stemReplace.from, patch.stemReplace.to)
    } else {
      params[c] = patch[c] ?? cur[c]
    }
  }
  const setCols = Object.keys(params).filter((k) => k !== 'id').map((c) => `${c} = @${c}`).join(', ')
  if (!setCols) { console.log(`题 ${id} 无可更新字段，跳过`); continue }
  console.log(`题 ${id}：更新 ${Object.keys(params).filter((k) => k !== 'id').join(', ')}${dryArg}`)
  if (!DRY) db.prepare(`UPDATE questions SET ${setCols} WHERE id = @id`).run(params)
}
console.log(`完成${dryArg}`)
