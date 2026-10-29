// 一次性脚本：第十二批补题独立重解自验发现的 5 处缺陷修正（#609/#610/#614/#615/#655）
// 独立重解依据：
// - #609：ρ=3π/(GT²)=3×3.1416/(6.67e-11×3.6e7)=9.4248/2.4012e-3≈3.9e3 kg/m³（原解析把 π²=9.87 误当代入 π，
//   得 1.2e4）；M=4π²R³/(GT²)=39.48×4.913e18/2.4012e-3≈8.1e22 kg（原答案 5.4e24 为运算错误；
//   交叉验证 M=ρV=3925×(4/3)π×(1.7e6)³≈8.1e22 一致）
// - #610：选项 C 的 √(GM/R) 代入 GM=gR² 后恰等于 √(gR)，与 A 等价构成双解 → C 改为 √(2gR)（典型错解：误用竖直
//   上抛/2 倍关系），解析同步改写
// - #614：题干只有设问没有 A~D 选项 → 按解析补齐四个选项（v 比 2:1、ω 比 8:1、a 比 16:1、T 比 1:8 中取 B 为
//   正确项，其余写反作干扰项）
// - #615：近地点 2R、远地点 4R 的椭圆半长轴只能 a=(2R+4R)/2=3R，题干 a=3R/2 自相矛盾 → 改 3R；
//   机械能 E=−GMm/(2r)：E₁=−GMm/4R、E₂=−GMm/6R、E₃=−GMm/8R，负数比较得 E₁<E₂<E₃（原解析写反）；
//   W=E₂−E₁=GMm/12R=mgR/12 不变（速度法交叉验证：½m(2gR/3−gR/2)=mgR/12 ✓）
// - #655：动量守恒 1×6=1×2+2v₂ → v₂=2 m/s（原解析解成 4，6=2+8 不成立）；碰后 v₁=v₂=2 共速 → 完全非弹性碰撞；
//   动能 18 J → ½·1·4+½·2·4=6 J，损失 12 J 不增加（原「弹性碰撞/18 J」全错）
// 防护同 fix-accept20.mjs：动态构建 SET，仅更新 patch 字段；stem 走原文精确替换
// 用法：node scripts/fix-accept20-selfcheck.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #609：ρ 与 M 数值修正 ----------
const q609Answer = `（1）$\\rho\\approx 3.9\\times10^{3}\\,\\mathrm{kg/m^{3}}$；（2）$M\\approx 8.1\\times10^{22}\\,\\mathrm{kg}$`
const q609Solution = `（1）卫星在天体表面附近运动，轨道半径 $r\\approx R$。万有引力提供向心力：
$$G\\frac{Mm}{R^{2}}=m\\frac{4\\pi^{2}}{T^{2}}R$$
得
$$M=\\frac{4\\pi^{2}R^{3}}{GT^{2}}$$
天体体积 $V=\\dfrac{4}{3}\\pi R^{3}$，故
$$\\rho=\\frac{M}{V}=\\frac{3\\pi}{GT^{2}}$$
代入数值（$\\pi\\approx3.14$）：
$$\\rho=\\frac{3\\times3.14}{6.67\\times10^{-11}\\times(6.0\\times10^{3})^{2}}\\,\\mathrm{kg/m^{3}}=\\frac{9.42}{2.4012\\times10^{-3}}\\,\\mathrm{kg/m^{3}}\\approx 3.9\\times10^{3}\\,\\mathrm{kg/m^{3}}$$
（注意：这里是 $\\pi\\approx3.14$，不要把题给的 $\\pi^{2}\\approx9.87$ 误代入 $\\pi$ 的位置。）
（2）由 $M=\\dfrac{4\\pi^{2}R^{3}}{GT^{2}}$ 代入数值（此处用 $\\pi^{2}\\approx9.87$）：
$$M=\\frac{4\\times9.87\\times(1.7\\times10^{6})^{3}}{6.67\\times10^{-11}\\times(6.0\\times10^{3})^{2}}\\,\\mathrm{kg}=\\frac{39.48\\times4.913\\times10^{18}}{2.4012\\times10^{-3}}\\,\\mathrm{kg}\\approx 8.1\\times10^{22}\\,\\mathrm{kg}$$
交叉验证：$M=\\rho V=3.9\\times10^{3}\\times\\dfrac{4}{3}\\times3.14\\times(1.7\\times10^{6})^{3}\\approx3.9\\times10^{3}\\times2.06\\times10^{19}\\approx8.0\\times10^{22}\\,\\mathrm{kg}$，两法一致。`

