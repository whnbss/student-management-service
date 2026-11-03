// 题库一键体检（验收 #13 建议②长期修法）：npm run bank-audit 等价于 npx tsx scripts/bank-audit.mts
// 合并口径：总数与分布 + 覆盖（精确节名）+ 缺图 + 字面 \n（后非字母）+ 字段非空（P1-11：answer 不得为空）+ 数值复核
// 补题批后必跑，报告贴评论；任一硬校验失败 exit 1
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'
import { checkSolutionArithmetic, requiresFigure } from '../packages/shared/src/index.ts'

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'app.db'), { readonly: true })
const rows = db.prepare('SELECT id, stem, answer, solution, pitfall, qtype, difficulty, figure, knowledge_points FROM questions ORDER BY id').all() as any[]
const kpOf = (r: string): string[] => { try { return JSON.parse(r || '[]') } catch { return [] } }
const norm = (s: string): string => String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—')
const BS = String.fromCharCode(92)
const LIT = new RegExp(BS + BS + 'n(?![a-zA-Z])', 'g') // 字面 反斜杠+n，后非字母

let hardFail = 0
// ---------- 1. 字段非空（P1-11 长期修法：answer 非空为硬校验） ----------
const emptyIds: string[] = []
for (const r of rows) {
  const miss: string[] = []
  if (!String(r.stem ?? '').trim()) miss.push('stem')
  if (!String(r.answer ?? '').trim()) miss.push('answer')
  if (!String(r.solution ?? '').trim()) miss.push('solution')
  if (miss.length) emptyIds.push(`#${r.id}(${miss.join('/')})`)
}
if (emptyIds.length) { hardFail++; console.log(`✗ 字段非空：${emptyIds.length} 题缺失 → ${emptyIds.join(' ')}`) }
else console.log(`✓ 字段非空：${rows.length} 题 stem/answer/solution 全部非空`)

// ---------- 2. 缺图守卫 ----------
const noFig = rows.filter((r) => /如图|图所示/.test(String(r.stem || '')) && !String(r.figure || '').trim())
if (noFig.length) { hardFail++; console.log(`✗ 缺图：${noFig.length} 题题干称「如图」但 figure 为空 → ${noFig.map((r) => '#' + r.id).join(' ')}`) }
else console.log('✓ 缺图：0 题（题干称「如图」的题均有配图）')

// ---------- 2b. figure NaN 守卫（#32 新增：坐标计算为 NaN 的 SVG 渲染即 console error，#763/#764/#834 教训） ----------
const nanFig = rows.filter((r) => String(r.figure || '').includes('NaN'))
if (nanFig.length) { hardFail++; console.log(`✗ figure NaN：${nanFig.length} 题配图含 NaN 坐标（渲染即报错）→ ${nanFig.map((r) => '#' + r.id).join(' ')}`) }
else console.log('✓ figure NaN：0 题（全部配图坐标有效）')

// ---------- 2a-2. B1 配图铁律进度（非硬校验：概念题豁免，仅报告涉计算/情境题的配图覆盖率） ----------
{
  const need = rows.filter((r) => requiresFigure(String(r.stem || ''), String(r.qtype || '')))
  const covered = need.filter((r) => String(r.figure || '').trim())
  const rate = need.length ? ((covered.length / need.length) * 100).toFixed(1) : '100.0'
  console.log(`- B1 配图铁律口径：涉计算/情境题 ${need.length} 题，已配图 ${covered.length} 题（覆盖率 ${rate}%${Number(rate) < 90 ? '，未达 90% 目标' : ''}）`)
  if (Number(rate) < 90) {
    console.log('  未配图题：' + need.filter((r) => !String(r.figure || '').trim()).map((r) => '#' + r.id).join(' '))
  }
}

