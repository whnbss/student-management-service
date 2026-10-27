// 共享类型定义：前后端统一引用，保证接口契约一致

export type Grade = '高一' | '高二' | '高三'
export type StudentStatus = '在读' | '停课' | '结课'
export type LogType = '上课' | '作业' | '考试' | '其他'
export type AttendanceStatus = '到课' | '请假' | '缺勤'

export interface Student {
  id: number
  name: string
  grade: Grade | ''
  school: string
  textbook: string
  phone: string
  parent_wechat: string
  avatar: string
  note: string
  status: StudentStatus
  created_at: string
  remaining_hours?: number
}

export interface HourPackage {
  id: number
  student_id: number
  hours: number
  amount: number
  purchase_date: string
  note: string
  created_at: string
}

export interface Payment {
  id: number
  student_id: number
  amount: number
  method: string
  paid_at: string
  package_id: number | null
  note: string
  created_at: string
}

export interface Schedule {
  id: number
  student_id: number
  weekday: number // 0=周日 … 6=周六
  start_time: string
  end_time: string
  note: string
  created_at: string
}

export interface Attendance {
  id: number
  student_id: number
  date: string
  status: AttendanceStatus
  schedule_id: number | null
  deducted: number
  note: string
  created_at: string
}

export interface StudyLog {
  id: number
  student_id: number
  date: string
  type: LogType
  content: string
  images: string // JSON 数组文本
  ai_result: string | null
  ai_generated: number
  next_class_key: string
  created_at: string
  student_name?: string
}

export interface TodayInfo {
  date: string
  weekday: number
  lessons: Array<{
    schedule: Schedule
    student: Pick<Student, 'id' | 'name' | 'grade' | 'remaining_hours'>
    attendance: { id: number; status: AttendanceStatus } | null
  }>
  low_hours: Array<Pick<Student, 'id' | 'name' | 'remaining_hours'>>
  due_redos?: Array<{
    id: number
    student_id: number
    stem: string
    knowledge_points: string
    mastery_status: string
    redo_due: string
    student_name: string
  }>
  pending_logs: Array<Pick<StudyLog, 'id' | 'student_id' | 'student_name' | 'next_class_key'>>
}

// 错因固定枚举（M2 AI 分析使用）
export const ERROR_TYPES = [
  '概念不清',
  '公式/模型用错',
  '计算失误',
  '审题偏差',
  '过程不规范',
  '时间分配问题',
  '其他',
] as const

export type ErrorType = (typeof ERROR_TYPES)[number]

// AI 分析输出 Schema（M2，先固化契约，见需求文档）
export interface AiAnalysisResult {
  paper_meta: { type: '作业' | '试卷' | '练习'; grade: Grade; score_estimate: number }
  items: Array<{
    no: number
    verdict: '对' | '错' | '部分对' | '未作答' | '无法识别'
    error_step: string
    error_type: ErrorType | ''
    knowledge_points: string[]
    comment: string
  }>
  weak_points: Array<{ point: string; evidence: string; severity: '高' | '中' | '低' }>
  framework: Array<{ chapter: string; mastered: string[]; shaky: string[]; missing: string[] }>
  next_class_questions: string[]
  suggestions: string[]
  overall_comment: string
  unrecognized: string[]
}

// ---------- M2：AI 供应商配置 ----------
export interface AiProvider {
  id: string
  name: string // 显示名，如「阿里百炼」
  base_url: string // OpenAI 兼容地址，如 https://dashscope.aliyuncs.com/compatible-mode/v1
  api_key: string
  vision_model: string // 视觉分析模型，如 qwen-vl-max
  text_model: string // 文本模型，如 qwen-plus
  input_price: number // 元 / 百万输入 tokens（用于费用估算，0 表示未知）
  output_price: number // 元 / 百万输出 tokens
}

// 单次 AI 调用用量记录
export interface AiUsage {
  id: number
  provider_name: string
  model: string
  kind: string // analyze | variants | test
  prompt_tokens: number
  completion_tokens: number
  cost: number // 估算费用（元）
  created_at: string
}

