// 一次性脚本：验收 #74 之后的 P3 遗留打磨批（题库质量维护，只修已记录的文字/配图缺陷，零物理改动）
//   P3-64  #562 解析句式重复：「由 $t=…$ 得 $t=…$。由 $t=\dfrac{…}$ 可知…」同一公式两种定界符连写两遍（修复插入语与原句叠加）→ 合并为一句
//   P3-116 #562 配图瑕疵：小球画成贴斜面的旋转矩形且位置在斜面中部，缺 v₀ 水平箭头 → 重画：
//          「\」形斜面（左高右低）+ 小球圆在顶端抛出点悬空 + v₀ 水平箭头 + 虚线轨迹落到斜面上 + h 尺寸线 + 37° 底角标注
//   P3-63  #694 配图弱相关：只有「电源 E」「R」，缺 L/C 元件 → 补电感线圈符号（实线，标 L）+ 电容器符号（虚线，标 C）+ 切换接入说明
//   P3(#70) #750 配图符号不一致：图内用电器标「Rx」而题干为「R₀」→ 改「R₀」
//   不动的（监督明示可选/留观察）：#850 偏心销位置（P3-104）、#843 双角度标注（P3-68）
// 约束：每题旧特征恰 1 处断言（防盲替换）+ 内容一致幂等跳过 + 写库回读断言（其余字段零改动）；零 AI 调用。
// 用法：node scripts/fix-accept75.mjs [--dry-run]
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
const FONT = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const SVG_HEAD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/>'

// ---------- ① #562 解析去重（P3-64，仅改 solution） ----------
const q562 = get.get(562)
assert(q562, '#562 不存在')
const OLD_SOL_562 = '得 $t=\\frac{2v_0\\tan\\theta}{g}$。由 $t=\\dfrac{2v_0\\tan\\theta}{g}$ 可知增大初速度时运动时间变长，故 C 错误。'
const NEW_SOL_562 = '得 $t=\\frac{2v_0\\tan\\theta}{g}$，故增大初速度时运动时间变长，C 错误。'

if (cnt(q562.solution, NEW_SOL_562) === 1 && cnt(q562.solution, '。由 $t=') === 0) {
  console.log('#562 solution 已是去重版，幂等跳过')
} else {
  assert(cnt(q562.solution, OLD_SOL_562) === 1, `#562 solution 旧特征应恰 1 处，实得 ${cnt(q562.solution, OLD_SOL_562)}`)
  // 物理基准锚点（本项纯文案去重，解析数值一个都不许变）
  assert(cnt(q562.solution, '\\tan\\alpha=\\frac{v_y}{v_x}=\\frac{gt}{v_0}=2\\tan\\theta=\\frac32') === 1, '#562 tanα 锚点应在位')
  assert(cnt(q562.solution, 't=\\frac{2v_0\\tan37^\\circ}{g}') === 1, '#562 D 问代入锚点应在位')
  assert(cnt(q562.solution, 'y=\\frac12gt^2=\\frac12\\times10\\times0.36\\ \\text{m}=1.8\\ \\text{m}') === 1, '#562 D 问 y=1.8m 锚点应在位')

  const sol562 = q562.solution.replace(OLD_SOL_562, NEW_SOL_562)
  assert(cnt(sol562, '。由 $t=') === 0 && cnt(sol562, NEW_SOL_562) === 1, '#562 替换后校验失败')
  // 去重后语义等价自检：同一公式在 C 段只出现一次
  assert(cnt(sol562, '2v_0\\tan\\theta}{g}') === 1, '#562 C 段公式应恰 1 处')

  if (DRY) console.log('[dry-run] #562 solution 校验全过，未写入')
  else {
    db.prepare('UPDATE questions SET solution=? WHERE id=562').run(sol562)
    const r = get.get(562)
    assert(r.solution === sol562, '#562 solution 回读失败')
    assert(r.stem === q562.stem && r.answer === q562.answer && r.pitfall === q562.pitfall && r.figure === q562.figure, '#562 其余字段必须零改动')
    q562.solution = sol562 // 同步内存基准，供后续 figure 项的零改动断言使用
    console.log('#562 已更新：solution 去重（C 段合并为一句）')
  }
}

