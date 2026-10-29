// 第十一批补题计划生成（#17 验收指令：24 空节全清，题型 实5/计8/选8/填3，难度 基础6/中档10/压轴8）
import fs from 'node:fs'
import { TEXTBOOK } from '../packages/shared/src/textbook.ts'

const VOL: Record<string, string> = { bxF1: '必修一', bxF2: '必修二', bxF3: '必修三', xxF1: '选必一', xxF2: '选必二', xxF3: '选必三' }
const GRADE: Record<string, string> = { bxF1: '高一', bxF2: '高一', bxF3: '高二', xxF1: '高二', xxF2: '高二', xxF3: '高三' }

// 24 空节 → 槽位（qtype/tier/note），按 #17 指令映射
const assign: Record<string, { qtype: string; tier: string; note?: string }> = {
  '实验：探究加速度与力、质量的关系': { qtype: '实验', tier: '基础', note: '实验题降配路线：严格按「实验目的→实验步骤→数据处理→误差分析」四段结构，只用打点计时器/纸带一套主要器材，数据用教科书级整洁数（纸带计数点间隔均匀），结论明确不超纲，难度 D2' },
  '实验：导体电阻率的测量（螺旋测微器/游标卡尺）': { qtype: '实验', tier: '基础', note: '实验题降配路线：螺旋测微器/游标卡尺读数为恰好对齐刻度线的整洁读数，按「原理→步骤→读数→计算」组织，电路用文字描述，难度 D2' },
  '实验：练习使用多用电表': { qtype: '实验', tier: '基础', note: '实验题降配路线：欧姆挡读数/挡位选择/表笔电流方向等教科书级考法，读数恰好对齐刻度，难度 D2' },
  '实验：用单摆测定重力加速度': { qtype: '实验', tier: '基础', note: '实验题降配路线：T=2π√(L/g) 测 g，摆长/周期数据整洁，用 T²-L 图像斜率法处理数据，难度 D2' },
  '简谐运动的表达式与图像': { qtype: '填空', tier: '基础' },
  '光的波粒二象性与不确定性关系': { qtype: '选择', tier: '基础' },
  '摩擦力突变与临界问题': { qtype: '选择', tier: '中档' },
  '平抛运动的推论与约束边界（斜面/圆弧）': { qtype: '选择', tier: '中档' },
  '综合专题：电场中的平衡与动力学问题': { qtype: '选择', tier: '中档' },
  '带电粒子在电场中的偏转（类平抛）': { qtype: '选择', tier: '中档' },
  '电路动态分析（滑片移动/开关通断）': { qtype: '选择', tier: '中档' },
  '滑动变阻器的限流与分压接法': { qtype: '选择', tier: '中档' },
  '板块模型（叠块问题）': { qtype: '计算', tier: '中档', note: '解析按「隔离法受力分析→分别列牛顿第二定律→运动学关联」分步组织，数值自洽' },
  '综合专题：子弹打木块与板块模型（动量+能量）': { qtype: '计算', tier: '中档', note: '解析按「动量守恒→能量守恒/摩擦生热→分步给分点」组织，数值自洽' },
  '综合专题：力学三大观点综合应用': { qtype: '计算', tier: '中档', note: '解析按「动量观点/能量观点/运动学观点分别列式→分步给分点」组织，数值自洽' },
  '伏安特性曲线（线性/非线性元件）': { qtype: '实验', tier: '中档', note: '实验题：描绘伏安特性曲线，涉及电流表内外接选择与滑动变阻器分压接法，按「原理→电路选择依据→步骤→图像分析」组织，难度 D3' },
  '安培力作用下的动力学问题（导轨启动）': { qtype: '计算', tier: '压轴', note: '导轨启动模型：先变加速后匀速，按 D4 压轴难度把握，解析按「步骤给分点」组织（受力分析→列动力学方程→最大速度条件→后续过程），每步数值自洽' },
  '有界磁场：圆形磁场区域（磁发散/磁汇聚）': { qtype: '计算', tier: '压轴', note: '圆形磁场磁发散/磁汇聚：按 D4 压轴难度把握，解析按「步骤给分点」组织（找圆心定半径→边界条件→磁发散结论或逐段推导），数值自洽' },
  '综合专题：复合场综合（重力+电场+磁场）': { qtype: '计算', tier: '压轴', note: '复合场：按 D4 压轴难度把握，解析按「步骤给分点」组织（各场独立受力→等效重力场或分阶段运动→逐段求解），数值自洽' },
  '综合专题：磁场+动力学+能量压轴': { qtype: '计算', tier: '压轴', note: '按 D4 压轴难度把握，解析按「步骤给分点」组织（电磁感应/安培力→动力学方程→能量守恒收尾），数值自洽' },
  '综合专题：气体状态变化与热力学第一定律综合': { qtype: '计算', tier: '压轴', note: '解析按「过程判定（等温/等压/等容）→状态方程求解→W/Q/ΔU 判定」分步给分点组织，数值自洽' },
  '综合专题：振动图像与波的图像综合（双图互推）': { qtype: '填空', tier: '压轴', note: '由振动图读周期/起振方向、由波形图读波长，互推波速与传播距离，注意多解讨论，解析完整' },
  '质点振动方向与波传播方向（上下坡法）': { qtype: '填空', tier: '压轴', note: '上下坡法判定质点振动方向，含传播距离与时间的多解讨论，解析完整' },
  '波的图像': { qtype: '选择', tier: '压轴', note: '波形图像综合：波速/波长/周期的多解与双向传播讨论，选项覆盖典型易错点' },
}

const topics: Array<{ vol: string; chapter: string; grade: string; groups: Array<{ qtype: string; tier: string; n: number; kps: string[]; note?: string }> }> = []
const seen = new Set<string>()
for (const v of TEXTBOOK) {
  for (const ch of v.chapters) {
    for (const s of ch.sections) {
      const a = assign[s]
      if (!a) continue
      if (seen.has(s)) throw new Error('重复节: ' + s)
      seen.add(s)
      topics.push({ vol: VOL[v.id], chapter: ch.name, grade: GRADE[v.id], groups: [{ qtype: a.qtype, tier: a.tier, n: 1, kps: [s], ...(a.note ? { note: a.note } : {}) }] })
    }
  }
}
if (topics.length !== 24) throw new Error('应为 24 节，实际 ' + topics.length)
fs.writeFileSync('scripts/batch11-plan.json', JSON.stringify({ topics }, null, 2))
const mix: Record<string, number> = {}
const tier: Record<string, number> = {}
for (const t of topics) for (const g of t.groups) { mix[g.qtype] = (mix[g.qtype] || 0) + g.n; tier[g.tier] = (tier[g.tier] || 0) + g.n }
console.log('覆盖空节:', topics.length, '题型:', JSON.stringify(mix), '难度档:', JSON.stringify(tier))
