// 一次性脚本：验收 #24 修复
// ① #698 p-V 循环题题设错误：原循环 A→B→C→D→A 中 D(2e5,2e-3) 与 A(2e5,2e-3) 重合，
//    「D→A 等容回到 A」物理上不存在。修法：删除 D 态，改三段循环
//    A→B 等容升压 / B→C 等温膨胀 / C→A 等压压缩（p_C=p_BV_B/V_C=2.0e5 Pa=p_A，恰好等压回到 A）；
//    三问答案全部保持不变：(1) T_B:T_C=1:1；(2) 净吸热 800ln2−400≈1.5e2 J（原 W_CD=p_C(V_D−V_C)=−400 J
//    与新 W_CA=p_A(V_A−V_C)=−400 J 完全相同）；(3) 等压压缩放热 1.0e3 J（ΔU=−600 J、W_外界=+400 J 不变）；
//    同步重画 p-V 图 SVG（三段循环严格一致：竖直线+双曲线+水平线）
// ② #574 配图模板错误（新 bank-audit 校验项扫出）：波动题配了「匀强场区 +q」电场图 →
//    重画波形图（实线 t=0：y=A sin(πx/2+π/4)，λ=4 m；虚线 t=0.6 s = 实线右移 1 m，与
//    「+x 传播 Δx=(n+1/4)λ=n=0 取 1 m」及「−x 传播 Δx=(n+3/4)λ=3 m（右移 1 m ≡ 左移 3 m）」双读法自洽）；
//    同步修正解析 D 项分析：原「P、Q 均位于平衡位置」不成立（二者相距 3 m=3λ/4，不可能是等相位平衡位置
//    ——间距须为 λ/2 整数倍），改为按虚线斜率符号判定：两种传播方向下 P、Q 处虚线斜率符号均相反 →
//    速度方向均相反（独立重解：右移 1 m 时 solid'(1)=−A(π/2)cos(π/4)<0? 取 A sin(πx/2+π/4)：
//    dashed'(2)=solid'(1)=A(π/2)cos(3π/4)<0、dashed'(5)=solid'(4)=A(π/2)cos(π/4)>0；左移 3 m 时
//    dashed'(2)=solid'(5)=A(π/2)cos(11π/4)<0、dashed'(5)=solid'(8)=A(π/2)cos(π/4)>0）→ D 仍错误，答案 BC 不变
// 防护同 fix-accept20.mjs：动态构建 SET、仅更新 patch 字段
// 用法：node scripts/fix-accept24.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #698：题干删除 D 态、改三段循环；(3) 问 C→D → C→A ----------
const q698Stem = `一定质量的理想气体（可视为单原子分子气体）经历如图所示的循环过程：$A\\to B$ 为等容过程，压强由 $p_A=2.0\\times10^5\\ \\text{Pa}$ 升至 $p_B=4.0\\times10^5\\ \\text{Pa}$；$B\\to C$ 为等温过程，体积由 $V_B=2.0\\times10^{-3}\\ \\text{m}^3$ 膨胀到 $V_C=4.0\\times10^{-3}\\ \\text{m}^3$；随后经等压过程 $C\\to A$ 回到状态 $A$。已知该气体的内能 $U$ 与热力学温度 $T$ 成正比，$U=\\frac{3}{2}pV$。求：
（1）状态 $B$ 与状态 $C$ 的温度之比 $T_B:T_C$；
（2）整个循环过程中气体吸收的热量 $Q_{\\text{吸}}$ 与放出的热量 $Q_{\\text{放}}$ 之差（即净吸热）；
（3）判断 $C\\to A$ 过程中气体是吸热还是放热，并求出放热量。`
const q698Answer = `（1）$T_B:T_C=1:1$；（2）净吸热 $Q_{\\text{净}}\\approx1.5\\times10^2\\ \\text{J}$；（3）$C\\to A$ 过程气体放热，放热量 $Q_{CA}=1.0\\times10^3\\ \\text{J}$。`
const q698Solution = `（1）$B\\to C$ 为等温过程，故 $T_B=T_C$，即 $T_B:T_C=1:1$。
（2）循环过程内能变化为零，由热力学第一定律，取气体对外做功为正、吸热为正，则 $Q_{\\text{净}}=W_{\\text{对外,净}}$。
$A\\to B$ 为等容过程，不做功。
由 $B\\to C$ 等温得 $p_BV_B=p_CV_C$，故 $p_C=\\dfrac{p_BV_B}{V_C}=\\dfrac{4.0\\times10^5\\times2.0\\times10^{-3}}{4.0\\times10^{-3}}\\ \\text{Pa}=2.0\\times10^5\\ \\text{Pa}=p_A$，即 $C\\to A$ 恰好是压强为 $2.0\\times10^5\\ \\text{Pa}$ 的等压压缩，与题设自洽。
$B\\to C$ 为等温膨胀，气体对外做功。等温过程中 $pV=p_BV_B$ 为定值，该段在 $p$-$V$ 图中为双曲线。
取 $\\ln2\\approx0.69$，等温过程做功 $W_{BC}=p_BV_B\\ln\\dfrac{V_C}{V_B}=4.0\\times10^5\\times2.0\\times10^{-3}\\times0.69\\ \\text{J}\\approx5.5\\times10^2\\ \\text{J}$。
$C\\to A$ 为等压压缩，气体对外做功 $W_{CA}=p_A(V_A-V_C)=2.0\\times10^5\\times(2.0\\times10^{-3}-4.0\\times10^{-3})\\ \\text{J}=-4.0\\times10^2\\ \\text{J}$，即外界对气体做功 $4.0\\times10^2\\ \\text{J}$。
故净功 $W_{\\text{对外,净}}=W_{BC}+W_{CA}\\approx5.5\\times10^2\\ \\text{J}-4.0\\times10^2\\ \\text{J}=1.5\\times10^2\\ \\text{J}$，即净吸热 $Q_{\\text{净}}\\approx1.5\\times10^2\\ \\text{J}$。
（3）$C\\to A$ 为等压压缩：$V$ 减小，由盖-吕萨克定律 $\\dfrac{V}{T}=\\text{常量}$ 知 $T$ 降低，内能减小。
$\\Delta U_{CA}=\\frac{3}{2}p_A(V_A-V_C)=\\frac{3}{2}\\times2.0\\times10^5\\times(-2.0\\times10^{-3})\\ \\text{J}=-6.0\\times10^2\\ \\text{J}$。
取吸热为正、外界对气体做功为正，由 $\\Delta U=Q+W_{\\text{外界}}$，其中 $W_{\\text{外界}}=-W_{CA}=4.0\\times10^2\\ \\text{J}$，得 $Q_{CA}=\\Delta U_{CA}-W_{\\text{外界}}=-6.0\\times10^2\\ \\text{J}-4.0\\times10^2\\ \\text{J}=-1.0\\times10^3\\ \\text{J}$，负号表示放热，放热量为 $1.0\\times10^3\\ \\text{J}$。`

