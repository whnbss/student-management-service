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