// ---------- ② #562 配图重画（P3-116，仅改 figure） ----------
// 「\」形斜面：顶点 (120,40)（左高）、底 (320,190)；tan37°=0.75 ⇔ dy=150 / dx=200 严格自洽
const FIG_562 =
  SVG_HEAD +
  '<line x1="40" y1="190" x2="360" y2="190" stroke="#334155" stroke-width="2"/>' +
  '<line x1="60" y1="200" x2="70" y2="190" stroke="#94a3b8" stroke-width="1.5"/>' +
  '<line x1="120" y1="200" x2="130" y2="190" stroke="#94a3b8" stroke-width="1.5"/>' +
  '<line x1="180" y1="200" x2="190" y2="190" stroke="#94a3b8" stroke-width="1.5"/>' +
  '<line x1="240" y1="200" x2="250" y2="190" stroke="#94a3b8" stroke-width="1.5"/>' +
  '<polygon points="120,40 100,190 320,190" fill="#eef2ff" stroke="#334155" stroke-width="2"/>' +
  '<path d="M 290,190 A 30,30 0 0 1 296,172" fill="none" stroke="#ef4444" stroke-width="1.5"/>' +
  `<text x="284" y="184" font-size="14" fill="#ef4444" text-anchor="end" ${FONT}>37°</text>` +
  '<circle cx="138" cy="34" r="8" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>' +
  `<text x="162" y="26" font-size="14" fill="#334155" text-anchor="start" ${FONT}>小球</text>` +
  '<line x1="150" y1="34" x2="192" y2="34" stroke="#2563eb" stroke-width="2"/>' +
  '<polygon points="198,34 189,29.5 189,38.5" fill="#2563eb"/>' +
  `<text x="171" y="22" font-size="14" fill="#2563eb" text-anchor="middle" ${FONT}>v₀</text>` +
  '<path d="M 146,42 Q 235,42 280,160" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 4"/>' +
  '<line x1="120" y1="48" x2="120" y2="184" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3 3"/>' +
  `<text x="110" y="120" font-size="14" fill="#64748b" text-anchor="middle" ${FONT}>h</text>` +
  '</svg>'

const fig562New = JSON.stringify({ kind: 'svg', data: FIG_562 })
if (q562.figure === fig562New) {
  console.log('#562 figure 已是新图，幂等跳过')
} else {
  // 旧图锚点：旋转矩形小球（四点 polygon）+ 无 v₀
  const oldFig562 = JSON.parse(q562.figure)
  assert(oldFig562.kind === 'svg', '#562 figure 应为 svg kind')
  const oldSvg562 = oldFig562.data
  assert(cnt(oldSvg562, '小球') === 1, '#562 旧图「小球」标签应恰 1 处')
  assert(cnt(oldSvg562, '<polygon') === 2, '#562 旧图应含斜面+旋转矩形两个 polygon（旧特征锚点）')
  assert(cnt(oldSvg562, 'v₀') === 0, '#562 旧图不应已有 v₀')
  // 新图自检：无 NaN、无答案泄露（B 项正确结论与 A/C/D 数值都不入图；37°/h/v₀ 均为题干已知或符号）
  assert(cnt(FIG_562, 'NaN') === 0 && cnt(FIG_562, 'undefined') === 0, '#562 新图含 NaN/undefined')
  assert(cnt(FIG_562, '37°') === 1, '#562 新图 37° 应恰 1 处（题干已知）')
  assert(cnt(FIG_562, '>B<') === 0 && cnt(FIG_562, '正确') === 0, '#562 新图不得泄露答案')
  // 几何自检：斜面 tanθ=150/200=0.75=tan37°；落点 (280,160) 在斜面上（y=40+0.75×160）
  assert(Math.abs(150 / 200 - Math.tan((37 / 180) * Math.PI)) < 0.01, '#562 斜面倾角应为 37°')
  assert(Math.abs(40 + 0.75 * (280 - 120) - 160) < 1e-9, '#562 轨迹落点应在斜面上')

  if (DRY) console.log('[dry-run] #562 figure 校验全过，未写入')
  else {
    db.prepare('UPDATE questions SET figure=? WHERE id=562').run(fig562New)
    const r = get.get(562)
    assert(r.figure === fig562New, '#562 figure 回读失败')
    assert(r.stem === q562.stem && r.answer === q562.answer && r.solution === q562.solution && r.pitfall === q562.pitfall, '#562 stem/answer/solution/pitfall 必须零改动')
    console.log('#562 已更新：figure 重画（顶端抛出点小球 + v₀ 箭头 + 虚线轨迹 + h 尺寸线）')
  }
}

