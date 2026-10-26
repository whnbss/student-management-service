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
5. 严格输出 JSON 数组，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
[{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点提示", "knowledge_points": ["知识点"], "difficulty": 3, "qtype": "计算"}]
其中 qtype 从：选择、填空、实验、计算 中选。`
