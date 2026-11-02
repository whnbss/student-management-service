// 验收 #71 催办执行（P1-118 同族坏模板 13 题批量重画 + P3-119 #477 标注 + P3-120 #231 kp）
// 判例同 #561/#671：只修 figure（#231 仅修 knowledge_points），答案/解析/题干零改动。
// 幂等三件套：旧特征断言（防盲替换）→ 替换 → 回读断言（箭头方向/双体结构/无 NaN/场景匹配/零答案泄露）。
// 用法：node scripts/fix-accept71.mjs
import Database from 'better-sqlite3'

const db = new Database('data/app.db')
const FF = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/>'

// ---------- 通用图元（全部右向箭头：line 终点留 9px，polygon 尖在 x2，与 #477 原右向箭头同几何） ----------
const esc = (s) => s // 文案里无 <>&，直接用
function txt(x, y, t, fill = '#334155', size = 14, anchor = 'middle') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FF}>${esc(t)}</text>`
}
// 水平向右箭头（tip 在 x2）
function arrowR(x1, x2, y, color = '#ef4444') {
  return `<line x1="${x1}" y1="${y}" x2="${x2 - 9}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round"/><polygon points="${x2},${y} ${x2 - 9},${y + 4.05} ${x2 - 9},${y - 4.05}" fill="${color}"/>`
}
// 地面线 + 斜纹
function ground(y) {
  let s = `<line x1="40" y1="${y}" x2="360" y2="${y}" stroke="#334155" stroke-width="2"/>`
  for (let x = 52; x <= 328; x += 38) s += `<line x1="${x}" y1="${y + 10}" x2="${x + 10}" y2="${y}" stroke="#94a3b8" stroke-width="1.5"/>`
  return s
}
function box(x, y, w, h, label, fill = '#c7d2fe', size = 15) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="#334155" stroke-width="2"/>` +
    (label ? txt(x + w / 2, y + h / 2 + 5, label, '#334155', size) : '')
}
// ⊗（竖直向下磁场符号）
function cross(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#334155" stroke-width="1.5"/>` +
    `<line x1="${cx - 5}" y1="${cy - 5}" x2="${cx + 5}" y2="${cy + 5}" stroke="#334155" stroke-width="1.5"/>` +
    `<line x1="${cx - 5}" y1="${cy + 5}" x2="${cx + 5}" y2="${cy - 5}" stroke="#334155" stroke-width="1.5"/>`
}
const svgOf = (inner) => JSON.stringify({ kind: 'svg', data: HEAD + inner + '</svg>' })

// ---------- 13 题新图 ----------
const FIGS = {}

// #206 传送带向右运行：双轮+带+物块左端+v₀ 右向箭头+L 尺寸线
FIGS[206] = svgOf(
  `<line x1="60" y1="151" x2="340" y2="151" stroke="#334155" stroke-width="2"/>` +
  `<line x1="60" y1="179" x2="340" y2="179" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="60" cy="165" r="14" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="340" cy="165" r="14" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  box(95, 105, 70, 46, 'm=2 kg') +
  txt(130, 196, 'μ=0.2', '#334155', 12) +
  arrowR(200, 330, 138) +
  txt(265, 122, '传送带 v₀=4 m/s（向右）', '#ef4444', 13) +
  `<line x1="60" y1="200" x2="60" y2="210" stroke="#334155" stroke-width="1.5"/><line x1="340" y1="200" x2="340" y2="210" stroke="#334155" stroke-width="1.5"/>` +
  `<line x1="60" y1="205" x2="340" y2="205" stroke="#94a3b8" stroke-width="1.5"/>` +
  txt(200, 224, 'L=10 m', '#334155', 13)
)

// #244 导轨+导体棒：双轨+左端 R+竖直棒+v₀ 右向箭头+B⊗
FIGS[244] = svgOf(
  `<line x1="60" y1="140" x2="340" y2="140" stroke="#334155" stroke-width="2"/>` +
  `<line x1="60" y1="190" x2="340" y2="190" stroke="#334155" stroke-width="2"/>` +
  `<line x1="60" y1="140" x2="60" y2="153" stroke="#334155" stroke-width="2"/>` +
  `<rect x="48" y="153" width="24" height="24" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
  `<line x1="60" y1="177" x2="60" y2="190" stroke="#334155" stroke-width="2"/>` +
  txt(84, 169, 'R', '#334155', 14, 'start') +
  `<line x1="200" y1="132" x2="200" y2="198" stroke="#334155" stroke-width="5"/>` +
  txt(200, 122, '导体棒（m，r）', '#334155', 13) +
  arrowR(215, 305, 165) +
  txt(268, 150, 'v₀（水平向右）', '#ef4444', 13) +
  cross(130, 105) + cross(190, 105) + cross(250, 105) + cross(310, 105) +
  txt(220, 80, 'B（竖直向下）', '#334155', 13)
)