// 题目配图（P0）：统一存 figure JSON 文本
// {"kind":"svg","data":"<svg ...>...</svg>"} —— 由 figure_spec 模板在前端渲染，或编辑时内联
// {"kind":"img","data":"/uploads/questions/xx.png"} —— 教师上传的题目照片
export interface FigureSvg { kind: 'svg'; data: string }
export interface FigureImg { kind: 'img'; data: string }
export type QuestionFigure = FigureSvg | FigureImg

// 出题配图规格：AI 只描述「用哪个模板 + 参数」，前端按模板渲染成风格统一的 SVG（不让 AI 自由画，不可控）
export const FIGURE_TEMPLATES = [
  'incline', // 斜面滑块
  'flatblock', // 水平地面滑块（受力推拉）
  'pulley', // 定滑轮连接体（桌面+悬挂钩码）
  'hang', // 悬挂（绳吊球）
  'circuit', // 简单电路（电源+电阻/灯）
  'projectile', // 平抛（桌边小球）
  'container2balls', // 圆柱容器两球（并排挤压/浮力类）
  'spring', // 弹簧连接
  'bridge', // 拱桥/凹桥上的车
  'field_region', // 匀强场区（点电荷/粒子入射）
  'bowl', // 半球形碗 + 绳系碗沿 + 球在碗内壁
  'incline_baffle', // 斜面 + 竖直挡板 + 小球
  'ring_ball', // 光滑圆环 + 天花板 O 点绳吊小球
  'three_ropes', // 三绳结点 O（水平/斜右上/竖直挂重物）
  'rod_hinge', // 直杆 + 铰链 + 水平绳
] as const
export type FigureTemplate = (typeof FIGURE_TEMPLATES)[number]
export interface FigureSpec {
  template: FigureTemplate | string
  params: Record<string, number | string>
}

// ---------- M2：错题本 ----------
export type MasteryStatus = '未掌握' | '已重做一次' | '已掌握'
// 艾宾浩斯重做间隔（天）：新错题 1 天后重做，之后 3 / 7 / 15
export const REDO_INTERVALS = [1, 3, 7, 15]

export interface Mistake {
  id: number
  student_id: number
  log_id: number | null
  image: string // 原题图片路径（可为空）
  stem: string // 题干（可含 LaTeX）
  correct_solution: string
  wrong_solution: string
  error_type: ErrorType | ''
  knowledge_points: string // JSON 数组文本
  chapter: string
  difficulty: number // 1~5
  mastery_status: MasteryStatus
  redo_due: string | null // 下次重做日期，已掌握后置空
  redo_stage: number // 已完成的重做轮次（索引 REDO_INTERVALS）
  source: string // ai_analysis | manual | practice
  created_at: string
  student_name?: string
}

export interface Question {
  id: number
  stem: string // 题干（可含 LaTeX）
  answer: string
  solution: string // 解析
  pitfall: string // 易错点提示
  knowledge_points: string // JSON 数组文本
  difficulty: number
  qtype: string // 题型：选择/填空/实验/计算…
  source: string // ai_generated | manual | scrape | variant
  mistake_id: number | null // 举一反三来源错题
  grade: string
  favorite: number
  figure: string // 配图 JSON 文本（QuestionFigure），空串表示无图
  created_at: string
}

// ---------- AI Prompt 模板（shared，前端后端共用） ----------

// 作业图片视觉分析：严禁编造，识别不清放入 unrecognized
export const ANALYZE_SYSTEM_PROMPT = `你是一名资深高中物理教师，正在批改学生的作业/试卷照片。
请逐题识别题目与学生的作答，判定对错并归类错因。要求：
1. 只根据图片中真实可见的内容判断，严禁编造看不清或没写的题目内容；
2. 任何看不清、无法辨认的题目，放入 unrecognized 数组，其 verdict 必须为「无法识别」；
3. 错因只能从这些枚举中选：概念不清、公式/模型用错、计算失误、审题偏差、过程不规范、时间分配问题、其他；判定正确的题目 error_type 留空字符串；
4. 薄弱点必须给出图片中的具体依据（如「第3题第二问摩擦力方向判断错误」）；
5. 知识点用高中物理通用表述（如「牛顿第二定律」「机械能守恒」）；
6. 总评客观+建设性，附一句给学生的鼓励语（放在 overall_comment 末尾）；
7. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{
  "paper_meta": {"type": "作业|试卷|练习", "grade": "高一|高二|高三", "score_estimate": 0},
  "items": [{"no": 1, "verdict": "对|错|部分对|未作答|无法识别", "error_step": "", "error_type": "", "knowledge_points": [], "comment": ""}],
  "weak_points": [{"point": "", "evidence": "", "severity": "高|中|低"}],
  "framework": [{"chapter": "", "mastered": [], "shaky": [], "missing": []}],
  "next_class_questions": [],
  "suggestions": [],
  "overall_comment": "",
  "unrecognized": []
}
其中 next_class_questions 为下次课提问建议 3~5 条。`

