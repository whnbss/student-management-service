// 一次性脚本：按验收 #13 的指令修正 3 道题（P1-11 / P1-12 / P2-24）
// - #276（P1-11 回归）：fix-accept12b.mjs 的三列无条件更新把 answer 清成了 null（undefined 绑定为 null），
//   此处补回 answer='B'（μ 改 0.2 后 ω=√(0.2×10/0.5)=2rad/s，选项 B 成立）
// - #443（P1-12 几何 slip）：原解析用 θ=2×(90°−30°)=120° 是错的——弦切角定理应为
//   圆心角 = 2×弦切角；极端验证：垂直入射 90° 时圆心角 180°=2×90° ✓，而原公式得 0° 显然错。
//   改为劣弧 60°：t=πm/(3qB)；同时重画配图（垂直纸面向外用 ⊙ 符号、入射速度与边界成 30°、
//   劣弧轨迹 + 圆心 O 与半径辅助线），图文自洽
// - #444（P2-24）：解析自行引入「水平面光滑」但题干未交代 → 题干补「光滑水平面」
// 长期修法（本次统一）：所有一次性修复脚本一律「动态构建 SET、patch.x ?? cur.x 回退」，
// 绝不再无条件三列全量 UPDATE（fix-accept12b.mjs 已同步补上同款防护，防再次误运行）
// 用法：node scripts/fix-accept13.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// ---------- #443 新配图：竖直边界 + 右侧场区（⊙ 垂直纸面向外）+ 入射 30° + 劣弧轨迹 ----------
// 几何：边界 x=150（竖直线），入射点 P=(150,90)，速度与边界成 30°（向右下），
// 轨迹半径 r=80px，圆心 O 在边界外（左侧），劣弧圆心角 60°，出射点 Q=(150,170)
const q443figure = JSON.stringify({
  kind: 'svg',
  data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/><rect x="150" y="30" width="230" height="180" fill="#eef2ff" opacity="0.55"/>${[[205,60],[265,60],[325,60],[205,110],[265,110],[325,110],[205,160],[265,160],[325,160]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#ffffff" stroke="#64748b" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="1.8" fill="#334155"/>`).join('')}<text x="267" y="48" font-size="13" fill="#64748b" text-anchor="middle" font-family="system-ui,'Microsoft YaHei',sans-serif">B（垂直纸面向外）</text><line x1="150" y1="30" x2="150" y2="210" stroke="#334155" stroke-width="2"/><text x="142" y="44" font-size="12" fill="#64748b" text-anchor="end" font-family="system-ui,'Microsoft YaHei',sans-serif">边界</text><line x1="80.7" y1="130" x2="150" y2="90" stroke="#94a3b8" stroke-width="1.3" stroke-dasharray="4 3"/><line x1="80.7" y1="130" x2="150" y2="170" stroke="#94a3b8" stroke-width="1.3" stroke-dasharray="4 3"/><text x="70" y="134" font-size="13" fill="#334155" text-anchor="middle" font-family="system-ui,'Microsoft YaHei',sans-serif">O</text><path d="M 150 90 A 80 80 0 0 1 150 170" fill="none" stroke="#4f46e5" stroke-width="2" stroke-dasharray="6 4"/><polygon points="160.7,140 156.4,130.5 165,130.5" fill="#4f46e5"/><circle cx="150" cy="90" r="4" fill="#334155"/><circle cx="150" cy="170" r="4" fill="#334155"/><line x1="150" y1="90" x2="150" y2="120" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M 150 106 A 16 16 0 0 0 158 103.9" fill="none" stroke="#334155" stroke-width="1.2"/><line x1="150" y1="90" x2="165" y2="116" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/><polygon points="169,122.9 168.5,114 161.5,118" fill="#ef4444"/><text x="174" y="112" font-size="14" fill="#ef4444" font-style="italic" font-family="system-ui,'Microsoft YaHei',sans-serif">v</text><text x="153" y="124" font-size="11" fill="#334155" font-family="system-ui,'Microsoft YaHei',sans-serif">30°</text></svg>`,
})

// ---------- #443：劣弧 60°，t=πm/(3qB)（弦切角定理正确表述 + 极端检验自证） ----------
const q443 = {
  answer: `$\\dfrac{mv}{qB}$；$\\dfrac{\\pi m}{3qB}$`,
  solution: `洛伦兹力提供向心力：$qvB=\\dfrac{mv^{2}}{r}$，得 $r=\\dfrac{mv}{qB}$。
粒子入射点与出射点都在边界上，这段圆弧的弦就在边界上。由弦切角定理：圆弧在入射点处的切线（入射速度方向）与弦（边界）的夹角，等于该弧所对圆心角的一半。入射速度与边界成 $30^{\\circ}$ 角，故轨迹圆心角 $\\theta=2\\times 30^{\\circ}=60^{\\circ}=\\dfrac{\\pi}{3}$（劣弧，如图）。
运动时间 $t=\\dfrac{\\theta}{2\\pi}T=\\dfrac{60^{\\circ}}{360^{\\circ}}\\times\\dfrac{2\\pi m}{qB}=\\dfrac{\\pi m}{3qB}$。
检验：若粒子垂直于边界射入（夹角 $90^{\\circ}$），圆心角应为 $2\\times 90^{\\circ}=180^{\\circ}$（半圆），对应 $t=\\dfrac{\\pi m}{qB}$，与弦切角定理一致。`,
  figure: q443figure,
}

// ---------- #444：题干补「光滑」（解析按动量定理 Δp=Ft=8 全归 F，需光滑前提） ----------
const q444Stem = `质量为 $m=2\\,\\text{kg}$ 的物块在光滑水平面上以 $v_0=6\\,\\text{m/s}$ 的速度向右运动，现对物块施加一个水平向左的恒力 $F=4\\,\\text{N}$，作用时间 $t=2\\,\\text{s}$ 后撤去该力。取向右为正方向，在力 $F$ 作用的这 $2\\,\\text{s}$ 内，下列说法正确的是（　　）
A. 力 $F$ 的冲量大小为 $8\\,\\text{N}\\cdot\\text{s}$，方向向右
B. 力 $F$ 的冲量大小为 $8\\,\\text{N}\\cdot\\text{s}$，方向向左
C. 这 $2\\,\\text{s}$ 内物块动量变化量的大小为 $8\\,\\text{kg}\\cdot\\text{m/s}$，方向向右
D. 这 $2\\,\\text{s}$ 内物块动量变化量的大小为 $20\\,\\text{kg}\\cdot\\text{m/s}$，方向向左`

// ---------- #276：补回被 fix-accept12b.mjs 清空的 answer（μ=0.2 后 B 成立） ----------
const updates = [
  [276, { answer: `B` }],
  [443, q443],
  [444, { stem: q444Stem }],
]

// 统一防护：动态构建 SET 子句，仅更新 patch 提供的字段，未提供的字段一律保持库中现值（cur 回退）
const get = db.prepare('SELECT id, stem, answer, solution, pitfall, figure FROM questions WHERE id = ?')

for (const [id, patch] of updates) {
  const cur = get.get(id)
  if (!cur) { console.log(`题 ${id} 不存在，跳过`); continue }
  const cols = Object.keys(patch)
  const next = {}
  for (const c of cols) {
    // ?? 回退：patch 值为 undefined/null 时保持现值，杜绝 undefined 绑定为 null 清空列（P1-11 根因）
    const v = patch[c] ?? cur[c]
    if (v === undefined || v === null) throw new Error(`题 ${id} 字段 ${c} 的 patch 与现值均为空，拒绝执行`)
    next[c] = v
    if (cur[c] == null && v != null) console.log(`  提示：题 ${id} 的 ${c} 原为空（${c === 'answer' ? 'P1-11 回归现场' : '原本缺失'}），本次补入`)
  }
  const setSql = cols.map((c) => `${c}=?`).join(', ')
  if (DRY) { console.log(`[dry-run] 题 ${id}：更新 ${setSql}；answer→${String(next.answer).slice(0, 40)}`); continue }
  db.prepare(`UPDATE questions SET ${setSql} WHERE id = ?`).run(...cols.map((c) => next[c]), id)
  console.log(`题 ${id} 已更新（${cols.join('/')}）`)
}

// ---------- 复测断言 ----------
const checks = [
  [`SELECT answer FROM questions WHERE id=276`, (r) => r.answer === 'B', `#276 answer='B'`],
  [`SELECT answer, solution FROM questions WHERE id=443`, (r) => /\\pi m\}\{3qB\}/.test(r.answer || '') && !/120\^?\{?\\circ/.test(r.solution), `#443 t=πm/(3qB) 且无 120° 残留`],
  [`SELECT stem FROM questions WHERE id=444`, (r) => /光滑水平面/.test(r.stem), `#444 题干含「光滑水平面」`],
  [`SELECT COUNT(*) AS n FROM questions WHERE answer IS NULL OR TRIM(answer)=''`, (r) => r.n === 0, `全库 answer 非空（0 题为空）`],
]
for (const [sql, ok, name] of checks) {
  const r = db.prepare(sql).get()
  console.log(`${ok(r) ? '✓' : '✗'} 复测：${name}`)
  if (!ok(r)) process.exitCode = 1
}

db.close()