// ---------- 2b. 配图场景匹配守卫（#24 教训：#698/#574 波动/热学题配了电场模板图） ----------
// #25 升级：凡 figure 非空的题**全部**参与校验（此前仅查题干含「如图」的题，漏掉了 #609 天体题配「+q 匀强场区」等
// 题干不含「如图」的错配，以及题干写「图甲/图乙」式引用的题）。图内含中文的标签若没有任何一个字出现在
// 题干中，判为场景不匹配。轴标签/纯字母数字标签不参与。
const sceneBad: string[] = []
for (const r of rows) {
  let fig: any = null
  try { fig = JSON.parse(String(r.figure || 'null')) } catch { continue }
  if (!fig || fig.kind !== 'svg') continue
  const texts = [...String(fig.data).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ')
  const cnTokens = [...new Set([...texts.matchAll(/[一-龥]{2,}/g)].map((m) => m[0]))]
  const stem = String(r.stem)
  const miss = cnTokens.filter((t) => ![...t].some((ch) => stem.includes(ch)))
  if (miss.length) sceneBad.push(`#${r.id}(${miss.join(',')})`)
}
if (sceneBad.length) { hardFail++; console.log(`✗ 配图场景：${sceneBad.length} 题图内中文标签与题干场景不匹配（疑为错误模板配图）→ ${sceneBad.join(' ')}`) }
else console.log('✓ 配图场景：全部非空配图（不限题干是否称「如图」）中文标签均与题干匹配')

// ---------- 2c. 模板强标记守卫（#25 新增：非电磁类知识点却带「匀强场区」「+q」电场模板图 → 硬失败） ----------
// #609（万有引力天体）题干不含「如图」且图内「匀强场区」的「匀」撞上题干「匀速」逃过字面匹配，
// 但图是电场模板残留。此处用「知识点是否含电磁类关键词」作门槛，比字面匹配更稳。
const EM_KP = /电场|磁场|电磁|感应|楞次|安培|洛伦兹|发电机|电动机|电容器|电荷|带电|电势|等势|库仑|静电|回旋|加速器|偏转|充放电|辉光|阴极|示波/
const STRONG_TPL = /匀强场区|\+q/
const tmplBad: string[] = []
for (const r of rows) {
  let fig: any = null
  try { fig = JSON.parse(String(r.figure || 'null')) } catch { continue }
  if (!fig || fig.kind !== 'svg') continue
  const texts = [...String(fig.data).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ')
  if (!STRONG_TPL.test(texts)) continue
  let kps: string[] = []
  try { kps = JSON.parse(r.knowledge_points || '[]') } catch { /* ignore */ }
  if (!kps.some((k) => EM_KP.test(k))) tmplBad.push(`#${r.id}`)
}
if (tmplBad.length) { hardFail++; console.log(`✗ 模板强标记：${tmplBad.length} 题知识点非电磁类但图内含「匀强场区/+q」电场模板标记 → ${tmplBad.join(' ')}`) }
else console.log('✓ 模板强标记：0 题（非电磁类知识点无「匀强场区/+q」残留）')

// ---------- 2d. 弹簧标签守卫（验收 #38 P1-20：spring 模板「压缩量 x=…」与题干语境错配） ----------
// ① 方向词错配：图标「压缩量」而题干是拉伸/悬挂语境（钩码→弹簧必拉伸）→ 硬失败
// ② 幻数值：图标「压缩量/伸长量 x=数值」的数值必须可从题干/答案/解析溯源（字面数值或 mm/cm 等价换算），
//    纯符号题不得出现幻数值（#783/#848 教训）；「振幅/形变量/示意」等标注豁免
const SPRING_MIS = /拉伸|伸长|钩码|悬挂/
const sprBad: string[] = []
for (const r of rows) {
  let fig: any = null
  try { fig = JSON.parse(String(r.figure || 'null')) } catch { continue }
  if (!fig || fig.kind !== 'svg') continue
  const texts = [...String(fig.data).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
  const stem = String(r.stem || '')
  // 溯源数字池：题干/答案/解析中全部数值 token（归一化尾零，0.10 与 0.1 视为同值）
  const poolNums = new Set<number>()
  for (const src of [r.stem, r.answer, r.solution]) {
    for (const m of String(src ?? '').matchAll(/\d+(?:\.\d+)?/g)) poolNums.add(parseFloat(m[0]))
  }
  for (const t of texts) {
    if (/压缩量/.test(t) && SPRING_MIS.test(stem)) { sprBad.push(`#${r.id}(${t.trim()}↔题干拉伸语境)`); break }
    const m = t.match(/[压缩伸长量]{3}\s*x=([0-9.]+)m/)
    if (m) {
      // 溯源：该数值（或 mm/cm 等价换算）须在题干/答案/解析数值池中
      const v = parseFloat(m[1])
      const cands = [v, v * 100, v * 1000].map((x) => Math.round(x * 1e9) / 1e9)
      if (!cands.some((c) => poolNums.has(c))) { sprBad.push(`#${r.id}(${t.trim()} 数值不可溯源)`); break }
    }
  }
}
if (sprBad.length) { hardFail++; console.log(`✗ 弹簧标签：${sprBad.length} 题图标「压缩量/伸长量 x=…」与题干错配或数值不可溯源 → ${sprBad.join(' ')}`) }
else console.log('✓ 弹簧标签：「压缩量/伸长量 x=…」标签与题干方向一致且数值均可溯源')

// ---------- 2e. 图内箭头方向 / 双体结构守卫（验收 #71 P1-118：13 题同族坏模板——题干「向右」箭头朝左、板块题缺板/缺块） ----------
// 移植监督者 sup71-sweep2.mjs 例行维度，零 AI 纯几何：
// ① 题干断言「向右」（且不含「向左」）而图内全部水平箭头均朝左 → 硬失败
// ② 板块双体题（题干同时含 木板/长板 与 物块/滑块 且提「地面」）图内可见矩形 <2 → 硬失败
function parseArrowDirs(svg: string): string[] {
  const out: string[] = []
  const re = /<polygon points="([-\d.,\s]+)" fill="(#[0-9a-f]{6})"\s*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg))) {
    const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number))
    if (pts.length !== 3) continue
    const mid = [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2]
    let tip = pts[0], best = -1
    for (const p of pts) { const d = Math.hypot(p[0] - mid[0], p[1] - mid[1]); if (d > best) { best = d; tip = p } }
    const dx = tip[0] - mid[0], dy = tip[1] - mid[1]
    if (Math.abs(dx) > Math.abs(dy) * 1.05) out.push(dx > 0 ? 'R' : 'L')
    else if (Math.abs(dy) > Math.abs(dx) * 1.05) out.push(dy < 0 ? 'U' : 'D')
  }
  return out
}
const dirBad: string[] = []
for (const r of rows) {
  let fig: any = null
  try { fig = JSON.parse(String(r.figure || 'null')) } catch { continue }
  if (!fig || fig.kind !== 'svg') continue
  const svg = String(fig.data).replace(/\\"/g, '"')
  const stem = String(r.stem || '')
  const dirs = parseArrowDirs(svg)
  const horiz = dirs.filter((d) => d === 'R' || d === 'L')
  if (/向右/.test(stem) && !/向左/.test(stem) && horiz.length && horiz.every((d) => d === 'L')) {
    dirBad.push(`#${r.id}(题干向右,${horiz.length}支箭头全朝左)`)
  }
  if (/木板|长板|薄板/.test(stem) && /滑块|物块|小物块|小滑块|金属块|黏块/.test(stem) && /地面/.test(stem)) {
    const vr = [...svg.matchAll(/<rect ([^>]+)\/>/g)].filter((m) => !/fill="none"/.test(m[1])).length
    if (vr < 2) dirBad.push(`#${r.id}(板块双体,图内仅${vr}矩形)`)
  }
}
if (dirBad.length) { hardFail++; console.log(`✗ 箭头方向/双体结构：${dirBad.length} 题图与题干不符（P1-118 家族口径）→ ${dirBad.join(' ')}`) }
else console.log('✓ 箭头方向/双体结构：全部带图题箭头方向与题干「向右/向左」一致、板块双体题结构完整')

// ---------- 2f. answer vs solution 数值一致性守卫（验收 #73 P1-123：#10/#713/#477 三起「解析对、答案错」同族） ----------
// 口径：answer 中每个物理数值（含科学计数/分数/根号/π 求值）必须能在 solution 数值池中找到（5% 容差，
// 覆盖 2~3 位有效数字舍入误差）；题干已知量豁免、解析「为零」豁免。真实不一致（同族历史案均为 ≥2 倍量级）远超容差。
const BSUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' }
// 求值：纯数 | PI | 乘积链 a*b*c（元素为纯数或 PI），允许包裹括号；纯符号（N_0/mg 等）按 1 处理（仅用于匹配池）
function auditEvalN(t0: string): number {
  let t = String(t0).trim()
  while (/^\(.*\)$/.test(t)) t = t.slice(1, -1).trim()
  if (!t) return NaN
  let v = 1
  for (const p0 of t.split('*')) {
    let p = p0.trim()
    while (/^\(.*\)$/.test(p)) p = p.slice(1, -1).trim()
    if (p === 'PI') { v *= Math.PI; continue }
    if (!/^[\d.]+(?:e[+-]?\d+)?$/.test(p)) {
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(p)) continue // 纯符号按 1
      return NaN
    }
    v *= parseFloat(p)
  }
  return v
}
function auditParseNums(text: string): number[] {
  let s = String(text || '')
  s = s.replace(/[（(]\s*\d{1,2}\s*[)）]/g, ' ') // 小问序号标签
  s = s.replace(/\\times\s*10\^\{?([+-]?\d+)\}?/g, 'e$1')
  s = s.replace(/×\s*10\^\{?([+-]?\d+)\}?/g, 'e$1')
  s = s.replace(/×\s*10([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, (_, sup: string) => 'e' + [...sup].map((c) => BSUP[c] ?? '').join(''))
  s = s.replace(/\\times/g, '*').replace(/×/g, '*')
  s = s.replace(/\\pi/g, 'PI').replace(/π/g, 'PI')
  s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'SQ($1)').replace(/\\sqrt\s*(\d+(?:\.\d+)?)/g, 'SQ($1)')
  s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'FR($1,$2)')
  s = s.replace(/\\[a-zA-Z]+/g, ' ') // 其余 LaTeX 命令剥离（防 \approx 的 x 吃掉 lookbehind）
  const out: number[] = []
  const P = (v: number) => { if (Number.isFinite(v)) out.push(v) }
  for (let i = 0; i < 6; i++) {
    const before = s
    // 系数×根号：5SQ(3) → 8.66；先 SQ 后 FR（SQ 可能嵌在 FR 参数里）
    s = s.replace(/(\d+(?:\.\d+)?)?\s*SQ\(([^()]+)\)/g, (_, coef: string | undefined, x: string) => {
      const v = Math.sqrt(auditEvalN(x))
      P(v)
      const prod = coef ? parseFloat(coef) * v : v
      P(prod)
      return String(prod)
    })
    s = s.replace(/FR\(([^(),]+),([^(),]+)\)/g, (_, a: string, b: string) => {
      const v = auditEvalN(a) / auditEvalN(b)
      P(v)
      return String(v)
    })
    if (s === before) break
  }
  for (const m of s.matchAll(/PI/g)) P(Math.PI)
  for (const m of s.matchAll(/(?<![\w.])(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w])/g)) P(parseFloat(m[1]))
  for (const m of s.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![\w.])/g)) P(parseFloat(m[1]) / parseFloat(m[2]))
  return out
}
const valClose = (a: number, b: number) => a === b || Math.abs(a - b) <= Math.max(1e-9, 0.05 * Math.max(Math.abs(a), Math.abs(b)))
const ZH_ZERO = /为零|等于零|是零|读数为零|电流为零|速度为零/
const ansSolBad: string[] = []
for (const r of rows) {
  const stemN = auditParseNums(String(r.stem || ''))
  const ansN = auditParseNums(String(r.answer || ''))
  const solN = auditParseNums(String(r.solution || ''))
  if (ZH_ZERO.test(String(r.solution || ''))) solN.push(0)
  const missing: number[] = []
  for (const a of ansN) {
    if (stemN.some((sv) => valClose(a, sv))) continue // 题干已知量豁免
    if (!solN.some((sv) => valClose(a, sv))) missing.push(Number(a.toPrecision(4)))
  }
  if (missing.length) ansSolBad.push(`#${r.id}(answer 独有值 ${[...new Set(missing)].join(',')})`)
}
if (ansSolBad.length) { hardFail++; console.log(`✗ 答案/解析一致：${ansSolBad.length} 题 answer 含 solution 中找不到的数值（P1-123 家族口径，需人工复核）→ ${ansSolBad.join(' ')}`) }
else console.log('✓ 答案/解析一致：全部题 answer 数值均可在 solution（或题干已知量）中溯源')

