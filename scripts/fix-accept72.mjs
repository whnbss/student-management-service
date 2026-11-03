// 一次性脚本：按验收 #72 催办修 P1-121 + P3-122。
// P1-121：#477（弹性正碰，计算 D5）题干物理矛盾——m₁=0.6kg(甲) 重撞 m₂=0.2kg(乙)，
//         弹性正碰后 v₁′=(m₁−m₂)/(m₁+m₂)·v₀=+0.5v₀>0，甲必继续向右，与题干
//         「甲在桌面上向左运动」「(4) 甲沿桌面返回冲上圆弧轨道」直接矛盾；
//         且旧解析算出 v₁=+2 m/s（取右为正）却解释「为正表示方向向左」，符号解释错误。
// 修法（验收 #72 推荐口径：m₁↔m₂ 数值互换，甲 0.2kg / 乙 0.6kg）：
//         v₁′=(0.2−0.6)/0.8×4=−2 m/s → 甲 2 m/s 向左（题干成立）；v₂′=2×0.2/0.8×4=+2 m/s → 乙 2 m/s 向右；
//         (3) x=v₂t=2×0.5=1 m（旧 3 m）；(4) h′=v₁′²/2g=4/20=0.2 m<0.8 m 不能回原点（数值与旧版巧合相同，无需改）。
//         动量 0.2×4=0.8=0.2×(−2)+0.6×2 ✓；动能 ½×0.2×16=1.6=½×0.2×4+½×0.6×4 ✓ 双守恒。
//         改动范围：#477 stem（两处质量互换）+ answer（(2)(3) 数值）+ solution（(2)(3) 数值与符号解释）；pitfall/figure 不动（图无质量数值，甲乙/H/h 标注在位）。
// P3-122：删除 data/backups/pre-accept71.db 裸快照（不匹配 backup.ts 清理模式 app-*.db*，会永久滞留）。
//         本脚本自建快照命名 app-pre-accept72.db（匹配 app-*.db* 清理模式，1h 后轮转自动回收，不重蹈覆辙）。
// 用法：node scripts/fix-accept72.mjs [--dry-run]
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const get = db.prepare('SELECT id, stem, answer, solution, pitfall, figure FROM questions WHERE id=?')
const cnt = (s, sub) => s.split(sub).length - 1
const assert = (ok, msg) => {
  if (!ok) throw new Error(`断言失败：${msg}`)
}

// ---------- 读取 #477 原数据 ----------
const q = get.get(477)
assert(q, '#477 不存在')

// ---------- P1-121 · #477 质量互换 + answer/solution 数值修正 ----------
// 旧特征（替换前必须恰好存在，防盲替换）
const OLD_STEM_M1 = '质量 $m_1=0.6\\ \\text{kg}$ 的小球甲'
const OLD_STEM_M2 = '质量 $m_2=0.2\\ \\text{kg}$ 的小球乙'
const NEW_STEM_M1 = '质量 $m_1=0.2\\ \\text{kg}$ 的小球甲'
const NEW_STEM_M2 = '质量 $m_2=0.6\\ \\text{kg}$ 的小球乙'

const OLD_SOL_2 =
  '联立解得 $v_1=\\dfrac{m_1-m_2}{m_1+m_2}v_0=\\dfrac{0.4}{0.8}\\times 4=2\\ \\text{m/s}$，' +
  '$v_2=\\dfrac{2m_1}{m_1+m_2}v_0=\\dfrac{1.2}{0.8}\\times 4=6\\ \\text{m/s}$。' +
  '$v_1$ 为正表示碰后甲的速度大小为 $2\\ \\text{m/s}$、方向向左；乙速度大小为 $6\\ \\text{m/s}$、方向向右。'
const NEW_SOL_2 =
  '联立解得 $v_1=\\dfrac{m_1-m_2}{m_1+m_2}v_0=\\dfrac{-0.4}{0.8}\\times 4=-2\\ \\text{m/s}$，' +
  '$v_2=\\dfrac{2m_1}{m_1+m_2}v_0=\\dfrac{0.4}{0.8}\\times 4=2\\ \\text{m/s}$。' +
  '$v_1$ 为负表示碰后甲的速度大小为 $2\\ \\text{m/s}$、方向向左；乙速度大小为 $2\\ \\text{m/s}$、方向向右。'