// ---------- #610：选项 C 改为 √(2gR) 消除与 A 的等价双解 ----------
const q610StemNew = `已知地球半径为 $R$，地球表面的重力加速度为 $g$，万有引力常量为 $G$。若把地球视为质量分布均匀的球体，忽略地球自转的影响，则地球的第一宇宙速度大小为（　　） A. $\\sqrt{gR}$ B. $\\sqrt{\\dfrac{g}{R}}$ C. $\\sqrt{2gR}$ D. $\\sqrt{\\dfrac{R}{g}}$`
const q610Solution = `第一宇宙速度是近地卫星（轨道半径近似等于地球半径 $R$）绕地球做匀速圆周运动的线速度。由万有引力提供向心力得 $G\\dfrac{Mm}{R^{2}}=m\\dfrac{v^{2}}{R}$，解得 $v=\\sqrt{\\dfrac{GM}{R}}$。又在地球表面附近有 $G\\dfrac{Mm}{R^{2}}=mg$，即 $GM=gR^{2}$，代入得 $v=\\sqrt{gR}$，故 A 正确。
B、D 中 $\\sqrt{g/R}$、$\\sqrt{R/g}$ 的量纲均不是速度的量纲，排除；C 的 $\\sqrt{2gR}$ 是把「第一宇宙速度等于 $\\sqrt{gR}$」误乘 $\\sqrt{2}$ 的典型错解（$\\sqrt{2}$ 因子出现在逃逸速度 $v=\\sqrt{2gR}$ 中，不是第一宇宙速度），排除。`

// ---------- #614：补齐缺失的 A~D 选项（解析口径：v 比 2:1、ω 比 8:1、a 比 16:1、T 比 1:8） ----------
const q614StemOld = `下列说法正确的是（　　）`
const q614StemNew = `下列说法正确的是（　　）
A. 甲、乙两卫星的线速度大小之比为 $1:2$
B. 甲、乙两卫星的角速度大小之比为 $8:1$
C. 甲、乙两卫星的向心加速度大小之比为 $1:16$
D. 甲、乙两卫星的运动周期之比为 $8:1$`

// ---------- #615：半长轴 3R/2→3R + 机械能排序修正 ----------
const q615StemOld = `$a=\\dfrac{3R}{2}$`
const q615StemNew = `$a=3R$`
const q615Answer = `（1）$v_1=\\sqrt{\\dfrac{gR}{2}}$，$T_1=4\\pi\\sqrt{\\dfrac{2R}{g}}$；（2）$E_1<E_2<E_3$，$W=\\dfrac{mgR}{12}$；（3）$v_3=\\dfrac{\\sqrt{gR}}{2}$`
const q615Solution = `（1）卫星在轨道Ⅰ上做匀速圆周运动，万有引力提供向心力：$G\\dfrac{Mm}{r_1^2}=m\\dfrac{v_1^2}{r_1}$，又在地表 $G\\dfrac{Mm}{R^2}=mg$，即 $GM=gR^2$。取 $r_1=2R$，得 $v_1=\\sqrt{\\dfrac{GM}{r_1}}=\\sqrt{\\dfrac{gR^2}{2R}}=\\sqrt{\\dfrac{gR}{2}}$。周期 $T_1=\\dfrac{2\\pi r_1}{v_1}=2\\pi\\cdot 2R\\cdot\\sqrt{\\dfrac{2}{gR}}=4\\pi\\sqrt{\\dfrac{2R}{g}}$。
（2）圆轨道上卫星的机械能为 $E=-\\dfrac{GMm}{2r}$。轨道Ⅰ（$r_1=2R$）：$E_1=-\\dfrac{GMm}{4R}$；轨道Ⅲ（$r_2=4R$）：$E_3=-\\dfrac{GMm}{8R}$；椭圆轨道Ⅱ的半长轴 $a=\\dfrac{r_1+r_2}{2}=\\dfrac{2R+4R}{2}=3R$（题给远地点 $4R$、近地点 $2R$，半长轴只能是二者平均，$a=3R$），机械能 $E_2=-\\dfrac{GMm}{2a}=-\\dfrac{GMm}{6R}$。由于 $\\dfrac{GMm}{4R}>\\dfrac{GMm}{6R}>\\dfrac{GMm}{8R}$，取负号后得 $E_1<E_2<E_3$，即轨道越高机械能越大。发动机做功等于机械能增量：$W=E_2-E_1=-\\dfrac{GMm}{6R}+\\dfrac{GMm}{4R}=\\dfrac{GMm}{12R}=\\dfrac{mgR}{12}$，$W>0$，发动机做正功。
交叉验证（速度法）：近地点速度 $v_2=\\sqrt{GM\\left(\\dfrac{2}{r_1}-\\dfrac{1}{a}\\right)}=\\sqrt{gR^2\\left(\\dfrac{1}{R}-\\dfrac{1}{3R}\\right)}=\\sqrt{\\dfrac{2gR}{3}}$，$W=\\dfrac{1}{2}m(v_2^2-v_1^2)=\\dfrac{1}{2}m\\left(\\dfrac{2gR}{3}-\\dfrac{gR}{2}\\right)=\\dfrac{1}{2}\\cdot\\dfrac{mgR}{6}=\\dfrac{mgR}{12}$，一致。
（3）轨道Ⅲ上万有引力提供向心力：$G\\dfrac{Mm}{r_2^2}=m\\dfrac{v_3^2}{r_2}$，得 $v_3=\\sqrt{\\dfrac{GM}{r_2}}=\\sqrt{\\dfrac{gR^2}{4R}}=\\sqrt{\\dfrac{gR}{4}}=\\dfrac{\\sqrt{gR}}{2}$。`

