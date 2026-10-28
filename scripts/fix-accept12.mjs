// 一次性脚本：按验收 #12 的指令修正 4 道题（P1-10 / P2-20×2 / P2-21）
// - #414（P1-10）：安培力答案错 2 倍——F=BIL=0.4×2×0.5=0.4N，answer 与 solution 两处同步 0.8→0.4
// - #420（P2-20①）：与 #419 正确选项几乎逐字重复 → 整题改写为「熔化温度特征」角度（正确选项换为 C）
// - #427（P2-20②）：与 #424 完全同数据同答案 → 换全套数据（P=72kW / f=1.6×10³N → 3.6×10³N / 20 m/s / 20 s / 45 m/s）
// - #411（P2-21）：题干首行残留节名「回旋加速器（周期与最大动能）」，删除首行+空行
// 用法：node scripts/fix-accept12.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #414：安培力 0.8 → 0.4（answer/solution 同步，自洽：F=BIL=0.4×2×0.5=0.4N） ----------
const q414 = {
  answer: `0.4；逆时针；0.4；0`,
  solution: `线框进入磁场时，右边切割磁感线，等效电源电动势 $E=BLv=0.4\\times 0.5\\times 2\\ \\text{V}=0.4\\ \\text{V}$。由楞次定律，穿过线框向里的磁通量增加，感应电流的磁场方向向外，感应电流为逆时针方向。感应电流 $I=\\frac{E}{R}=\\frac{0.4}{0.2}\\ \\text{A}=2\\ \\text{A}$，安培力 $F=BIL=0.4\\times 2\\times 0.5\\ \\text{N}=0.4\\ \\text{N}$。线框完全在磁场中时，穿过线框的磁通量不变，感应电动势为零。`,
}

// ---------- #420：整题改写（熔化温度特征角度，与 #419 各选项考点、正确选项文本均不同） ----------
const q420 = {
  stem: `关于固体物质的熔化与温度，下列说法正确的是（　　）
A. 非晶体在熔化过程中吸收热量，温度保持不变
B. 玻璃块被敲碎后形状不规则，说明玻璃没有确定的熔点
C. 晶体熔化时吸收热量但温度保持不变，非晶体熔化时吸收热量温度持续升高
D. 多晶体没有确定的熔点`,
  answer: `C`,
  solution: `A 项：有确定熔点、熔化时温度不变是晶体的特征；非晶体没有确定的熔点，熔化过程中吸收热量温度持续升高，A 错误。
B 项：「形状不规则」与「是否有确定熔点」没有必然联系；玻璃确实是非晶体、没有确定熔点，但不能由敲碎后的形状得出这一结论，B 错误。
C 项：晶体有确定的熔点，熔化过程中吸收热量全部用于破坏晶体结构，温度保持在熔点不变；非晶体没有确定熔点，吸热时温度持续升高，C 正确。
D 项：有确定熔点是晶体（含单晶体与多晶体）的共同特征，多晶体同样有确定的熔点，D 错误。`,
  pitfall: `易把「熔化时温度不变」当成所有固体的共性（实为晶体独有）；也易由「玻璃形状不规则」这类无关现象去推断熔点有无——判断有无确定熔点要依据熔化过程中温度是否变化，与外形无关。`,
}

