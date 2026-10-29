// 一次性脚本：第十三批补题独立重解自验发现的 7 处缺陷修正
// （#660 几何矛盾 / #665 重写（原解析自认「无物理依据」）/ #670 答案与解析数值不符 /
//  #681 重写（原题切线方向与平抛矛盾、答案自认「不存在」）/ #683 数据非物理重设计 /
//  #691 波形方向自相矛盾+配图模板错误 / #696 销钉表述自相矛盾）
// 逐题独立重解依据写在各 fix 上方注释；防护同 fix-accept20.mjs：动态构建 SET、仅更新 patch 字段
// 用法：node scripts/fix-accept21-batch13.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #660：物块放在木板「右端」但向右拉 F、向右相对滑动 → 刚放上就滑离，几何矛盾。
// 解析全程按「从左端滑到右端、相对位移=L=2 m」计算（t=2√3/3 s、W_F:Q=200:34=100:17 均自洽），
// 故只需把题干「右端放」改为「左端放」 ----------
const q660StemReplace = { from: '木板右端放一质量', to: '木板左端放一质量' }

// ---------- #665 整题重写：原题（斜面+弹簧+变角绳）中绳角变化与小球位置的几何关系未定义，
// 原解析自认「此假设无物理依据」、原答案自认「与初始条件矛盾」。重写为可严格求解的
// 弹簧悬球水平缓拉问题（图解法矢量三角形 + 跨章功能关系，压轴定位保留）：
// 独立重解：(1) 竖直 T cosθ=mg → T=mg/cosθ=10/0.8=12.5 N，水平 F=T sinθ=mg tanθ=10×0.75=7.5 N，
//   伸长 x=T/k=0.125 m；(2) 矢量三角形竖直边 mg 不变，θ 增大 → T=mg/cosθ↑、F=mg tanθ↑；
//   (3) 缓慢过程 W_F=ΔEp重+ΔEp弹：初始伸长 x0=mg/k=0.1 m、长 0.6 m；θ=37° 时长 0.625 m、
//   球在悬点下 0.625cos37°=0.5 m → 上升 0.1 m；W_F=mg×0.1+½×100×(0.125²−0.1²)=1+0.28125=1.28125≈1.28 J
const q665Stem = `轻弹簧上端固定于天花板，自然长度 $L_0=0.5\\,\\text{m}$、劲度系数 $k=100\\,\\text{N/m}$，下端竖直悬挂质量 $m=1\\,\\text{kg}$ 的小球，系统静止。现对小球施加一个方向始终水平、大小可调的拉力 $F$，极其缓慢地把小球拉到弹簧与竖直方向成 $\\theta$ 角的位置（弹簧始终在弹性限度内，弹簧弹力沿弹簧方向）。取 $g=10\\,\\text{m/s}^2$，$\\sin37^\\circ=0.6$，$\\cos37^\\circ=0.8$。求：
(1) 当 $\\theta=37^\\circ$ 时，水平拉力 $F$ 与弹簧弹力的大小；
(2) 用矢量三角形（图解法）分析：$\\theta$ 增大的过程中，$F$ 与弹簧弹力的大小如何变化；
(3) 从 $\\theta=0$ 到 $\\theta=37^\\circ$ 的过程中，水平拉力 $F$ 做的功。`
const q665Answer = `(1) $F=7.5\\,\\text{N}$，弹簧弹力 $T=12.5\\,\\text{N}$（伸长量 $0.125\\,\\text{m}$）；(2) $F$ 与弹簧弹力均单调增大；(3) $W_F\\approx1.28\\,\\text{J}$（未修约值 $1.28125\\,\\text{J}$）`
const q665Solution = `(1) 小球缓慢移动，处于动态平衡，受重力 $mg$、弹簧弹力 $T$（沿弹簧向上）、水平拉力 $F$。沿竖直方向：$T\\cos\\theta=mg$；沿水平方向：$F=T\\sin\\theta=mg\\tan\\theta$。当 $\\theta=37^\\circ$ 时：$T=\\dfrac{mg}{\\cos37^\\circ}=\\dfrac{10}{0.8}=12.5\\,\\text{N}$，$F=mg\\tan37^\\circ=10\\times0.75=7.5\\,\\text{N}$。弹簧伸长量 $x=\\dfrac{T}{k}=\\dfrac{12.5}{100}=0.125\\,\\text{m}$。
(2) 以不变的重力 $mg$ 为竖直边作出矢量三角形：竖直边 $mg$、水平边 $F$、斜边 $T$（沿弹簧方向，与竖直方向夹角为 $\\theta$）。$\\theta$ 增大时竖直边不变、三角形张角变大，由 $T=\\dfrac{mg}{\\cos\\theta}$、$F=mg\\tan\\theta$（$\\theta\\in(0,90^\\circ)$ 上 $\\cos\\theta$ 减小、$\\tan\\theta$ 增大）可知：$F$ 与弹簧弹力 $T$ 均单调增大。
(3) 小球缓慢移动，动能不变。由功能关系，水平拉力做的功等于小球重力势能增加量与弹簧弹性势能增加量之和。
初始（$\\theta=0$）：弹簧竖直，伸长 $x_0=\\dfrac{mg}{k}=\\dfrac{10}{100}=0.1\\,\\text{m}$，长度 $L_1=L_0+x_0=0.6\\,\\text{m}$；
$\\theta=37^\\circ$ 时：伸长 $x=0.125\\,\\text{m}$，长度 $L_2=L_0+x=0.625\\,\\text{m}$，球在悬点正下方的竖直距离 $h_2=L_2\\cos37^\\circ=0.625\\times0.8=0.5\\,\\text{m}$。
小球上升高度 $\\Delta h=L_1-h_2=0.6-0.5=0.1\\,\\text{m}$。
$W_F=mg\\Delta h+\\dfrac{1}{2}k(x^2-x_0^2)=10\\times0.1+\\dfrac{1}{2}\\times100\\times(0.125^2-0.1^2)=1+0.28125=1.28125\\,\\text{J}\\approx1.28\\,\\text{J}$。`
const q665Pitfall = `①误认为弹簧弹力方向仍竖直（$\\theta\\neq0$ 后弹力沿弹簧方向，与竖直成 $\\theta$ 角）；②求功时漏掉重力势能或弹性势能之一；③误认为「缓慢」过程中 $F$ 恒定而直接用 $W=Fs$ 计算（$F$ 是变力，须用功能关系）`

