// 共享类型定义：前后端统一引用，保证接口契约一致

export * from './textbook'
export * from './date'
export * from './figure'
// 显式引入供本模块内使用（TEXTBOOK_SECTIONS 构建）
import { TEXTBOOK } from './textbook'

export type Grade = '高一' | '高二' | '高三'
export type StudentStatus = '在读' | '停课' | '结课'
export type LogType = '上课' | '作业' | '考试' | '其他'
export type AttendanceStatus = '到课' | '请假' | '缺勤'
// Phase 3 课时结算模式：package 充值课时（耗尽自动停用学生账号）| per_lesson 一课一结算
export type BillingMode = 'package' | 'per_lesson'

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
  billing_mode?: BillingMode
  lesson_price?: number
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

// 一课一结算：每次到课签到生成一条结算记录（金额取学生档案的单次课费用）
export interface Settlement {
  id: number
  student_id: number
  date: string
  amount: number
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
  homework: string // 下次课作业布置（C3，可选，学生端「日志」Tab 同步展示）
  created_at: string
  student_name?: string
}

export interface TodayInfo {
  date: string
  weekday: number
  lessons: Array<{
    schedule: Schedule
    student: Pick<Student, 'id' | 'name' | 'grade' | 'remaining_hours' | 'billing_mode'>
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

// AI 分析输出 Schema（M2，先固化契约，见需求文档；B4 原题还原：items 新增 stem/options/reference_answer/figure_spec/figure_status）
export interface AiAnalysisResult {
  paper_meta: { type: '作业' | '试卷' | '练习'; grade: Grade; score_estimate: number }
  items: Array<{
    no: number
    verdict: '对' | '错' | '部分对' | '未作答' | '无法识别'
    error_step: string
    error_type: ErrorType | ''
    knowledge_points: string[]
    comment: string
    // ---- B4 原题还原 ----
    stem: string // 原题题干全文（逐字识别，严禁改写缩写编造）
    options: string[] // 选择题各选项原文（A. B. C. D.），非选择题为空数组
    reference_answer: string // 参考答案与解析（能从图中看出/常规答案时填写）
    figure_spec: { template: string; params: Record<string, number | string> } | null // 原题配图重绘规格
    figure_status: '已重绘' | '图待补' | '' // 原题有图但无法用模板重绘时标「图待补」
    // ---- C2 两阶段批改：学生实际作答（答题卡识别结果，比对判定的依据） ----
    student_answer: string
    sub_answers?: SubAnswer[] // 多小问/多空逐项判定（12 题按空、13~16 按得分点）
  }>
  weak_points: Array<{ point: string; evidence: string; severity: '高' | '中' | '低' }>
  framework: Array<{ chapter: string; mastered: string[]; shaky: string[]; missing: string[] }>
  next_class_questions: string[]
  suggestions: string[]
  overall_comment: string
  unrecognized: string[]
}

// ---------- Phase 2：账号系统与同步通知 ----------
export type AccountRole = 'teacher' | 'student'

export interface Account {
  id: number
  role: AccountRole
  student_id: number | null // student 角色对应的学生；teacher 为 null
  username: string
  phone: string
  status: 'active' | 'suspended'
  must_change_pwd: number // 1 = 首次登录（初始密码为手机号），前端强制改密
  last_login: string | null
  created_at: string
  student_name?: string
  remaining_hours?: number
}

export interface LoginResp {
  ok: boolean
  token: string
  role: AccountRole
  username: string
  must_change_pwd: boolean
}

export interface NotificationItem {
  id: number
  target_role: AccountRole
  target_user_id: number | null
  type: string // redo | system ...
  title: string
  body: string
  ref_id: number | null
  read: number
  created_at: string
}

// 学生工作台「我的」信息
export interface StudentMe {
  username: string
  name: string
  grade: string
  status: StudentStatus
  remaining_hours: number
  billing_mode: BillingMode
  lesson_price?: number
  must_change_pwd: boolean
  account_status: 'active' | 'suspended'
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
// 功能批次 B1 配图铁律：模板库扩充至覆盖高中主要物理模型（传送带/板块/导轨/波动/实验装置等）
export const FIGURE_TEMPLATES = [
  'incline', // 斜面滑块
  'flatblock', // 水平地面滑块（受力推拉）
  'pulley', // 定滑轮连接体（桌面+悬挂钩码）
  'hang', // 悬挂（绳吊球）
  'circuit', // 简单电路（电源+电阻/灯）
  'projectile', // 平抛（桌边小球）
  'container2balls', // 圆柱容器两球（并排挤压/浮力类）
  'spring', // 弹簧连接
  'spring_vertical', // 竖直悬挂弹簧（天花板固定+下端钩码/物块，标 L₀ 原长/L 现长）
  'bridge', // 拱桥/凹桥上的车
  'field_region', // 匀强场区（点电荷/粒子入射）
  'bowl', // 半球形碗 + 绳系碗沿 + 球在碗内壁
  'bowl2balls', // 半球形碗内两等大球（球心连线水平、相互接触）
  'incline_baffle', // 斜面 + 竖直挡板 + 小球
  'ring_ball', // 光滑圆环 + 天花板 O 点绳吊小球
  'three_ropes', // 三绳结点 O（水平/斜右上/竖直挂重物）
  'rod_hinge', // 直杆 + 铰链 + 水平绳
  // ---- B1 扩充：覆盖高中主要模型 ----
  'conveyor', // 传送带（水平/倾斜，带速 v0）
  'block_on_block', // 板块模型（上下叠放两物块 + 拉力）
  'two_blocks', // 水平面上两物块并排/弹簧连接
  'incline_spring', // 斜面 + 弹簧 + 物块
  'equipotential', // 等势面（平行直线/同心圆）
  'magnet_rect', // 矩形匀强磁场区域 + 粒子入射（⊗）
  'magnet_circle', // 圆形匀强磁场区域 + 粒子入射（⊗）
  'rail', // 平行导轨 + 导体棒（电磁感应）
  'vertical_circle', // 竖直平面圆周（绳/杆/管道模型）
  'pendulum', // 单摆
  'wave', // 波形图（y-x 正弦曲线）
  'vibrate', // 振动图（y-t 正弦曲线）
  'optics_refract', // 光的折射/全反射（界面 + 法线）
  'exp_trolley', // 打点计时器小车实验（小车+纸带+滑轮砝码）
  'exp_circuit', // 实验电路（限流/分压：电源+滑变+电表）
  'gas_cylinder', // 气缸活塞（理想气体）
  'graph_lines', // 函数图像（x-t/v-t/a-t/Ek-ν 等坐标图，1~2 条直线段）
  'car_road', // 汽车/列车在平直公路（刹车/行驶）
  'pv_diagram', // p-V 状态图（等温/等压/等容线段或循环）
  'collision', // 两球碰撞（速度箭头）
  'freefall', // 竖直下落/上抛
  'accel_plates', // 平行板加速/偏转电场
  'wire_bfield', // 通电导线/运动电荷在磁场中（安培力/洛伦兹力）
  'photoelectric', // 光电效应（光照金属板逸出光电子）
  'coil_flux', // 线圈在磁场中（磁通量/感应电动势）
  'orbit', // 卫星/行星轨道（圆/椭圆 + 中心天体）
  'energy_levels', // 氢原子能级图（跃迁箭头）
  'double_slit', // 双缝干涉（双缝+波前+屏上条纹）
  'oil_film', // 油膜法估测分子大小（水面油膜网格）
  'multimeter', // 多用电表欧姆挡测电阻（表盘+表笔）
] as const
export type FigureTemplate = (typeof FIGURE_TEMPLATES)[number]
export interface FigureSpec {
  template: FigureTemplate | string
  params: Record<string, number | string>
}

// 全部模板的参数说明（出题/变式/分层/修复/补图各 prompt 与脚本共用这一份，防止多处失同步）
export const FIGURE_TEMPLATE_DOCS = `- incline：斜面滑块（angle 斜面倾角（度）、mu、label、force 可选沿斜面向上拉力描述如 "F"）
- flatblock：水平地面滑块（label、force 可选外力描述）
- pulley：桌面滑块+定滑轮+悬挂钩码（label_m1、label_m2、angle_desk 可选桌面倾角）
- hang：天花板绳吊小球（angle 绳与竖直夹角、label、second_rope 可选第二根绳角度）
- circuit：简单电路（emf 电源电动势、r 内阻、R 外阻）
- projectile：桌边平抛（h 桌高（m）、label）
- container2balls：圆柱容器内两球（默认并排贴底；label1、label2、R 容器半径可选、r 球半径可选；liquid 画液体）
- spring：墙面弹簧连滑块（label、x 压缩量（m））
- spring_vertical：竖直悬挂弹簧（天花板固定+竖直弹簧+下端钩码/物块；label 默认 "钩码"、l0 可选原长如 "10.0cm"、l 可选现长如 "14.0cm"；竖直悬挂/钩码拉伸实验一律用本模板，勿用水平 spring）
- bridge：桥上的车（kind 填 convex（拱桥）或 concave（凹桥）、R 半径（m）、label）
- field_region：匀强场区/点电荷（kind 填 uniform 或 point、charge 可选 +q/-q、label）
- bowl：光滑半球形碗（angle 球与碗心连线偏离竖直方向角（度）、R 半径（m）、label）
- bowl2balls：光滑半球形碗内两等大球并排相互接触（球心连线水平）（angle 球与碗心连线偏离竖直方向角（度）、R 碗半径（m）、r 球半径（m）、label1、label2）
- incline_baffle：斜面+竖直挡板+小球（angle 斜面倾角（度）、label）
- ring_ball：光滑圆环+天花板 O 点绳吊小球在环上（angle 小球相对环最高点方位角（度）、R 半径（m）、d 为 O 到环心距文字标注）
- three_ropes：三绳结点 O（OA 水平向左、OB 斜右上与竖直夹角 angle（度）、OC 竖直向下挂重物 G）
- rod_hinge：直杆+铰链 A+水平绳系墙上 C（angle 杆与竖直方向夹角（度）、label）
- conveyor：传送带（angle 倾角（度，0=水平）、mu、v0 带速（m/s）、label 物块标注、direction 可选 "up"（向上传送）/"down"）
- block_on_block：板块模型（上物块叠在下物块上）（label_top、label_bottom、force 可选作用于下板的拉力如 "F"）
- two_blocks：水平面上两物块并排/弹簧连接（label1、label2、force 可选推力、spring 填 1 表示两块间有弹簧）
- incline_spring：斜面底端挡板+弹簧+物块（angle 斜面倾角（度）、label）
- equipotential：等势面（kind 填 parallel（平行等距直线）或 circle（同心圆，中心点电荷 charge 如 +Q）、label 可选入射粒子）
- magnet_rect：矩形匀强磁场区域+粒子从边界入射（charge 如 +q、label 速度标注、angle 可选入射角（度，相对边界））
- magnet_circle：圆形匀强磁场区域+粒子沿半径指向圆心入射（charge 如 +q、label）
- rail：水平平行导轨+导体棒（R 导轨末端电阻、label 棒标注、v 可选棒速度标注）
- vertical_circle：竖直平面内圆周运动（kind 填 rope（轻绳）/rod（轻杆）/track（圆轨道内侧）、angle 小球位置方位角（度，0=最高点起顺时针）、R 半径（m）、label）
- pendulum：单摆（L 摆长（m）、angle 摆角（度）、label）
- wave：波形图 y-x（lambda 波长（m）、A 振幅（m）、label 可选质点标注如 "P"）
- vibrate：振动图 y-t（T 周期（s）、A 振幅（m））
- optics_refract：光的折射/全反射（kind 填 refract（折射）或 reflect（全反射）、i 入射角（度）、r 折射角（度）、n1/n2 介质折射率标注可选）
- exp_trolley：打点计时器小车实验（小车+纸带+计时器+定滑轮+悬挂砝码）（label 小车标注、m2 可选砝码标注）
- exp_circuit：伏安法实验电路（kind 填 limit（限流接法）或 divide（分压接法）、emf 电源、A 电流表、V 电压表）
- gas_cylinder：水平气缸+活塞封闭气体（label 气体标注、p 可选压强标注、thermo 填 1 画温度计）
- graph_lines：函数图像（坐标图 1~2 条直线段，适用 x-t/v-t/a-t/Ek-ν 等图像题）（xlabel 横轴标签如 "t/s"、ylabel 纵轴标签如 "v/(m·s⁻¹)"、l1_start/l1_end 第一条线起止纵值（数值，可负）、l2_start/l2_end 第二条线起止纵值（可省略=单线）、label1/label2 线标注如 "甲"/"乙"）
- car_road：汽车/列车在平直公路上（kind 填 brake（刹车，车尾画刹车痕）或 run（匀速/加速）、v0 速度标注、a 可选加速度标注、label 车辆标注）
- pv_diagram：p-V 状态图（等温/等压/等容过程线或循环；给 2~4 个状态点依次相连，闭合循环自动首尾相连）（pA,VA,pB,VB,pC,VC,pD,VD 各状态点压强/体积数值（只需给出出现的点），xlabel 可选 "V/m³"、ylabel 可选 "p/Pa"，label1~4 各点旁标注如 "等温"）
- collision：两球同向/相向碰撞（m1、v1 球1质量与速度（m/s）、m2、v2 球2质量与速度（可为负表示反向）、label1、label2）
- freefall：竖直下落/上抛（kind 填 down（下落）或 up（上抛）、h 高度（m）、v0 可选初速度标注、label）
- accel_plates：平行板电场加速/偏转（kind 填 accel（加速：粒子穿过带孔双板）或 deflect（偏转：粒子平行于板射入板间）、U 板间电压、d 可选板间距、charge 如 -e、label）
- wire_bfield：通电导线/运动电荷在磁场中（kind 填 wire（水平直导线，I 电流方向箭头）或 charge（运动电荷）、B 磁场标注如 "B（⊗垂直纸面向里）"、F 可选受力标注、label）
- photoelectric：光电效应（nu 入射光频率/波长标注、Ek 可选光电子最大初动能、W 可选逸出功标注、label 金属标注）
- coil_flux：线圈在磁场中（kind 填 static（线圈平放在磁场中）或 rotate（线圈绕竖直轴在磁场中匀速转动）、B 磁场标注、label 线圈标注）
- orbit：卫星/行星绕中心天体（kind 填 circle（圆轨道）或 ellipse（椭圆轨道）、R 可选轨道半径、label 卫星标注、center 中心天体标注如 "地球"）
- energy_levels：氢原子能级图（max_n 能级数（默认4）、from/to 跃迁箭头起止能级、E1 基态能量标注）
- double_slit：双缝干涉（d 双缝间距（mm）、L 双缝到屏距离（m）、lambda 波长标注可选）
- oil_film：油膜法估测分子大小（label 油膜标注）
- multimeter：多用电表欧姆挡测电阻（ohm 倍率如 "×100"、label 待测电阻标注）
params 里的数值一律用国际单位制基本量（角度用度，其余 m/s、kg、T 等）。`

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
  options: string // 选择题选项 JSON 数组文本（B4 原题还原；空数组 = 非选择题）
  figure: string // 题图 JSON 文本（QuestionFigure，B4 原题还原；空串 = 无图）
  correct_solution: string
  wrong_solution: string
  error_type: ErrorType | ''
  knowledge_points: string // JSON 数组文本
  chapter: string
  difficulty: number // 1~5
  mastery_status: MasteryStatus
  redo_due: string | null // 下次重做日期，已掌握后置空
  redo_stage: number // 已完成的重做轮次（索引 REDO_INTERVALS）
  source: string // ai_analysis | manual | practice | photo
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

// 作业图片视觉分析：严禁编造，识别不清放入 unrecognized；B4 原题还原：逐题完整识别并保存原题
export const ANALYZE_SYSTEM_PROMPT = `你是一名资深高中物理教师，正在批改学生的作业/试卷照片。
请逐题识别题目与学生的作答，判定对错并归类错因，并**完整还原原题**。要求：
1. 只根据图片中真实可见的内容判断，严禁编造看不清或没写的题目内容；
2. 任何看不清、无法辨认的题目，放入 unrecognized 数组，其 verdict 必须为「无法识别」；
3. 错因只能从这些枚举中选：概念不清、公式/模型用错、计算失误、审题偏差、过程不规范、时间分配问题、其他；判定正确的题目 error_type 留空字符串；
4. 薄弱点必须给出图片中的具体依据（如「第3题第二问摩擦力方向判断错误」）；
5. 知识点用高中物理通用表述（如「牛顿第二定律」「机械能守恒」）；
6. **原题还原（每题必做）**：
   - stem：把该题题干**逐字完整转录**（含公式写成 LaTeX，$...$ 包裹），严禁改写、缩写、概括或编造；题干较长的也要完整转录；
   - options：选择题把 A/B/C/D 每个选项的原文逐条放进数组（如 "A. ……"),非选择题留空数组；
   - reference_answer：写出该题的参考答案（选择题写字母+简理由，计算题写最终答案与关键式）；
   - figure_spec：原题配有插图且能用下方模板重绘时，给出重绘规格（模板名+参数，参数必须与原题数值严格一致）；原题有图但无法用模板重绘时，figure_spec 置 null 且 figure_status 填「图待补」，并在 unrecognized 中注明「第N题原图待补」；原题没有图则 figure_status 留空。严禁编造图形内容。
   可用配图模板：
   ${FIGURE_TEMPLATE_DOCS}
7. 总评客观+建设性，附一句给学生的鼓励语（放在 overall_comment 末尾）；
8. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{
  "paper_meta": {"type": "作业|试卷|练习", "grade": "高一|高二|高三", "score_estimate": 0},
  "items": [{"no": 1, "verdict": "对|错|部分对|未作答|无法识别", "error_step": "", "error_type": "", "knowledge_points": [], "comment": "", "stem": "原题题干全文", "options": [], "reference_answer": "", "figure_spec": null, "figure_status": ""}],
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

// ---------- C2 拍照识别准确率：两阶段批改流水线（试卷页 / 答题卡页分离） ----------
// 旧单阶段「一坨图片直接判对错」识别不出答题卡红叉、也不解原题；
// 新流水线：①视觉转录试卷完整原题 → ②文本模型独立求解得标准答案 → ③视觉读取答题卡学生作答
// → ④文本逐题比对（标准答案 vs 学生作答）出判定与错因。红叉只作校验线索，不作结论。

// C2 类型：试卷原题转录 / 独立求解 / 答题卡读取
export interface PaperExtractItem {
  no: string // 题号（如 "1"、"12(2)"、"15(3)"）
  qtype: '选择' | '填空' | '实验' | '计算'
  stem: string // 完整题干（逐字转录，公式 LaTeX，$...$ 包裹）
  options: string[] // 选择题选项原文
  sub_questions: string[] // 小问原文（(1)(2)(3) 或按空 (1)~(5)）
  has_figure: boolean // 原题是否配图
  figure_note: string // 配图内容一句话描述（无法重绘时保留说明）
}
export interface PaperSolvedItem {
  no: string
  answer: string // 标准答案（选择题字母；填空按空；计算最终值）
  solution: string // 完整解析（分步，公式 LaTeX）
  per_blank: Array<{ key: string; answer: string }> // 多空/多小问时逐空标准答案（单题单问可空）
}
export interface SheetReadItem {
  no: string
  student_answer: string // 学生实际作答（选择填涂字母；填空按空原文；计算抄关键结果）
  per_blank: Array<{ key: string; answer: string }> // 多空/多小问时逐空学生作答
  red_x: boolean // 卷面是否有红笔叉号（只作校验线索）
  handwritten_note: string // 手写作答关键内容（计算题步骤/结果）
}

// ① 视觉：试卷页 → 逐题完整转录原题
export const PAPER_EXTRACT_SYSTEM_PROMPT = `你是一名资深高中物理教师，正在把学生试卷照片**逐题逐字转录**成电子文本，供后续独立求解与批改。
要求：
1. 逐题完整转录：stem 逐字抄写题干全文（含公式写成 LaTeX，$...$ 包裹；严禁改写、缩写、概括、编造），选择题把 A/B/C/D 选项原文逐条放进 options，非选择题把每个小问/每个空的原文放进 sub_questions（保持 "(1)"、"(2)" 等编号）；
2. qtype 从 选择/填空/实验/计算 中选（实验归「实验」，含图像/装置的计算大题归「计算」）；
3. 图上若有学生手写作答，**忽略手写内容**，只转录印刷体原题（手写属于答题卡识别阶段的事）；
4. has_figure：原题配有插图（电路图/受力图/装置图/函数图像等）填 true，并在 figure_note 用一句话描述图的内容；纯文字题填 false；
5. 分辨不清的文字：在 unrecognized 中注明「第N题部分文字识别不清」，**严禁编造补全**；
6. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"paper_name": "试卷名称（卷头可见时）", "items": [{"no": "1", "qtype": "选择", "stem": "题干全文", "options": ["A. …", "B. …", "C. …", "D. …"], "sub_questions": [], "has_figure": false, "figure_note": ""}], "unrecognized": []}`

export function paperExtractUserPrompt(grade: string, pageCount: number): string {
  return `学生年级：${grade || '未知'}。这批照片共 ${pageCount} 张，都是**试卷题目页**（按拍摄顺序可能是卷面的连续页）。
请逐题完整转录所有可见题目并按约定 JSON 结构输出。`
}

// ② 文本：独立求解试卷（不依赖学生作答，得出标准答案与解析）
export const PAPER_SOLVE_SYSTEM_PROMPT = `你是一名资深高中物理命题与解题专家。给你一份**逐字转录的试卷原题**，请你作为「标准答案出品方」**独立求解每一道题**：
1. 不依赖任何学生作答信息，只根据题干与你的物理知识求解，得出标准答案与解析；
2. answer 写最终答案：选择题写选项字母+简要理由，填空题按空给值（(1)=…，(2)=…），计算题写最终数值与单位（关键中间式放 solution）；
3. solution 分步给出规范解答（公式用 LaTeX，$...$ 包裹；公式里的中文用 \\text{} 包裹），必须是最终正确版本，严禁试错/疑问等过程文字；
4. 多小问/多空题必须填 per_blank（key 用 "(1)"、"(2)" 或空序号，answer 为该空最终答案）；单题单问可给空数组；
5. 求解后**自查一遍**：量纲、数量级、边界条件、多选/单选；若某题题干本身不完整（转录缺条件），在 note 中注明「第N题题干不完整，按最合理补全求解」并给出条件性答案；
6. 可能附带试卷页原图：纸带读数、图像、电路与实验装置等数据**以图为准**（图中的手写痕迹是学生的演算，忽略其结论，自己独立算）；逐小问列式后代入数值复算一遍再定稿；
7. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"items": [{"no": "1", "answer": "D", "solution": "分步解析", "per_blank": []}], "note": ""}`

export function paperSolveUserPrompt(grade: string, questions: PaperExtractItem[]): string {
  const lines = questions.map((q) =>
    `【第${q.no}题·${q.qtype}】${q.stem}${q.options.length ? '\n选项：' + q.options.join(' | ') : ''}${q.sub_questions.length ? '\n小问：' + q.sub_questions.join(' ') : ''}${q.has_figure ? `\n（原题配图：${q.figure_note || '见卷面'}）` : ''}`
  ).join('\n\n')
  return `学生年级：${grade || '未知'}。试卷原题逐字转录如下：
${lines}
请独立求解每道题并按约定 JSON 结构输出（items 与输入题号一一对应，一个不多一个不少）。`
}

// ③ 视觉：答题卡页 → 学生实际作答（红叉只记录为线索）
export const SHEET_READ_SYSTEM_PROMPT = `你是一名阅卷助手，正在读取学生**答题卡照片**，逐题提取学生的实际作答。
要求：
1. 选择题：仔细识别每题 2B 铅笔填涂的选项框（涂黑的字母）；多题并排的框要按行仔细对应题号，严禁串行错位；
2. 红笔批改痕迹（叉号 ✗、圈划）：逐题记录到 red_x（有红叉=true）与 mark_note（描述红笔位置，如「B 选项上有红叉」）。**红叉只是线索，不得直接当结论**——最终判定以「作答内容 vs 标准答案」比对为准；
3. 填空题：逐空抄写学生手写的原文（公式照抄成 LaTeX，$...$ 包裹；看不清的空写「(字迹不清)」，严禁编造）；
4. 计算题：把学生手写的关键步骤与最终结果抄到 handwritten_note（重要的方程与结果，照实转录，看不清标「(字迹不清)」），student_answer 填最终结果。**手写数字必须逐位照抄**（如卷面写 9.625 就抄 9.625，严禁四舍五入成 8.6、严禁凭感觉改写）；每个手写结果抄完再回看原图复核一遍位数与小数点；
5. 空白未作答的题：student_answer 填「（空白）」，red_x 如实记录；
6. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"items": [{"no": "1", "student_answer": "A", "per_blank": [], "red_x": false, "mark_note": "", "handwritten_note": ""}], "unrecognized": []}`

export function sheetReadUserPrompt(grade: string, pageCount: number): string {
  return `学生年级：${grade || '未知'}。这批照片共 ${pageCount} 张，都是**答题卡**（含选择题填涂区与非选择题手写区，可能含红笔批改痕迹）。
