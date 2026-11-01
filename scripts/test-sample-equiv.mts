// P1-81/P1-82/P2-80/P1-84 单测：数值抽样等价判定 + 判定文案机器校正启发式 + 展示层/判定层交叉校验（验收 #45/#46/#47 实测案例）
import { sampleEquivalent as eq, isEquivClaim, hasJudgeContradiction } from '../packages/shared/src/index.ts'
import { answersClearlyDisagree as dis, subBlanksMisaligned as mis, scrubSpeculation as scrub, answersAgree as agree, splitParts, expectedBlankCountOf, solveBlanksMismatch, missingFigureNoteOf, ensureMissingFigureNotes } from '../apps/api/src/answerMatch.ts'

let fail = 0
function chk(name: string, got: unknown, expect: unknown) {
  const ok = got === expect
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name} → ${String(got)}（期望 ${String(expect)}）`)
}

// ---- P1-82 数值抽样等价 ----
chk('12(5) (g−k)/(2k) ≡ g/(2k)−1/2（全角减号）', eq('(g−k)/(2k)', 'g/(2k)−1/2'), true)
chk('12(5) LaTeX 分式写法', eq('(g-k)/(2k)', '\\frac{g}{2k}-\\frac{1}{2}'), true)
chk('θ√(L/2g) ≡ (θ/2)·√(2L/g)', eq('θ√(L/2g)', '(θ/2)·√(2L/g)'), true)
chk('θL/√(2gL) ≡ θ√(L/(2g))', eq('θL/√(2gL)', 'θ√(L/(2g))'), true)
chk('\\frac{1}{2}mv^2 ≡ mv^2/2', eq('\\frac{1}{2}mv^2', 'mv^2/2'), true)
chk('v₀²/(2g) ≡ \\dfrac{v_0^2}{2g}（下标变量）', eq('v₀²/(2g)', '\\dfrac{v_0^2}{2g}'), true)
chk('常数相等 2.4≡2.4', eq('2.4', '2.4'), true)
chk('常数不等 2.4≠1.3（12(2) 漂移不误救）', eq('2.4', '1.3'), false)
chk('纯文字（小于/大于）不表态', eq('小于', '大于'), null)
chk('选项字母不表态为不等', eq('A', 'B'), false)
chk('含单位对称一致', eq('2.4 m/s', '2.4m/s'), true)
chk('单位不对称不表态误判为不等（保守）', eq('2.4 m/s', '2.4'), false)
chk('三角函数放弃', eq('v₀sinθ', 'v₀·sinθ'), null)
chk('空串不表态', eq('', ''), null)

// ---- P2-80 等价自认判定（负向排除） ----
chk('自认等价：代数等价，但书写不同', isEquivClaim('两者代数等价，但书写形式不同'), true)
chk('自认等价：数学等价', isEquivClaim('两者数学等价'), true)
chk('自认等价：仅形式不同', isEquivClaim('两者仅书写形式不同'), true)
chk('否定：不等价，但形式相近', isEquivClaim('不等价，但形式相近'), false)
chk('否定：并非代数等价', isEquivClaim('并非代数等价，两者实质不同'), false)
chk('否定：非等价仅形式相近', isEquivClaim('非等价，仅形式相近'), false)
chk('否定：并非仅形式不同，而是本质不同', isEquivClaim('并非仅形式不同，而是本质不同'), false)

// ---- P1-81 矛盾判定 ----
chk('12(4) note 自书「此处判错」', hasJudgeContradiction('学生填"小于"，但标准答案为"大于"，此处判错'), true)
chk('note 写「不一致」', hasJudgeContradiction('学生作答与标准答案不一致'), true)
chk('note 写「≠」', hasJudgeContradiction('学生结果 x≠2m/s'), true)
chk('「无错误」不算矛盾', hasJudgeContradiction('与标准答案一致，无错误'), false)
chk('「无不一致」不算矛盾', hasJudgeContradiction('两者并无不一致'), false)
chk('「没判错」不算矛盾', hasJudgeContradiction('该空没判错'), false)

// ---- P1-84 展示层/判定层交叉校验（answersClearlyDisagree）----
// #47 Q7 实况：展示层 C、判定层表决答案 B —— 必须确证不一致（进待确认而非静默判对）
chk('Q7 选择题 C vs B → 不一致', dis('C', 'B', '选择', eq), true)
chk('Q7 带解析尾巴 C（解析：…） vs B → 不一致', dis('C（解析：剪断L2瞬间T1=0）', 'B', '选择', eq), true)
chk('选择题一致 C vs C → 一致', dis('C', 'C', '选择', eq), false)
chk('选择题归一化 AD vs A、D → 一致', dis('AD', 'A、D', '选择', eq), false)
chk('选择题单侧长叙述解析不出 → 保守不表态', dis('正确答案见解析，图示法求解得选项', 'C', '选择', eq), false)
// 12(5) 代数等价（P1-82 求值器）不再误标不一致
chk('12(5) (g−k)/(2k) vs g/(2k)−1/2 → 等价即一致', dis('(g−k)/(2k)', 'g/(2k)−1/2', '其它', eq), false)
chk('数值一致 3750J vs 3750 → 一致', dis('3750J（解析：动能定理）', '3750', '其它', eq), false)
chk('数值漂移 3000 vs 3750 → 不一致', dis('3000J', '3750J', '其它', eq), true)
chk('多问数值漂移 (1)2.4(2)8 vs (1)2.4(2)9 → 不一致', dis('(1)2.4；(2)8', '(1)2.4；(2)9', '其它', eq), true)
chk('多问数值一致 → 一致', dis('(1)2.4；(2)8', '(1)2.4；(2)8.0', '其它', eq), false)
// 12(4) 文字答案：一致/不一致
chk('12(4) 大于 vs 大于 → 一致', dis('大于', '大于', '其它', eq), false)
chk('12(4) 大于 vs 小于 → 不一致', dis('大于', '小于', '其它', eq), true)
chk('文字带「答案：」前缀归一化', dis('答案：大于', '大于', '其它', eq), false)
// 保守边界：单侧空、解析口径不齐
chk('单侧空 → 不表态', dis('', '3750', '其它', eq), false)
chk('单侧无数值 → 保守不表态', dis('见解析', '3750J', '其它', eq), false)
chk('单位不对称 2.4 m/s vs 2.4 → 保守不表态', dis('2.4 m/s', '2.4', '其它', eq), false)


// ---- P1-88 空位对齐校验（subBlanksMisaligned，验收#48 12(4)(5) 两空合并实测）----
const std5 = ['(1)','(2)','(3)','(4)','(5)'].map((k) => ({ key: k, answer: '' }))
chk('12(4)(5) 合并：比对层 4 空 vs 标准 5 空 → 不齐', mis(std5, ['(1)','(2)','(3)','(4)'].map((k) => ({ key: k }))), '比对层4空 vs 标准5空')
chk('逐空齐 5 空 → 不表态', mis(std5, ['(1)','(2)','(3)','(4)','(5)'].map((k) => ({ key: k }))), '')
chk('空数同但空位不齐 (6) → 不齐', mis(std5, ['(1)','(2)','(3)','(4)','(6)'].map((k) => ({ key: k }))), '比对层空位（1/2/3/4/6）与标准空位（1/2/3/4/5）不齐')
chk('标准单空题不校验', mis([{ key: '(1)', answer: '' }], [{ key: '(1)' }]), '')
chk('比对层没给逐空且读卡也没读出多空 → 不表态', mis(std5, [], []), '')
chk('比对层没给逐空但读卡 4 空 vs 标准 5 空 → 不齐', mis(std5, [], ['(1)','(2)','(3)','(4)'].map((k) => ({ key: k }))), '读卡层4空 vs 标准5空（比对层未给逐空判定）')
chk('比对层没给逐空但读卡 5 空 = 标准 5 空 → 不表态', mis(std5, [], ['(1)','(2)','(3)','(4)','(5)'].map((k) => ({ key: k }))), '')
chk('key 无数字条目被忽略（(字迹不清)）', mis(std5, [{ key: '(字迹不清)' }, { key: '(1)' }, { key: '(2)' }, { key: '(3)' }, { key: '(4)' }, { key: '(5)' }]), '')
chk('key 无数字条目忽略后剩 4 空 → 不齐', mis(std5, [{ key: '(字迹不清)' }, { key: '(1)' }, { key: '(2)' }, { key: '(3)' }, { key: '(4)' }]), '比对层4空 vs 标准5空')

// ---- P3-86 臆测禁令清洗（scrubSpeculation）----
chk('臆测：填空错位改写', scrub('学生第12题填空错位，(4)(5)内容串行'), '学生第12题空位对应存疑（待人工核对），(4)(5)空位对应存疑（待人工核对）')
chk('臆测：抄错行改写', scrub('疑似抄错行'), '疑似空位对应存疑（待人工核对）')
chk('臆测：看错题号改写', scrub('可能看错题号'), '可能空位对应存疑（待人工核对）')
chk('正常 note 不改写', scrub('学生作答与标准答案数值一致'), '学生作答与标准答案数值一致')
chk('系统自书「空位对齐失败」不被误洗', scrub('空位对齐失败（比对层4空 vs 标准5空）'), '空位对齐失败（比对层4空 vs 标准5空）')


// ---- P1-88 续（验收#48 C2 实测）：表决票前导等号噪声拆散多数组 —— splitParts 剥离前导 = 后应一致
const v1 = '(1)=AD；(2)=2.4；(3)=mgh，大于；(4)=(g/2k−1/2)'
const v2 = '(1)AD；(2)2.4；(3)mgh，大于；(4)(g/2k−1/2)'
chk('票内 (1)=AD vs (1)AD 前导等号噪声 → agree', agree(v1, v2, '填空'), true)
chk('前导等号噪声 splitParts 剥离', JSON.stringify(splitParts(v1)), JSON.stringify(['ad','2.4','mgh,大于','(g/2k−1/2)']))
chk('真分歧仍不一致（等号修复不放宽）', agree('(1)=AD；(2)=2.4', '(1)AC；(2)=2.4', '填空'), false)


// ---- P1-88 续：表决分组支持数值抽样等价（g/2k−1/2 ≡ (g−k)/2k 不拆散多数组，验收#48 Q12 五票实测）
chk('等价票分组：g/2k−1/2 vs (g−k)/2k → agree', agree('g/2k−1/2', '(g−k)/2k', '填空', eq), true)
chk('真分歧不分组：g/2k−1/2 vs g/k−1/2', agree('g/2k−1/2', 'g/k−1/2', '填空', eq), false)
chk('多问内逐空等价救回', agree('(1)=AD；(2)=2.4；(4)=g/2k−1/2', '(1)AD；(2)=2.4；(4)=(g−k)/2k', '填空', eq), true)

// ---- P1-84 漏网（验收#50）：带单位数值形态的展示层/判定层不一致检测 ----
chk('14(2) 带单位 0.8kg vs 0.3kg → 不一致（#50 漏网主案例）', dis('0.8kg', '0.3kg', '计算', eq), true)
chk('带单位一致 0.8kg vs 0.8 kg → 一致', dis('0.8kg', '0.8 kg', '计算', eq), false)
chk('题号前缀噪声 14(2) 0.8kg vs 0.3kg → 不一致', dis('14(2) 0.8kg', '0.3kg', '计算', eq), true)
chk('多问段数不齐但单位可配对 → 不一致', dis('(1)7.5m/s；(2)0.8kg；(3)大于', '(1)7.5m/s；(2)0.3kg', '计算', eq), true)
chk('多问段数不齐但同单位全等 → 不误标', dis('(1)7.5m/s；(2)0.8kg；(3)大于', '(1)7.5m/s；(2)0.8kg', '计算', eq), false)
chk('代数等价优先于单位配对（不误标）', dis('(g−k)/(2k)', 'g/(2k)−1/2', '计算', eq), false)
chk('带单位表达式两侧一致 → 不误标', dis('2.4m/s（解析：v=…）', '2.4m/s', '计算', eq), false)
chk('单侧有单位 → 保守不表态', dis('3750J', '3750', '计算', eq), false)

// ---- P2-90（验收#50）：求解层逐空对齐检测（expectedBlankCountOf / solveBlanksMismatch）----
chk('期望空数：5 问 → 5', expectedBlankCountOf(['第12题…(1)…(2)…(3)…(4)…(5)…']), 5)
chk('期望空数：题干+小问合并数出 → 3', expectedBlankCountOf(['题干…', '(1)求速度 (2)求加速度 (3)求时间']), 3)
chk('期望空数：非连续编号 (1)(2)(4) → 不表态 0', expectedBlankCountOf(['(1)…(2)…(4)…']), 0)
chk('期望空数：无编号 → 0', expectedBlankCountOf(['单空题无编号']), 0)
chk('求解层 5 问输出 4 段（#50 实测）→ 需重解', solveBlanksMismatch(5, { answer: '(1)=AD；(2)=2.4；(3)=mgh，大于；(4)=(g/2k−1/2)', per_blank: [] }).length, 5)
chk('求解层 per_blank 4 条 vs 期望 5 → 需重解', solveBlanksMismatch(5, { answer: '', per_blank: ['(1)', '(2)', '(3)', '(4)'].map((k) => ({ key: k })) }).length, 5)
chk('求解层空数齐 → 不重解', solveBlanksMismatch(5, { answer: '', per_blank: ['(1)', '(2)', '(3)', '(4)', '(5)'].map((k) => ({ key: k })) }).length, 0)
chk('期望 <2 空（单问）→ 不重解', solveBlanksMismatch(1, { answer: '2.4', per_blank: [] }).length, 0)
chk('answer 段数兜底（per_blank 空但 answer 5 段）→ 不重解', solveBlanksMismatch(5, { answer: '(1)a；(2)b；(3)c；(4)d；(5)e', per_blank: [] }).length, 0)

// ---- P2-92（验收#51）：重绘失败缺图标注机器兜底 ----
{
  const note = missingFigureNoteOf({ figure_note: '图(b) v-t 图：0~1s 匀加速' })
  chk('缺图声明含「原图待补」前缀', note.startsWith('原图待补：'), true)
  chk('缺图声明带转录层图形描述（不编造）', note.includes('原卷图描述：图(b) v-t 图：0~1s 匀加速'), true)
  chk('缺图声明：转录层无描述时只有声明', missingFigureNoteOf({}).includes('原卷图描述'), false)
  const items = [
    { no: 2, figure_status: '图待补' },
    { no: 12, figure_status: '已重绘' },
    { no: 5, figure_status: '图待补' },
    { no: 3, figure_status: '' },
  ]
  const ur: string[] = []
  chk('缺图清单：仅图待补题入 unrecognized（2条）', ensureMissingFigureNotes(ur, items), 2)
  chk('缺图清单内容含题号', ur.every((u) => /原图待补/.test(u)) && ur.some((u) => u.includes('第2题')) && ur.some((u) => u.includes('第5题')), true)
  chk('缺图清单：已有标注去重不重复补', ensureMissingFigureNotes(ur, items), 0)
  chk('缺图清单：非数组入参兜底', ensureMissingFigureNotes(undefined as any, [{ no: 8, figure_status: '图待补' }]), 1)
  // P3-96（验收#52）：模型手写含空格变体「第 15 题原图待补」也要去重（\s 必须真正生效）
  const ur2 = ['第 15 题原图待补（模型已标注）']
  chk('缺图清单：含空格变体「第 15 题」→ 去重不再补', ensureMissingFigureNotes(ur2, [{ no: 15, figure_status: '图待补' }]), 0)
  const ur3 = ['第15题原图待补（无空格）']
  chk('缺图清单：无空格串照常去重', ensureMissingFigureNotes(ur3, [{ no: 15, figure_status: '图待补' }]), 0)
}

process.exit(fail ? 1 : 0)
