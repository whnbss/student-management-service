// P1-81/P1-82/P2-80/P1-84 单测：数值抽样等价判定 + 判定文案机器校正启发式 + 展示层/判定层交叉校验（验收 #45/#46/#47 实测案例）
import { sampleEquivalent as eq, isEquivClaim, hasJudgeContradiction } from '../packages/shared/src/index.ts'
import { answersClearlyDisagree as dis, subBlanksMisaligned as mis, scrubSpeculation as scrub, answersAgree as agree, splitParts } from '../apps/api/src/answerMatch.ts'

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

process.exit(fail ? 1 : 0)