请逐题提取学生的实际作答并按约定 JSON 结构输出。`
}

// ④ 文本：标准答案 vs 学生作答 逐题比对 → 判定/错因/错题集
export const COMPARE_SYSTEM_PROMPT = `你是一名资深高中物理教师，正在逐题比对「标准答案」与「学生实际作答」，输出批改结论。
判定纪律（严格执行）：
1. 结论只来自**作答内容 vs 标准答案**的比对：一致=「对」；不一致=「错」；多小问部分正确=「部分对」（并逐小问说明）；答题卡上该题无作答内容=「未作答」；作答内容看不清无法比对=「无法识别」；
2. 红笔叉号（red_x）**只作交叉校验线索**：若比对结论为「对」但卷面有红叉，优先复核学生作答转录是否遗漏（如填涂识别错位），仍无法确定时判「无法识别」并放入 unrecognized，**不得仅凭红叉直接判错**；
3. 计算/大题按**得分点**判定：用学生 handwritten_note 中的方程与结果，对照标准 solution 的关键步骤与小问分值，判定「对/部分对/错」，error_step 精确到失分的那一步（如「(3) 求拉力时漏乘 cosθ，得 3600J，正确为 3750J」）；
4. error_type 只能从枚举中选：概念不清、公式/模型用错、计算失误、审题偏差、过程不规范、时间分配问题、其他；判定正确的题 error_type 留空；无学生作答信息的题（如只传了试卷页）该题判「无法识别」并写明原因；
5. items 必须把**全部题目**逐一输出（与输入题号一致），stem 照抄输入的原题题干（不得缩写），options 照抄输入的选项，reference_answer 照抄输入的标准答案（可补充关键结论）；
6. 薄弱点必须给出具体依据（题号+失分点）；next_class_questions 为下次课提问建议 3~5 条；总评客观+建设性，附一句鼓励语（放 overall_comment 末尾）；
7. score_estimate：按卷面分值结构估算学生得分（可依据红叉/错题数量，但要写明这是估算）；
8. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"paper_meta": {"type": "试卷", "grade": "高三", "score_estimate": 0},
 "items": [{"no": 1, "verdict": "对|错|部分对|未作答|无法识别", "error_step": "", "error_type": "", "knowledge_points": [], "comment": "", "stem": "照抄原题", "options": [], "reference_answer": "照抄标准答案", "figure_spec": null, "figure_status": "", "student_answer": "照抄学生作答", "sub_answers": [{"key": "(1)", "verdict": "对", "student": "…", "correct": "…", "note": ""}]}],
 "weak_points": [{"point": "", "evidence": "", "severity": "高|中|低"}],
 "framework": [{"chapter": "", "mastered": [], "shaky": [], "missing": []}],
 "next_class_questions": [], "suggestions": [], "overall_comment": "", "unrecognized": []}`

export interface SubAnswer { key: string; verdict: string; student: string; correct: string; note: string }

export function compareUserPrompt(p: {
  grade: string
  hasSheet: boolean
  questions: PaperExtractItem[]
  solved: PaperSolvedItem[]
  sheet: SheetReadItem[]
  extraNote?: string
}): string {
  const std = p.solved.map((s) => `第${s.no}题：标准答案=${s.answer}${s.per_blank.length ? `（逐空：${s.per_blank.map((b) => `${b.key}=${b.answer}`).join('，')}）` : ''}\n  解析：${s.solution.slice(0, 400)}`).join('\n')
  const stu = p.hasSheet
    ? p.sheet.map((s) => `第${s.no}题：学生作答=${s.student_answer}${s.per_blank.length ? `（逐空：${s.per_blank.map((b) => `${b.key}=${b.answer}`).join('，')}）` : ''}${s.red_x ? '［卷面有红叉］' : ''}${s.handwritten_note ? `\n  手写作答：${s.handwritten_note.slice(0, 300)}` : ''}`).join('\n')
    : '（本次未提供答题卡，无法比对学生作答——所有题目判「无法识别」并注明原因）'
  const stems = p.questions.map((q) =>
    `第${q.no}题（${q.qtype}）：${q.stem.slice(0, 300)}${q.options.length ? '\n  选项：' + q.options.join(' | ') : ''}${q.sub_questions.length ? '\n  小问：' + q.sub_questions.join(' ') : ''}`
  ).join('\n')
  return `学生年级：${p.grade || '未知'}。