// ---------- #670：解析数值正确（Q=6.4×(4√35−7)≈106.6 J≈107 J；ΔE=2.8+42+106.6≈151 J，
//   另法 6.4×4√35≈151 J 交叉一致），但答案字段写成 Q≈106 J、ΔE≈109 J（疑为漏掉 ΔEp=42 J 的旧稿残留）→ 答案同步修正 ----------
const q670Answer = `(1) $t=\\sqrt{35}\\approx5.9\\ \\text{s}$；(2) $Q\\approx107\\ \\text{J}$；(3) $\\Delta E\\approx151\\ \\text{J}$；(4) 物块全程做匀加速直线运动，到达 $B$ 前始终未与传送带共速，不存在匀速阶段。`

// ---------- #681 整题重写：原题几何错误（四分之一圆弧末端 C 与圆心等高处切线竖直，「沿水平方向
//   飞出做平抛」不成立；且 v_C=0 与「平抛」自相矛盾，原答案自认「不存在满足条件的 L」）。
//   重写为竖直圆内侧轨道临界+平抛压轴（跨章：圆周临界+机械能守恒+平抛）：
//   独立重解：(1) v_B²=v0²−4gR=25−20=5=gR ≥ gR 临界 → 恰能过最高点且 N=0；
//   (2) 平抛高 2R=1 m：t=√0.2 s，x=√5×√0.2=1.0 m；(3) v_y=2√5，v=√(5+20)=5 m/s（=v0 机械能守恒自洽），
//   tanφ=v_y/v_x=2（φ≈63.4°）
const q681Stem = `竖直平面内固定一光滑圆形轨道，半径 $R=0.5\\ \\text{m}$，最低点 $A$ 与水平地面相切，最高点 $B$ 在圆心 $O$ 的正上方（离地 $2R$）。质量 $m=0.5\\ \\text{kg}$ 的小物块（可视为质点）贴着轨道内壁，从 $A$ 点以 $v_0=5\\ \\text{m/s}$ 的水平初速度沿轨道向上运动。取 $g=10\\ \\text{m/s}^2$，不计空气阻力。求：
（1）通过定量计算判断物块能否到达最高点 $B$；若能，求它在 $B$ 点对轨道的压力，并说明该位置对应什么临界情形；
（2）物块离开 $B$ 点后做平抛运动，求平抛的水平位移大小；
（3）求物块落地时速度的大小，以及速度方向与水平方向夹角的正切值。`
const q681Answer = `（1）能到达 $B$，$v_B=\\sqrt{5}\\ \\text{m/s}=\\sqrt{gR}$，轨道对物块压力 $N=0$，恰好是「重力全部提供向心力、物块不脱离轨道」的临界情形；（2）水平位移 $x=1.0\\ \\text{m}$；（3）落地速度 $v=5\\ \\text{m/s}$，$\\tan\\varphi=2$（$\\varphi\\approx63.4^\\circ$）`
const q681Solution = `（1）设物块能到最高点 $B$，从 $A$ 到 $B$ 只有重力做功，机械能守恒：
$$\\frac{1}{2}mv_0^2=\\frac{1}{2}mv_B^2+mg\\cdot2R$$
得 $v_B^2=v_0^2-4gR=25-20=5\\ (\\text{m/s})^2$，$v_B=\\sqrt{5}\\ \\text{m/s}>0$，故物块能到达 $B$ 点。
在最高点，由牛顿第二定律（重力与轨道压力的合力提供向心力）：$mg+N=\\dfrac{mv_B^2}{R}$，得 $N=\\dfrac{mv_B^2}{R}-mg=\\dfrac{0.5\\times5}{0.5}-5=0$，即 $N=0$。这恰好是物块在竖直圆轨道内侧最高点不脱离轨道的临界情形（重力全部提供向心力），$v_B=\\sqrt{gR}=\\sqrt{5}\\ \\text{m/s}$ 为临界速度，物块贴着轨道恰好不脱离。
（2）离开 $B$ 点时速度水平，物块做平抛运动，抛出点离地 $H=2R=1\\ \text{m}$。由 $H=\\dfrac{1}{2}gt^2$ 得 $t=\\sqrt{\\dfrac{2\\times1}{10}}=\\sqrt{0.2}\\ \text{s}$。水平位移 $x=v_Bt=\\sqrt{5}\\times\\sqrt{0.2}=\\sqrt{1}=1.0\\ \text{m}$。
（3）落地时竖直分速度 $v_y=gt=10\\sqrt{0.2}=2\\sqrt{5}\\ \text{m/s}$，水平分速度 $v_x=v_B=\\sqrt{5}\ \text{m/s}$，落地速度大小 $v=\\sqrt{v_x^2+v_y^2}=\\sqrt{5+20}=5\ \text{m/s}$（与 $v_0$ 相等，可由全程机械能守恒交叉验证：落回同一高度、动能复原）。速度方向与水平方向夹角 $\\varphi$ 满足 $\\tan\\varphi=\\dfrac{v_y}{v_x}=\\dfrac{2\\sqrt{5}}{\\sqrt{5}}=2$（$\\varphi\\approx63.4^\\circ$）。`
const q681Pitfall = `①不检验最高点临界速度就默认物块能通过；②误把最高点临界速度写成 $\\sqrt{2gR}$（那是绳模型/杆模型混淆的典型错误，内轨临界是 $\\sqrt{gR}$）；③平抛下落高度误用 $R$（抛出点 $B$ 离地 $2R$）；④第(3)问可用全程机械能守恒自检：落回地面时速度应等于 $v_0$`
// #681 重画配图：竖直圆轨道 + 地面 + A/B 标注 + v0 箭头（旧图为四分之一弧+挡板，与新题不符）
const q681Figure = JSON.stringify({ kind: 'svg', data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="400" height="260" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="260" fill="none"/><line x1="40" y1="210" x2="360" y2="210" stroke="#334155" stroke-width="2.5"/><line x1="52" y1="222" x2="62" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="82" y1="222" x2="92" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="112" y1="222" x2="122" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="142" y1="222" x2="152" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="172" y1="222" x2="182" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="202" y1="222" x2="212" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="232" y1="222" x2="242" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="262" y1="222" x2="272" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="292" y1="222" x2="302" y2="210" stroke="#94a3b8" stroke-width="1.5"/><line x1="322" y1="222" x2="332" y2="210" stroke="#94a3b8" stroke-width="1.5"/><circle cx="200" cy="130" r="80" fill="none" stroke="#4f46e5" stroke-width="2.5"/><circle cx="200" cy="130" r="2.5" fill="#334155"/><text x="212" y="128" font-size="13" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">O</text><circle cx="200" cy="50" r="2.5" fill="#334155"/><text x="212" y="48" font-size="13" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">B</text><circle cx="200" cy="210" r="2.5" fill="#334155"/><text x="200" y="234" font-size="13" fill="#334155" text-anchor="middle" font-family="system-ui,'Microsoft YaHei',sans-serif">A</text><line x1="252" y1="130" x2="200" y2="130" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 3"/><text x="228" y="122" font-size="12" fill="#64748b" font-family="system-ui,'Microsoft YaHei',sans-serif">R</text><rect x="188" y="200" width="12" height="10" fill="#fde68a" stroke="#334155" stroke-width="1.5"/><line x1="204" y1="205" x2="238" y2="205" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/><polygon points="248,205 238,200.95 238,209.05" fill="#ef4444"/><text x="226" y="196" font-size="12" fill="#ef4444" font-family="system-ui,'Microsoft YaHei',sans-serif">v₀</text></svg>` })

// ---------- #683 数据重设计：原数据 ΔEk(0.400 J) > ΔEp(0.235 J) 动能增加量大于势能减少量，
//   物理上不可能（只能 ΔEk 略小于 ΔEp）；且原题 O 点已舍去开头、v_O≠0 却按 ½mv_B² 算 ΔEk。
//   重设计：O 为重物开始下落时打下的第一个清晰点（v_O=0，第一、二点间距 ≈2 mm 与 a=9.75 自洽：
//   ½×9.75×0.02²=1.95mm ✓）；计数点 A/B/C 于 t=0.04/0.08/0.12 s（T=0.04 s），a≈9.75 m/s²（阻力略）：
//   h_A=0.0078、h_B=0.0312、h_C=0.0702 m；v_B=(h_C−h_A)/2T=0.0624/0.08=0.78 m/s；
//   ΔEp=mgh_B=0.2×9.8×0.0312=0.0612 J；ΔEk=½mv_B²=0.1×0.6084=0.0608 J；ΔEp 略大 0.0004 J（≈0.7%）→ 误差范围内守恒 ✓
const q683Stem = `某同学用打点计时器验证机械能守恒定律。重物由静止释放，拖着纸带竖直下落，打点计时器在纸带上打出一系列点。已知打点计时器所用交流电源频率为 $50\\ \\text{Hz}$，当地重力加速度取 $g=9.80\\ \\text{m/s}^2$，重物质量 $m=0.200\\ \\text{kg}$。实验中选取第一条、二点间距接近 $2\\ \\text{mm}$ 的清晰纸带，以重物开始下落时打下的清晰点 $O$ 为起点（此时重物速度为零），沿纸带依次取计数点 $A$、$B$、$C$（每两个计时点间隔取一个计数点，相邻计数点间时间间隔 $T=0.04\\ \text{s}$），测得 $O$ 到 $A$、$B$、$C$ 的距离分别为 $h_A=0.0078\\ \text{m}$、$h_B=0.0312\\ \text{m}$、$h_C=0.0702\\ \text{m}$。请回答下列问题：（1）说明本实验的目的、主要步骤与器材、数据处理方法以及误差来源；（2）计算打 $B$ 点时重物的速度大小；（3）以 $O$ 点为初位置，计算从 $O$ 到 $B$ 过程中重物重力势能的减少量 $\\Delta E_{\\text{p}}$ 和动能的增加量 $\\Delta E_{\\text{k}}$，并判断在实验误差允许范围内机械能是否守恒。`
const q683Answer = `（1）见解析；（2）$v_B=0.78\\ \text{m/s}$；（3）$\\Delta E_{\\text{p}}=0.0612\\ \text{J}$，$\\Delta E_{\\text{k}}=0.0608\\ \text{J}$；$\\Delta E_{\\text{p}}$ 略大于 $\\Delta E_{\\text{k}}$，相对差约 $0.7\\%$，在实验误差允许范围内可认为机械能守恒。`
const q683Solution = `【实验目的】用打点计时器记录重物自由下落过程中的位置，测出下落高度与对应时刻的速度，比较重力势能的减少量 $\\Delta E_{\\text{p}}=mgh$ 与动能的增加量 $\\Delta E_{\\text{k}}=\\frac{1}{2}mv^2$，在实验误差允许范围内验证机械能守恒定律。

【实验步骤（装置与器材）】器材：打点计时器、交流电源、纸带、复写纸、重物、铁架台（带铁夹）、刻度尺、导线。步骤：①将打点计时器竖直固定在铁架台上，两限位孔在同一竖直线上；②纸带穿过限位孔，下端系牢重物，手提纸带上端使重物靠近打点计时器；③先接通电源，待打点稳定后再释放纸带；④重复几次，选取第一、二点间距接近 $2\\ \text{mm}$（说明初速度为零）且点迹清晰的纸带；⑤以开始下落时的清晰点 $O$ 为起点，每两个计时点间隔取一个计数点，用刻度尺测各计数点到 $O$ 的距离。

【数据处理】相邻计数点间时间间隔 $T=0.04\ \text{s}$。打 $B$ 点时重物的速度等于 $AC$ 段的平均速度：
$$v_B=\\frac{h_C-h_A}{2T}=\\frac{0.0702-0.0078}{2\\times0.04}\ \text{m/s}=\\frac{0.0624}{0.08}\ \text{m/s}=0.78\ \text{m/s}$$
（交叉验证：由逐差法 $a=\\frac{(h_C-h_B)-(h_B-h_A)}{T^2}=\\frac{0.0390-0.0234}{0.0016}=9.75\ \text{m/s}^2$，$v_B=a\\times2T=9.75\\times0.08=0.78\ \text{m/s}$，一致；$a$ 略小于 $g$，符合存在纸带阻力的预期。）
从 $O$ 到 $B$，重力势能减少量：
$$\\Delta E_{\\text{p}}=mgh_B=0.200\\times9.80\\times0.0312\ \text{J}=0.0612\ \text{J}$$
动能增加量（$O$ 点速度为零）：
$$\\Delta E_{\\text{k}}=\\frac{1}{2}mv_B^2=\\frac{1}{2}\\times0.200\\times0.78^2\ \text{J}=0.0608\ \text{J}$$
$\\Delta E_{\\text{p}}$ 略大于 $\\Delta E_{\\text{k}}$，相对差约 $\\frac{0.0004}{0.0612}\\approx0.7\\%$。方向合理（阻力做负功使动能增加量略偏小），且差值远小于常规实验误差，故在实验误差允许范围内可认为机械能守恒。

【误差分析】①纸带与限位孔间摩擦、重物受空气阻力，使动能增加量略小于重力势能减少量（本题 $0.7\\%$ 的差即来源于此）；②先释放纸带后接通电源会使起始点迹不准；③刻度尺读数存在偶然误差。多次测量取平均可减小偶然误差。`
const q683Pitfall = `①计数点间隔 $T$ 与打点周期 $0.02\ \text{s}$ 混淆（本题每两个计时点间隔取一计数点，$T=0.04\ \text{s}$）；②瞬时速度用 $AC$ 段平均速度代替，不能用 $\\sqrt{2gh_B}$ 估算（那是用待验证结论算待验证量）；③正常数据应满足 $\\Delta E_{\\text{p}}$ 略大于 $\\Delta E_{\\text{k}}$，若出现 $\\Delta E_{\\text{k}}>\\Delta E_{\\text{p}}$ 则数据不自洽`

// ---------- #691：①题干波形方向自相矛盾——波沿 +x 传播、P 处波形「下降」时 P 应向上运动
//   （v_y=−v·斜率，「上坡下、下坡上」），与图乙「P 向 −y 运动」矛盾 → 改为「上升趋势」后自洽
//   （+x 波 + 上升趋势 → P 向下 ✓；第(4)问反向传播后 P 向上 ✓ 与原答案一致）；
//   ②配图模板渲染错误（渲染成了速度选择器图）→ 重画双图（甲：t=0 波形 y=0.1sin[2π(x−2)/8]，P 在 x=2
//   平衡位置且该处上升；乙：P 的振动图像 y=−0.1sin(2πt/0.4)，t=0 从平衡位置向 −y 运动） ----------
const q691StemReplace = { from: '波形在该处沿 $x$ 轴正方向呈下降趋势', to: '波形在该处沿 $x$ 轴正方向呈上升趋势' }

// 生成 #691 双图 SVG（节点用解析式精确采样后拼 polyline）
function svg691() {
  const pts1 = []
  for (let x = 0; x <= 8.001; x += 0.1) {
    const y = 0.1 * Math.sin(2 * Math.PI * (x - 2) / 8)
    pts1.push(`${(30 + x * 22.5).toFixed(1)},${(110 - y * 400).toFixed(1)}`)
  }
  const pts2 = []
  for (let t = 0; t <= 0.801; t += 0.01) {
    const y = -0.1 * Math.sin(2 * Math.PI * t / 0.4)
    pts2.push(`${(260 + t * 225).toFixed(1)},${(110 - y * 400).toFixed(1)}`)
  }
  const axis = (x1, y1, x2, y2, color = '#334155') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6"/>`
  const arrow = (x, y, color = '#334155') => `<polygon points="${x},${y} ${x - 4},${y + 8} ${x + 4},${y + 8}" fill="${color}"/>`
  return JSON.stringify({ kind: 'svg', data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 250" width="470" height="250" style="max-width:100%;height:auto"><rect x="0" y="0" width="470" height="250" fill="none"/>` +
    // 图甲：x 轴 30→210（0~8 m），y 轴 110（上 +0.1 下 −0.1）
    axis(30, 110, 218, 110) + arrow(218, 110) + axis(40, 190, 40, 30) + arrow(40, 30) +
    `<polyline points="${pts1.join(' ')}" fill="none" stroke="#4f46e5" stroke-width="2.2"/>` +
    `<line x1="30" y1="40" x2="210" y2="40" stroke="#64748b" stroke-width="1" stroke-dasharray="5 4"/>` +
    `<line x1="30" y1="180" x2="210" y2="180" stroke="#64748b" stroke-width="1" stroke-dasharray="5 4"/>` +
    `<circle cx="75" cy="110" r="4" fill="#ef4444"/>` +
    `<text x="75" y="132" font-size="13" fill="#ef4444" text-anchor="middle" font-family="system-ui,'Microsoft YaHei',sans-serif">P</text>` +
    `<text x="212" y="126" font-size="12" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">x/m</text>` +
    `<text x="34" y="26" font-size="12" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">y/m</text>` +
    `<text x="120" y="216" font-size="12.5" fill="#64748b" font-family="system-ui,'Microsoft YaHei',sans-serif">图甲　t=0 时刻波形图</text>` +
    // 图乙：t 轴 260→440（0~0.8 s）
    axis(260, 110, 448, 110) + arrow(448, 110) + axis(270, 190, 270, 30) + arrow(270, 30) +
    `<polyline points="${pts2.join(' ')}" fill="none" stroke="#0d9488" stroke-width="2.2"/>` +
    `<text x="440" y="126" font-size="12" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">t/s</text>` +
    `<text x="264" y="26" font-size="12" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">y/m</text>` +
    `<text x="350" y="216" font-size="12.5" fill="#64748b" font-family="system-ui,'Microsoft YaHei',sans-serif">图乙　质点 P 的振动图像</text>` +
    `</svg>` })
}

// ---------- #696：「现拔去销钉，同时保持活塞位置不变」自相矛盾（拔去销钉活塞即可自由移动）。
//   第(1)问 p1 需要销钉受力平衡的语境、第(2)(3)问需要体积不变 → 统一改为「保持销钉固定（体积不变）」 ----------
const q696StemReplace = { from: '现拔去销钉，同时保持活塞位置不变（体积不变），将缸内气体缓慢加热', to: '现保持销钉固定（活塞位置不变，体积不变），将缸内气体缓慢加热' }
const q696SolutionReplace = { from: '（2）拔去销钉后保持活塞位置不变，气体体积不变，做等容变化', to: '（2）销钉保持固定，活塞位置不变，气体体积不变，做等容变化' }

// ---------- 统一防护：动态构建 SET，仅更新 patch 字段；stem/solution 支持原文精确替换 ----------
const updates = [
  [660, { stemReplace: q660StemReplace }],
  [665, { stem: q665Stem, answer: q665Answer, solution: q665Solution, pitfall: q665Pitfall }],
  [670, { answer: q670Answer }],
  [681, { stem: q681Stem, answer: q681Answer, solution: q681Solution, pitfall: q681Pitfall, figure: q681Figure }],
  [683, { stem: q683Stem, answer: q683Answer, solution: q683Solution, pitfall: q683Pitfall }],
  [691, { stemReplace: q691StemReplace, figure: svg691() }],
  [696, { stemReplace: q696StemReplace, solutionReplace: q696SolutionReplace }],
]

const get = db.prepare('SELECT id, stem, answer, solution, difficulty FROM questions WHERE id = ?')

for (const [id, patch] of updates) {
  const cur = get.get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  const params = { id: cur.id }
  if (patch.stem && !patch.stemReplace) params.stem = patch.stem
  if (patch.stemReplace) {
    if (!cur.stem.includes(patch.stemReplace.from)) { console.log(`题 ${id} 题干未找到待替换片段，跳过 stem：${JSON.stringify(patch.stemReplace.from.slice(0, 50))}`); continue }
    params.stem = cur.stem.replace(patch.stemReplace.from, patch.stemReplace.to)
  }
  if (patch.answer !== undefined) params.answer = patch.answer
  if (patch.solution && !patch.solutionReplace) params.solution = patch.solution
  if (patch.solutionReplace) {
    const sol = patch.solution || cur.solution
    if (!sol.includes(patch.solutionReplace.from)) { console.log(`题 ${id} 解析未找到待替换片段，跳过 solution`); continue }
    params.solution = sol.replace(patch.solutionReplace.from, patch.solutionReplace.to)
  }
  if (patch.pitfall !== undefined) params.pitfall = patch.pitfall
  if (patch.figure !== undefined) params.figure = patch.figure
  const setCols = Object.keys(params).filter((k) => k !== 'id').map((c) => `${c} = @${c}`).join(', ')
  console.log(`题 ${id}：更新 ${Object.keys(params).filter((k) => k !== 'id').join(', ')}${DRY ? ' [dry-run]' : ''}`)
  if (!DRY) db.prepare(`UPDATE questions SET ${setCols} WHERE id = @id`).run(params)
}
console.log(`完成${DRY ? ' [dry-run]' : ''}`)
