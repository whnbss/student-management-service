// 一次性脚本：按验收 #73 催办修 P1-123。
// P1-123：#10（均匀直杆+水平绳+铰链，计算 D4）answer 字段与自家解析不一致且数值物理不可能——
//         解析（正确）：对 A 取矩 T·L·cos30°=mg·(L/2)·sin30° → T=(mg/2)tan30°=5√3/3≈2.89 N；
//         F_x=T=2.89 N、F_y=mg=10 N → F=√(25/3+100)=√(325/3)=5√39/3≈10.4 N。
//         answer（错误）：T=10√3/3≈5.77 N（恰为解析 2 倍——把重力力臂错当 L 而非 L/2）
//                        F=10√7/3≈8.82 N（物理不可能：绳水平 ⇒ 铰链竖直分量必为 mg=10 N，F≥10 恒成立，8.82<10 矛盾）。
// 修法（验收 #73 推荐口径）：仅改 answer 字段为解析正确值；stem/solution/figure/pitfall 零改动。
// 独立复算：T=5×tan30°/2=5/(2√3)×2=…（见脚本内断言）；F=√((5/√3)²+10²)=√(325/3)≈10.408。
// 用法：node scripts/fix-accept73.mjs [--dry-run]
import Database from 'better-sqlite3'
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

// ---------- 读取 #10 原数据 ----------
const q = get.get(10)
assert(q, '#10 不存在')

// ---------- P1-124 · #141（回旋加速器）answer 字段修正（解析已正确，仅改 answer） ----------
// 新增 P1（本轮 bank-audit 2f answer/solution 一致性口径发现，与 #10 同族「解析对、答案错」）：
//   题干 givens：B=1.0T、U=2.0e4V、R=0.5m、m=1.6e-27kg、q=1.6e-19C
//   独立复算：v_m=qBR/m=1.6e-19×1.0×0.5/1.6e-27=5.0e7 m/s；E_km=½mv²=½×1.6e-27×2.5e15=2.0e-12 J（=12.5 MeV）；
//             n=E_km/(qU)=2.0e-12/3.2e-15=625
//   旧 answer（错 2 倍）：E_km≈1.0e-12 J（约 6.25 MeV）、n≈313；解析为 2.0e-12 J / 625（正确基准）
const q141 = get.get(141)
assert(q141, '#141 不存在')

const OLD_ANS_141 =
  '（1）$E_{km}\\approx1.0\\times10^{-12}\\ \\mathrm{J}$（约 $6.25\\ \\mathrm{MeV}$）；（2）$n\\approx313$ 次'
const NEW_ANS_141 =
  '（1）$E_{km}\\approx2.0\\times10^{-12}\\ \\mathrm{J}$（约 $12.5\\ \\mathrm{MeV}$）；（2）$n\\approx625$ 次'

const already141 = cnt(q141.answer, NEW_ANS_141) === 1
if (already141) {
  console.log('#141 已是新内容，幂等跳过')
} else {
  assert(cnt(q141.answer, OLD_ANS_141) === 1, `#141 answer 旧特征应恰 1 处，实得 ${cnt(q141.answer, OLD_ANS_141)}`)
  // 解析正确值锚点
  assert(cnt(q141.solution, '2.0\\times10^{-12}\\ \\mathrm{J}') >= 1, 'solution E_km=2.0e-12 锚点应在位')
  assert(cnt(q141.solution, '\\approx625') === 2, `solution n≈625 锚点应恰 2 处，实得 ${cnt(q141.solution, '\\approx625')}`)
  assert(cnt(q141.stem, '1.6\\times10^{-27}') === 1 && cnt(q141.stem, '2.0\\times10^4') === 1, '#141 题干已知量锚点应在位')

  const answer141 = q141.answer.replace(OLD_ANS_141, NEW_ANS_141)
  assert(cnt(answer141, OLD_ANS_141) === 0 && cnt(answer141, NEW_ANS_141) === 1, '#141 answer 替换后校验失败')
  assert(cnt(answer141, '1.0\\times10^{-12}') === 0 && cnt(answer141, '6.25') === 0 && cnt(answer141, '313') === 0, '#141 旧值残留')

  // 独立复算
  const qe = 1.6e-19, me = 1.6e-27, B = 1.0, R = 0.5, U = 2.0e4
  const vm = (qe * B * R) / me
  assert(Math.abs(vm - 5.0e7) < 1, `v_m 复算应为 5.0e7，实得 ${vm}`)
  const Ekm = 0.5 * me * vm * vm
  assert(Math.abs(Ekm - 2.0e-12) < 1e-15, `E_km 复算应为 2.0e-12 J，实得 ${Ekm}`)
  assert(Math.abs(Ekm / 1.6e-13 - 12.5) < 1e-9, 'E_km=12.5 MeV 复算失败')
  const n = Ekm / (qe * U)
  assert(Math.abs(n - 625) < 1e-9, `n 复算应为 625，实得 ${n}`)

  if (DRY) {
    console.log('[dry-run] #141 校验全过，未写入')
  } else {
    db.transaction(() => {
      db.prepare('UPDATE questions SET answer=? WHERE id=141').run(answer141)
    })()
    const r141 = get.get(141)
    assert(cnt(r141.answer, NEW_ANS_141) === 1, '回读 #141 answer 失败')
    assert(r141.stem === q141.stem && r141.solution === q141.solution && r141.pitfall === q141.pitfall && r141.figure === q141.figure, '#141 stem/solution/pitfall/figure 必须零改动')
    console.log('#141 已更新：answer 字段（E_km=2.0e-12 J≈12.5 MeV、n≈625）')
  }
}