原题题干（照抄进输出，不得缩写）：
${stems}

标准答案（独立求解所得）：
${std}

学生实际作答（答题卡识别所得）：
${stu}
${p.extraNote ? `\n补充说明：${p.extraNote}` : ''}
请逐题比对并按约定 JSON 结构输出。items 的 no 用数字（如 1、12、15，有小问的题用「15」为主编号，小问结论写进 sub_answers）。`
}

// ②′ 标准答案交叉复核（二审）：对独立求解结果再验一遍，修正错误答案
export const SOLVE_REVIEW_SYSTEM_PROMPT = `你是一名资深高中物理阅卷组长，负责**复核**另一名老师给出的试卷标准答案。请你当作自己从没见过这份答案一样，逐题独立重算，再与给出的答案对照：
1. 逐题独立重算（选择/填空/计算全部；多小问逐小问），然后与给出的「待复核答案」对照；
2. 两者一致 → answer/keep 照抄；不一致 → 以你重算的结果为准修正（answer 给修正后的），changed=true 并在 reason 写明错在哪一步（如「动能比应为 k，原答案把质量比弄反」）；
3. 计算题代数值时逐位复算；选择题注意单选唯一正确；填空注意有效数字与单位；
4. 严禁把「待复核答案」当权威直接照抄——你必须真的重算；严禁试错/疑问等过程文字（solution 只给最终规范解答）；
5. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"items": [{"no": "1", "answer": "复核后的答案", "solution": "规范解析", "per_blank": [{"key": "(1)", "answer": "..."}], "changed": false, "reason": ""}], "note": ""}`

export function solveReviewUserPrompt(p: { grade: string; questions: PaperExtractItem[]; solved: PaperSolvedItem[] }): string {
  const q = p.questions.map((x) =>
    `第${x.no}题（${x.qtype}）：${x.stem.slice(0, 280)}${x.options.length ? '\n  选项：' + x.options.join(' | ') : ''}${x.sub_questions.length ? '\n  小问：' + x.sub_questions.join(' ') : ''}`
  ).join('\n')
  const a = p.solved.map((s) => `第${s.no}题：答案=${s.answer}${s.per_blank.length ? `（逐空：${s.per_blank.map((b) => `${b.key}=${b.answer}`).join('，')}）` : ''}`).join('\n')
  return `学生年级：${p.grade || '未知'}。