// #269 / #272 / #455 / #659 / #890 单物块 + 水平向右箭头（同族单体重画）
function singleBlockF(boxLabel, fLabel) {
  return svgOf(
    ground(170) +
    box(150, 124, 90, 46, boxLabel) +
    arrowR(60, 145, 147) +
    txt(95, 118, fLabel, '#ef4444', 14)
  )
}
FIGS[269] = singleBlockF('m=2 kg', 'F=10 N（水平向右）')
FIGS[272] = singleBlockF('m=2 kg', 'F（水平向右）')
FIGS[455] = singleBlockF('箱子', 'F（水平向右）')
FIGS[659] = singleBlockF('m=2 kg', 'F（水平向右）')
FIGS[890] = singleBlockF('m=2 kg', 'F=10 N（水平向右）')

// #386 斜向右上 37° 拉力（几何：tan37°=0.75，方向单位 (0.8,-0.6)）
{
  const sx = 185, sy = 124, len = 96, tipLen = 105
  const ex = sx + len * 0.8, ey = sy - len * 0.6 // (261.8, 66.4)
  const tx = sx + tipLen * 0.8, ty = sy - tipLen * 0.6 // (269, 61)
  const px = 4.05 * 0.6, py = 4.05 * 0.8
  FIGS[386] = svgOf(
    ground(170) +
    box(150, 124, 90, 46, 'm=2 kg') +
    `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>` +
    `<polygon points="${tx},${ty} ${Number((ex + px).toFixed(1))},${Number((ey + py).toFixed(1))} ${Number((ex - px).toFixed(1))},${Number((ey - py).toFixed(1))}" fill="#ef4444"/>` +
    txt(310, 75, 'F=10 N', '#ef4444', 14) +
    txt(310, 95, '斜向右上，θ=37°', '#ef4444', 12)
  )
}