// #698 重画 p-V 图：A(2e-3,2e5)、B(2e-3,4e5)、C(4e-3,2e5)；
// A→B 竖直线（等容升压）、B→C 双曲线 pV=800（等温膨胀）、C→A 水平线（等压压缩）
// 坐标映射：V∈[1e-3,4.5e-3]→x∈[70,340]；p∈[0,4.5e5]→y∈[200,40]
function svg698() {
  const X = (V) => 70 + ((V - 1e-3) / 3.5e-3) * 270
  const Y = (p) => 200 - (p / 4.5e5) * 160
  const xA = X(2e-3), xC = X(4e-3), yB = Y(4e5), yAC = Y(2e5)
  // 等温双曲线采样 pV=800
  const pts = []
  for (let i = 0; i <= 40; i++) {
    const V = 2e-3 + (2e-3 * i) / 40
    pts.push(`${X(V).toFixed(1)},${Y(800 / V).toFixed(1)}`)
  }
  const FONT = `font-family="system-ui,'Microsoft YaHei',sans-serif"`
  return JSON.stringify({ kind: 'svg', data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="400" height="250" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="250" fill="none"/>` +
    // 坐标轴
    `<line x1="60" y1="200" x2="352" y2="200" stroke="#334155" stroke-width="1.8"/><polygon points="352,200 343,196 343,204" fill="#334155"/>` +
    `<line x1="60" y1="200" x2="60" y2="32" stroke="#334155" stroke-width="1.8"/><polygon points="60,32 56,41 64,41" fill="#334155"/>` +
    `<text x="358" y="215" font-size="13" fill="#334155" ${FONT}>V</text>` +
    `<text x="34" y="30" font-size="13" fill="#334155" ${FONT}>p</text>` +
    // 刻度与单位
    `<line x1="${xA}" y1="197" x2="${xA}" y2="203" stroke="#334155" stroke-width="1.4"/><text x="${xA}" y="218" font-size="12" fill="#64748b" text-anchor="middle" ${FONT}>2</text>` +
    `<line x1="${xC}" y1="197" x2="${xC}" y2="203" stroke="#334155" stroke-width="1.4"/><text x="${xC}" y="218" font-size="12" fill="#64748b" text-anchor="middle" ${FONT}>4</text>` +
    `<text x="200" y="236" font-size="12" fill="#64748b" text-anchor="middle" ${FONT}>V/×10⁻³m³</text>` +
    `<line x1="57" y1="${yAC}" x2="63" y2="${yAC}" stroke="#334155" stroke-width="1.4"/><text x="50" y="${yAC + 4}" font-size="12" fill="#64748b" text-anchor="end" ${FONT}>2</text>` +
    `<line x1="57" y1="${yB}" x2="63" y2="${yB}" stroke="#334155" stroke-width="1.4"/><text x="50" y="${yB + 4}" font-size="12" fill="#64748b" text-anchor="end" ${FONT}>4</text>` +
    `<text x="66" y="42" font-size="12" fill="#64748b" ${FONT}>/×10⁵Pa</text>` +
    // 辅助虚线
    `<line x1="${xA}" y1="${yAC}" x2="${xA}" y2="200" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>` +
    `<line x1="${xC}" y1="${yAC}" x2="${xC}" y2="200" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>` +
    `<line x1="60" y1="${yB}" x2="${xA}" y2="${yB}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>` +
    // A→B 等容升压（竖直向上箭头）
    `<line x1="${xA}" y1="${yAC}" x2="${xA}" y2="${yB + 8}" stroke="#4f46e5" stroke-width="2.4"/><polygon points="${xA},${yB + 1} ${xA - 4.5},${yB + 10} ${xA + 4.5},${yB + 10}" fill="#4f46e5"/>` +
    // B→C 等温膨胀（双曲线，末端箭头）
    `<polyline points="${pts.join(' ')}" fill="none" stroke="#4f46e5" stroke-width="2.4"/>` +
    `<polygon points="${xC + 2},${yAC} ${xC - 9},${yAC - 1.5} ${xC - 4},${yAC - 7.5}" fill="#4f46e5"/>` +
    // C→A 等压压缩（水平向左箭头）
    `<line x1="${xC - 6}" y1="${yAC}" x2="${xA + 10}" y2="${yAC}" stroke="#4f46e5" stroke-width="2.4"/><polygon points="${xA + 2},${yAC} ${xA + 11},${yAC - 4.5} ${xA + 11},${yAC + 4.5}" fill="#4f46e5"/>` +
    // 状态点与标注
    `<circle cx="${xA}" cy="${yAC}" r="3.5" fill="#334155"/><text x="${xA - 12}" y="${yAC + 16}" font-size="14" fill="#334155" ${FONT}>A</text>` +
    `<circle cx="${xA}" cy="${yB}" r="3.5" fill="#334155"/><text x="${xA - 12}" y="${yB - 6}" font-size="14" fill="#334155" ${FONT}>B</text>` +
    `<circle cx="${xC}" cy="${yAC}" r="3.5" fill="#334155"/><text x="${xC + 10}" y="${yAC - 8}" font-size="14" fill="#334155" ${FONT}>C</text>` +
    `</svg>` })
}

