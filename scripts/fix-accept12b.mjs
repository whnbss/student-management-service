// 一次性脚本：表达式求值版 checkSolutionArithmetic 全库扫描新发现的 3 个真错误（人工独立复算确认）
// - #144：r=mv/(qB)=160m 被写成 0.16m，且 T≈1.0s 与自身 r 矛盾（r=0.16m 时 T 只能 ≈0.25s）
//   修法：质量 2.0×10⁻³→4.0×10⁻⁵ kg，使 r=3.2m、T≈5.0s 整洁自洽；第二问 mg=4×10⁻⁴N > f=2×10⁻⁴N，E=2.0V/m 向上
// - #198：r=mv/(qB)=160m 被写成 0.16m、T 被写成 3.1×10⁻⁵s（实际 0.25s）
//   修法：速度 4.0×10³→4.0 m/s，使 r=0.16m（答案不变）、T=2πr/v≈0.25s；周期与速度无关的结论保留
// - #276：ω=√(μg/r)=√(0.4×10/0.5)=2.83rad/s 被写成 2rad/s（选项 B 及解析同错）
//   修法：μ=0.4→0.2，使 ω=√4=2rad/s，选项 B 与解析成立
// 用法：node scripts/fix-accept12b.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #144：m→4.0×10⁻⁵ kg，全部重算（r=3.2m / T≈5.0s / E=2.0V/m 向上，两问自洽） ----------
const q144 = {
  stem: `如图所示，光滑绝缘水平面上方存在垂直纸面向里的匀强磁场，磁感应强度 $B=0.5\\ \\mathrm{T}$。一个质量 $m=4.0\\times10^{-5}\\ \\mathrm{kg}$、电荷量 $q=+1.0\\times10^{-4}\\ \\mathrm{C}$ 的小球以速度 $v_0=4\\ \\mathrm{m/s}$ 水平进入磁场，速度方向与磁场垂直。小球在磁场中运动时始终未离开磁场区域，取 $g=10\\ \\mathrm{m/s^2}$。求：（1）小球在磁场中做圆周运动的半径 $r$ 和周期 $T$；（2）若小球恰好能沿直线运动，则需同时加一竖直方向的匀强电场，求该电场的场强大小和方向。`,
  answer: `（1）$r=3.2\\ \\mathrm{m}$，$T\\approx5.0\\ \\mathrm{s}$；（2）$E=2.0\\ \\mathrm{V/m}$，方向竖直向上`,
  solution: `（1）洛伦兹力提供向心力：$qv_0B=\\dfrac{mv_0^2}{r}$，得 $r=\\dfrac{mv_0}{qB}=\\dfrac{4.0\\times10^{-5}\\times4}{1.0\\times10^{-4}\\times0.5}=3.2\\ \\mathrm{m}$。
周期 $T=\\dfrac{2\\pi m}{qB}=\\dfrac{2\\pi\\times4.0\\times10^{-5}}{1.0\\times10^{-4}\\times0.5}\\approx5.0\\ \\mathrm{s}$。
（2）小球沿直线运动时受力平衡。由左手定则，正电荷速度向右、磁场向里，洛伦兹力竖直向上，大小为 $f=qv_0B=1.0\\times10^{-4}\\times4\\times0.5=2.0\\times10^{-4}\\ \\mathrm{N}$。
重力 $mg=4.0\\times10^{-5}\\times10=4.0\\times10^{-4}\\ \\mathrm{N}$，大于洛伦兹力，故电场力必须竖直向上且 $qE+f=mg$。
$qE=mg-f=4.0\\times10^{-4}-2.0\\times10^{-4}=2.0\\times10^{-4}\\ \\mathrm{N}$，
$E=\\dfrac{2.0\\times10^{-4}}{1.0\\times10^{-4}}=2.0\\ \\mathrm{V/m}$，方向竖直向上（正电荷受电场力方向即场强方向）。`,
}