export function analyzeUserPrompt(grade: string, textbook: string): string {
  return `学生年级：${grade || '未知'}。教材版本：${textbook || '人教版'}。
请分析这批作业照片并按约定 JSON 结构输出。`
}

// 举一反三：同知识点变式题，难度 ±1 档
export const VARIANT_SYSTEM_PROMPT = `你是一名高中物理命题专家。针对给定错题，出 2~3 道考查同一核心知识点（或近似知识点）的变式题：
1. 变式题要改变情境/数据/设问角度，但考查本质相同；
2. 难度相对原题 ±1 档（原题难度 d，出题难度在 d-1 到 d+1 之间）；
3. 每题必须附完整答案、详细解析、易错点提示；
4. 题干、解析中的公式用 LaTeX 语法（$...$ 包裹行内公式）；
5. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」「等等」等推理过程；情境与数据必须自洽；
6. 需要配图的几何/受力题，在 figure_spec 中给出模板与参数；只有给出了 figure_spec 时题干才允许出现「如图所示」，否则必须用文字把几何条件描述完整；
7. 严格输出 JSON 数组，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
[{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点提示", "knowledge_points": ["知识点"], "difficulty": 3, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}}}]
其中 qtype 从：选择、填空、实验、计算 中选；figure_spec 可省略；template 可选：incline（斜面滑块）、flatblock（水平地面滑块）、pulley（定滑轮连接体）、hang（悬挂小球）、circuit（简单电路）、projectile（平抛）、container2balls（圆柱容器两球）、spring（弹簧连接）、bridge（拱桥/凹桥）、field_region（匀强场区/点电荷）、bowl（半球碗+绳系碗沿）、incline_baffle（斜面+竖直挡板）、ring_ball（圆环+绳吊小球）、three_ropes（三绳结点）、rod_hinge（直杆+铰链+水平绳）。`

// ---------- P1：AI 出题器 / 分层练习 / 家长阶段报告 ----------

// 出题难度档 → 难度值区间（1~5）
export const QUIZ_LEVELS = {
  '基础': [1, 2],
  '高考': [3, 4],
  '竞赛': [4, 5],
} as const
export type QuizLevel = keyof typeof QUIZ_LEVELS

