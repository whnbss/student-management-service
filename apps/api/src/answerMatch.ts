// ---------- 答案一致性/分歧判定（C2 表决 + P1-84 展示层/判定层同源校验用） ----------
// 独立纯函数模块（不依赖 db/fastify），便于单测（scripts/test-sample-equiv.mts）。

// 选择题：提取 A~D 字母集合（答案串较短时）；其它题：提取全部数值（含 LaTeX 里的数字），2% 容差配对
export function letterSetOf(s: string): string[] | null {
  const clean = String(s || '').replace(/\s+/g, '')
  if (!clean || clean.length > 60) return null
  const letters = [...new Set(clean.replace(/[^ABCD]/g, '').split(''))]
  if (!letters.length || letters.length > 4) return null
  // 至少要有一个字母紧邻答案语境（如「C」「AD」「答案：C」），纯叙述文字不算
  return /^[^A-Za-z]{0,6}[ABCD]/.test(clean) || /^(答案|选)[^A-Za-z]{0,3}[ABCD]/.test(clean) ? letters.sort() : null
}
// P1-76：答案写法归一化 —— 消除「语义一致仅写法不同」的表决票差异：
//   \frac12 vs \frac{1}{2} vs ½、\dfrac、全角括号/标点、空白、分隔标点、大小写。
// 只用于一致性比对，不改动任何入库文本。
const VULGAR_FRACS: Record<string, string> = {
  '½': '\\frac{1}{2}', '⅓': '\\frac{1}{3}', '⅔': '\\frac{2}{3}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}',
  '⅕': '\\frac{1}{5}', '⅖': '\\frac{2}{5}', '⅗': '\\frac{3}{5}', '⅘': '\\frac{4}{5}', '⅙': '\\frac{1}{6}', '⅛': '\\frac{1}{8}',
}
export function canonAnswer(s: string): string {
  let t = String(s || '')
  t = t.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅛]/g, (c) => VULGAR_FRACS[c] || c)
  // 上标数字统一成 ^n（v² vs v^2 之类写法差）
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => '^' + '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c))
  // \frac12 / \frac1{2} / \dfrac{1}{2} → 统一成 \frac{1}{2}（单数字分子/分母补花括号）
  t = t.replace(/\\[dt]\s*frac/g, '\\frac')
  t = t.replace(/\\frac\s*(\d)\s*(\d)/g, '\\frac{$1}{$2}')
  t = t.replace(/\\left|\\right/g, '')
  t = t.replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[：]/g, ':')
  // 顿号只作列举分隔（字母选项间常见），直接去掉；其余分隔标点统一成半角逗号；句号去掉
  t = t.replace(/[、]/g, '').replace(/[，；;]/g, ',').replace(/[。]/g, '')
  t = t.replace(/^答案[:]*/, '').replace(/^选[,]?/, '')
  return t.replace(/\s+/g, '').toLowerCase()
}
// P1-76：多问拆分 —— "(1)…；(2)…" 结构按问号切开逐问比对（问数一致且逐问一致才算一致）
export function splitParts(s: string): string[] | null {
  const t = canonAnswer(s)
  const marks = [...t.matchAll(/\((\d{1,2})\)/g)]
  if (marks.length < 2 || marks[0][1] !== '1') return null
  const parts: string[] = []
  for (let i = 0; i < marks.length; i++) {
    const start = (marks[i].index || 0) + marks[i][0].length
    const end = i + 1 < marks.length ? marks[i + 1].index || t.length : t.length
    parts.push(t.slice(start, end).replace(/^,+|,+$/g, '').replace(/^[:：=]+/, ''))
  }
  return parts
}
export function numsOf(s: string): number[] {
  const t = canonAnswer(s).replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, ' ')
  const out: number[] = []
  const re = /-?\d+(?:\.\d+)?(?:\s*[eE]\s*(-?\d+)|\s*[×x*]\s*10\s*\^?\s*\{?(-?\d+)\}?)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const base = parseFloat(m[0].replace(/[×x*]\s*10\s*\^?\s*\{?-?\d+\}?$/, '').replace(/\s+/g, ''))
    if (!isFinite(base)) continue
    const exp = m[1] || m[2]
    out.push(exp ? base * Math.pow(10, parseInt(exp)) : base)
    if (out.length > 12) break
  }
  return out
}
export function answersAgree(a: string, b: string, qtype: string, equiv?: (x: string, y: string) => boolean | null): boolean {
  const na = String(a || '').trim(); const nb = String(b || '').trim()
  if (!na || !nb) return false
  if (qtype === '选择') {
    const la = letterSetOf(na); const lb = letterSetOf(nb)
    if (la && lb) return la.join('') === lb.join('')
  }
  // P1-76：多问结构逐问比对（(1)…(2)…，问数一致且逐问一致才算一致）
  const pa = splitParts(na); const pb = splitParts(nb)
  if (pa && pb && pa.length === pb.length) {
    return pa.every((p, i) => answersAgree(p, pb[i], '其它', equiv))
  }
  const xs = numsOf(na); const ys = numsOf(nb)
  if (xs.length && ys.length && xs.length === ys.length) {
    const used = new Set<number>()
    let all = true
    for (const x of xs) {
      const hit = ys.findIndex((y, i) => !used.has(i) && (Math.abs(x - y) <= 0.02 * Math.max(Math.abs(x), Math.abs(y), 1e-9)))
      if (hit < 0) { all = false; break }
      used.add(hit)
    }
    if (all) return true
    // 数值集合不一致不直接判分歧：可能是 \frac12→"12" 之类的写法噪声（P1-76），
    // 交给归一化字符串比对兜底；真分歧（数值实质不同）归一化后必然不同
  }
  // 验收#48 实测：等价但写法不同的票（g/2k−1/2 vs (g−k)/2k）不该拆散多数组——
  // 调用方传入数值抽样等价求值器（P1-82）时，证实等价即一致（真分歧求值器不会证实）
  if (equiv && equiv(na, nb) === true) return true
  return canonAnswer(na) === canonAnswer(nb)
}