const OLD_SOL_3 =
  '水平方向位移 $x=v_2 t=6\\times 0.5=3\\ \\text{m}$，即落地点到桌面右端边缘的水平距离为 $3\\ \\text{m}$'
const NEW_SOL_3 =
  '水平方向位移 $x=v_2 t=2\\times 0.5=1\\ \\text{m}$，即落地点到桌面右端边缘的水平距离为 $1\\ \\text{m}$'

const OLD_ANS_2_3 = '（2）甲 $2\\ \\text{m/s}$ 方向向左，乙 $6\\ \\text{m/s}$ 方向向右；（3）$3\\ \\text{m}$；'
const NEW_ANS_2_3 = '（2）甲 $2\\ \\text{m/s}$ 方向向左，乙 $2\\ \\text{m/s}$ 方向向右；（3）$1\\ \\text{m}$；'

// 内容一致幂等跳过（旧特征断言只对未修复状态做）
const alreadyFixed =
  cnt(q.stem, NEW_STEM_M1) === 1 && cnt(q.stem, NEW_STEM_M2) === 1 &&
  cnt(q.solution, NEW_SOL_2) === 1 && cnt(q.solution, NEW_SOL_3) === 1 && cnt(q.answer, NEW_ANS_2_3) === 1

if (alreadyFixed) {
  console.log('#477 已是新内容，幂等跳过')
} else {
  // 旧解法锚点断言（防内容漂移后盲替换）
  assert(cnt(q.stem, OLD_STEM_M1) === 1, `stem 旧 m₁ 特征应恰 1 处，实得 ${cnt(q.stem, OLD_STEM_M1)}`)
  assert(cnt(q.stem, OLD_STEM_M2) === 1, `stem 旧 m₂ 特征应恰 1 处，实得 ${cnt(q.stem, OLD_STEM_M2)}`)
  assert(cnt(q.solution, OLD_SOL_2) === 1, `solution 旧(2)块应恰 1 处`)
  assert(cnt(q.solution, OLD_SOL_3) === 1, `solution 旧(3)块应恰 1 处`)
  assert(cnt(q.answer, OLD_ANS_2_3) === 1, `answer 旧(2)(3)应恰 1 处`)
  // (4) 锚点（本次不改，但必须在位）
  assert(cnt(q.solution, '$h\'=\\dfrac{v_1^2}{2g}=\\dfrac{4}{20}=0.2\\ \\text{m}$') === 1, 'solution (4) h′=0.2 锚点应在位')
  assert(cnt(q.answer, '最大高度 $0.2\\ \\text{m}$') === 1, 'answer (4) 0.2 m 锚点应在位')

  // 应用替换 + 替换次数校验
  const stem = q.stem.replace(OLD_STEM_M1, NEW_STEM_M1).replace(OLD_STEM_M2, NEW_STEM_M2)
  const solution = q.solution.replace(OLD_SOL_2, NEW_SOL_2).replace(OLD_SOL_3, NEW_SOL_3)
  const answer = q.answer.replace(OLD_ANS_2_3, NEW_ANS_2_3)

  // 应用后旧特征清零、新特征恰 1
  assert(cnt(stem, OLD_STEM_M1) === 0 && cnt(stem, NEW_STEM_M1) === 1, 'stem 替换后校验失败')
  assert(cnt(stem, OLD_STEM_M2) === 0 && cnt(stem, NEW_STEM_M2) === 1, 'stem 替换后校验失败(m₂)')
  assert(cnt(solution, OLD_SOL_2) === 0 && cnt(solution, NEW_SOL_2) === 1, 'solution (2) 替换后校验失败')
  assert(cnt(solution, OLD_SOL_3) === 0 && cnt(solution, NEW_SOL_3) === 1, 'solution (3) 替换后校验失败')
  assert(cnt(answer, OLD_ANS_2_3) === 0 && cnt(answer, NEW_ANS_2_3) === 1, 'answer (2)(3) 替换后校验失败')
  assert(cnt(answer, '乙 $6') === 0 && cnt(solution, '6\\ \\text{m/s}') === 0, '旧 6 m/s 残留')
  assert(cnt(answer, '$3\\ \\text{m}$；') === 0, '旧 3 m 残留')

  // 独立复算：动量/动能双守恒 + v₁′/v₂′ 公式复核
  const m1 = 0.2, m2 = 0.6, v0 = 4
  const v1 = ((m1 - m2) / (m1 + m2)) * v0
  const v2 = ((2 * m1) / (m1 + m2)) * v0
  assert(Math.abs(v1 - (-2)) < 1e-9, `v1′ 复算应为 −2，实得 ${v1}`)
  assert(Math.abs(v2 - 2) < 1e-9, `v2′ 复算应为 +2，实得 ${v2}`)
  assert(Math.abs(m1 * v0 - (m1 * v1 + m2 * v2)) < 1e-9, '动量守恒复算失败')
  assert(Math.abs(0.5 * m1 * v0 * v0 - (0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2)) < 1e-9, '动能守恒复算失败')
  // (3) 平抛：t=√(2H/g)=0.5s，x=v₂t=1 m
  const t = Math.sqrt((2 * 1.25) / 10)
  assert(Math.abs(t - 0.5) < 1e-9 && Math.abs(v2 * t - 1) < 1e-9, '平抛 x=1 m 复算失败')
  // (4) h′=v₁²/2g=0.2<0.8
  assert(Math.abs((v1 * v1) / 20 - 0.2) < 1e-9, 'h′=0.2 m 复算失败')

  if (DRY) {
    console.log('[dry-run] 校验全过，未写入')
  } else {
    const tx = db.transaction(() => {
      db.prepare('UPDATE questions SET stem=?, answer=?, solution=? WHERE id=477').run(stem, answer, solution)
    })
    tx()

    // 回读断言
    const r = get.get(477)
    assert(cnt(r.stem, NEW_STEM_M1) === 1 && cnt(r.stem, NEW_STEM_M2) === 1, '回读 stem 失败')
    assert(cnt(r.stem, OLD_STEM_M1) === 0 && cnt(r.stem, OLD_STEM_M2) === 0, '回读 stem 旧特征残留')
    assert(cnt(r.solution, NEW_SOL_2) === 1 && cnt(r.solution, '为负表示') === 1, '回读 solution 失败')
    assert(cnt(r.solution, 'x=v_2 t=2\\times 0.5=1') === 1, '回读 solution (3) 失败')
    assert(cnt(r.answer, NEW_ANS_2_3) === 1, '回读 answer 失败')
    assert(cnt(r.answer, '6') === 0, '回读 answer 旧 6 m/s 残留')
    assert(r.pitfall === q.pitfall && r.figure === q.figure, 'pitfall/figure 必须零改动')
    assert(cnt(r.stem, '向左运动') === 1 && cnt(r.stem, '返回冲上圆弧轨道') === 1, '题干甲向左/返回结论句应保留')
    console.log('#477 已更新：stem 质量互换 + answer(2)(3) + solution(2)(3)')
  }
}

// ---------- P3-122 · 删除 backups 裸快照 pre-accept71.db ----------
const BK = path.join(ROOT, 'data', 'backups')
for (const f of ['pre-accept71.db', 'pre-accept71.db-shm', 'pre-accept71.db-wal']) {
  const p = path.join(BK, f)
  if (fs.existsSync(p)) {
    if (!DRY) fs.rmSync(p)
    console.log(`P3-122 ${DRY ? '[dry-run] 待删除' : '已删除'}裸快照：${f}`)
  } else {
    console.log(`P3-122 ${f} 不存在（幂等）`)
  }
}

// ---------- 全库一致性抽查：#477 唯一改动 ----------
const others = db
  .prepare("SELECT id FROM questions WHERE id != 477 AND (stem LIKE '%m_1=0.2%' AND stem LIKE '%m_2=0.6%')").all()
console.log(`同特征其它题：${others.length ? others.map((o) => o.id).join(',') : '无'}（应与本题口径无关）`)

db.close()
console.log(DRY ? 'dry-run 结束' : 'fix-accept72 完成')