// ---------- ③ #694 配图补 L/C 元件（P3-63，仅改 figure，在原 SVG 基础上追加） ----------
const q694 = get.get(694)
assert(q694, '#694 不存在')
const fig694New = (() => {
  const old = JSON.parse(q694.figure)
  assert(old.kind === 'svg', '#694 figure 应为 svg kind')
  let svg = old.data
  if (cnt(svg, '>L<') === 1 && cnt(svg, '>C<') === 1) return null // 幂等
  // 旧图锚点：顶部走线缺口 150~260（L/C 应画在此），且当前无 L/C 元件
  assert(cnt(svg, 'x1="150" y1="60" x2="260" y2="60"') === 0, '#694 顶部缺口应为两段走线')
  assert(cnt(svg, '>电源 E<') === 1 && cnt(svg, '>R<') === 1, '#694 旧图锚点（电源 E / R）应在位')
  assert(cnt(svg, '>L<') === 0 && cnt(svg, '>C<') === 0, '#694 旧图不应已有 L/C')
  const add =
    // 电感线圈（实线，顶行走线缺口内，150~222，四个上凸半圆）
    '<path d="M 150,60 A 12,12 0 0 1 174,60 A 12,12 0 0 1 198,60 A 12,12 0 0 1 222,60" fill="none" stroke="#334155" stroke-width="2"/>' +
    `<text x="186" y="46" font-size="14" fill="#334155" text-anchor="middle" ${FONT}>L</text>` +
    // 电容器（虚线，第三次换入的替代元件，与 L 同位切换）
    '<line x1="222" y1="60" x2="228" y2="60" stroke="#334155" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<line x1="232" y1="44" x2="232" y2="76" stroke="#334155" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<line x1="240" y1="44" x2="240" y2="76" stroke="#334155" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<line x1="244" y1="60" x2="260" y2="60" stroke="#334155" stroke-width="2" stroke-dasharray="4 3"/>' +
    `<text x="236" y="94" font-size="14" fill="#334155" text-anchor="middle" ${FONT}>C</text>` +
    `<text x="205" y="24" font-size="11" fill="#64748b" text-anchor="middle" ${FONT}>L、C 切换接入（虚线为 C）</text>`
  svg = svg.replace('</svg>', add + '</svg>')
  assert(cnt(svg, '>L<') === 1 && cnt(svg, '>C<') === 1, '#694 追加后 L/C 标签应恰各 1 处')
  assert(cnt(svg, 'NaN') === 0, '#694 新图含 NaN')
  return JSON.stringify({ kind: 'svg', data: svg })
})()

if (!fig694New) {
  console.log('#694 figure 已含 L/C，幂等跳过')
} else {
  if (DRY) console.log('[dry-run] #694 figure 校验全过，未写入')
  else {
    db.prepare('UPDATE questions SET figure=? WHERE id=694').run(fig694New)
    const r = get.get(694)
    assert(r.figure === fig694New, '#694 figure 回读失败')
    assert(r.stem === q694.stem && r.answer === q694.answer && r.solution === q694.solution && r.pitfall === q694.pitfall, '#694 stem/answer/solution/pitfall 必须零改动')
    console.log('#694 已更新：figure 补电感 L（实线）+ 电容 C（虚线）+ 切换接入说明')
  }
}