原题题干：
${q}

待复核答案（另一名老师独立求解所得，可能有错）：
${a}
请逐题独立重算并复核，按约定 JSON 结构输出（items 与输入题号一一对应）。`
}

// 举一反三：同知识点变式题，难度 ±1 档
export const VARIANT_SYSTEM_PROMPT = `你是一名高中物理命题专家。针对给定错题，出 2~3 道考查同一核心知识点（或近似知识点）的变式题：
1. 变式题要改变情境/数据/设问角度，但考查本质相同；
2. 难度相对原题 ±1 档（原题难度 d，出题难度在 d-1 到 d+1 之间）；
3. 每题必须附完整答案、详细解析、易错点提示；
4. 题干、解析中的公式用 LaTeX 语法（$...$ 包裹行内公式）；LaTeX 公式里的中文（含上下标）必须用 \text{} 包裹（如 $v_{\text{甲}}$、$W_{\text{电}}$），严禁裸中文进数学模式；
5. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」「等等」等推理过程；情境与数据必须自洽；
6. 配图铁律：凡涉及公式计算、受力分析、物体运动、电路、场、振动与波、光路、气体或实验装置的变式题，必须在 figure_spec 中给出配图规格（模板与参数须与题干数值严格一致）；只有纯概念辨析题允许省略；只有给出了 figure_spec 时题干才允许出现「如图所示」，否则必须用文字把几何条件描述完整；
7. 严格输出 JSON 数组，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
[{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点提示", "knowledge_points": ["知识点"], "difficulty": 3, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}}}]
其中 qtype 从：选择、填空、实验、计算 中选。
template 可选模板及 params 说明：
${FIGURE_TEMPLATE_DOCS}`

// ---------- P1：AI 出题器 / 分层练习 / 家长阶段报告 ----------

// 出题难度档 → 难度值区间（1~5）。C5：四档「基础 / 中档 / 稍难 / 压轴」（替换旧 基础/高考/竞赛）
export const QUIZ_LEVELS = {
  '基础': [1, 2],
  '中档': [3, 3],
  '稍难': [4, 4],
  '压轴': [5, 5],
} as const
export type QuizLevel = keyof typeof QUIZ_LEVELS
// 旧档名兼容映射（历史脚本仍传 高考/竞赛）
export const QUIZ_LEVEL_ALIASES: Record<string, QuizLevel> = { 高考: '中档', 竞赛: '压轴' }

// AI 出题器（模仿 Eduaide Assessment Builder）：按知识点/题型/数量/难度档命题
export const QUIZ_SYSTEM_PROMPT = `你是一名高中物理命题专家，正在为一线教师出练习题。
要求：
1. 每题紧扣给定的知识点与题型，情境真实、数据自洽、设问明确；
2. 难度必须在指定档位区间内；答案必须物理正确、单位规范。难度定义（C5 四档）：基础=单步代入或直接套公式（D1~2）；中档=2~3 步综合计算（多对象或多过程，但套路常规，D3）；稍难=含临界条件、图像分析、实验数据处理或双对象联动，步骤更多但主线单一（D4）；压轴=跨章节知识综合、多对象耦合（如双星/板块/传送带两物体联动）、多过程拼接（D5）。压轴必须满足以下至少一条：跨章节知识综合、多对象耦合、临界与图像叠加分析——单对象单章的常规多步计算（哪怕计算量较大）只能算中档 D3 或稍难 D4，严禁标为压轴；压轴题情境优先取「综合专题」类跨章综合；
3. 每题必须附答案、详细解析（分步）、易错点提示；实验题必须按「实验目的 → 实验步骤（或装置与器材）→ 数据处理 → 误差分析」四段结构完整作答；
4. 题干与解析中的公式用 LaTeX 语法（$...$ 包裹行内公式）；LaTeX 公式里的中文（含上下标，如物体甲的速度、电场力做的功）必须用 \text{} 包裹，写成 $v_{\text{甲}}$、$W_{\text{电}}$，严禁裸中文进数学模式；
5. 选择题的选项写在题干内（A. B. C. D. 各占一行），答案写选项字母与理由；
6. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」「等等」等推理过程，直接给出规范解答；
7. 严禁编造不存在的物理常识，严禁超纲（不得使用大学物理工具，除非知识点明确要求）；
8. 配图铁律（物理讲究通过题目图片来分析解题而不是空想）：凡涉及公式计算、受力分析、物体运动、电路、场（电场/磁场）、振动与波、光路、理想气体或实验装置的题（无论选择/填空/实验/计算），必须在 figure_spec 中给出配图规格（从模板列表中选并给参数）；只有不涉及任何计算与情境的纯概念判断题（如单位制、物理学史、无计算无情境的纯概念辨析）才允许省略 figure_spec。figure_spec 的参数必须与题干给出的数值严格一致（角度/μ/R/r 等逐一对上），严禁图与题干数据不符或套用与情境无关的模板；只有给出了 figure_spec 时题干才允许出现「如图所示」，否则必须用文字把几何条件描述完整，严禁出现「如图」却无图；
9. knowledge_points 必须包含题目要求里给出的知识点/节名原文（原样照抄，不要改写、不要拆分、不要增删括号）；补充标签（若需要）也必须使用教材目录中的节名原文（原样照抄），严禁自创变体写法（如把「闭合电路的欧姆定律」写成「闭合电路欧姆定律」、「带电粒子在电场中的偏转（类平抛）」写成「类平抛运动」）；
10. 输出顺序必须按题型分组：先输出全部选择题，再全部填空题、实验题，最后计算题（与试卷大题顺序一致），组内按难度从低到高；
11. 严格输出 JSON 数组，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。
12. 渲染卫生：填空空位一律用 8 个纯文本下划线 ________，后缀说明直接用普通文字接在空位后（如 ________倍），严禁用 \\underline、\\hspace、{\\text{…}} 包裹空位，严禁 \\begin{array} 等表格环境（表格数据用文字逐项列出）；数学上下标中的中文必须用 _{\\text{…}} 写法（如 $v_{\\text{甲}}$），严禁单下划线后直接跟中文（如 x_子）；只有 $…$/$$…$$ 定界符内才允许出现 LaTeX 命令，定界符外的普通文字段严禁出现任何 LaTeX 命令；

输出 JSON 结构（数量与要求一致）：
[{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点提示", "knowledge_points": ["知识点"], "difficulty": 3, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}}}]
其中 qtype 从：选择、填空、实验、计算 中选，difficulty 为 1~5 整数；仅纯概念判断题允许省略 figure_spec（见规则 8 配图铁律）。
template 可选模板及 params 说明：
${FIGURE_TEMPLATE_DOCS}`

export function quizUserPrompt(p: { kps: string[]; qtypes: string[]; count: number; level: QuizLevel; grade: string; hint?: string; avoid?: string[]; seed?: string }): string {
  const [lo, hi] = QUIZ_LEVELS[p.level]
  // C5 同参数去重：注入随机种子 + 上次题干摘要排除项，强制换情境/数值/设问
  const avoidBlock = p.avoid && p.avoid.length
    ? `\n- 避免重复：以下题目是刚刚生成过的（题干摘要），本次严禁再出与它们情境、数值或设问雷同的题，必须更换物理情境、更换数值、更换设问角度：\n${p.avoid.map((s, i) => `  ${i + 1}. ${s.slice(0, 80)}`).join('\n')}`
    : ''
  const seedBlock = p.seed ? `\n- 创作种子（本次命题多样性种子，用于启发不同的情境与数值组合）：${p.seed}` : ''
  return `请出 ${p.count} 道高中物理题：
- 知识点：${p.kps.join('、')}
- 题型：${p.qtypes.join('、')}（按题型分组输出：先输出全部选择题，再填空题、实验题，最后计算题；组内按难度从低到高）
- 难度档：${p.level}（difficulty 取 ${lo}~${hi} 的整数）
- 年级：${p.grade || '高一'}${seedBlock}${avoidBlock}${p.hint ? `\n- 补充要求：${p.hint}` : ''}
请按约定 JSON 数组结构输出 ${p.count} 道题。`
}

// 分层练习（模仿 Brisk Change Level）：同一批知识点出 基础/巩固/拔尖 三档
export const TIERED_SYSTEM_PROMPT = `你是一名高中物理命题专家。针对同一批知识点，出「基础 / 巩固 / 拔尖」三档分层练习，供教师按学生水平选用：
1. 基础档：直接套用公式与基本模型，帮学生建立信心；巩固档：高考常规难度，一两步综合；拔尖档：多过程综合或临界/图像分析，不超纲；
2. 每档 2~3 题，每题附答案、解析、易错点提示；
3. 公式用 LaTeX 语法（$...$ 包裹行内公式）；LaTeX 公式里的中文（含上下标）必须用 \text{} 包裹（如 $v_{\text{甲}}$、$W_{\text{电}}$），严禁裸中文进数学模式；
4. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」等过程；情境与数据必须自洽；
5. 配图铁律：凡涉及公式计算、受力分析、物体运动、电路、场、振动与波、光路、气体或实验装置的题，用 figure_spec 给出配图模板与参数（参数与题干数值严格一致）；只有纯概念判断题允许省略；只有给出 figure_spec 时题干才允许出现「如图所示」，否则用文字把几何条件写全；
6. knowledge_points 必须包含题目要求里给出的知识点/节名原文（原样照抄）；补充标签（若需要）也必须使用教材目录中的节名原文，严禁自创变体写法；
7. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"基础": [同变式题结构], "巩固": [同上], "拔尖": [同上]}
每题结构：{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点", "knowledge_points": ["知识点"], "difficulty": 2, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}}}
figure_spec 的 template 可选及 params 说明：
${FIGURE_TEMPLATE_DOCS}`

export type TieredResult = { '基础': QuizDraft[]; '巩固': QuizDraft[]; '拔尖': QuizDraft[] }

// ---------- B5 智能教案：拍照试卷 → AI 诊断 → 结构化教案（打印 PDF） ----------
// 结构严格参照示例《高三物理错题讲义（10月检测）.docx》：
// 封面 / 失分诊断总览（选择题表 + 非选择题表 + 失分主线 + 优势）/ 知识框架 / 变形训练题 / 课后任务

// 第一步（视觉）：逐题诊断——从试卷照片还原原题并给出作答/正解/漏洞分析
export interface LessonDiagnosisItem {
  no: string // 题号（含小问，如 "15(3)"）
  qtype: '选择' | '非选择'
  stem: string // 原题题干全文（逐字转录，严禁编造）
  options: string[] // 选择题选项原文
  context: string // 情境（一句话概括）
  kp: string // 考查点/知识点
  student_answer: string // 学生作答（卷面可见时）
  correct_answer: string // 正解
  solution: string // 正确解法关键步骤
  gap: string // 漏洞/失分原因分析
}
export interface LessonDiagnosis {
  paper_name: string // 试卷来源/名称
  paper_note: string // 满分/时长等补充（可见时）
  items: LessonDiagnosisItem[]
  note: string // 识别说明（识别不清的内容在此注明，严禁编造）
}

// 第二步（文本）：生成完整教案 JSON
export interface LessonPlan {
  cover: { title: string; subtitle: string; source: string; time: string; composition: string }
  overview: {
    text: string // 总览段落（失分分布 + 总体评价 + 本次课思路）
    choice_table: Array<{ no: string; context: string; answer: string; correct: string; gap: string }>
    nonchoice_table: Array<{ no: string; kp: string; answer: string; correct: string; gap: string }>
    mainlines: string[] // 失分主线 2~3 条
    strengths: string // 优势
  }
  frameworks: Array<{ title: string; targets: string; priority: string; content: string[]; self_check: string[] }>
  variants: Array<{ ref: string; topic: string; stem: string; solution: string; insight: string }>
  homework: { text: string; items: string[] }
}

// 第一步 prompt（视觉诊断）
export const LESSON_DIAGNOSE_SYSTEM_PROMPT = `你是一名资深高中物理教师，正在逐题诊断学生试卷照片，为编写错题讲义做准备。
要求：
1. 逐题完整还原原题：stem 逐字转录题干（公式写成 LaTeX，$...$ 包裹），选择题把 A/B/C/D 选项原文逐条放进 options；严禁改写、缩写、编造；看不清的题在 note 中注明「第N题识别不清」；
2. 每题给出：qtype（选择/非选择）、context（一句话概括情境）、kp（考查点/知识点）、student_answer（卷面可见的学生作答，看不清写「卷面未见」）、correct_answer（正解）、solution（正确解法关键步骤）、gap（漏洞/失分原因分析，具体到步骤与概念）；
3. 只诊断**做错或有扣分痕迹**的题？不——全部可见题目都要诊断（correct_answer 照实给出），教师后续只取错题编讲义；
4. 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"paper_name": "试卷名称/来源", "paper_note": "满分/时长等补充", "items": [{"no": "7", "qtype": "选择", "stem": "原题题干全文", "options": ["A. …", "B. …"], "context": "情境概括", "kp": "考查点", "student_answer": "B", "correct_answer": "C", "solution": "正解关键步骤", "gap": "漏洞分析"}], "note": "识别说明"}`

// 第二步 prompt（教案生成，结构模仿示例 docx）
export const LESSON_PLAN_SYSTEM_PROMPT = `你是一名资深高中物理教师，要根据试卷逐题诊断结果，编写一份可直接打印、一对一课堂上使用的错题讲义（智能教案）。
结构必须严格遵循以下五部分（模仿成熟讲义范式）：
1. cover 封面：title（讲义标题，如「高三物理错题讲义（XX检测）」）、subtitle（一句话副标题）、source（试卷来源）、time（授课时间，按当前日期）、composition（内容构成：错题诊断 · N大知识框架 · M道变式题详解）；
2. overview 失分诊断总览：text（失分分布与总体评价，具体到题号与分数）、choice_table（选择题错题表：题号/情境/作答/正解/漏洞分析——情境要具体，漏洞分析要指到概念或步骤）、nonchoice_table（非选择题错题表：题号/考查点/作答/正确/失分原因）、mainlines（失分主线 2~3 条，每条归纳一类共性漏洞）、strengths（优势，具体到题号）；
3. frameworks 知识框架（3~6 个，每个对应具体错题）：title（框架名，如「功能关系全家福 —— 针对第8题、15(3)」）、targets（针对哪些题）、priority（优先级，如「★最高优先级」）、content（核心干货条目：核心结论/公式/方法流程/陷阱分析，每条独立成段，结合原题数据讲解，公式用 LaTeX $...$）、self_check（自查问题 1~3 条）；
4. variants 变形训练题（≥5 道，每道对应原题题号）：ref（对应第X题）、topic（考点名）、stem（变式题题干，情境/数据改变但考查本质相同，难度贴近原题）、solution（完整详解，分步，最终数值正确）、insight（点睛：一句话点破易错处）；
5. homework 课后任务：text（引导句）+ items（① 原题重做 ② 变式巩固 ③ 下讲预告，各一条）。
纪律：
- 所有内容必须基于给定诊断结果，严禁编造卷面上没有的题；
- 解析必须是最终正确版本，严禁试错/疑问/「重新分析」等过程文字，数据自洽；
- 措辞专业、直接给结论，拒绝 AI 腔；
- 严格输出 JSON，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"cover": {"title": "", "subtitle": "", "source": "", "time": "", "composition": ""},
 "overview": {"text": "", "choice_table": [{"no": "", "context": "", "answer": "", "correct": "", "gap": ""}], "nonchoice_table": [{"no": "", "kp": "", "answer": "", "correct": "", "gap": ""}], "mainlines": [""], "strengths": ""},
 "frameworks": [{"title": "", "targets": "", "priority": "", "content": [""], "self_check": [""]}],
 "variants": [{"ref": "对应第X题", "topic": "", "stem": "", "solution": "", "insight": ""}],
 "homework": {"text": "", "items": [""]}}`

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
  /** 二审闭环自动修复说明（仅终稿带，表示该题曾被自动修正过） */
  fix_note?: string
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

// ---------- P2-12：LaTeX 中文下标清洗 ----------
// 公式里裸中文（$v_甲$、$W_{电}$）会被 KaTeX 按数学变量渲染（斜体不规范）并刷 console 警告；
// 入库前统一把上/下标中的中文包上 \text{}（已在 \text{} 内的不重复处理）
function wrapChineseScript(source: string, mark: string): string {
  // 形式一：mark{中文...} → mark{\text{...}}（花括号内含中文且尚未包 \text）
  let t = source.replace(new RegExp(`\\${mark}\\{([^{}]*)\\}`, 'g'), (m: string, inner: string) => {
    if (!/[一-龥]/.test(inner) || inner.includes('\\text')) return m
    return `${mark}{\\text{${inner}}}`
  })
  // 形式二：mark中文 → mark{\text{中文}}（紧跟的连续中文/括号/间隔号串）
  t = t.replace(new RegExp(`\\${mark}([\\u4e00-\\u9fa5][\\u4e00-\\u9fa5·（）()0-9]*)`, 'g'), (_m: string, cs: string) => `${mark}{\\text{${cs}}}`)
  return t
}
export function sanitizeLatexChinese(s: unknown): string {
  let t = String(s ?? '')
  t = wrapChineseScript(t, '_')
  t = wrapChineseScript(t, '^')
  return t
}

// ---------- C1：裸 LaTeX 自动补定界（教案/分析文本中公式未包 $...$ 时按原文直出成乱码源码） ----------
// 把「游离在数学定界符之外、但明显是 LaTeX/公式」的片段自动包上 $...$，
// 使 KaTeX 渲染层（ Katex.tsx / texToMathml）对同一份文本口径一致。规则宁可少包不误包：
//  - 只有出现 LaTeX 命令（\frac、\sqrt、\times…）或 ^/_ 上下标才算「公式信号」；
//  - 从信号向两侧扩展数学字符（数字/字母/运算符/括号/空格），遇中文停（\text{...} 内除外）；
//  - 行内 $ 个数为奇数（缺右定界）时把行尾悬空段补全。
const KATEX_MATH_SEG = /\$\$[\s\S]+?\$\$|\\\[([\s\S]+?)\\\]|\$[^$\n]+?\$|\\\(([\s\S]+?)\\\)/g

function isMathChar(c: string): boolean {
  return /[A-Za-z0-9+\-*/×÷=·.,<>≤≥≠≈(){}\[\]^_\\°′″%'|~]/.test(c) || c === ' ' || c === '\t'
}

// 扩展一个公式片段：从种子区间向两侧扩展，返回 [start, end)
function expandMathRun(line: string, seedStart: number, seedEnd: number): [number, number] {
  let s = seedStart
  let e = seedEnd
  while (s > 0) {
    const c = line[s - 1]
    if (!isMathChar(c)) break
    // \text{...} / \mathrm{...} 内的中文允许整体保留：命中 \text{ 时把 s 拉到该命令开头
    const before = line.slice(Math.max(0, s - 6), s)
    if (/\\(?:text|mathrm|mathbf|mbox)$/.test(before)) { s -= 6; continue }
    s--
  }
  while (e < line.length) {
    const c = line[e]
    if (!isMathChar(c)) break
    if (c === '\\') {
      // \命令（如 \times、\text{中文}）整体吞入
      const m = /^\\[a-zA-Z]+/.exec(line.slice(e))
      if (m) { e += m[0].length; continue }
      break
    }
    e++
  }
  // 去掉首尾悬空的空白与孤立运算符/逗号（如 "= "、"，"），避免包出空公式
  const trimEnd = (str: string) => str.replace(/[\s.,=+×÷*/·\-]+$/, '')
  const trimStart = (str: string) => str.replace(/^[\s.,=+×÷*/·\-]+/, '')
  let txt = line.slice(s, e)
  const cutL = txt.length - trimStart(txt).length
  const cutR = txt.length - trimEnd(txt).length
  s += cutL
  e -= cutR
  if (e <= s) return [seedStart, seedEnd]
  return [s, e]
}

/** 把非数学段落中的裸 LaTeX 片段包上 $...$（已含定界符的段落原样保留） */
export function wrapBareLatex(text: string): string {
  const src = String(text ?? '')
  // 含 $ 的文本也要进来（处理「缺右定界」）；完全无公式信号的才直接返回
  if (!src || !/[\\^_$]/.test(src)) return src
  const out: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  KATEX_MATH_SEG.lastIndex = 0
  const processPlain = (plain: string) => {
    // 逐行处理：行内公式很少跨行（$$ 块级已在切分时保护）
    const lines = plain.split('\n').map((line) => {
      // 缺失右 $ 的行（$ 数量为奇数）：把 $ 之后视为公式补右定界，公式主体截到第一个中文停
      const dollars = (line.match(/\$/g) || []).length
      let fixed = line
      if (dollars % 2 === 1) {
        fixed = line.replace(/\$([^$]*)$/, (_mm, inner: string) => {
          const stop = inner.search(/[一-龥，。；：、（）]/)
          return stop >= 0 ? `$${inner.slice(0, stop)}$${inner.slice(stop)}` : `$${inner}$`
        })
      }
      if (!/[\\^_]/.test(fixed)) return fixed
      // 收集公式信号种子
      const seeds: Array<[number, number]> = []
      for (const sm of fixed.matchAll(/\\[a-zA-Z]{2,}(?:\s*(?:\{[^{}]*\}|\[[^\[\]]*\]))*/g)) {
        seeds.push([sm.index!, sm.index! + sm[0].length])
      }
      // ^ 上下标：变量/数字后接 ^（10^8、v^2 都是公式）
      for (const sm of fixed.matchAll(/[A-Za-z0-9)\]]\s*\^\s*(?:\{[^{}\n]*\}|[-+\w一-龥.()]{1,12})/g)) {
        seeds.push([sm.index!, sm.index! + sm[0].length])
      }
      // _ 下标：前面必须是字母/括号/右花括号（排除 2026_10_31.docx 这类文件名/日期的数字下划线）
      for (const sm of fixed.matchAll(/[A-Za-z}\)]\s*_\s*(?:\{[^{}\n]*\}|[-+\w一-龥.()]{1,12})/g)) {
        seeds.push([sm.index!, sm.index! + sm[0].length])
      }
      if (!seeds.length) return fixed
      // 区间扩展 + 合并重叠
      const runs = seeds.map(([a, b]) => expandMathRun(fixed, a, b)).sort((a, b) => a[0] - b[0])
      const merged: Array<[number, number]> = []
      for (const r of runs) {
        const tail = merged[merged.length - 1]
        if (tail && r[0] <= tail[1] + 1) tail[1] = Math.max(tail[1], r[1])
        else merged.push([...r] as [number, number])
      }
      // 重组：区间之间夹的普通文字保留
      let res = ''
      let pos = 0
      for (const [a, b] of merged) {
        res += fixed.slice(pos, a) + '$' + fixed.slice(a, b) + '$'
        pos = b
      }
      res += fixed.slice(pos)
      return res
    })
    return lines.join('\n')
  }
  while ((m = KATEX_MATH_SEG.exec(src))) {
    out.push(processPlain(src.slice(last, m.index)))
    out.push(m[0])
    last = m.index + m[0].length
  }
  out.push(processPlain(src.slice(last)))
  return out.join('')
}

// C1 统一入口：清洗 AI 文本（字面 \n）→ 中文上下标包 \text{} → 裸 LaTeX 补 $ 定界
export function sanitizeMathText(s: unknown): string {
  return wrapBareLatex(sanitizeLatexChinese(sanitizeAiText(s)))
}

// ---------- 数值机器复核（验收 #12 根因修法：通用表达式求值） ----------
// 背景：#244（0.5/0.2 误写 1）、#273（2+1 误写 2.5）、#375（1/8e11 量级错）、#414（三因子 0.4×2×0.5 误写 0.8）
// ——旧版只认「两个纯数字一步运算」，三因子乘积/带幂/嵌套 \frac 一律漏判。
// 做法：抽取 $...$ / $$...$$ 数学段 → 归一（单位宏剥离、\times→×、纯数字 \frac → ((A)/(B))、
// 其余 LaTeX 命令剥离）→ 按「=」分段；任一相邻对若「左段整体是纯数字算式、右段是纯数字」，
// 用递归下降求值器独立复验（±2% 或 0.05 容差吸收四舍五入）。
// 含变量/字母/未知命令的段一律跳过——宁漏判不误杀，机器只兜「纯数字算式」这一类。

/** 纯数字算式判定：只含 数字/四则/幂/括号（用于决定是否值得求值） */
function isPureArith(t: string): boolean {
  return /^[\d+\-×÷*/^().]+$/.test(t) && /\d/.test(t)
}

/** 递归下降求值：+ - × ÷ / ^（右结合）与括号、一元负号；解析失败返回 null */
function evalArith(src: string): number | null {
  let i = 0
  const s = src
  const ws = () => { while (i < s.length && s[i] === ' ') i++ }
  function expr(): number | null {
    let v = term(); if (v === null) return null
    for (;;) {
      ws()
      if (s[i] === '+') { i++; const r = term(); if (r === null) return null; v += r }
      else if (s[i] === '-') { i++; const r = term(); if (r === null) return null; v -= r }
      else return v
    }
  }
  function term(): number | null {
    let v = pow(); if (v === null) return null
    for (;;) {
      ws()
      if (s[i] === '×' || s[i] === '*') { i++; const r = pow(); if (r === null) return null; v *= r }
      else if (s[i] === '÷' || s[i] === '/') { i++; const r = pow(); if (r === null) return null; if (r === 0) return null; v /= r }
      else return v
    }
  }
  function pow(): number | null {
    const base = factor(); if (base === null) return null
    ws()
    if (s[i] === '^') { i++; const e = pow(); if (e === null) return null; const v = Math.pow(base, e); return Number.isFinite(v) ? v : null }
    return base
  }
  function factor(): number | null {
    ws()
    if (s[i] === '-') { i++; const v = factor(); return v === null ? null : -v }
    if (s[i] === '+') { i++; return factor() }
    if (s[i] === '(') {
      i++
      const v = expr()
      ws()
      if (v === null || s[i] !== ')') return null
      i++
      return v
    }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i))
    if (!m) return null
    i += m[0].length
    return Number(m[0])
  }
  const v = expr()
  ws()
  if (i !== s.length || v === null || !Number.isFinite(v)) return null
  return v
}

/** 读一个平衡花括号组（pos 指向「{」），返回内容与结束下标；不匹配返回 null */
function readBrace(t: string, pos: number): { content: string; end: number } | null {
  if (t[pos] !== '{') return null
  let depth = 0
  for (let j = pos; j < t.length; j++) {
    if (t[j] === '{') depth++
    else if (t[j] === '}') { depth--; if (depth === 0) return { content: t.slice(pos + 1, j), end: j + 1 } }
  }
  return null
}

/** 剥离 \text{...} / \mathrm{...} 等带参命令（含嵌套花括号） */
function stripBracedCmds(t: string, cmds: string[]): string {
  for (const cmd of cmds) {
    for (;;) {
      const m = new RegExp(`\\\\${cmd}\\s*\\{`).exec(t)
      if (!m) break
      const g = readBrace(t, m.index + m[0].length - 1)
      if (!g) break
      t = t.slice(0, m.index) + t.slice(g.end)
    }
  }
  return t
}

/** 读一个 \frac/\sqrt 参数：花括号组，或无花括号时的单字符（LaTeX 单 token），如 \dfrac12、\sqrt3 */
function readArg(t: string, pos: number): { content: string; end: number } | null {
  if (t[pos] === '{') return readBrace(t, pos)
  if (pos < t.length && /\S/.test(t[pos])) return { content: t[pos], end: pos + 1 }
  return null
}

/** 纯数字 \frac{A}{B} → ((A)/(B))（支持嵌套与乘式参数）；非纯数字的 \frac 用占位符替换（后续整段必被跳过） */
function fracToExpr(t: string): string {
  for (;;) {
    const m = /\\(?:d|t)?frac\s*/.exec(t)
    if (!m) break
    let k = m.index + m[0].length
    const a = readArg(t, k)
    if (!a) break
    k = a.end
    while (k < t.length && /\s/.test(t[k])) k++
    const b = readArg(t, k)
    if (!b) break
    const loose = (x: string) => isPureArith(x.replace(/[{}\s]/g, ''))
    const rep = loose(a.content) && loose(b.content) ? `((${a.content})/(${b.content}))` : '@FRAC@'
    t = t.slice(0, m.index) + rep + t.slice(b.end)
  }
  return t
}

/** \sqrt{A}：A 为纯数字算式 → ((A)^{0.5})；否则占位替换（剥掉 \sqrt 会让 4^2+3^2 伪装成 5，必须先处理） */
function sqrtToExpr(t: string): string {
  for (;;) {
    const m = /\\(?:sqrt)\s*(?:\[[^\]]*\])?\s*/.exec(t)
    if (!m) break
    const a = readArg(t, m.index + m[0].length)
    if (!a) break
    const loose = isPureArith(a.content.replace(/[{}\s]/g, ''))
    const rep = loose ? `((${a.content})^{0.5})` : '@SQRT@'
    t = t.slice(0, m.index) + rep + t.slice(a.end)
  }
  return t
}

export interface ArithIssue {
  /** 原始算式片段（含上下文，便于定位） */
  expr: string
  /** 机器复验的正确值 */
  expect: number
  /** 解析里写的值 */
  got: number
}
export function checkSolutionArithmetic(solution: unknown): ArithIssue[] {
  const s = String(solution ?? '')
  const issues: ArithIssue[] = []
  // 抽取数学段（$$..$$ 与 $..$；\( \) 形式也支持）
  const segs: string[] = []
  s.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, (_m, a, b, c) => {
    segs.push(String(a || b || c || ''))
    return _m
  })
  for (const raw of segs) {
    // 归一：\times/\cdot → ×，\div → ÷，−/· 归一，\neq → ≠，单位上标并入单位宏，剥单位宏，\frac/\sqrt 求值化，其余命令剥离
    let t = raw.replace(/\\(times|cdot)/g, '×').replace(/\\div/g, '÷').replace(/−/g, '-').replace(/·/g, '×')
    t = t.replace(/\\ne(q)?|\\approx/g, '≠')
    // \text{m}^{2} → \text{m^2}（单位的幂随单位一起剥离，否则 ^2 会错误挂到前面的数字上：0.50×0.160^2）
    t = t.replace(/\\(?:text|mathrm)\{([^{}]*)\}\s*\^\s*(\{[^{}]*\}|[-\d]+)/g, (_m, inner, sup) => `\\text{${inner}^${String(sup).replace(/[{}]/g, '')}}`)
    t = stripBracedCmds(t, ['text', 'mathrm', 'mathit', 'mathbf', 'operatorname'])
    t = fracToExpr(t)
    t = sqrtToExpr(t)
    t = t.replace(/\\[,;:! ]|~/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/[{}\s\\,]|°|℃/g, '')
    if (!/\d/.test(t)) continue
    // 按 = 分段，逐相邻对复验：左段整体是纯数字算式（可求值）、右段是纯数字
    // 左段必须含运算符——裸数字对裸数字多为单位换算（300s=5min、4000kg=4t），不能按恒等式复验
    // 按 ≠ 分块：≠ 两侧不是相等关系（5m≠10m），跨块的相邻段不构成复验对
    const chunks = t.split('≠')
    for (const chunk of chunks) {
      const parts = chunk.split('=')
      for (let i = 0; i < parts.length - 1; i++) {
        const lhs = parts[i]
        const rhs = parts[i + 1]
        if (!isPureArith(lhs) || !/[+\-×÷*/^]/.test(lhs)) continue
        const gotM = rhs.match(/^-?\d+(?:\.\d+)?$/)
        if (!gotM) continue
        const expect = evalArith(lhs)
        if (expect === null) continue
        const got = Number(gotM[0])
        // 容差：相对 2% 吸收有效数字舍入；绝对下限从 0.05 收紧到 0.005（验收 #36 P1-19：
        // #855 写 0.005 实为 0.05，0.045 的偏差恰被旧 0.05 绝对容差吞掉。0.005 下限仍能吸收
        // 两位小数舍入的正常情形，如 0.0499→0.05 偏差 0.0001、0.026→0.03 偏差 0.004）
        if (Math.abs(expect - got) > Math.max(0.005, Math.abs(expect) * 0.02)) {
          issues.push({ expr: lhs, expect: Number(expect.toFixed(4)), got })
        }
      }
    }
  }
  return issues
}

// ---------- 答案↔解析一致性机器校验（二审闭环硬校验之一） ----------
// 背景：二审 AI 偶发「解析算出 A、答案写 B」的自相矛盾终稿（用户实测 5/5 全中），仅靠
// checkSolutionArithmetic 复核解析内部算式不够——它管不到「答案列的数值」与解析脱节。
// 做法：答案含数字时，提取答案中的全部数值（科学计数/纯数字分数先展开成定点数），
// 逐个在「解析 + 题干」里找对应：原文数值出现（2% 容差）或解析中某段纯数字算式求值≈该值。
// 设计取向：宁漏判不误杀——匹配是宽松的（任意位置出现即算对应），只拦真正脱节的答案。
// 选择题字母答案（无数字）跳过。

/** 科学计数 / 纯数字分数 → 定点数展开（便于数值比对） */
function expandNumericForms(t: string): string {
  const expand = (m: string, e: string) => {
    const v = Number(m) * Math.pow(10, Number(e))
    if (!Number.isFinite(v)) return '0'
    return v.toFixed(12).replace(/0+$/, '').replace(/\.$/, '')
  }
  return t
    .replace(/(\d+(?:\.\d+)?)\s*[×x*]\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?/g, (_m, mm: string, ee: string) => expand(mm, ee))
    .replace(/(\d+(?:\.\d+)?)\s*[eE](-?\d+)\b/g, (_m, mm: string, ee: string) => expand(mm, ee))
    .replace(/\\(?:d|t)?frac\s*\{(\d+(?:\.\d+)?)\}\s*\{(\d+(?:\.\d+)?)\}/g, (_m, a: string, b: string) => (Number(b) ? String(Number(a) / Number(b)) : _m))
}

/**
 * 答案与解析一致性校验：答案中每个数值必须在「解析/题干」中找到对应。
 * 返回问题列表（空数组 = 一致）。
 */
export function checkAnswerTraceable(answer: unknown, solution: unknown, stem?: unknown): string[] {
  const a = expandNumericForms(String(answer ?? ''))
  if (!/\d/.test(a)) return [] // 字母答案 / 纯文字答案不检
  const text = expandNumericForms(`${String(solution ?? '')}\n${String(stem ?? '')}`)
  // 参照值集合：正文里的所有数字 token + 解析里纯数字算式段的求值结果
  const refNums = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const segs: string[] = []
  String(solution ?? '').replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, (_m, x, y, z) => {
    segs.push(String(x || y || z || ''))
    return _m
  })
  for (const raw of segs) {
    let t = raw.replace(/\\(times|cdot)/g, '×').replace(/\\div/g, '÷').replace(/−/g, '-').replace(/·/g, '×')
    t = t.replace(/\\ne(q)?|\\approx/g, '≠')
    t = t.replace(/\\(?:text|mathrm)\{([^{}]*)\}\s*\^\s*(\{[^{}]*\}|[-\d]+)/g, (_m, inner: string, sup: string) => `\\text{${inner}^${String(sup).replace(/[{}]/g, '')}}`)
    t = stripBracedCmds(t, ['text', 'mathrm', 'mathit', 'mathbf', 'operatorname'])
    t = fracToExpr(t)
    t = sqrtToExpr(t)
    t = t.replace(/\\[,;:! ]|~/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/[{}\s\\,]|°|℃/g, '')
    if (!/\d/.test(t)) continue
    for (const chunk of t.split('≠')) {
      const parts = chunk.split('=')
      for (let i = 0; i < parts.length - 1; i++) {
        const lhs = parts[i]
        if (!isPureArith(lhs) || !/[+\-×÷*/^]/.test(lhs)) continue
        const v = evalArith(lhs)
        if (v !== null) refNums.push(v)
      }
    }
  }
  const issues: string[] = []
  const ansNums = [...new Set((a.match(/-?\d+(?:\.\d+)?/g) || []).map(Number))]
  for (const v of ansNums) {
    const tol = Math.max(Math.abs(v) * 0.02, 0.011)
    const hit = refNums.some((r) => Math.abs(r - v) <= tol)
    if (!hit) issues.push(`答案中的数值 ${v} 在解析与题干中找不到对应（答案与解析脱节）`)
  }
  return issues
}

// ---------- P1-7：知识点标签与教材节名对齐 ----------
// 教材全部节名（扁平列表，220 节）
export const TEXTBOOK_SECTIONS: string[] = TEXTBOOK.flatMap((v) => v.chapters.flatMap((c) => c.sections))

// 比较用归一：去空白、统一破折号（半角 - / 全角 — / 连字符 – 视为同一字符）、
// 去括号与冒号变体（「导体棒切割磁感线（E=BLv）」与「导体棒切割磁感线 E=BLv」视为同一标签，验收#8 P3-①）
function kpNorm(s: string): string {
  return String(s || '').replace(/\s+/g, '').replace(/[—–-]/g, '—').replace(/[（）()：:]/g, '')
}

// 单个标签 → 对应教材节名：归一后完全相等直接命中；否则仅当「唯一候选」且
// （标签是节名前缀 或 标签 ≥4 字足够具体）才注入——像「电势」「加速度」这类泛化标签
// 候选多（电势差/电势能与电场力做功/向心加速度…），宁可不挂节名也不错挂
export function alignKpToSection(k: string): string | null {
  const nk = kpNorm(k)
  if (!nk) return null
  for (const s of TEXTBOOK_SECTIONS) if (kpNorm(s) === nk) return s
  const cands = TEXTBOOK_SECTIONS.filter((s) => {
    const ns = kpNorm(s)
    return ns.includes(nk) || nk.includes(ns)
  })
  if (cands.length !== 1) return null
  const ns = kpNorm(cands[0])
  if (ns.startsWith(nk) || nk.length >= 4) return cands[0]
  return null
}

// 合并知识点：出题时教师/脚本传入的节名原文必须注入（放最前，避免模型自由发挥的碎片标签顶掉节名导致教材筛选漏题）
export function mergeSectionKps(requested: string[], modelKps: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (k: string) => {
    const key = kpNorm(k)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(k)
  }
  for (const k of requested || []) push(String(k).trim())
  for (const k of modelKps || []) {
    const s = alignKpToSection(String(k))
    if (s) push(s)
    push(String(k).trim())
  }
  return out
}

// 二审（自动质检）：出题生成后的第二次 AI 调用，逐题挑错；不过审的草稿在前端标黄由教师终审
export const REVIEW_SYSTEM_PROMPT = `你是一名严格的高中物理审题专家（二审质检）。给你一批题目草稿（题干/答案/解析），请逐题独立检查：
1. 物理与数值自洽：把数据代入解析重算，答案数值、单位、有效数字是否正确；
2. 情境与几何自洽：题目描述的装置/角度/方向是否矛盾（例：「绳跨过定滑轮一端水平、另一端竖直」与「绳与水平方向夹角 53°」即矛盾，不合格）；
3. 是否超纲：是否使用高中未学的工具（微积分、矢量点叉乘等）；
4. 解析规范性：是否残留试错、疑问、「重新分析」「等等」等过程文字（必须是最终正确版本）；LaTeX 公式内的中文（含上下标）是否已用 \text{} 包裹（如 $v_{\text{甲}}$，裸中文下标不合格）；
5. 配图检查（铁律，物理讲究通过题目图片来分析解题而不是空想）：凡涉及公式计算、受力分析、物体运动、电路、场（电场/磁场）、振动与波、光路、理想气体或实验装置的题却没有任何 figure_spec 配图 → 判为不合格，issues 中指出「应配图未配图」，并在 fixed 中补上贴合题意的 figure_spec（模板与参数须与题干数值严格一致；确实补不出就改写题干用文字把几何条件描述完整且删去「如图」）；figure_spec 参数与题干数值不一致、或所选模板与题干情境不符（如受力题配了波动图）→ 同样判不合格并在 fixed 中修正；题干出现「如图」却无配图 → 必须补图或改写；
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

// 二审闭环修复：把未过审的题目草稿与问题清单喂回模型，输出完整修正稿（不再把问题抛给教师人工处理）
export const FIX_SYSTEM_PROMPT = `你是一名高中物理命题修订专家。给你一道题目草稿（题干/答案/解析/配图规格）与审查发现的问题清单，请输出这道题的完整修正稿：
1. 逐条修复问题：数值或答案与解析矛盾 → 以物理正确为准重算答案并重写解析；情境/几何矛盾 → 改写题干；题干出现「如图」但无配图 → 优先在 figure_spec 中补模板配图，补不出就改写题干用文字把几何条件描述完整（此时题干不得再出现「如图」）；
2. 修正后整题必须自洽：答案与解析最终数值一致，解析中每个纯数字算式的结果正确，情境数据自洽；
3. 保持原题考查的知识点与题型不变，难度可在 ±1 档内调整；
4. 解析必须是最终正确版本，严禁出现试错、疑问、「重新分析」等过程文字；LaTeX 公式内中文（含上下标）必须用 \\text{} 包裹（如 $v_{\\text{甲}}$），严禁裸中文进数学模式；
5. 在 fix_note 中用一句话说明改了什么；
6. 严格输出 JSON 对象，不要输出任何 JSON 以外的文字（不要 markdown 代码块标记）。

输出 JSON 结构：
{"stem": "题干", "answer": "答案", "solution": "解析", "pitfall": "易错点提示", "knowledge_points": ["知识点"], "difficulty": 3, "qtype": "计算", "figure_spec": {"template": "模板名", "params": {}} 或省略, "fix_note": "一句话修正说明"}

figure_spec 的 template 可选及 params 说明（配图铁律：涉及计算/受力/运动/电路/场/波/光/气体/实验装置的题必须配图，参数与题干数值严格一致）：
${FIGURE_TEMPLATE_DOCS}`

export function fixUserPrompt(q: QuizDraft, issues: string[]): string {
  return `题目草稿：
题干：${q.stem}
答案：${q.answer || '（无）'}
解析：${q.solution || '（无）'}
易错点：${q.pitfall || '（无）'}
figure_spec：${q.figure_spec ? JSON.stringify(q.figure_spec) : '（无）'}

审查发现的问题：
${issues.map((s, i) => `${i + 1}. ${s}`).join('\n') || '（无）'}

请按约定输出这道题的完整修正稿（单个 JSON 对象）。`
}

// 题干「如图」判定（出题终稿硬校验：提到如图 ⇒ 必须有 figure_spec）
export function mentionsFigureStem(stem: string): boolean {
  return /如图|如下图|见图/.test(stem || '')
}

// ---------- B1 配图铁律：必须配图的机器判定 ----------
// 口径：计算题/实验题一律必须配图；选择/填空题干含情境线索（受力/运动/场/波/光/气体/实验装置等）必须配图；
// 只有纯概念判断题（单位制、物理学史、无计算无情境的辨析）豁免。
const SITUATION_CUES =
  /受力|摩擦|斜面|滑块|传送带|板块|弹簧|绳|杆|滑轮|挂|小球|物块|平抛|抛|圆周|转弯|拱桥|凹桥|卫星|万有引力|星球|天体|轨道|动量|碰撞|爆炸|反冲|动能|势能|机械能|做功|功率|电路|电阻|电源|电流|电压|电容器|电场|电势|电荷|磁场|洛伦兹|安培|导轨|电磁感应|感应|自感|变压器|单摆|摆|振动|简谐|机械波|波长|波速|波形|折射|反射|全反射|透镜|光的|干涉|衍射|光电|能级|跃迁|半衰期|核反应|气体|压强|活塞|汽缸|气缸|等温|等压|等容|实验|装置|小车|纸带|打点|游标|多用电表|伏安|图像|如图|图中|图甲|图乙|如图所示/

export function requiresFigure(stem: string, qtype: string): boolean {
  if (qtype === '计算' || qtype === '实验') return true
  return SITUATION_CUES.test(stem || '')
}