// P1-84：展示层/判定层同源校验 —— 「能确证不一致」才返回 true（保守：解析不了的一律返回 false 不表态）。
// 与 answersAgree 的区别：answersAgree 面向表决（聚合相似票），本函数面向「展示答案 vs 判定用答案」的
// 交叉校验——只有双侧都能解析且实质不同（或文字答案归一化后不同）才确证不一致，避免把
// 「大于/小于」类文字答案、纯代数等价表达式误标进待确认。
// 剥离「（解析：…）」尾巴（reference_answer 回填时带的解析文本不参与比对）。
// 解析文本里可能含嵌套括号（如 $(m+M)v=…$），且尾巴总在串尾——直接从「（解析：」截到串尾
export function stripParseTail(s: string): string {
  return String(s || '').replace(/[（(]解析[：:][\s\S]*$/, '').trim()
}
export function answersClearlyDisagree(a: string, b: string, qtype: string, sampleEquivalent: (x: string, y: string) => boolean | null): boolean {
  const na = stripParseTail(a); const nb = stripParseTail(b)
  if (!na || !nb) return false
  if (qtype === '选择') {
    const la = letterSetOf(na); const lb = letterSetOf(nb)
    if (la && lb) return la.join('') !== lb.join('')
    return false // 一侧解析不出字母集合（如长叙述）——保守不表态
  }
  // 多问结构逐问校验（问数一致才有意义）
  const pa = splitParts(na); const pb = splitParts(nb)
  if (pa && pb && pa.length === pb.length) {
    return pa.some((p, i) => answersClearlyDisagree(p, pb[i], '其它', sampleEquivalent))
  }
  // 数值抽样等价（P1-82 求值器）证实等价 → 必然一致（(g−k)/(2k) ≡ g/(2k)−1/2 这类不再误标）
  const eq = sampleEquivalent(na, nb)
  if (eq === true) return false
  const xs = numsOf(na); const ys = numsOf(nb)
  if (xs.length && ys.length && xs.length === ys.length) {
    const used = new Set<number>()
    let all = true
    for (const x of xs) {
      const hit = ys.findIndex((y, i) => !used.has(i) && (Math.abs(x - y) <= 0.02 * Math.max(Math.abs(x), Math.abs(y), 1e-9)))
      if (hit < 0) { all = false; break }
      used.add(hit)
    }
    return !all // 双侧都解析出同数量数值且配不上 → 确证不一致
  }
  // 双侧均无法解析成数值（大于/小于/有/无类文字答案）：归一化文本不同才视为不一致
  if (eq === null && !xs.length && !ys.length) return canonAnswer(na) !== canonAnswer(nb)
  return false // 解析口径不齐（数值个数不同/单侧有数值）——保守不表态
}

// P1-88（验收#48）：空位对齐校验 —— 比对层 sub_answers 必须与标准答案逐空一一对应。
// 读卡/比对层把两空内容合并成一条（#48 的 12(4)(5)）或漏空时，逐空判定不可信：
// 某空判定行丢失、P1-82 等价救回失效、note 臆测连锁发生。空数/空位不符 → 整题转待确认。
// 保守边界：标准答案没有逐空（<2 空）不校验；比对层没给逐空判定时，仅当读卡层确实读出了
// 多空且空数与标准不符才判不齐（比对层整体判定可能仍可信，不强行作废）。
export function blankKeyDigits(key: string): string {
  return String(key || '').replace(/[^0-9]/g, '')
}
export function subBlanksMisaligned(
  stdPerBlank: Array<{ key: string; answer?: string }>,
  studentSubs: Array<{ key: string }>,
  sheetPerBlank?: Array<{ key: string; answer?: string }>
): string {
  const stdKeys = (stdPerBlank || []).map((b) => blankKeyDigits(b.key)).filter(Boolean)
  if (stdKeys.length < 2) return '' // 单空/单问题无需对齐
  const subKeys = (studentSubs || []).map((b) => blankKeyDigits(b.key)).filter(Boolean)
  if (subKeys.length) {
    if (subKeys.length !== stdKeys.length) return `比对层${subKeys.length}空 vs 标准${stdKeys.length}空`
    const stdSet = new Set(stdKeys)
    if (stdKeys.some((k) => !subKeys.includes(k)) || subKeys.some((k) => !stdSet.has(k))) {
      return `比对层空位（${subKeys.join('/')}）与标准空位（${stdKeys.join('/')}）不齐`
    }
    return ''
  }
  // 比对层没给逐空判定：读卡层读出了多空且空数与标准不符 → 同样视为不齐（读卡合并/漏空的实证）
  const sheetKeys = (sheetPerBlank || []).map((b) => blankKeyDigits(b.key)).filter(Boolean)
  if (sheetKeys.length && sheetKeys.length !== stdKeys.length) {
    return `读卡层${sheetKeys.length}空 vs 标准${stdKeys.length}空（比对层未给逐空判定）`
  }
  return ''
}

// P3-86（验收#48）：臆测禁令的机器侧清洗 —— 比对模型偶发写出「填空错位/串行/抄错行」类
// 未经核实的归因，会被教案/讲评原样引用误导教师。命中臆测词的片段统一改写为「待人工核对」，
// 不改写其它内容（只做词级替换，不动句子结构）。
const SPECULATION_RE = /填空错位|答案错位|空位错位|错位作答|两空错位|内容串行|作答串行|串行作答|抄错行|看错行|看错题号|两空互串|填涂错位/g
export function scrubSpeculation(text: string): string {
  const t = String(text || '')
  if (!SPECULATION_RE.test(t)) return t
  SPECULATION_RE.lastIndex = 0
  return t.replace(SPECULATION_RE, '空位对应存疑（待人工核对）')
}