// ---------- #655：v₂=2 m/s、完全非弹性碰撞、动能 18→6 J ----------
const q655Answer = `(1) $v_2=2\\,\\text{m/s}$，方向向右；(2) 该碰撞为完全非弹性碰撞；(3) 碰前总动能 $18\\,\\text{J}$，碰后总动能 $6\\,\\text{J}$，动能减少 $12\\,\\text{J}$、没有增加，验证成立。`
const q655Solution = `(1) 取向右为正方向。碰撞过程内力远大于外力（水平面光滑），系统动量守恒：$m_1v_0=m_1v_1+m_2v_2$，代入数据 $1\\times6=1\\times2+2v_2$，解得 $v_2=2\\,\\text{m/s}$，方向向右。
(2) 碰后 $v_1=v_2=2\\,\\text{m/s}$，两物块速度相同（碰后合为一体运动），符合完全非弹性碰撞的特征。再看能量：碰前系统总动能 $E_{k0}=\\frac12m_1v_0^2=\\frac12\\times1\\times6^2=18\\,\\text{J}$；碰后系统总动能 $E_{k1}=\\frac12m_1v_1^2+\\frac12m_2v_2^2=\\frac12\\times1\\times2^2+\\frac12\\times2\\times2^2=2+4=6\\,\\text{J}$。动能损失 $18-6=12\\,\\text{J}$（转化为形变与内能），且碰后共速，故该碰撞为完全非弹性碰撞。
(3) 由(2)知 $E_{k1}=6\\,\\text{J}<E_{k0}=18\\,\\text{J}$，碰撞后系统总动能没有增加（减少的动能转化为内能），满足能量关系，验证成立。`

// ---------- 统一防护：动态构建 SET、仅更新 patch 字段；stem 走原文精确替换 ----------
const updates = [
  [609, { answer: q609Answer, solution: q609Solution }],
  [610, { solution: q610Solution, stemReplace: { from: `C. $\\sqrt{\\dfrac{GM}{R}}$`, to: `C. $\\sqrt{2gR}$` } }],
  [614, { stemReplace: { from: q614StemOld, to: q614StemNew } }],
  [615, { stemReplace: { from: q615StemOld, to: q615StemNew }, answer: q615Answer, solution: q615Solution }],
  [655, { answer: q655Answer, solution: q655Solution }],
]

const get = db.prepare('SELECT id, stem, answer, solution FROM questions WHERE id = ?')

for (const [id, patch] of updates) {
  const cur = get.get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  const params = { id: cur.id }
  if (patch.stem && !patch.stemReplace) params.stem = patch.stem
  if (patch.stemReplace) {
    if (!cur.stem.includes(patch.stemReplace.from)) { console.log(`题 ${id} 题干未找到待替换片段，跳过 stem：${JSON.stringify(patch.stemReplace.from.slice(0, 60))}`); continue }
    params.stem = cur.stem.replace(patch.stemReplace.from, patch.stemReplace.to)
  }
  if (patch.answer !== undefined) params.answer = patch.answer
  if (patch.solution !== undefined) params.solution = patch.solution
  const setCols = Object.keys(params).filter((k) => k !== 'id').map((c) => `${c} = @${c}`).join(', ')
  if (!setCols) { console.log(`题 ${id} 无可更新字段，跳过`); continue }
  console.log(`题 ${id}：更新 ${Object.keys(params).filter((k) => k !== 'id').join(', ')}${DRY ? ' [dry-run]' : ''}`)
  if (!DRY) db.prepare(`UPDATE questions SET ${setCols} WHERE id = @id`).run(params)
}
console.log(`完成${DRY ? ' [dry-run]' : ''}`)