// ---------- 2g. figure 底板指纹守卫（验收 #75 P1-125：23 题同底板仅换文字标注的「换皮图」） ----------
// 两层（零 AI 纯结构比对）：
// ① 硬失败（回归钉）：P1-125 坏底板（虚线矩形「B / E（匀强场区）」+ 向上箭头 + +q 黄圆）除留观察的
//    #339 外任何题再现 → 硬失败（该家族已 22 题重画，此钉防同款底板复发）。
// ② 观察项（不硬失败）：同指纹族（剥离 <text> 内容与颜色、坐标按 8px 桶化后完全一致）且族内题干
//    中文双字 bigram 相似度过低（<0.10）=「同底板 + 不相干场景」疑似换皮 → 打印族清单供甄别。
//    注：本库存在大量**合法**同模板族（如电路底板逐题定制文字，#143 族 37 题），不能一刀切硬失败；
//    #75 轮实证该口径下合法族与坏族需人工甄别，故只作观察项。
function figFingerprint(svg0: string): Set<string> {
  let s = String(svg0).replace(/<text[\s\S]*?<\/text>/g, '<text/>')
  const toks = new Set<string>()
  for (const m of s.matchAll(/<(rect|line|circle|polygon|path|ellipse|polyline)\b([^>]*?)\/?>/g)) {
    const attrs: string[] = []
    for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
      const k = a[1]
      let v = a[2]
      if (k === 'fill' || k === 'stroke') v = '' // 颜色剥离（换色不算换结构）
      v = v.replace(/-?\d+(?:\.\d+)?/g, (n) => String(Math.round(parseFloat(n) / 8))) // 坐标桶化
      attrs.push(`${k}=${v}`)
    }
    attrs.sort()
    toks.add(m[1] + '|' + attrs.join('&'))
  }
  toks.delete('rect|x=0&y=0&fill=&height=30&width=50') // 全图透明背景 rect（桶化后 400→50、240→30）
  return toks
}
const BAD_PLATE_MARK = 'B / E（匀强场区）'
const BAD_PLATE_KEEP = new Set([339]) // 监督 #75 明示留观察
const plateRegress = db
  .prepare('SELECT id FROM questions WHERE figure LIKE ?')
  .all(`%${BAD_PLATE_MARK}%`)
  .map((r) => Number(r.id))
  .filter((id) => !BAD_PLATE_KEEP.has(id))