// 板块双体通用：地面 + 长木板 + 块 + 标注
function boardScene({ boardLabel, blockLabel, blockX, extra }) {
  const g = 185
  return svgOf(
    ground(g) +
    `<rect x="100" y="150" width="240" height="35" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
    txt(220, 172, boardLabel, '#334155', 14) +
    box(blockX, 115, 60, 35, blockLabel, '#c7d2fe', 12) +
    (extra || '')
  )
}

// #559：A 在 B 上，F 水平向右拉 B（箭头贴 B 左缘朝右）
FIGS[559] = boardScene({
  boardLabel: 'B（M=2 kg）', blockLabel: 'A', blockX: 120,
  extra: arrowR(40, 95, 167) + txt(70, 210, 'F（水平向右，拉 B）', '#ef4444', 13),
})

// #660：木板 M 左端放 m，F 水平向右拉物块（箭头贴 m 左缘朝右）+ L 尺寸线
FIGS[660] = svgOf(
  ground(185) +
  `<rect x="100" y="150" width="240" height="35" rx="3" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(240, 172, 'M=1 kg', '#334155', 14) +
  box(105, 115, 66, 35, 'm=2 kg', '#c7d2fe', 12) +
  arrowR(30, 100, 132) +
  txt(60, 105, 'F（水平向右）', '#ef4444', 13) +
  `<line x1="100" y1="200" x2="100" y2="210" stroke="#334155" stroke-width="1.5"/><line x1="340" y1="200" x2="340" y2="210" stroke="#334155" stroke-width="1.5"/>` +
  `<line x1="100" y1="205" x2="340" y2="205" stroke="#94a3b8" stroke-width="1.5"/>` +
  txt(220, 224, 'L=2 m', '#334155', 13)
)

// #672：A 以 v₀ 从左端滑上 B（A 块 + v₀ 右向箭头）
FIGS[672] = boardScene({
  boardLabel: 'B（M=2 kg）', blockLabel: 'A', blockX: 105,
  extra: arrowR(175, 255, 132) + txt(215, 118, 'v₀=8 m/s', '#ef4444', 13),
})

// #839：木板右端放 m，F 水平向右作用于木板（双体 + F 箭头贴板左缘朝右）
FIGS[839] = boardScene({
  boardLabel: 'M=2 kg', blockLabel: 'm=1 kg', blockX: 270,
  extra: arrowR(40, 95, 167) + txt(70, 210, 'F=11 N（水平向右）', '#ef4444', 13),
})

// #896：木板右端放滑块 m，F 水平向右作用于木板
FIGS[896] = boardScene({
  boardLabel: 'M=2 kg', blockLabel: 'm=1 kg', blockX: 270,
  extra: arrowR(40, 95, 167) + txt(70, 210, 'F=14 N（水平向右）', '#ef4444', 13),
})

// #477（P3-119）：甲乙归属 + H/h 符号与题干一致（H=1.25 m 桌面高 / h=0.8 m 弧高），零答案数值
FIGS[477] = svgOf(
  `<line x1="30" y1="190" x2="370" y2="190" stroke="#334155" stroke-width="2"/>` +
  `<rect x="40" y="90" width="120" height="100" fill="#eef2ff" stroke="#334155" stroke-width="2"/>` +
  txt(100, 145, '桌面', '#64748b', 13) +
  `<path d="M 95 45 A 45 45 0 0 1 140 90" fill="none" stroke="#334155" stroke-width="2"/>` +
  `<circle cx="95" cy="37" r="8" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(95, 22, '甲', '#334155', 13) +
  `<line x1="82" y1="45" x2="82" y2="90" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
  txt(90, 70, 'h=0.8 m', '#64748b', 12, 'start') +
  `<circle cx="152" cy="82" r="8" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  txt(152, 64, '乙', '#334155', 13) +
  arrowR(164, 220, 82) +
  `<path d="M 162 84 Q 225 92 295 190" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 5"/>` +
  `<line x1="160" y1="90" x2="160" y2="190" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4"/>` +
  txt(172, 140, 'H=1.25 m', '#64748b', 12, 'start')
)

// ---------- 旧特征（防盲替换）与新完成标记 ----------
const OLD_SIG = {
  206: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  244: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  269: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  272: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  455: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  659: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  890: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  896: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  386: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  559: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  660: (f) => f.includes('>m</text>') && !f.includes('M=1 kg'),
  672: (f) => f.includes('<line x1="140" y1="146" x2="99" y2="146"'),
  839: (f) => f.includes('>m</text>') && !f.includes('M=2 kg'),
  477: (f) => f.includes('h=1.25m'),
}
const NEW_MARK = {
  206: '传送带 v₀=4 m/s（向右）',
  244: 'B（竖直向下）',
  269: 'F=10 N（水平向右）',
  272: 'F（水平向右）',
  455: 'F（水平向右）',
  659: 'F（水平向右）',
  890: 'F=10 N（水平向右）',
  896: 'F=14 N（水平向右）',
  386: '斜向右上，θ=37°',
  559: 'F（水平向右，拉 B）',
  660: 'M=1 kg',
  672: '>v₀=8 m/s</text>',
  839: 'F=11 N（水平向右）',
  477: 'H=1.25 m',
}
// 上一轮脚本产物的陈旧标记（本脚本迭代修正后须强制重替换，如 #672 标签曾带「向右」未过场景断言）
const STALE_MARK = { 672: 'v₀=8 m/s（向右）' }

// ---------- 执行（幂等：已修→跳过；旧图→替换；两者皆无→报错终止） ----------
const upd = db.prepare('UPDATE questions SET figure = ? WHERE id = ?')
const get = db.prepare('SELECT id, figure FROM questions WHERE id = ?')
let replaced = 0, skipped = 0, failed = 0
for (const [idStr, fig] of Object.entries(FIGS)) {
  const id = Number(idStr)
  const row = get.get(id)
  if (!row) { console.log(`✗ #${id} 不存在`); failed++; continue }
  // 库内 figure 为 JSON 字符串（内层引号带反斜杠转义），先归一再做特征匹配（同监督 sweep 口径）
  const cur = String(row.figure || '').replace(/\\"/g, '"')
  let curData = null
  try { curData = JSON.parse(row.figure).data } catch { /* 非法 JSON 走特征分支 */ }
  const isOld = OLD_SIG[id](cur)
  const isStale = !!(STALE_MARK[id] && cur.includes(STALE_MARK[id]))
  const isNew = cur.includes(NEW_MARK[id]) && !isStale
  if (curData !== null && curData === JSON.parse(fig).data) { skipped++; continue } // 内容一致，幂等跳过
  if (isOld || isStale || isNew) { /* 旧坏图或本脚本历史版本 → 重替换 */ }
  else { console.log(`✗ #${id} 既无旧坏模板特征也无新图标记 → 终止防盲替换`); failed++; continue }
  upd.run(fig, id)
  replaced++
}
console.log(`figure 替换 ${replaced} / 跳过(已修) ${skipped} / 失败 ${failed}`)
if (failed > 0) process.exit(1)

// #231（P3-120）：kp 移除与题干无关的「光电效应（规律与方程）」（同 #385 判例，仅 kp 字段）
{
  const row = db.prepare('SELECT knowledge_points FROM questions WHERE id = 231').get()
  const kps = JSON.parse(row.knowledge_points)
  const cleaned = kps.filter((k) => !k.includes('光电效应'))
  if (cleaned.length !== kps.length) {
    db.prepare('UPDATE questions SET knowledge_points = ? WHERE id = 231').run(JSON.stringify(cleaned))
    console.log(`#231 kp：${JSON.stringify(kps)} → ${JSON.stringify(cleaned)}`)
  } else console.log('#231 kp 已无「光电效应」，跳过')
}

// ---------- 回读断言（几何级） ----------
console.log('--- 回读断言 ---')
const rows = db.prepare('SELECT id, stem, figure, knowledge_points FROM questions WHERE id IN (206,244,269,272,455,659,890,896,386,559,660,672,839,477) ORDER BY id').all()
function parseArrows(svg) {
  const out = []
  const re = /<polygon points="([-\d.,\s]+)" fill="(#[0-9a-f]{6})"\s*\/>/g
  let m
  while ((m = re.exec(svg))) {
    const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number))
    const mid = [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2]
    let tip = pts[0], best = -1
    for (const p of pts) { const d = Math.hypot(p[0] - mid[0], p[1] - mid[1]); if (d > best) { best = d; tip = p } }
    const dx = tip[0] - mid[0], dy = tip[1] - mid[1]
    if (Math.abs(dx) > Math.abs(dy) * 1.05) out.push({ dir: dx > 0 ? 'R' : 'L' })
    else if (Math.abs(dy) > Math.abs(dx) * 1.05) out.push({ dir: dy < 0 ? 'U' : 'D' })
  }
  return out
}
let assertFail = 0
for (const r of rows) {
  const fig = JSON.parse(r.figure)
  const svg = fig.data
  const stem = String(r.stem)
  const arrows = parseArrows(svg)
  const errs = []
  if (svg.includes('NaN')) errs.push('NaN')
  if (fig.kind !== 'svg') errs.push('kind')
  // 方向断言：题干「向右」且无「向左」时，水平箭头必须全朝右
  if (/向右/.test(stem) && !/向左/.test(stem)) {
    const horiz = arrows.filter((a) => a.dir === 'R' || a.dir === 'L')
    if (horiz.some((a) => a.dir === 'L')) errs.push('水平箭头含朝左')
  }
  // 双体结构断言：板块题可见矩形（板+块）≥2
  if (/木板|长板/.test(stem) && /物块|滑块/.test(stem)) {
    const rects = [...svg.matchAll(/<rect ([^>]+)\/>/g)].filter((m) => !/fill="none"/.test(m[1])).length
    if (rects < 2) errs.push(`双体仅 ${rects} 矩形`)
  }
  // 场景匹配：图内中文 token 每字须见于题干
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ')
  const toks = [...new Set([...texts.matchAll(/[一-龥]{2,}/g)].map((m) => m[0]))]
  const miss = toks.filter((t) => ![...t].some((ch) => stem.includes(ch)))
  if (miss.length) errs.push(`场景不匹配:${miss.join(',')}`)
  // #477 专项：甲乙标注 + H/h 符号正确，旧混淆值清除
  if (r.id === 477) {
    if (!svg.includes('甲') || !svg.includes('乙')) errs.push('缺甲乙标注')
    if (!svg.includes('H=1.25 m') || !svg.includes('h=0.8 m')) errs.push('缺 H/h 尺寸')
    if (svg.includes('h=1.25m')) errs.push('旧混淆 h=1.25m 残留')
    // 甲乙是文本节点才算（而非题干子串）
    const hasJiaYi = /<text[^>]*>[^<]*甲[^<]*<\/text>/.test(svg) && /<text[^>]*>[^<]*乙[^<]*<\/text>/.test(svg)
    if (!hasJiaYi) errs.push('甲乙非图内标注')
  }
  if (errs.length) { assertFail++; console.log(`✗ #${r.id}: ${errs.join('；')}`) }
  else console.log(`✓ #${r.id}: 箭头[${arrows.map((a) => a.dir).join(',') || '无'}] 方向/结构/场景/NaN 全过`)
}
const kp231 = JSON.parse(db.prepare('SELECT knowledge_points FROM questions WHERE id = 231').get().knowledge_points)
if (kp231.some((k) => k.includes('光电效应'))) { assertFail++; console.log('✗ #231 kp 仍含光电效应') } else console.log(`✓ #231 kp = ${JSON.stringify(kp231)}`)

db.close()
if (assertFail > 0) { console.log(`✗ 回读断言失败 ${assertFail} 项`); process.exit(1) }
console.log('✅ 全部回读断言通过')
