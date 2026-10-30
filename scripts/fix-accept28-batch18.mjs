// 一次性脚本：第十八批补题（id 867~906）独立重解自验发现的缺陷修正（验收 #28 指令①前置 + ②）
// 【内容缺陷 13 处】
// - #871 (3) 题设 U=25qB²d²/16m 使 r=1.77d>d，粒子必从 PQ 射出，与「从 MN 射出」矛盾，解析自认
//   「无解」且含半无限磁场自协商残稿、answer 与解析互相矛盾 → (3) 改 U=U₀/4（r=d/2 半圆返回 MN），
//   距离 d、时间 πm/(qB)，删除残稿
// - #872 情形（1）几何不成立（从边界上 P 点以 30° 斜射入，圆必再交边界，「恰好不射出」不可能），
//   解析为多轮试错残稿、answer 与推导矛盾 → 整题重写为弦切角定圆心角 + 场内 A 点临界相切 + 变速判据三问
// - #873 Ekm 算术错：q²B²R²/2m=(1.6e-19)²×0.25/3.2e-27=2.0e-12 J，原写 3.2e-12；连带 n=1000→改为
//   U=2.5e4 V 使 n=500（偶数）、t=nT/2≈1.6e-5 s；删「偶数次加速回到出发侧」臆断
// - #876 欠定：仅给 i 与 R 无法同时定 B、v（解析自认「取 v=1 m/s」）→ 题干补 B=1 T，删残稿句
// - #880 单选无正确选项（A/B/C/D 均错，answer 写「无正确选项」）→ B 项改 0.1 A 为正确项
// - #883 「电视信号常利用地波」物理错误（电视用直线传播空间波）+ 2 处 `________{\text{传播}}` 裸 LaTeX
//   → 情境改「中波广播用地波；电视、雷达和手机用空间波」，空位改纯文本下划线
// - #885 题干数据表用 \begin{array} 表格环境（前端不渲染、字面显示）→ 改文字逐项列出
// - #889 纸带数据不物理：OA=12.40 cm（0.1 s 内自由落体仅 4.9 cm）且 O 非释放点却按 v_O=0 算 ΔEk，
//   ΔEk≪ΔEp 与「略大于」矛盾 → 重设 OA=4.80/AB=14.60/BC=24.20 cm（含微小阻力损耗，自洽），
//   v_B=1.94、ΔEp=1.90m、ΔEk=1.88m，ΔEp 略大于 ΔEk 成立
// - #891 v₀=6>v带=4 时物块对传送带的摩擦力向前，电动机「多消耗电能 8 J」不成立（实为少耗/回收），
//   能量收支不平衡（W_M+ΔEk=−2≠Q=+2）→ 改 v₀=2 m/s（<v带），重解 t=2.25 s，多耗电能 8 J 严格成立
//   （ΔEk=6 J+Q=2 J=8 J 收支平衡）
// - #895 F=20 N 时 F−mgsinθ−μmgcosθ=20−12−8=0，a=0 与「由静止向上加速」矛盾 → F 改 24 N（a=2 不变）
// - #899 l=700 mm 时 λ=3.14e-7 m 为紫外段，与「红色滤光片」矛盾 → l 改 350 mm，λ≈6.3e-7 m（红光）
// - #904 3→4 等温压缩的功需 ln（超纲），解析误按等压公式算 66 J 且与 answer 一致地错 → (2)(3) 改为
//   面积含义与吸放热定性说明，不要求计算 3→4 热量
// - #906 3 处 \underline{①②③} 裸 LaTeX → 纯文本下划线空位
// 【配图重画 8 幅】#868/#870/#871/#876（「匀强场区+q」模板残留）/#885（含无关 h=0.8m 标注）/
// #886（传动题配定滑轮挂钩模板，场景失配）/#899（双缝干涉题配力学轨道模板，场景失配）
import Database from 'better-sqlite3'

const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')
const changed = []
function upd(id, field, expect, next, tag) {
  const row = db.prepare(`SELECT ${field} AS v FROM questions WHERE id=${id}`).get()
  if (!row) throw new Error(`#${id} 不存在`)
  const cur = String(row.v)
  // 幂等：预期片段已不在（且替换目标已在）则视为已完成，跳过
  if (!cur.includes(expect)) { changed.push(`${tag}（已应用，跳过）`); return }
  const fixed = typeof next === 'function' ? next(cur) : cur.replace(expect, next)
  if (fixed === cur) throw new Error(`#${id}.${field} 替换无效`)
  db.prepare(`UPDATE questions SET ${field}=? WHERE id=${id}`).run(fixed)
  changed.push(tag)
}

// ---------- #871 (3) 重构 ----------
upd(871, 'stem',
  '(3) 当加速电压 $U=\\dfrac{25qB^2d^2}{16m}$ 时，求粒子从边界 $MN$ 射出时的位置与入射点间的距离以及粒子在磁场中运动的时间。',
  '(3) 当加速电压 $U=\\dfrac{U_0}{4}$ 时，求粒子从边界 $MN$ 射出时的位置与入射点间的距离以及粒子在磁场中运动的时间。',
  '#871 stem (3) 重设')
db.prepare('UPDATE questions SET answer=? WHERE id=871').run(
  '(1) $v=\\sqrt{\\dfrac{2qU}{m}}$；(2) $U_0=\\dfrac{qB^2d^2}{2m}$；(3) 出射点与入射点间的距离为 $d$，运动时间为 $\\dfrac{\\pi m}{qB}$。')