if (plateRegress.length) {
  hardFail++
  console.log(`✗ 底板指纹：P1-125 坏底板在 ${plateRegress.length} 题再现（应仅剩留观察 #339）→ ${plateRegress.map((i) => '#' + i).join(' ')}`)
} else console.log('✓ 底板指纹：P1-125 坏底板仅剩留观察 #339，无复发')

const zhBigrams = (s: string) => {
  const t = String(s).replace(/\s|\$|\\|[a-zA-Z0-9{}^_()（）=+*/.,、：:;；！!?？'"-]/g, '')
  const out = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}
const svgRows2g: { id: number; fp: Set<string>; bg: Set<string> }[] = []
for (const r of rows) {
  try {
    const f = JSON.parse(String(r.figure || 'null'))
    if (f && f.kind === 'svg') svgRows2g.push({ id: Number(r.id), fp: figFingerprint(String(f.data)), bg: zhBigrams(String(r.stem || '')) })
  } catch { /* 跳过坏 JSON */ }
}
const fpGroups = new Map<string, number[]>()
for (const it of svgRows2g) {
  const key = [...it.fp].sort().join('\n')
  if (!fpGroups.has(key)) fpGroups.set(key, [])
  fpGroups.get(key)!.push(it.id)
}
const skinFams: string[] = []
for (const members of fpGroups.values()) {
  if (members.length < 2) continue
  let minSim = 1
  for (let i = 0; i < members.length; i++) {
    const bi = svgRows2g.find((x) => x.id === members[i])!.bg
    for (let j = i + 1; j < members.length; j++) {
      const bj = svgRows2g.find((x) => x.id === members[j])!.bg
      let inter = 0
      for (const t of bi) if (bj.has(t)) inter++
      const uni = bi.size + bj.size - inter
      if (uni > 0 && inter / uni < minSim) minSim = inter / uni
    }
  }
  if (minSim < 0.1) skinFams.push(`{${members.slice(0, 6).map((i) => '#' + i).join(' ')}${members.length > 6 ? ` …共${members.length}题` : ''}}(最小bigram=${minSim.toFixed(3)})`)
}
if (skinFams.length) {
  console.log(`⚠ 底板指纹观察：${skinFams.length} 个同指纹族族内题干场景差异大（同底板换皮疑似，待人工甄别，不计硬失败）→ ${skinFams.slice(0, 8).join(' ')}`)
} else console.log(`✓ 底板指纹观察：${svgRows2g.length} 张 svg 图无「同底板 + 不相干场景」族`)

// ---------- 3. 字面 \n（后非字母） ----------
const litIds: string[] = []
let litTotal = 0
for (const r of rows) {
  for (const f of ['stem', 'answer', 'solution', 'pitfall']) {
    LIT.lastIndex = 0
    const n = (String(r[f] ?? '').match(LIT) || []).length
    if (n) { litTotal += n; litIds.push(`#${r.id}.${f}×${n}`) }
  }
}
if (litTotal) { hardFail++; console.log(`✗ 字面 \\n：${litTotal} 处 → ${litIds.join(' ')}`) }
else console.log('✓ 字面 \\n：0 处')

// ---------- 3b. 裸中文下标守卫（验收 #28 P2-49：x_子 之类单下划线直跟中文，KaTeX warning） ----------
// 口径：单个下划线（且不属于 ________ 填空下划线串）后直接跟中文 → 硬失败。
// 修复写法是 $x_{\text{子}}$；填空串 `________运动` 的尾下划线被前一个下划线吞掉不误报。
const CJK_SUB = /(?<!_)_(?![_{])[一-龥]/
const cjkIds: string[] = []
let cjkTotal = 0
for (const r of rows) {
  for (const f of ['stem', 'answer', 'solution', 'pitfall']) {
    const n = (String(r[f] ?? '').match(CJK_SUB) || []).length
    if (n) { cjkTotal += n; cjkIds.push(`#${r.id}.${f}×${n}`) }
  }
}
if (cjkTotal) { hardFail++; console.log(`✗ 裸中文下标：${cjkTotal} 处（应写 _{\\text{…}}）→ ${cjkIds.join(' ')}`) }
else console.log('✓ 裸中文下标：0 处')

// ---------- 3c. math 外裸 LaTeX 命令守卫（验收 #28 P2-50：\underline{\hspace{2cm}} 等在定界符外字面显示） ----------
// 口径沿用 .agent_context/tmp/sup28-barelatex.mjs：按 $$…$$ / $…$ 切分，text 段内出现 LaTeX 命令即失败；
// 额外把合法块级定界符 \[ … \] 也按 math 段剔除，避免误报。
const BARE_CMD = /\\(?:underline|hspace|dfrac|tfrac|frac|sqrt|times|cdot|approx|text|mathrm|pi|Delta|omega|alpha|beta|theta|mu|lambda)/
const MATH_BLOCK = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]/g
const bareIds: string[] = []
let bareTotal = 0
for (const r of rows) {
  for (const f of ['stem', 'answer', 'solution', 'pitfall']) {
    const s = String(r[f] ?? '')
    let last = 0, m: RegExpExecArray | null, bad = 0
    while ((m = MATH_BLOCK.exec(s))) {
      bad += (s.slice(last, m.index).match(BARE_CMD) || []).length
      last = m.index + m[0].length
    }
    bad += (s.slice(last).match(BARE_CMD) || []).length
    MATH_BLOCK.lastIndex = 0
    if (bad) { bareTotal += bad; bareIds.push(`#${r.id}.${f}×${bad}`) }
  }
}
if (bareTotal) { hardFail++; console.log(`✗ math 外裸 LaTeX：${bareTotal} 处（定界符外命令字面显示）→ ${bareIds.join(' ')}`) }
else console.log('✓ math 外裸 LaTeX：0 处')

// ---------- 3d. 选择题选项守卫（验收 #36 P2-59：questions 表无 options 列，选项文本必须嵌于 stem） ----------
// 口径：qtype 含「选」的题，stem 必须含 A./B. 类选项标记（[ABCD] 后跟 . 、 ．），否则用户端见题无选项无法作答 → 硬失败
const noOpt: string[] = []
for (const r of rows) {
  if (/选/.test(String(r.qtype || '')) && !/[ABCD][.、．]/.test(String(r.stem || ''))) noOpt.push(`#${r.id}`)
}
if (noOpt.length) { hardFail++; console.log(`✗ 选择题选项：${noOpt.length} 题 qtype 为选择但 stem 无 A~D 选项文本（用户端无法作答）→ ${noOpt.join(' ')}`) }
else console.log('✓ 选择题选项：全部选择题 stem 均含 A~D 选项文本')

// ---------- 4. 数值复核（表达式求值，全库 solution 扫描） ----------
const flagged: string[] = []
for (const r of rows) {
  const issues = checkSolutionArithmetic(String(r.solution ?? ''))
  if (issues.length) flagged.push(`#${r.id} ${issues.map((i: any) => i.msg || JSON.stringify(i)).join('；').slice(0, 120)}`)
}
if (flagged.length) { hardFail++; console.log(`✗ 数值复核：${flagged.length} 题标记（需人工复算确认）\n- ` + flagged.join('\n- ')) }
else console.log(`✓ 数值复核：全库 ${rows.length} 题 0 标记`)

// ---------- 5. 分布与覆盖 ----------
const byT: Record<string, number> = {}
const byD: Record<number, number> = {}
for (const r of rows) { byT[r.qtype] = (byT[r.qtype] || 0) + 1; byD[r.difficulty] = (byD[r.difficulty] || 0) + 1 }
console.log(`总数 ${rows.length}；题型 ${Object.entries(byT).map(([k, v]) => `${k}${v}`).join('/')}；难度 D1-2 ${(byD[1] || 0) + (byD[2] || 0)}/D3 ${byD[3] || 0}/D4-5 ${(byD[4] || 0) + (byD[5] || 0)}（D5 ${byD[5] || 0}）`)

const VOL: Record<string, string> = { bxF1: '必修一', bxF2: '必修二', bxF3: '必修三', xxF1: '选必一', xxF2: '选必二', xxF3: '选必三' }
const sections: string[] = []
TEXTBOOK.forEach((v) => v.chapters.forEach((ch) => ch.sections.forEach((s) => sections.push(s))))
const secSet = new Set(sections.map(norm))
// ---------- 5b. 节名规范守卫（验收 #26 P3-45/46：每题至少含 1 个教材规范节名，精确归一匹配） ----------
const noSec: string[] = []
for (const r of rows) {
  const kps = kpOf(r.knowledge_points)
  if (!kps.some((k) => secSet.has(norm(k)))) noSec.push(`#${r.id}`)
}
if (noSec.length) { hardFail++; console.log(`✗ 节名规范：${noSec.length} 题 knowledge_points 不含任何教材节名（精确筛选/充实度统计会漏题）→ ${noSec.join(' ')}`) }
else console.log('✓ 节名规范：每题 knowledge_points 均含至少 1 个教材规范节名')
const coveredExact = new Set<string>()
for (const r of rows) for (const k of kpOf(r.knowledge_points)) if (secSet.has(norm(k))) coveredExact.add(norm(k))
console.log(`覆盖（精确）：${coveredExact.size}/${sections.length}（${Math.round((coveredExact.size / sections.length) * 1000) / 10}%）`)

console.log(hardFail ? `\n===== bank-audit 结论：${hardFail} 项硬校验未过 =====` : '\n===== bank-audit 结论：全部硬校验通过 =====')
process.exit(hardFail ? 1 : 0)
