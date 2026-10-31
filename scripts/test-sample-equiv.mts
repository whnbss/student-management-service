// P1-81/P1-82/P2-80 单测：数值抽样等价判定 + 判定文案机器校正启发式（验收 #45/#46 实测案例）
import { sampleEquivalent as eq, isEquivClaim, hasJudgeContradiction } from '../packages/shared/src/index.ts'

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

process.exit(fail ? 1 : 0)