upd(871, 'solution',
  '(3) 当 $U=\\dfrac{25qB^2d^2}{16m}$',
  (s) => {
    const i = s.indexOf('(3) 当 $U=')
    return s.slice(0, i) +
      `(3) 由 (2) 知临界电压 $U_0$ 对应 $r=d$。当 $U=\\dfrac{U_0}{4}$ 时，由 $qU=\\dfrac12mv^2$ 得 $v=\\dfrac{1}{2}\\sqrt{\\dfrac{2qU_0}{m}}$，轨道半径
$$r=\\dfrac{mv}{qB}=\\dfrac{1}{2}\\cdot\\dfrac{m}{qB}\\sqrt{\\dfrac{2qU_0}{m}}=\\dfrac{d}{2}<d$$
粒子垂直边界 $MN$ 射入，在磁场中做匀速圆周运动，转过半个圆周后仍垂直于 $MN$，从边界 $MN$ 射出。出射点与入射点间的距离
$$x=2r=2\\times\\dfrac{d}{2}=d$$
在磁场中运动的时间为半个周期
$$t=\\dfrac{T}{2}=\\dfrac{\\pi m}{qB}.$$
轨迹与 $PQ$ 不相交（$r=\\dfrac d2<d$），粒子不会从 $PQ$ 射出，与题设一致。`
  },
  '#871 solution (3) 重写')
{
  const row = db.prepare('SELECT solution AS v FROM questions WHERE id=871').get()
  if (String(row.v).includes('注：若将磁场视为')) {
    const s = String(row.v)
    db.prepare('UPDATE questions SET solution=? WHERE id=871').run(s.slice(0, s.indexOf('注：若将磁场视为')) + s.slice(s.indexOf('【易错】')))
    changed.push('#871 solution 删残稿')
  } else changed.push('#871 solution 残稿已随 (3) 重写移除')
}

// ---------- #872 整题重写 ----------
db.prepare('UPDATE questions SET stem=?, answer=?, solution=?, pitfall=? WHERE id=872').run(
  `真空中有一无限长直边界 $MN$，右侧分布着匀强磁场，磁感应强度大小为 $B$，方向垂直纸面向里。一质量为 $m$、电荷量为 $q$ 的带正电粒子，重力不计。
（1）粒子从边界上的 $P$ 点以速度 $v_0$ 射入磁场，速度方向与边界 $MN$ 的夹角为 $\\theta=30^\\circ$（斜向磁场一侧）。求粒子再次回到边界射出时，出射位置与 $P$ 点的距离 $x$，以及在磁场中运动的时间 $t$；
（2）粒子改为从磁场内与边界相距 $d$ 的 $A$ 点以速度 $v$ 射出，速度方向与边界 $MN$ 成 $60^\\circ$ 角（斜向边界一侧）。要使粒子恰好不从边界 $MN$ 射出，求轨道半径 $r$ 与速度大小 $v$；
（3）在（2）情形中，若粒子速度大小减为 $\\dfrac{v}{2}$（方向不变），通过计算判断粒子能否到达边界 $MN$；若不能，求粒子运动过程中离边界的最小距离。`,
  `（1）$x=\\dfrac{mv_0}{qB}$，$t=\\dfrac{\\pi m}{3qB}$；（2）$r=2d$，$v=\\dfrac{2qBd}{m}$；（3）不能到达边界；最小距离为 $\\dfrac{d}{2}$。`,
  `（1）粒子在磁场中做匀速圆周运动，洛伦兹力提供向心力：$qv_0B=\\dfrac{mv_0^2}{R}$，得 $R=\\dfrac{mv_0}{qB}$。
圆心在入射点速度垂线上：过 $P$ 作 $v_0$ 的垂线，圆心 $O_1$ 在磁场一侧，$O_1P=R$。粒子从边界射入又回到边界，弦 $PQ$（沿边界方向）与入射速度方向的夹角即弦切角 $\\theta=30^\\circ$，由弦切角定理，弦所对的圆心角
$$\\varphi=2\\theta=60^\\circ$$
由几何关系，弦长（出射点与 $P$ 的距离）
$$x=2R\\sin\\dfrac{\\varphi}{2}=2R\\sin30^\\circ=R=\\dfrac{mv_0}{qB}$$
运动时间
$$t=\\dfrac{\\varphi}{2\\pi}T=\\dfrac{60^\\circ}{360^\\circ}\\times\\dfrac{2\\pi m}{qB}=\\dfrac{\\pi m}{3qB}.$$
（2）过 $A$ 作速度的垂线定圆心 $O_2$：由左手定则（正电荷、磁场垂直纸面向里），圆心在 $A$ 的斜下方一侧，$O_2A=r$。$v$ 与边界成 $60^\circ$，故 $O_2A$（垂直于 $v$）与边界成 $30^\circ$，圆心在 $A$ 的远离边界一侧，圆心到边界的距离比 $A$ 到边界的距离 $d$ 更远，为
$$d+r\sin30^\circ$$
轨迹与边界相切是「恰好不射出」的临界条件：圆心到边界的距离等于半径 $r$，即
$$d+r\\sin30^\\circ=r$$
解得
$$r=\\dfrac{d}{1-\\sin30^\\circ}=2d$$
由 $r=\\dfrac{mv}{qB}$ 得
$$v=\\dfrac{qBr}{m}=\\dfrac{2qBd}{m}.$$
（3）速度减半，轨道半径 $r'=\\dfrac{r}{2}=d$。圆心仍在过 $A$ 且垂直于速度的直线上，$O_3A=r'=d$，圆心到边界的距离 $=d+r'\\sin30^\\circ=d+\\dfrac{d}{2}=\\dfrac{3d}{2}$。
圆心到边界的距离 $\\dfrac{3d}{2}>r‘=d$，轨迹圆与边界不相交，粒子不能到达边界 $MN$。
粒子离边界的最小距离即轨迹最低点到边界的距离：
$$d_{\\min}=\\dfrac{3d}{2}-r\'=\\dfrac{3d}{2}-d=\\dfrac{d}{2}.$$`,
  `易错点：①「恰好不从边界射出」的临界条件是轨迹与边界相切（圆心到边界距离等于半径），不是圆心在边界上；②定圆心必须用「入射点速度垂线」与「切点处速度垂线（或弦的中垂线）」交点，不能把速度垂线与边界的交点当圆心；③弦切角等于所对圆心角的一半，弦长用 $x=2R\\sin\\dfrac{\\varphi}{2}$ 计算；④速度变化只改变半径，不改变入射角，判断能否到达边界应比较「圆心到边界的距离」与「半径」。`)