// ---------- #198：v→4.0 m/s，r=0.16m 不变、T 改为 ≈0.25s ----------
const q198 = {
  stem: `一个电荷量为 $q=1.0\\times10^{-6}\\ \\mathrm{C}$、质量为 $m=2.0\\times10^{-8}\\ \\mathrm{kg}$ 的带电粒子，以速度 $v=4.0\\ \\mathrm{m/s}$ 垂直射入磁感应强度 $B=0.50\\ \\mathrm{T}$ 的匀强磁场中，不计重力。则粒子做匀速圆周运动的轨迹半径 $r=$ ______ m，运动周期 $T=$ ______ s。`,
  answer: `0.16；$0.25$`,
  solution: `（1）粒子速度与磁场垂直，洛伦兹力提供向心力：$qvB=\\dfrac{mv^{2}}{r}$，解得 $r=\\dfrac{mv}{qB}$。代入数据：$r=\\dfrac{2.0\\times10^{-8}\\times4.0}{1.0\\times10^{-6}\\times0.50}\\ \\mathrm{m}=0.16\\ \\mathrm{m}$。（2）由 $T=\\dfrac{2\\pi r}{v}=\\dfrac{2\\pi m}{qB}$，代入数据：$T=\\dfrac{2\\pi\\times2.0\\times10^{-8}}{1.0\\times10^{-6}\\times0.50}\\ \\mathrm{s}\\approx0.25\\ \\mathrm{s}$。可见周期与速度大小无关。`,
}

// ---------- #276：μ→0.2，使 ω=√(0.2×10/0.5)=2rad/s，选项 B 成立 ----------
const q276 = {
  stem: `如图，一圆盘可绕通过圆心的竖直轴匀速转动，圆盘上距转轴 $r=0.5\\ \\text{m}$ 处放一质量 $m=1\\ \\text{kg}$ 的小物块，物块与圆盘间的动摩擦因数 $\\mu=0.2$，最大静摩擦力等于滑动摩擦力，$g$ 取 $10\\ \\text{m/s}^2$。当圆盘转速缓慢增大时，下列说法正确的是（　　）
A. 物块随圆盘转动所需的向心力由圆盘对物块的支持力提供
B. 物块即将相对圆盘滑动时，圆盘的角速度为 $2\\ \\text{rad/s}$
C. 物块即将相对圆盘滑动时，圆盘边缘某点的线速度一定为 $2\\ \\text{m/s}$
D. 若物块质量变为 $2\\ \\text{kg}$，其他条件不变，则物块开始滑动的临界角速度变为原来的 $2$ 倍`,
  solution: `（1）物块随圆盘做匀速圆周运动，静摩擦力提供向心力，支持力与重力平衡，A 错误。
（2）当物块即将相对圆盘滑动时，静摩擦力达到最大值 $f_{\\max}=\\mu mg$，由 $\\mu mg=m\\omega^2 r$ 得 $\\omega=\\sqrt{\\dfrac{\\mu g}{r}}=\\sqrt{\\dfrac{0.2\\times 10}{0.5}}\\ \\text{rad/s}=2\\ \\text{rad/s}$，B 正确。
（3）圆盘边缘某点的线速度 $v=\\omega R$，题目未给出圆盘半径，$R$ 不一定等于 $r$，故线速度不一定为 $2\\ \\text{m/s}$，C 错误。
（4）临界角速度 $\\omega=\\sqrt{\\dfrac{\\mu g}{r}}$ 与质量无关，质量变为 $2\\ \\text{kg}$ 时临界角速度不变，D 错误。`,
}

const updates = [
  [144, q144],
  [198, q198],
  [276, q276],
]

const upd = db.prepare('UPDATE questions SET stem=?, answer=?, solution=? WHERE id=?')

for (const [id, patch] of updates) {
  const cur = db.prepare('SELECT id, stem, answer, solution FROM questions WHERE id = ?').get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  if (DRY) { console.log(`[dry-run] 题 ${id}：题干首行 ${patch.stem.split('\n')[0].slice(0, 50)}`); continue }
  upd.run(patch.stem, patch.answer, patch.solution, id)
  console.log(`题 ${id} 已更新（stem/answer/solution）`)
}

db.close()