// ---------- ④ #750 配图符号对齐（P3，仅改 figure：Rx → R₀） ----------
// 图题符号一致性：题干用电器符号为 R₀ 的题，图内不得标 Rx（#70 验收对 #750 的观察）。
// 全库含 Rx 图的其余题（#566/#568/#684/#685/#745/#746/#749/#751）题干未用 R₀ 符号（待测电阻 Rx 属教材惯用标注），不动。
const rxTargets = db
  .prepare("SELECT id, stem, answer, solution, pitfall, figure FROM questions WHERE figure LIKE '%>Rx<%'")
  .all()
  .filter((q) => q.stem.includes('R_{0}') || q.stem.includes('R₀'))
// 目标态：#750 图内为 R₀ 且标签已移出电压表圆遮挡区（x=330,y=92）
const q750Cur = get.get(750)
const cur750 = JSON.parse(q750Cur.figure).data
const done750 = cnt(cur750, '>R₀<') === 1 && cnt(cur750, 'Rx') === 0 && cnt(cur750, 'x="330" y="92"') === 1
if (done750) {
  console.log('#750 figure 已是 R₀（含标签移位），幂等跳过')
} else {
  // 两步修复（各自幂等）：Rx→R₀（未做时）；标签移出电压表圆遮挡（未做时）
  assert(rxTargets.length <= 1, `题干用 R₀ 的 Rx 图应至多 #750 一题，实得 ${rxTargets.map((q) => q.id).join(',')}`)
  const q750 = q750Cur
  const old = JSON.parse(q750.figure)
  assert(old.kind === 'svg', '#750 figure 应为 svg kind')
  let svg = old.data
  let changed = false
  if (cnt(svg, '>Rx<') === 1) {
    assert(q750.stem.includes('R_{0}=10\\ \\Omega'), '#750 题干 R₀ 锚点应在位')
    assert(q750.stem.includes('滑动变阻器 $R$'), '#750 题干变阻器 R 锚点应在位')
    svg = svg.replace('>Rx<', '>R₀<')
    changed = true
  }
  if (cnt(svg, 'x="354" y="129"') === 1) {
    // R₀ 原位置（x=354）被电压表圆（cx=370 r=16）遮挡不可读，移到用电器矩形正上方
    svg = svg.replace('<text x="354" y="129" font-size="13"', '<text x="330" y="92" font-size="13"')
    changed = true
  }
  assert(cnt(svg, 'Rx') === 0 && cnt(svg, '>R₀<') === 1 && cnt(svg, 'x="330" y="92"') === 1, '#750 目标态校验失败')
  if (!changed) {
    console.log('#750 figure 无需变更')
  } else if (DRY) {
    console.log('[dry-run] #750 figure 校验全过，未写入')
  } else {
    const figNew = JSON.stringify({ kind: 'svg', data: svg })
    db.prepare('UPDATE questions SET figure=? WHERE id=750').run(figNew)
    const r = get.get(750)
    assert(r.figure === figNew, '#750 figure 回读失败')
    assert(r.stem === q750.stem && r.answer === q750.answer && r.solution === q750.solution && r.pitfall === q750.pitfall, '#750 stem/answer/solution/pitfall 必须零改动')
    console.log('#750 已更新：figure 用电器标注 Rx → R₀ 并移出电压表遮挡区')
  }
}

// ---------- 全库收尾自检：旧特征清零（题干用 R₀ 的题图内不得再有 Rx；dry-run 不写库故跳过） ----------
if (!DRY) {
  const leftovers = db
    .prepare("SELECT id, stem, figure FROM questions WHERE figure LIKE '%>Rx<%'")
    .all()
    .filter((q) => q.stem.includes('R_{0}') || q.stem.includes('R₀'))
  assert(leftovers.length === 0, `旧特征残留：${leftovers.map((o) => o.id).join(',')}`)
}

db.close()
console.log(DRY ? 'dry-run 结束' : 'fix-accept75 完成')