changed.push('#872 整题重写（弦切角+临界相切+变速判据）')

// ---------- #873 Ekm 算术错 + U 重设 ----------
upd(873, 'stem', '电压为 $U=2.0\\times10^{4}\\ \\text{V}$ 的高频交变电源', '电压为 $U=2.5\\times10^{4}\\ \\text{V}$ 的高频交变电源', '#873 stem U=2.5e4 V')
db.prepare('UPDATE questions SET answer=? WHERE id=873').run(
  '（1）$T\\approx6.3\\times10^{-8}\\ \\text{s}$；（2）$E_{\\text{km}}=2.0\\times10^{-12}\\ \\text{J}$；（3）$n=500$；（4）$t\\approx1.6\\times10^{-5}\\ \\text{s}$')
upd(873, 'solution',
  '$$E_{\\text{km}}=\\frac{1}{2}mv_{\\text{m}}^2=\\frac{q^2B^2R^2}{2m}=\\frac{(1.6\\times10^{-19})^2\\times1.0^2\\times0.50^2}{2\\times1.6\\times10^{-27}}\\ \\text{J}=3.2\\times10^{-12}\\ \\text{J}.$$',
  '$$E_{\\text{km}}=\\frac{1}{2}mv_{\\text{m}}^2=\\frac{q^2B^2R^2}{2m}=\\frac{(1.6\\times10^{-19})^2\\times1.0^2\\times0.50^2}{2\\times1.6\\times10^{-27}}\\ \\text{J}=2.0\\times10^{-12}\\ \\text{J}.$$',
  '#873 Ekm=2.0e-12 J')
upd(873, 'solution', '$$n=\\frac{E_{\\text{km}}}{qU}=\\frac{3.2\\times10^{-12}}{1.6\\times10^{-19}\\times2.0\\times10^{4}}=1000.$$\n$n=1000$ 为偶数，质子从中心出发第一次过狭缝加速后进入一个 D 形盒，此后每半圈过狭缝加速一次，经偶数次加速后质子回到出发侧 D 形盒，轨道半径恰达到 $R$，与“从靠近中心处由静止开始”的过程相符。',
  '$$n=\\frac{E_{\\text{km}}}{qU}=\\frac{2.0\\times10^{-12}}{1.6\\times10^{-19}\\times2.5\\times10^{4}}=500.$$\n经 500 次加速后质子动能达最大值，此时轨道半径恰达到 $R$，与“从靠近中心处由静止开始”的过程相符。',
  '#873 n=500')
upd(873, 'solution', '$$t=\\frac{nT}{2}=\\frac{1000\\times6.3\\times10^{-8}}{2}\\ \\text{s}\\approx3.1\\times10^{-5}\\ \\text{s}.$$',
  '$$t=\\frac{nT}{2}=\\frac{500\\times6.3\\times10^{-8}}{2}\\ \\text{s}\\approx1.6\\times10^{-5}\\ \\text{s}.$$',
  '#873 t≈1.6e-5 s')
// #873 易错点无 n=1000 数值残留，无需修改

// ---------- #876 欠定 → 题干补 B=1 T ----------
upd(876, 'stem', '磁感应强度 $B$ 恒定。', '磁感应强度 $B=1\\ \\text{T}$ 恒定。', '#876 stem 补 B=1 T')
upd(876, 'answer', '(1) $L=0.2\\ \\text{m}$，$v=1\\ \\text{m/s}$；(2) $B=1\\ \\text{T}$，$d=0.5\\ \\text{m}$',
  '(1) $L=0.2\\ \\text{m}$，$v=1\\ \\text{m/s}$；(2) $d=0.5\\ \\text{m}$', '#876 answer (2) 调整')