// AI 出题器（模仿 Eduaide Assessment Builder）：按知识点/题型/数量/难度档命题
export const QUIZ_SYSTEM_PROMPT = `你是一名高中物理命题专家，正在为一线教师出练习题。
要求：
1. 每题紧扣给定的知识点与题型，情境真实、数据自洽、设问明确；
2. 难度必须在指定档位区间内；答案必须物理正确、单位规范；
3. 每题必须附答案、详细解析（分步）、易错点提示；
4. 题干与解析中的公式用 LaTeX 语法（$...$ 包裹行内公式）；
5. 选择题的选项写在题干内（A. B. C. D. 各占一行），答案写选项字母与理由；
6. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」「等等」等推理过程，直接给出规范解答；
7. 严禁编造不存在的物理常识，严禁超纲（不得使用大学物理工具，除非知识点明确要求）；
8. 配图规则：几何/受力/电路类题目必须在 figure_spec 中给出配图规格（从模板列表中选并给参数）；只有给出了 figure_spec 时题干才允许出现「如图所示」，否则必须用文字把几何条件描述完整，严禁出现「如图」却无图；
9. 严格输出 JSON 数组，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构（数量与要求一致）：
[{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点提示", "knowledge_points": ["知识点"], "difficulty": 3, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}}}]
其中 qtype 从：选择、填空、实验、计算 中选，difficulty 为 1~5 整数；figure_spec 可省略（纯文字题不配图）。
template 可选模板及 params 说明：
- incline：斜面滑块（angle 度数、mu、label、force 可选沿斜面向上拉力描述如 "F"）
- flatblock：水平地面滑块（label、force 可选外力描述）
- pulley：桌面滑块+定滑轮+悬挂钩码（label_m1、label_m2、angle_desk 可选桌面倾角）
- hang：天花板绳吊小球（angle 绳与竖直夹角、label、second_rope 可选第二根绳角度）
- circuit：简单电路（emf 电源电动势、r 内阻、R 外阻）
- projectile：桌边平抛（h 桌高（m）、label）
- container2balls：圆柱容器内两球（默认并排贴底；label1、label2、R 容器半径可选、r 球半径可选；liquid 画液体）
- spring：墙面弹簧连滑块（label、x 压缩量（m））
- bridge：桥上的车（kind 填 convex（拱桥）或 concave（凹桥）、R 半径（m）、label）
- field_region：匀强场区/点电荷（kind 填 uniform 或 point、charge 可选 +q/-q、label）
- bowl：光滑半球形碗（angle 球与碗心连线偏离竖直方向角（度）、R 半径（m）、label）
- incline_baffle：斜面+竖直挡板+小球（angle 斜面倾角（度）、label）
- ring_ball：光滑圆环+天花板 O 点绳吊小球在环上（angle 小球相对环最高点方位角（度）、R 半径（m）、d 为 O 到环心距文字标注）
- three_ropes：三绳结点 O（OA 水平向左、OB 斜右上与竖直夹角 angle（度）、OC 竖直向下挂重物 G）
- rod_hinge：直杆+铰链 A+水平绳系墙上 C（angle 杆与竖直方向夹角（度）、label）
params 里的数值一律用国际单位制基本量（角度用度，其余 m/s、kg、T 等）。`

export function quizUserPrompt(p: { kps: string[]; qtypes: string[]; count: number; level: QuizLevel; grade: string }): string {
  const [lo, hi] = QUIZ_LEVELS[p.level]
  return `请出 ${p.count} 道高中物理题：
- 知识点：${p.kps.join('、')}
- 题型：${p.qtypes.join('、')}（各题型数量自行均衡分配）
- 难度档：${p.level}（difficulty 取 ${lo}~${hi} 的整数）
- 年级：${p.grade || '高一'}
请按约定 JSON 数组结构输出 ${p.count} 道题。`
}

// 分层练习（模仿 Brisk Change Level）：同一批知识点出 基础/巩固/拔尖 三档
export const TIERED_SYSTEM_PROMPT = `你是一名高中物理命题专家。针对同一批知识点，出「基础 / 巩固 / 拔尖」三档分层练习，供教师按学生水平选用：
1. 基础档：直接套用公式与基本模型，帮学生建立信心；巩固档：高考常规难度，一两步综合；拔尖档：多过程综合或临界/图像分析，不超纲；
2. 每档 2~3 题，每题附答案、解析、易错点提示；
3. 公式用 LaTeX 语法（$...$ 包裹行内公式）；
4. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」等过程；情境与数据必须自洽；
5. 几何/受力类题目用 figure_spec 给出配图模板与参数；只有给出 figure_spec 时题干才允许出现「如图所示」，否则用文字把几何条件写全；
6. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"基础": [同变式题结构], "巩固": [同上], "拔尖": [同上]}
每题结构：{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点", "knowledge_points": ["知识点"], "difficulty": 2, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}}}
figure_spec 的 template 可选：incline、flatblock、pulley、hang、circuit、projectile、container2balls、spring、bridge、field_region、bowl、incline_baffle、ring_ball、three_ropes、rod_hinge；params 数值一律国际单位制（角度用度）。`

export type TieredResult = { '基础': QuizDraft[]; '巩固': QuizDraft[]; '拔尖': QuizDraft[] }