// ---------- P1-123 · #10 answer 字段修正（解析已正确，仅改 answer） ----------
const OLD_ANS =
  '绳拉力 $T=\\dfrac{10\\sqrt3}{3}\\,\\mathrm{N}\\approx5.77\\,\\mathrm{N}$，' +
  '铰链作用力 $F=\\dfrac{10\\sqrt7}{3}\\,\\mathrm{N}\\approx8.82\\,\\mathrm{N}$'
const NEW_ANS =
  '绳拉力 $T=\\dfrac{5\\sqrt3}{3}\\,\\mathrm{N}\\approx2.89\\,\\mathrm{N}$，' +
  '铰链作用力 $F=\\dfrac{5\\sqrt{39}}{3}\\,\\mathrm{N}\\approx10.4\\,\\mathrm{N}$'

// 内容一致幂等跳过
const alreadyFixed = cnt(q.answer, NEW_ANS) === 1

if (alreadyFixed) {
  console.log('#10 已是新内容，幂等跳过')
} else {
  // 旧答案锚点断言（防内容漂移后盲替换）
  assert(cnt(q.answer, OLD_ANS) === 1, `answer 旧特征应恰 1 处，实得 ${cnt(q.answer, OLD_ANS)}`)
  // 解析正确值锚点（必须在位——本脚本不改 solution，但需确认解析确实是正确基准）
  assert(cnt(q.solution, '\\dfrac{5\\sqrt3}{3}') === 2, `solution T=5√3/3 锚点应恰 2 处，实得 ${cnt(q.solution, '\\dfrac{5\\sqrt3}{3}')}`)
  assert(cnt(q.solution, 'F_x=T=\\dfrac{5\\sqrt3}{3}') === 1, 'solution F_x=T 锚点应在位')
  assert(cnt(q.solution, '\\dfrac{5\\sqrt{39}}{3}') === 1, 'solution F=5√39/3 锚点应在位')
  assert(cnt(q.solution, '10.4') === 1, 'solution 10.4 锚点应在位')

  const answer = q.answer.replace(OLD_ANS, NEW_ANS)

  // 应用后旧特征清零、新特征恰 1
  assert(cnt(answer, OLD_ANS) === 0 && cnt(answer, NEW_ANS) === 1, 'answer 替换后校验失败')
  assert(cnt(answer, '10\\sqrt3') === 0 && cnt(answer, '10\\sqrt7') === 0, '旧 10√3/10√7 残留')
  assert(cnt(answer, '5.77') === 0 && cnt(answer, '8.82') === 0, '旧 5.77/8.82 残留')

  // 独立复算：T=(mg/2)tan30°；F=√(T²+(mg)²)
  const g = 10
  const T = (1 * g / 2) * Math.tan(Math.PI / 6) // = 5/√3 ≈ 2.887
  const F = Math.sqrt(T * T + g * g) // = √(25/3+100) = √(325/3) ≈ 10.408
  assert(Math.abs(T - 5 / Math.sqrt(3)) < 1e-9, `T 复算应为 5/√3，实得 ${T}`)
  assert(Math.abs(T - 2.887) < 0.001, `T≈2.89 复算失败，实得 ${T.toFixed(4)}`)
  assert(Math.abs(F - Math.sqrt(325 / 3)) < 1e-9, `F 复算应为 √(325/3)，实得 ${F}`)
  assert(Math.abs(F - 10.408) < 0.001, `F≈10.4 复算失败，实得 ${F.toFixed(4)}`)
  // 物理约束：绳水平 ⇒ 铰链竖直分量 = mg = 10 N ⇒ F ≥ 10 N（旧 8.82 直接矛盾）
  assert(F >= 10, '物理约束 F≥10 应成立')

  if (DRY) {
    console.log('[dry-run] 校验全过，未写入')
  } else {
    const tx = db.transaction(() => {
      db.prepare('UPDATE questions SET answer=? WHERE id=10').run(answer)
    })
    tx()

    // 回读断言
    const r = get.get(10)
    assert(cnt(r.answer, NEW_ANS) === 1, '回读 answer 失败')
    assert(cnt(r.answer, '10\\sqrt3') === 0 && cnt(r.answer, '10\\sqrt7') === 0, '回读 answer 旧特征残留')
    assert(r.stem === q.stem && r.solution === q.solution && r.pitfall === q.pitfall && r.figure === q.figure, 'stem/solution/pitfall/figure 必须零改动')
    console.log('#10 已更新：answer 字段（T=5√3/3≈2.89 N、F=5√39/3≈10.4 N）')
  }
}

// ---------- 全库一致性抽查：#10 唯一改动 ----------
const others = db
  .prepare("SELECT id FROM questions WHERE id != 10 AND answer LIKE '%10\\u005Csqrt7%'").all()
console.log(`同特征其它题：${others.length ? others.map((o) => o.id).join(',') : '无'}（应为 0）`)

db.close()
console.log(DRY ? 'dry-run 结束' : 'fix-accept73 完成')