upd(876, 'solution',
  '进入磁场阶段感应电动势 $E=BLv$，感应电流 $i_1=\\dfrac{BLv}{R}=0.4\\ \\text{A}$，即 $BLv=0.4\\times0.5=0.2\\ \\text{V}$。将 $L=0.2v$ 代入得 $B\\cdot0.2v\\cdot v=0.2$，即 $Bv^2=1$。又由 $d-L=0.3v$ 与 $L=0.2v$ 得 $d=0.5v$。仅由电流大小无法分别确定 $B$ 与 $v$，需结合线框边长与速度关系；由 $L=0.2v$ 及 $BLv=0.2$ 可得 $B=\\dfrac{1}{v^2}$。取 $v=1\\ \\text{m/s}$，则 $L=0.2\\ \\text{m}$，$B=1\\ \\text{T}$，$d=0.5\\ \\text{m}$，与各段时间及电流大小均自洽。故 $L=0.2\\ \\text{m}$，$v=1\\ \\text{m/s}$。',
  `进入磁场阶段感应电动势 $E=BLv$，感应电流 $i_1=\\dfrac{BLv}{R}=0.4\\ \\text{A}$，即 $BLv=0.4\\times0.5=0.2\\ \\text{V}$。代入 $B=1\\ \\text{T}$ 得 $Lv=0.2$；又 $L=0.2v$，两式联立得 $0.2v^2=0.2$，即
$$v=1\\ \\text{m/s},\\quad L=0.2\\ \\text{m}$$
再由 $d-L=0.3v=0.3\\ \\text{m}$ 得 $d=0.5\\ \\text{m}$，与各段时间及电流大小均自洽。`,
  '#876 solution (1) 重写（消欠定）')
upd(876, 'solution', '(2) 由 (1) 得 $B=1\\ \\text{T}$，$d=0.5\\ \\text{m}$。', '(2) 由 (1) 得 $d=0.5\\ \\text{m}$（$B=1\\ \\text{T}$ 已在题干给出）。', '#876 solution (2) 调整')

// ---------- #880 无正确选项 → B 改 0.1 A ----------
upd(880, 'stem', 'B. 原线圈电流表的示数为 $1\\,\\text{A}$', 'B. 原线圈电流表的示数为 $0.1\\,\\text{A}$', '#880 B 项改 0.1 A')
db.prepare('UPDATE questions SET answer=? WHERE id=880').run('B')
upd(880, 'solution', '原线圈电流表示数为 $0.1\\,\\text{A}$，B 错误。', '原线圈电流表示数为 $0.1\\,\\text{A}$，B 正确。', '#880 解析 B 判定')
upd(880, 'solution', '综上，四个选项均错误，本题无正确选项。', '综上，正确选项为 B。', '#880 综上句')

// ---------- #883 电视→空间波 + 裸 LaTeX ----------
upd(883, 'stem', '其中，广播和电视信号常利用________{\\text{传播}}，而雷达和手机通信则主要利用________{\\text{传播}}。',
  '其中，中波广播信号常利用________传播，而电视、雷达和手机通信则主要利用________传播。', '#883 电视改空间波+去裸 LaTeX')
upd(883, 'solution', '广播和电视信号波长较长，常利用地波传播；雷达和手机通信频率较高，主要利用空间波（直线传播）传播。',
  '中波广播波长较长，沿地表绕射能力较强，常利用地波传播；电视、雷达和手机通信频率较高，不能靠电离层反射，主要利用沿直线传播的空间波。', '#883 解析同步')

// ---------- #885 表格环境改文字 ----------
upd(885, 'stem', `\\begin{array}{c|cccc}\nx/\\text{m} & 0.10 & 0.20 & 0.30 & 0.40 \\ \\hline\ny/\\text{m} & 0.05 & 0.20 & 0.45 & 0.80 \\end{array}`,
  '$x=0.10\\ \\text{m}$ 时 $y=0.05\\ \\text{m}$；$x=0.20\\ \\text{m}$ 时 $y=0.20\\ \\text{m}$；$x=0.30\\ \\text{m}$ 时 $y=0.45\\ \\text{m}$；$x=0.40\\ \\text{m}$ 时 $y=0.80\\ \\text{m}$。', '#885 表格改文字')

// ---------- #889 纸带数据重设 ----------
upd(889, 'stem', '测得 $OA=12.40\\,\\text{cm}$，$AB=7.80\\,\\text{cm}$，$BC=8.20\\,\\text{cm}$。',
  '测得 $OA=4.80\\,\\text{cm}$，$AB=14.60\\,\\text{cm}$，$BC=24.20\\,\\text{cm}$。', '#889 纸带数据')
upd(889, 'answer', '（1）C；（2）$0.800$；（3）$\\Delta E_p=1.98m\\,\\text{J}$，$\\Delta E_k=0.320m\\,\\text{J}$',
  '（1）C；（2）$1.94$；（3）$\\Delta E_p=1.90m\\,\\text{J}$，$\\Delta E_k=1.88m\\,\\text{J}$', '#889 answer')
upd(889, 'solution', '$v_B=\\dfrac{AB+BC}{2T}=\\dfrac{0.0780+0.0820}{2\\times 0.10}\\,\\text{m/s}=0.800\\,\\text{m/s}$。',
  '$v_B=\\dfrac{AB+BC}{2T}=\\dfrac{0.1460+0.2420}{2\\times 0.10}\\,\\text{m/s}=1.94\\,\\text{m/s}$。', '#889 v_B')
upd(889, 'solution', '$h_{OB}=OA+AB=0.1240+0.0780\\,\\text{m}=0.2020\\,\\text{m}$，\n$\\Delta E_p=mgh_{OB}=m\\times 9.80\\times 0.2020\\,\\text{J}\\approx 1.98m\\,\\text{J}$。\n动能的增加量 $\\Delta E_k=\\frac{1}{2}mv_B^2=\\frac{1}{2}m\\times(0.800)^2\\,\\text{J}=0.320m\\,\\text{J}$。',
  '$h_{OB}=OA+AB=0.0480+0.1460\\,\\text{m}=0.1940\\,\\text{m}$，\n$\\Delta E_p=mgh_{OB}=m\\times 9.80\\times 0.1940\\,\\text{J}\\approx 1.90m\\,\\text{J}$。\n动能的增加量 $\\Delta E_k=\\frac{1}{2}mv_B^2=\\frac{1}{2}m\\times(1.94)^2\\,\\text{J}\\approx 1.88m\\,\\text{J}$。', '#889 ΔEp/ΔEk')