// ---------- #427：换全套数据（与 #424 的 60kW/2×10³N 组合彻底区分，数值自洽） ----------
// m=2.0×10³kg、a=1.0、f=1.6×10³N、P=72kW → F=3.6×10³N、v1=20m/s、t1=20s、vm=45m/s
const q427 = {
  stem: `一辆质量 $m=2.0\\times10^{3}\\,\\text{kg}$ 的汽车在平直公路上由静止开始启动，发动机的额定功率为 $P=72\\,\\text{kW}$。汽车先以恒定加速度 $a=1.0\\,\\text{m/s}^{2}$ 做匀加速直线运动，达到额定功率后保持额定功率不变继续加速，最终达到最大速度。设汽车所受阻力恒为 $f=1.6\\times10^{3}\\,\\text{N}$。求：(1) 匀加速阶段汽车所受的牵引力大小；(2) 匀加速阶段结束时汽车的速度大小；(3) 匀加速阶段持续的时间；(4) 汽车最终达到的最大速度大小。`,
  answer: `(1) $F=3.6\\times10^{3}\\,\\text{N}$；(2) $v_1=20\\,\\text{m/s}$；(3) $t_1=20\\,\\text{s}$；(4) $v_{\\text{m}}=45\\,\\text{m/s}$。`,
  solution: `(1) 匀加速阶段加速度恒定，由牛顿第二定律得 $F-f=ma$，故 $F=f+ma=1.6\\times10^{3}+2.0\\times10^{3}\\times1.0=3.6\\times10^{3}\\,\\text{N}$。
(2) 匀加速阶段牵引力恒定，功率随速度增大而增大，当功率刚达到额定功率时匀加速阶段结束，此时 $P=Fv_1$，得 $v_1=\\dfrac{P}{F}=\\dfrac{72\\times10^{3}}{3.6\\times10^{3}}=20\\,\\text{m/s}$。
(3) 匀加速阶段为初速度为零的匀加速直线运动，由 $v_1=at_1$ 得 $t_1=\\dfrac{v_1}{a}=\\dfrac{20}{1.0}=20\\,\\text{s}$。
(4) 汽车达到最大速度时加速度为零，牵引力与阻力平衡，$F'=f=1.6\\times10^{3}\\,\\text{N}$，由 $P=F'v_{\\text{m}}$ 得 $v_{\\text{m}}=\\dfrac{P}{f}=\\dfrac{72\\times10^{3}}{1.6\\times10^{3}}=45\\,\\text{m/s}$。`,
  pitfall: `易错点：①匀加速阶段结束的条件是功率达到额定功率而非速度达到最大，此时 $v_1=\\frac{P}{F}$ 中的 $F$ 是匀加速阶段的牵引力 $3.6\\times10^{3}\\,\\text{N}$，不是阻力；②最大速度对应牵引力等于阻力，应用 $v_{\\text{m}}=\\frac{P}{f}$，不能误用匀加速阶段的牵引力求最大速度；③注意功率单位换算 $72\\,\\text{kW}=72\\times10^{3}\\,\\text{W}$。`,
}

// ---------- #411：删除题干首行残留节名 ----------
const q411Stem = `某回旋加速器的两个 D 形金属盒所在区域存在垂直于盒面的匀强磁场，磁感应强度大小为 $B$；两盒间狭缝宽度很小，缝隙间加高频交流电压，其周期与粒子做圆周运动的周期相同。现用它加速质量为 $m$、电荷量为 $q$ 的正离子（初速度可视为零，忽略相对论效应），下列说法正确的是（　　）
A. 离子在磁场中做圆周运动的周期随速度增大而增大
B. 离子每次经过狭缝时都被加速，其动能增量随速度增大而增大
C. 仅增大磁感应强度 $B$，离子获得的最大动能增大
D. 仅增大高频交流电压的峰值 $U$，离子获得的最大动能增大`

const updates = [
  [414, { answer: q414.answer, solution: q414.solution }],
  [420, q420],
  [427, q427],
  [411, { stem: q411Stem }],
]

const upd = db.prepare('UPDATE questions SET stem=?, answer=?, solution=?, pitfall=? WHERE id=?')

for (const [id, patch] of updates) {
  const cur = db.prepare('SELECT id, stem, answer, solution, pitfall FROM questions WHERE id = ?').get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  const next = {
    stem: patch.stem ?? cur.stem,
    answer: patch.answer ?? cur.answer,
    solution: patch.solution ?? cur.solution,
    pitfall: patch.pitfall ?? cur.pitfall,
  }
  if (DRY) { console.log(`[dry-run] 题 ${id}：\n  题干首行：${next.stem.split('\n')[0].slice(0, 60)}\n  答案：${next.answer.slice(0, 80)}\n  解析含 0.8N：${/0\.8/.test(next.solution)}\n`); continue }
  upd.run(next.stem, next.answer, next.solution, next.pitfall, id)
  console.log(`题 ${id} 已更新（${Object.keys(patch).join('/')}）`)
}

db.close()
