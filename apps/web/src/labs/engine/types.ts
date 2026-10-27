// 课件场景统一接口与绘制上下文类型
// 舞台为 SVG，场景通过 ctx 以「保留模式」直接增改 SVG 节点，
// 动画帧内不触发 React setState（性能铁律），实时数据由 LabFrame 节流刷新。

export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  unit: string
  default: number
  /** 枚举参数（下拉选择），value 为数值 */
  options?: { value: number; label: string }[]
  /**
   * 改动该参数是否重置场景状态：初始条件参数（如 h、v0、d0）应为 true（默认），
   * 过程参数（如 μ、m、F、ω）设为 false —— 播放中调整不重置位置/速度，只更新受力
   */
  reset?: boolean
  /** 仅在指定模式值下显示（对应场景的模式参数取值），缺省为始终显示 */
  modes?: number[]
}

export interface Preset {
  name: string
  params: Record<string, number>
  /** 预设附带的状态覆盖（如小球位置），应用预设时合并进初始状态 */
  state?: Record<string, unknown>
}

/** 先预测后揭示（PhET 教学法）：挑战题面 + 选项 + 判定 + 揭示解释 */
export interface LabChallenge {
  question: string
  options: string[]
  /** 正确选项索引（从 0 开始） */
  answer: number
  /** 揭示时展示的讲解 */
  explanation: string
  /** 揭示时自动应用的预设名（演示正确答案的情景，须与 presets 中的 name 一致） */
  reveal_preset?: string
  /** 揭示时直接应用的参数（与 reveal_preset 二选一，优先用预设） */
  reveal_params?: Record<string, number>
}

/** 实时数据面板：label → 显示文本 */
export type LabData = Record<string, string>

export interface RenderOpts {
  showForces: boolean
  showComponents: boolean
  showPoints: boolean
}

/** 场景内部状态（由场景自定义，init/step 维护） */
export interface LabState {
  t?: number
  [k: string]: unknown
}

export type SceneParams = Record<string, number>

/** 绘制上下文：舞台(stage)与图像面板(graph)两组独立 SVG 视口 */
export interface LabCtx {
  /** 舞台 viewBox 尺寸 */
  w: number
  h: number
  /** 图像面板 viewBox 尺寸（usesGraph 为 true 时有效） */
  gw: number
  gh: number
  /** 舞台：按 id 增改图形元素（返回元素以便首帧挂拖拽事件） */
  set(id: string, tag: string, attrs: Record<string, string | number>): SVGElement
  remove(...ids: string[]): void
  clear(): void
  /** 图像面板：按 id 增改图形元素 */
  gset(id: string, tag: string, attrs: Record<string, string | number>): SVGElement
  gremove(...ids: string[]): void
  gclear(): void
  /** 指针事件坐标 → 舞台坐标 */
  point(ev: PointerEvent): { x: number; y: number }
  /** 为元素挂拖拽（Pointer Events，鼠标/触屏/电子白板通用），同一元素只挂一次 */
  drag(
    el: SVGElement,
    onMove: (p: { x: number; y: number }, ev: PointerEvent) => void,
    onStart?: () => void,
    onEnd?: () => void
  ): void
  /** 从舞台拖拽更新参数（同步右侧滑块 UI） */
  setParam(key: string, value: number): void
  /** 暂停状态下请求重绘一帧 */
  requestRender(): void
}

export interface LabScene {
  id: string
  title: string
  grade: '高一' | '高二' | '高三'
  chapter: string
  /** 一句话简介（列表卡片展示） */
  desc: string
  tags: string[]
  /** 舞台逻辑尺寸（viewBox） */
  view: { w: number; h: number }
  params: ParamDef[]
  presets: Preset[]
  /** 是否使用图像面板（默认 false） */
  usesGraph?: boolean
  /** 核心公式（KaTeX 渲染，静态） */
  formulas?: string[]
  /** 教学要点（2~3 条易错点，详情页折叠卡，投影时可直接念） */
  keyPoints?: string[]
  /** 挑战模式（先预测后揭示），配置了才显示「挑战」按钮 */
  challenge?: LabChallenge
  /** 初始化/重置场景状态 */
  init(params: SceneParams): LabState
  /** 推进物理过程（固定时间步长，可选；静态场景无此方法） */
  step?(dt: number, params: SceneParams, state: LabState): void
  /** 绘制一帧（含拖拽注册），返回实时数据 */
  render(ctx: LabCtx, params: SceneParams, state: LabState, opts: RenderOpts): LabData
}