// ---------- #891 v₀=6→2 m/s ----------
upd(891, 'stem', '以 $v_0=6\\,\\mathrm{m/s}$ 的初速度从 $A$ 点滑上传送带', '以 $v_0=2\\,\\mathrm{m/s}$ 的初速度从 $A$ 点滑上传送带', '#891 v₀=2 m/s')
upd(891, 'answer', '(1) $t=1.25\\,\\mathrm{s}$，$\\Delta E=8\\,\\mathrm{J}$', '(1) $t=2.25\\,\\mathrm{s}$，$\\Delta E=8\\,\\mathrm{J}$', '#891 answer t')
upd(891, 'solution',
  '物块滑上传送带时 $v_0=6\\,\\mathrm{m/s}>v=4\\,\\mathrm{m/s}$，相对传送带向前滑动，所受滑动摩擦力方向向左，加速度大小 $a=\\mu g=2\\,\\mathrm{m/s^2}$，物块做匀减速运动。设经时间 $t_1$ 速度减为 $v=4\\,\\mathrm{m/s}$，则 $t_1=\\dfrac{v_0-v}{a}=1\\,\\mathrm{s}$，此过程物块位移 $x_1=\\dfrac{v_0+v}{2}t_1=5\\,\\mathrm{m}<L=6\\,\\mathrm{m}$，故物块与传送带共速后相对静止，一起匀速运动。匀速阶段位移 $x_2=L-x_1=1\\,\\mathrm{m}$，时间 $t_2=\\dfrac{x_2}{v}=0.25\\,\\mathrm{s}$。总时间 $t=t_1+t_2=1.25\\,\\mathrm{s}$。\n传送带因传送物块多消耗的电能等于传送带克服摩擦力做的功。相对滑动阶段传送带位移 $s_{\\text{带}}=vt_1=4\\,\\mathrm{m}$，摩擦力 $f=\\mu mg=2\\,\\mathrm{N}$，传送带克服摩擦力做功 $W=fs_{\\text{带}}=8\\,\\mathrm{J}$；共速后无相对滑动，无摩擦生热。故 $\\Delta E=8\\,\\mathrm{J}$。',
  '物块滑上传送带时 $v_0=2\\,\\mathrm{m/s}<v=4\\,\\mathrm{m/s}$，相对传送带向后滑动，所受滑动摩擦力方向向右，加速度大小 $a=\\mu g=2\\,\\mathrm{m/s^2}$，物块做匀加速运动。设经时间 $t_1$ 速度增至 $v=4\\,\\mathrm{m/s}$，则 $t_1=\\dfrac{v-v_0}{a}=1\\,\\mathrm{s}$，此过程物块位移 $x_1=\\dfrac{v_0+v}{2}t_1=3\\,\\mathrm{m}<L=6\\,\\mathrm{m}$，故物块与传送带共速后相对静止，一起匀速运动。匀速阶段位移 $x_2=L-x_1=3\\,\\mathrm{m}$，时间 $t_2=\\dfrac{x_2}{v}=0.75\\,\\mathrm{s}$。总时间 $t=t_1+t_2=2.25\\,\\mathrm{s}$。\n传送带因传送物块多消耗的电能等于传送带克服摩擦力做的功。相对滑动阶段传送带位移 $s_{\\text{带}}=vt_1=4\\,\\mathrm{m}$，物块对传送带的摩擦力 $f=\\mu mg=2\\,\\mathrm{N}$ 方向向左（阻力），传送带克服摩擦力做功 $W=fs_{\\text{带}}=8\\,\\mathrm{J}$。校验：物块动能增加 $\\Delta E_k=\\dfrac12 m v^2-\\dfrac12 m v_0^2=8-2=6\\,\\mathrm{J}$，摩擦生热 $Q=f\\Delta s_{\\text{相对}}=2\\times(4-3)=2\\,\\mathrm{J}$，$6+2=8\\,\\mathrm{J}$，收支平衡；共速后无相对滑动，不再生热。故 $\\Delta E=8\\,\\mathrm{J}$。',
  '#891 solution (1) 重写')
upd(891, 'pitfall', '①第(1)问须先判断物块是否在传送带上一直减速，本题物块在到达 $B$ 前已与传送带共速，共速后无摩擦力、不再生热',
  '①第(1)问须先判断物块是否在到达 $B$ 前与传送带共速，本题物块先加速后共速匀速，共速后无摩擦力、不再生热', '#891 易错①')

// ---------- #895 F=20→24 N ----------
upd(895, 'stem', '沿斜面向上的恒定拉力 $F=20\\,\\text{N}$ 拉滑块', '沿斜面向上的恒定拉力 $F=24\\,\\text{N}$ 拉滑块', '#895 F=24 N')
upd(895, 'solution', '$20-2\\times10\\times0.6-0.5\\times2\\times10\\times0.8=2a$\n即 $20-12-8=2a$，解得 $a=2\\,\\text{m/s}^2$',
  '$24-2\\times10\\times0.6-0.5\\times2\\times10\\times0.8=2a$\n即 $24-12-8=2a$，解得 $a=2\\,\\text{m/s}^2$', '#895 解析代入')

