// 一次性脚本：按验收 #32 的指令修正欠账问题（P1-18 / P1-17 / P2-51 / P3-52）
// 独立重解自验（每题均从题干条件重新推导，不依赖原解析）：
// - #888(3)（P1-18）：近地卫星 T=2π√(R/g)=2×3.14×√(3.2e6/5.0)=2×3.14×√(6.4e5)=2×3.14×800=5024 s≈5.0×10³ s
//   （原库 answer 与 solution 均写 4.0×10³，系「√6.4e5=800」开方后乘 2π 时漏乘——2×3.14×800=5024，
//   前两空 7.7e23 / 5.6e3 独立复算正确，不动）
// - #891(1)（P1-17）：解析自身 t₁=(4−2)/2=1 s、x₁=3 m<L=6 m、x₂=3 m、t₂=3/4=0.75 s，
//   总时间 t=1+0.75=1.75 s（原「t=t₁+t₂=2.25」与自身 t₂=0.75 矛盾，系求和 slip；其余各问已对，不动）
// - #872（P3-52）：解析 3 处裸 ^circ（60^circ/30^circ/rsin30^circ）→ ^\circ（KaTeX 报错源）
// - #763/#764（P2-51）：figure 中 1 个坐标计算为 NaN 的 ⊗ 符号组（circle + 2 line）→ 删除
//   （该图另有两个正常的 ⊗ 符号与 B₂ 标注，删除失效符号组不影响图义）
// - #834（P2-51）：粗糙段 AB 矩形内 8 条斜纹 y 坐标为 NaN → 按「贴矩形上边缘的短斜纹」修复
//   （矩形 y=150~185，斜纹样式与图中地面短斜纹一致 dx=−7/dy=+8 → y1=150、y2=158）
// 长期防护：沿用 cur 回退 + 动态 SET + 空值拒执行（P1-11 教训）；更新后逐题回读断言
// 用法：node scripts/fix-accept32.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

const patches = []

// ---------- #888：第三空 4.0e3 → 5.0e3 ----------
{
  const cur = db.prepare('SELECT answer, solution FROM questions WHERE id = 888').get()
  const answer = cur.answer.replace('$4.0\\times10^{3}$', '$5.0\\times10^{3}$')
  const solution = cur.solution.replace('\\approx4.0\\times10^{3}\\,\\text{s}', '\\approx5.0\\times10^{3}\\,\\text{s}')
  patches.push({ id: 888, answer, solution, expect: (r) => r.answer.includes('5.0\\times10^{3}') && !r.answer.includes('4.0\\times10^{3}') && r.solution.includes('5.0\\times10^{3}') })
}

// ---------- #891：(1) 2.25 s → 1.75 s ----------
{
  const cur = db.prepare('SELECT answer, solution FROM questions WHERE id = 891').get()
  const answer = cur.answer.replace('$t=2.25\\,\\mathrm{s}$', '$t=1.75\\,\\mathrm{s}$')
  const solution = cur.solution.replace('总时间 $t=t_1+t_2=2.25\\,\\mathrm{s}$', '总时间 $t=t_1+t_2=1+0.75=1.75\\,\\mathrm{s}$')
  patches.push({ id: 891, answer, solution, expect: (r) => r.answer.includes('1.75') && !r.answer.includes('2.25') && r.solution.includes('1.75') })
}

// ---------- #872：裸 ^circ ×3 → ^\circ，rsin → r\sin ----------
{
  const cur = db.prepare('SELECT solution FROM questions WHERE id = 872').get()
  let solution = cur.solution.replaceAll('^circ', '^\\circ')
  solution = solution.replace('d+rsin30^\\circ', 'd+r\\sin30^\\circ')
  patches.push({ id: 872, solution, expect: (r) => !r.solution.includes('^circ') && r.solution.includes('r\\sin30^\\circ') })
}

// ---------- #763/#764：删除 NaN ⊗ 符号组；#834：修复 NaN 斜纹 y 坐标 ----------
{
  const rows = db.prepare('SELECT id, figure FROM questions WHERE id IN (763, 764, 834)').all()
  for (const r of rows) {
    const f = JSON.parse(r.figure)
    let data = f.data
    if (r.id === 834) {
      // 粗糙段矩形 y=150~185，斜纹贴上边缘（与图中地面斜纹 dx=−7/dy=+8 同样式）
      data = data.replaceAll('y1="NaN"', 'y1="150"').replaceAll('y2="NaN"', 'y2="158"')
    } else {
      // 删除坐标为 NaN 的失效 ⊗ 符号组（circle + line 元素）
      data = data.replace(/<circle[^>]*NaN[^>]*\/>/g, '').replace(/<line[^>]*NaN[^>]*\/>/g, '')
    }
    patches.push({ id: r.id, figure: JSON.stringify({ ...f, data }), expect: (q) => !String(q.figure || '').includes('NaN') })
  }
}

// ---------- 执行（动态 SET + cur 回退 + 空值拒执行） ----------
if (DRY) {
  console.log('[dry-run] 待更新', patches.map((p) => `#${p.id}(${Object.keys(p).filter((k) => k !== 'id' && k !== 'expect').join(',')})`).join(' '))
} else {
  let n = 0
  for (const p of patches) {
    const cols = Object.keys(p).filter((k) => k !== 'id' && k !== 'expect')
    const cur = db.prepare('SELECT * FROM questions WHERE id = ?').get(p.id)
    if (!cur) throw new Error(`#${p.id} 不存在`)
    const assign = {}
    for (const c of cols) {
      const v = p[c]
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        if (c === 'figure') assign[c] = v ?? cur[c] // figure 允许置空
        else throw new Error(`#${p.id} ${c} 修正值为空，拒执行（cur 回退防护）`)
      } else assign[c] = v
    }
    const setSql = Object.keys(assign).map((c) => `${c} = @${c}`).join(', ')
    db.prepare(`UPDATE questions SET ${setSql} WHERE id = @id`).run({ ...assign, id: p.id })
    // 逐题回读断言
    const after = db.prepare('SELECT * FROM questions WHERE id = ?').get(p.id)
    if (!p.expect(after)) throw new Error(`#${p.id} 更新后断言未通过`)
    console.log(`✓ #${p.id} 已修正并断言通过（${cols.join('/')}）`)
    n++
  }
  console.log(`共更新 ${n} 题`)
}

// ---------- 全库残留复查 ----------
const nanLeft = db.prepare("SELECT id FROM questions WHERE figure LIKE '%NaN%'").all()
console.log(nanLeft.length ? `✗ figure 仍含 NaN：${nanLeft.map((r) => '#' + r.id).join(' ')}` : '✓ 全库 figure NaN 残留 0')
const circLeft = db.prepare("SELECT id FROM questions WHERE solution LIKE '%^circ%' ESCAPE '\\'").all()
console.log(circLeft.length ? `✗ 裸 ^circ 残留：${circLeft.map((r) => '#' + r.id).join(' ')}` : '✓ 全库裸 ^circ 残留 0')
db.close()