// ---------- #574：重画波形图（实线 t=0 / 虚线 t=0.6 s）+ 修正解析 D 项分析 ----------
// 实线 y=A sin(πx/2+π/4)（λ=4 m）；虚线 = 实线右移 1 m
function svg574() {
  const X = (x) => 45 + x * 32 // x∈[0,9] → 45..333
  const Y = (y) => 110 - y * 400 // A=0.1 → ±40 px
  const A = 0.1
  const solid = []
  const dashed = []
  for (let i = 0; i <= 180; i++) {
    const x = (9 * i) / 180
    solid.push(`${X(x).toFixed(1)},${Y(A * Math.sin(Math.PI * x / 2 + Math.PI / 4)).toFixed(1)}`)
    dashed.push(`${X(x).toFixed(1)},${Y(A * Math.sin(Math.PI * (x - 1) / 2 + Math.PI / 4)).toFixed(1)}`)
  }
  const FONT = `font-family="system-ui,'Microsoft YaHei',sans-serif"`
  return JSON.stringify({ kind: 'svg', data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/>` +
    // 坐标轴
    `<line x1="30" y1="110" x2="352" y2="110" stroke="#334155" stroke-width="1.8"/><polygon points="352,110 343,106 343,114" fill="#334155"/>` +
    `<line x1="45" y1="210" x2="45" y2="26" stroke="#334155" stroke-width="1.8"/><polygon points="45,26 41,35 49,35" fill="#334155"/>` +
    `<text x="358" y="124" font-size="13" fill="#334155" ${FONT}>x</text>` +
    `<text x="20" y="26" font-size="13" fill="#334155" ${FONT}>y</text>` +
    `<text x="330" y="136" font-size="12" fill="#64748b" ${FONT}>x/m</text>` +
    `<text x="8" y="38" font-size="12" fill="#64748b" ${FONT}>y/cm</text>` +
    // 实线（t=0）与虚线（t=0.6 s）
    `<polyline points="${solid.join(' ')}" fill="none" stroke="#4f46e5" stroke-width="2.4"/>` +
    `<polyline points="${dashed.join(' ')}" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="7 5"/>` +
    // 平衡位置参考点 P(x=2)、Q(x=5)（画在 x 轴上）
    `<circle cx="${X(2)}" cy="110" r="4" fill="#334155"/><text x="${X(2)}" y="130" font-size="14" fill="#334155" text-anchor="middle" ${FONT}>P</text>` +
    `<circle cx="${X(5)}" cy="110" r="4" fill="#334155"/><text x="${X(5)}" y="130" font-size="14" fill="#334155" text-anchor="middle" ${FONT}>Q</text>` +
    // 图例
    `<line x1="240" y1="40" x2="272" y2="40" stroke="#4f46e5" stroke-width="2.4"/><text x="278" y="44" font-size="12" fill="#64748b" ${FONT}>t=0</text>` +
    `<line x1="240" y1="62" x2="272" y2="62" stroke="#ef4444" stroke-width="2" stroke-dasharray="7 5"/><text x="278" y="66" font-size="12" fill="#64748b" ${FONT}>t=0.6s</text>` +
    `</svg>` })
}

const q574SolOld = `$t=0.6\\,\\text{s}$ 时刻的波形为虚线，$P$（$x=2\\,\\text{m}$）和 $Q$（$x=5\\,\\text{m}$）均位于平衡位置，二者相距 $\\dfrac{3}{4}\\lambda$，振动步调相差 $\\dfrac{3}{4}T$。若波沿 $x$ 轴正方向传播，$P$ 向下运动、$Q$ 向上运动；若波沿 $x$ 轴负方向传播，$P$ 向上运动、$Q$ 向下运动。两种情况下速度方向均相反，故D错误。`
const q574SolNew = `$t=0.6\\,\\text{s}$ 时刻的波形为虚线（=实线波形整体平移形成）。$P$（$x=2\\,\\text{m}$）与 $Q$（$x=5\\,\\text{m}$）相距 $\\dfrac{3}{4}\\lambda$。由图读虚线在 $P$、$Q$ 两处的斜率符号：若波沿 $x$ 轴正方向传播（虚线为实线右移 $\\dfrac{1}{4}\\lambda$），$P$ 处虚线斜率为负、$Q$ 处为正，由 $v_y=-v\\cdot$斜率得 $P$ 向上运动、$Q$ 向下运动；若波沿 $x$ 轴负方向传播（右移 $\\dfrac{1}{4}\\lambda$ 等价于左移 $\\dfrac{3}{4}\\lambda$），由 $v_y=+v\\cdot$斜率并结合该情形下 $P$、$Q$ 处斜率符号仍相反，得 $P$ 向下运动、$Q$ 向上运动。两种情况下 $t=0.6\\,\\text{s}$ 时刻 $P$ 与 $Q$ 的速度方向均相反，故D错误。`

// ---------- 执行（动态构建 SET，仅更新 patch 字段） ----------
const patches = [
  { id: 698, fields: { stem: q698Stem, answer: q698Answer, solution: q698Solution, figure: svg698() } },
  { id: 574, fields: { figure: svg574(), solution: 'REPLACE:' + q574SolOld + '→' + q574SolNew } },
]

if (DRY) {
  for (const p of patches) {
    const cur = db.prepare('SELECT stem, solution FROM questions WHERE id=?').get(p.id)
    if (!cur) { console.error('题不存在 #' + p.id); process.exit(1) }
    console.log(`#${p.id} dry-run：将更新字段 ${Object.keys(p.fields).join('/')}`)
    if (typeof p.fields.solution === 'string' && p.fields.solution.startsWith('REPLACE:')) {
      const [from, to] = p.fields.solution.slice(8).split('→')
      if (!cur.solution.includes(from)) { console.error(`#${p.id} 解析中未找到待替换原文！`); process.exit(1) }
      console.log(`  解析替换命中 ✓`)
    }
  }
  console.log('dry-run 校验通过，去掉 --dry-run 执行')
  process.exit(0)
}

// 逐题动态 SET（仅更新 patch 声明的字段）
for (const p of patches) {
  const sets = Object.keys(p.fields).map((k) => `${k}=@${k}`).join(', ')
  const params = { id: p.id }
  for (const [k, v] of Object.entries(p.fields)) {
    if (typeof v === 'string' && v.startsWith('REPLACE:')) {
      const [from, to] = v.slice(8).split('→')
      const cur = db.prepare(`SELECT ${k} AS v FROM questions WHERE id=@id`).get({ id: p.id })
      if (!cur || !String(cur.v).includes(from)) { console.error(`#${p.id}.${k} 未找到待替换原文，中止`); process.exit(1) }
      params[k] = String(cur.v).replace(from, to)
    } else params[k] = v
  }
  const r = db.prepare(`UPDATE questions SET ${sets} WHERE id=@id`).run(params)
  console.log(`#${p.id} 更新 ${r.changes} 行（字段：${Object.keys(p.fields).join('/')}）`)
}

// 回读自检：#698 题干不含 D 态等容段、答案不变关键词；(2) 净吸热 800ln2−400≈154.5≈1.5e2 J
const chk = db.prepare('SELECT stem, answer, solution FROM questions WHERE id=698').get()
console.log('\n== #698 自检 ==')
console.log('题干含「随后经等压过程 C→A 回到状态 A」:', chk.stem.includes('随后经等压过程'))
console.log('题干不含 D 态等容段:', !chk.stem.includes('D\\to A'))
console.log('答案净吸热 1.5e2 J:', chk.answer.includes('1.5\\times10^2'))
console.log('解析净功 5.5e2−4.0e2:', chk.solution.includes('5.5\\times10^2') && chk.solution.includes('4.0\\times10^2'))
console.log('解析无 W_CD/ΔU_CD 残留:', !chk.solution.includes('W_{CD}') && !chk.solution.includes('CD}'))
const chk2 = db.prepare('SELECT solution FROM questions WHERE id=574').get()
console.log('\n== #574 自检 ==')
console.log('解析已无「均位于平衡位置」:', !chk2.solution.includes('均位于平衡位置'))
console.log('解析含斜率判定:', chk2.solution.includes('斜率'))