// ---------- #899 l=700→350 mm，λ 重算 ----------
upd(899, 'stem', '双缝到光屏（测量头分划板）的距离为 $l=700\\ \\text{mm}$', '双缝到光屏（测量头分划板）的距离为 $l=350\\ \\text{mm}$', '#899 l=350 mm')
upd(899, 'answer', '$\\lambda\\approx 3.14\\times10^{-7}\\ \\text{m}$', '$\\lambda\\approx 6.3\\times10^{-7}\\ \\text{m}$', '#899 λ')
upd(899, 'solution', '$$\\lambda=\\frac{\\Delta x\\cdot d}{l}=\\frac{1.100\\times10^{-3}\\times0.200\\times10^{-3}}{700\\times10^{-3}}\\ \\text{m}\\approx3.14\\times10^{-7}\\ \\text{m}.$$',
  '$$\\lambda=\\frac{\\Delta x\\cdot d}{l}=\\frac{1.100\\times10^{-3}\\times0.200\\times10^{-3}}{350\\times10^{-3}}\\ \\text{m}\\approx6.3\\times10^{-7}\\ \\text{m}.$$',
  '#899 解析 λ')

// ---------- #904 3→4 等温功超纲 → 定性 ----------
upd(904, 'stem', '(3) 分别求 2→3、3→4 两过程中气体吸收的热量 $Q$ 与内能变化 $\\Delta U$，并判断气体是吸热还是放热。',
  '(3) 求 2→3 过程气体内能的变化 $\\Delta U$ 与吸收的热量 $Q$；说明 3→4 过程中气体内能的变化情况，并判断气体是吸热还是放热（3→4 的热量不要求计算）。', '#904 stem (3) 重设')
upd(904, 'answer',
  '(2) 1→2 为等压膨胀（水平线），2→3 为等压膨胀（水平线），3→4 为等温压缩（双曲线）；2→3 段图线下方面积表示气体对外做功 $W_{23}=44\\ \\text{J}$，3→4 段图线下方面积表示外界对气体做功 $W_{34}=66\\ \\text{J}$。(3) 2→3：$\\Delta U_{23}=300\\ \\text{J}$，$Q_{23}=344\\ \\text{J}$，气体吸热；3→4：$\\Delta U_{34}=0$，$Q_{34}=-66\\ \\text{J}$，气体放热 $66\\ \\text{J}$。',
  '(2) 1→2、2→3 均为等压膨胀（$p$-$V$ 图上为同一水平线上的两段），3→4 为等温压缩（双曲线）；2→3 段图线下方面积表示气体对外做的功（$W_{23}=44\\ \\text{J}$），3→4 段图线下方面积表示外界对气体做的功。(3) 2→3：$\\Delta U_{23}=300\\ \\text{J}$，$Q_{23}=344\\ \\text{J}$，气体吸热；3→4：$\\Delta U_{34}=0$，外界对气体做功，气体放热。', '#904 answer')
upd(904, 'solution',
  '(2) 1→2、2→3 均为等压膨胀，在 $p$-$V$ 图上为水平线；3→4 为等温压缩，图线为双曲线。2→3 段图线下方面积表示气体对外做功 $W_{23}=p_2(V_3-V_2)=1.1\\times10^{5}\\times(1.2\\times10^{-3}-8.0\\times10^{-4})=44\\ \\text{J}$；3→4 段图线下方面积表示外界对气体做功 $W_{34}=66\\ \\text{J}$。',
  '(2) 1→2、2→3 均为等压膨胀且压强相同（活塞均可自由移动），在 $p$-$V$ 图上为同一水平线上的两段；3→4 为等温压缩，图线为双曲线。2→3 段图线下方面积表示气体对外做功 $W_{23}=p_2(V_3-V_2)=1.1\\times10^{5}\\times(1.2\\times10^{-3}-8.0\\times10^{-4})=44\\ \\text{J}$；3→4 段图线下方面积表示外界对气体做的功。', '#904 解析 (2)')
upd(904, 'solution',
  '3→4 等温压缩：$\\Delta U_{34}=0$，外界对气体做功 $W_{34}=66\\ \\text{J}$，故 $Q_{34}=\\Delta U_{34}-W_{34}=-66\\ \\text{J}$，气体放热 $66\\ \\text{J}$。',
  '3→4 等温压缩：温度不变，由 $U=cT$ 知 $\\Delta U_{34}=0$；体积减小，外界对气体做功 $W_{34}>0$，由 $\\Delta U=Q+W_{34}=0$ 得 $Q_{34}=-W_{34}<0$，气体放热（放出的热量等于外界对气体做的功，数值不要求计算）。', '#904 解析 (3)')

// ---------- #906 裸 LaTeX 空位 ----------
upd(906, 'stem', '这一条件称为\\underline{①}条件。', '这一条件称为________条件。', '#906 空位①')
upd(906, 'stem', '粒子 $X$ 是\\underline{②}。', '粒子 $X$ 是________。', '#906 空位②')
upd(906, 'stem', '释放的能量约为\\underline{③}$\\,\\text{MeV}$', '释放的能量约为________$\\,\\text{MeV}$', '#906 空位③')

console.log('内容修复完成：')
for (const c of changed) console.log(' -', c)