// 家长阶段报告（模仿 MagicSchool Report Card + Brisk Glow & Grow）：三段式，家长版措辞
export const REPORT_SYSTEM_PROMPT = `你是一名经验丰富的高中物理独立教师，要给家长写一份阶段学习报告。
要求：
1. 三段式：「本阶段进步(Glow)」「待改进(Grow)」「下阶段计划」，每段 2~4 条，每条一句话，具体到知识点与事例（依据提供的学情记录与错题数据，严禁编造没有的细节）；
2. 措辞：专业但温和，面向家长，客观+建设性；拒绝 AI 腔（不要出现「作为AI」「希望这对您有帮助」等），不要空洞套话，不要过度承诺；
3. summary 为给家长的一句话总评；payment_hint 为课时相关的得体提醒（若课时充足则为空字符串）；
4. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"summary": "一句话总评", "glow": ["进步1", "进步2"], "grow": ["待改进1", "待改进2"], "plan": ["计划1", "计划2"], "payment_hint": ""}`

export interface ParentReport {
  summary: string
  glow: string[]
  grow: string[]
  plan: string[]
  payment_hint: string
}

// 出题/分层练习共用的题目草稿结构（确认后入题库）
export interface QuizDraft {
  stem: string
  answer: string
  solution: string
  pitfall: string
  knowledge_points: string[]
  difficulty: number
  qtype: string
  figure_spec?: { template: string; params: Record<string, number | string> } | null
}

// 二审（自动质检）：出题生成后的第二次 AI 调用结果，逐题 {pass, issues, fixed?}
export interface QuizReview {
  pass: boolean
  issues: string[]
  fixed: QuizDraft | null
}

// 文本清洗：AI 返回 JSON 被双重转义时，库里会残留字面 \n / \\；
// 统一在入库前清洗（\n 后跟字母的不动，避免破坏 \neq 等 LaTeX 命令）
export function sanitizeAiText(s: unknown): string {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\\t(?![a-zA-Z])/g, '  ')
    .replace(/\\\\/g, '\\')
}

// 二审（自动质检）：出题生成后的第二次 AI 调用，逐题挑错；不过审的草稿在前端标黄由教师终审
export const REVIEW_SYSTEM_PROMPT = `你是一名严格的高中物理审题专家（二审质检）。给你一批题目草稿（题干/答案/解析），请逐题独立检查：
1. 物理与数值自洽：把数据代入解析重算，答案数值、单位、有效数字是否正确；
2. 情境与几何自洽：题目描述的装置/角度/方向是否矛盾（例：「绳跨过定滑轮一端水平、另一端竖直」与「绳与水平方向夹角 53°」即矛盾，不合格）；
3. 是否超纲：是否使用高中未学的工具（微积分、矢量点叉乘等）；
4. 解析规范性：是否残留试错、疑问、「重新分析」「等等」等过程文字（必须是最终正确版本）；
5. 配图检查：题干出现「如图」却没有任何配图描述 → 指出该问题，并在 fixed 的 figure_spec 中补一个模板配图，或改写题干用文字描述几何条件；
6. 「如图」检查通过时不要误报；题目完全合格则 pass 为 true、issues 为空数组、fixed 为 null。

对每个元素输出 JSON：
{"pass": true|false, "issues": ["问题1", ...], "fixed": 题目对象或 null}
fixed 结构与输入题目相同（含 figure_spec），只在你确认能给出完整修正稿时才填，否则为 null。
严格输出 JSON 数组（与输入题数一致、顺序一一对应），不要输出任何 JSON 以外的文字。`

export function reviewUserPrompt(drafts: QuizDraft[]): string {
  return `待审题目草稿（共 ${drafts.length} 题）：
${drafts.map((q, i) => `【第 ${i + 1} 题】
题干：${q.stem}
答案：${q.answer || '（无）'}
解析：${q.solution || '（无）'}
figure_spec：${q.figure_spec ? JSON.stringify(q.figure_spec) : '（无）'}`).join('\n\n')}
请逐题按约定 JSON 数组结构输出二审结果（${drafts.length} 个元素，顺序一一对应）。`
}