// ---------- 配图重画（8 幅，house style：viewBox 400×240、#334155 线、#eef2ff 场区） ----------
const F = (data) => JSON.stringify({ kind: 'svg', data })
const FONT = `font-family="system-ui,'Microsoft YaHei',sans-serif"`
const T = (x, y, s, fill = '#334155', size = 13, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT}>${s}</text>`
const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/>'
const ARROW = 'marker-end="url(#ah)"'
const DEFS = '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#ef4444"/></marker></defs>'

const figures = {
  // #868 条形磁铁 N 极向下插入线圈
  868: head + DEFS +
    `<rect x="150" y="30" width="100" height="90" fill="#fda4af" stroke="#334155" stroke-width="2"/>` +
    `<rect x="150" y="120" width="100" height="90" fill="#bae6fd" stroke="#334155" stroke-width="2"/>` +
    T(200, 70, 'N', '#b91c1c', 20) + T(200, 185, 'S', '#1d4ed8', 20) +
    `<line x1="200" y1="215" x2="200" y2="236" stroke="#ef4444" stroke-width="2.5" ${ARROW} stroke-linecap="round"/>` +
    `<ellipse cx="200" cy="180" rx="70" ry="16" fill="none" stroke="#334155" stroke-width="2"/>` +
    `<ellipse cx="200" cy="180" rx="70" ry="16" fill="none" stroke="#334155" stroke-width="2" transform="translate(0,-10)"/>` +
    `<ellipse cx="200" cy="180" rx="70" ry="16" fill="none" stroke="#334155" stroke-width="2" transform="translate(0,-20)"/>` +
    T(200, 232, '闭合线圈', '#334155') +
    '</svg>',
  // #870 矩形有界磁场，粒子从左边界中点垂直射入
  870: head + DEFS +
    `<rect x="110" y="50" width="180" height="140" fill="#eef2ff" opacity="0.7" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    `<line x1="110" y1="50" x2="110" y2="190" stroke="#334155" stroke-width="2"/>` +
    `<line x1="290" y1="50" x2="290" y2="190" stroke="#334155" stroke-width="2"/>` +
    T(110, 42, '左边界', '#334155') + T(290, 42, '右边界', '#334155') +
    `<circle cx="80" cy="120" r="9" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
    `<line x1="92" y1="120" x2="130" y2="120" stroke="#ef4444" stroke-width="2.5" ${ARROW} stroke-linecap="round"/>` +
    T(80, 145, '+q', '#ef4444') + T(118, 108, 'v', '#ef4444') +
    T(200, 105, 'B（垂直纸面向里）', '#4f46e5') +
    `<line x1="180" y1="130" x2="180" y2="168" stroke="#64748b" stroke-width="1"/>` +
    T(200, 205, '宽为 d 的矩形有界磁场', '#64748b') +
    '</svg>',
  // #871 电场加速 + 双边界磁场（MN/PQ 间距 d）
  871: head + DEFS +
    `<line x1="60" y1="60" x2="60" y2="180" stroke="#334155" stroke-width="3"/>` +
    `<line x1="120" y1="60" x2="120" y2="180" stroke="#334155" stroke-width="3"/>` +
    T(90, 50, 'U', '#334155') +
    `<circle cx="70" cy="150" r="8" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
    T(96, 155, '+q', '#ef4444') +
    `<line x1="80" y1="150" x2="108" y2="150" stroke="#ef4444" stroke-width="2.5" ${ARROW} stroke-linecap="round"/>` +
    `<rect x="170" y="50" width="170" height="140" fill="#eef2ff" opacity="0.7" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    `<line x1="170" y1="50" x2="170" y2="190" stroke="#334155" stroke-width="2"/>` +
    `<line x1="340" y1="50" x2="340" y2="190" stroke="#334155" stroke-width="2"/>` +
    T(170, 42, 'MN', '#334155') + T(340, 42, 'PQ', '#334155') +
    T(255, 110, 'B（垂直纸面向里）', '#4f46e5') +
    `<line x1="196" y1="120" x2="196" y2="190" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3"/>` +
    T(212, 160, 'd', '#64748b') +
    T(90, 205, '加速电场', '#64748b') + T(255, 205, '匀强磁场', '#64748b') +
    '</svg>',
  // #872 直线边界 MN（竖直），右侧磁场；P 点 30° 斜射入；场内 A 点以与边界成 60° 斜向边界
  872: head + DEFS +
    `<rect x="110" y="30" width="250" height="180" fill="#eef2ff" opacity="0.7" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    `<line x1="110" y1="30" x2="110" y2="210" stroke="#334155" stroke-width="2"/>` +
    T(110, 22, 'MN', '#334155') +
    `<circle cx="110" cy="150" r="6" fill="#334155"/>` + T(94, 168, 'P', '#334155') +
    `<line x1="116" y1="146" x2="158" y2="122" stroke="#ef4444" stroke-width="2.5" ${ARROW} stroke-linecap="round"/>` +
    T(150, 112, 'v₀', '#ef4444') + T(146, 150, '30°', '#334155') +
    `<circle cx="250" cy="70" r="6" fill="#334155"/>` + T(262, 62, 'A', '#334155') +
    `<line x1="244" y1="75" x2="192" y2="105" stroke="#ef4444" stroke-width="2.5" ${ARROW} stroke-linecap="round"/>` +
    T(196, 92, 'v', '#ef4444') + T(232, 108, '60°', '#334155') +
    `<line x1="110" y1="70" x2="250" y2="70" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3"/>` +
    T(180, 64, 'd', '#64748b') +
    T(240, 220, '匀强磁场 B（垂直纸面向里）', '#4f46e5') +
    '</svg>',
  // #876 正方形线框以恒定速度穿过右侧有界磁场
  876: head + DEFS +
    `<rect x="210" y="60" width="150" height="120" fill="#eef2ff" opacity="0.7" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    `<line x1="210" y1="60" x2="210" y2="180" stroke="#334155" stroke-width="2"/>` +
    `<line x1="360" y1="60" x2="360" y2="180" stroke="#334155" stroke-width="2"/>` +
    T(210, 52, '磁场区', '#334155') + T(285, 110, 'B（竖直向下）', '#4f46e5') +
    `<rect x="100" y="90" width="80" height="80" fill="none" stroke="#334155" stroke-width="2.5"/>` +
    T(140, 85, '线框 R', '#334155') +
    `<line x1="185" y1="130" x2="225" y2="130" stroke="#ef4444" stroke-width="2.5" ${ARROW} stroke-linecap="round"/>` +
    T(205, 118, 'v', '#ef4444') +
    T(285, 205, '宽度 d 的有界匀强磁场', '#64748b') +
    '</svg>',
  // #885 平抛实验装置：斜槽末端水平 + 竖直木板坐标
  885: head +
    `<path d="M 60 60 Q 150 130 190 140" fill="none" stroke="#334155" stroke-width="3"/>` +
    `<line x1="190" y1="140" x2="230" y2="140" stroke="#334155" stroke-width="3"/>` +
    T(110, 45, '斜槽（末端水平）', '#334155') +
    `<circle cx="228" cy="132" r="6" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
    `<line x1="230" y1="140" x2="230" y2="220" stroke="#4f46e5" stroke-width="1.5"/>` +
    `<line x1="230" y1="140" x2="330" y2="140" stroke="#4f46e5" stroke-width="1.5"/>` +
    T(222, 158, 'O', '#4f46e5') + T(345, 144, 'x', '#4f46e5') + T(222, 232, 'y', '#4f46e5') +
    `<rect x="290" y="40" width="8" height="180" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>` +
    T(305, 60, '竖直木板', '#64748b') +
    `<line x1="90" y1="170" x2="105" y2="150" stroke="#94a3b8" stroke-width="1.5"/>` +
    T(80, 185, '重垂线', '#64748b') +
    '</svg>',
  // #886 皮带传动 A-B + 同轴大轮 C
  886: head +
    `<circle cx="100" cy="120" r="30" fill="none" stroke="#334155" stroke-width="2.5"/>` +
    `<circle cx="100" cy="120" r="3" fill="#334155"/>` + T(100, 165, 'A', '#334155') +
    T(100, 82, 'P', '#ef4444') + `<circle cx="100" cy="90" r="4" fill="#ef4444"/>` +
    `<circle cx="240" cy="120" r="60" fill="none" stroke="#334155" stroke-width="2.5"/>` +
    `<circle cx="240" cy="120" r="3" fill="#334155"/>` +
    `<circle cx="240" cy="120" r="38" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    T(240, 195, 'B（与 C 同轴）', '#334155') +
    T(283, 120, 'Q', '#ef4444') + `<circle cx="283" cy="120" r="4" fill="#ef4444"/>` +
    `<line x1="100" y1="90" x2="240" y2="60" stroke="#334155" stroke-width="2"/>` +
    `<line x1="100" y1="150" x2="240" y2="180" stroke="#334155" stroke-width="2"/>` +
    T(170, 52, '皮带', '#64748b') + T(286, 78, 'C', '#334155') +
    '</svg>',
  // #899 双缝干涉测波长装置：光源-滤光片-单缝-双缝-遮光筒-测量头
  899: head +
    `<line x1="30" y1="200" x2="380" y2="200" stroke="#334155" stroke-width="2"/>` +
    T(40, 218, '光具座', '#64748b') +
    `<circle cx="55" cy="120" r="14" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
    T(55, 95, '光源', '#334155') +
    `<rect x="95" y="100" width="10" height="40" fill="#fca5a5" stroke="#334155" stroke-width="1.5"/>` +
    T(100, 90, '滤光片', '#334155') +
    `<rect x="140" y="104" width="6" height="32" fill="#fff" stroke="#334155" stroke-width="1.5"/>` +
    `<line x1="143" y1="108" x2="143" y2="132" stroke="#334155" stroke-width="1"/>` +
    T(143, 90, '单缝', '#334155') +
    `<rect x="185" y="100" width="6" height="40" fill="#fff" stroke="#334155" stroke-width="1.5"/>` +
    `<line x1="186" y1="112" x2="186" y2="128" stroke="#334155" stroke-width="1"/>` +
    `<line x1="190" y1="112" x2="190" y2="128" stroke="#334155" stroke-width="1"/>` +
    T(188, 90, '双缝', '#334155') +
    `<rect x="210" y="80" width="110" height="80" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>` +
    T(265, 70, '遮光筒', '#334155') +
    `<rect x="330" y="95" width="26" height="50" fill="#c7d2fe" stroke="#334155" stroke-width="1.5"/>` +
    T(343, 85, '测量头', '#334155') +
    '</svg>',
}
for (const [id, data] of Object.entries(figures)) {
  db.prepare('UPDATE questions SET figure=? WHERE id=?').run(F(data), Number(id))
  changed.push(`#${id} 配图重画`)
}

console.log(`\n共 ${changed.length} 项修复落库`)
db.close()
