// 通用课件壳：SVG 舞台 + 参数面板 + 实时数据 + 图像面板 + 工具条（播放/单步/重置/倍速/全屏）
// 性能铁律：动画帧内不 setState 渲染场景；实时数据面板节流 ~10Hz；拖拽用 Pointer Events
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LabData, LabScene, LabState, RenderOpts, SceneParams } from './types'
import { SvgCtx } from './ctx'
import { FIXED_DT, useAnimationLoop } from './useAnimationLoop'
import { clamp } from './vec'

const SPEEDS = [0.25, 0.5, 1, 2]
const PRESET_KEY = (id: string) => `labs-preset-${id}`

interface CustomPreset {
  name: string
  params: SceneParams
  state?: Record<string, unknown>
}

// 舞台网格（浅色，随深色模式）
function drawGrid(ctx: SvgCtx) {
  for (let x = 40; x < ctx.w; x += 40) {
    ctx.set(`_gx${x}`, 'line', { x1: x, y1: 0, x2: x, y2: ctx.h, stroke: 'currentColor', 'stroke-opacity': 0.05 })
  }
  for (let y = 40; y < ctx.h; y += 40) {
    ctx.set(`_gy${y}`, 'line', { x1: 0, y1: y, x2: ctx.w, y2: y, stroke: 'currentColor', 'stroke-opacity': 0.05 })
  }
}

export default function LabFrame({ scene, initialPreset }: { scene: LabScene; initialPreset?: string }) {
  const stageRef = useRef<SVGSVGElement>(null)
  const graphRef = useRef<SVGSVGElement>(null)
  const ctxRef = useRef<SvgCtx | null>(null)
  const paramsRef = useRef<SceneParams>(initialParams(scene))
  const stateRef = useRef<LabState>(scene.init(initialParams(scene)))
  const playingRef = useRef(false)
  const onceRaf = useRef(0)
  const lastDataTs = useRef(0)
  const lastParamSync = useRef(0)
  const sceneIdRef = useRef(scene.id)
  // 最新绘制函数（避免闭包过期：requestRender / 动画循环都经 ref 调用）
  const doRenderRef = useRef<() => void>(() => {})

  const [params, setParams] = useState<SceneParams>(() => initialParams(scene))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [data, setData] = useState<LabData>({})
  const [opts, setOpts] = useState<RenderOpts>({ showForces: true, showComponents: false, showPoints: true })
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(PRESET_KEY(scene.id)) || '[]')
    } catch {
      return []
    }
  })

  // 参数引用与 UI 保持同步
  paramsRef.current = params
  playingRef.current = playing

  const resetState = useCallback(
    (p: SceneParams, statePatch?: Record<string, unknown>) => {
      stateRef.current = scene.init(p)
      if (statePatch) Object.assign(stateRef.current, statePatch)
    },
    [scene]
  )

  const doRender = useCallback(
    (forceData = false) => {
      const ctx = ctxRef.current
      if (!ctx) return
      drawGrid(ctx)
      const d = scene.render(ctx, paramsRef.current, stateRef.current, optsRef.current)
      const now = performance.now()
      if (forceData || now - lastDataTs.current > 100) {
        lastDataTs.current = now
        setData(d)
      }
    },
    [scene]
  )
  // opts 也走 ref：动画循环与 requestRender 永远拿到最新值
  const optsRef = useRef(opts)
  optsRef.current = opts
  doRenderRef.current = doRender

  // 暂停状态下请求重绘一帧
  const requestRender = useCallback(() => {
    if (playingRef.current) return // 播放中下一帧自会渲染
    cancelAnimationFrame(onceRaf.current)
    onceRaf.current = requestAnimationFrame(() => doRenderRef.current())
  }, [])

  // 从舞台拖拽更新参数：同步滑块（节流 60ms）；过程参数（reset=false）不重置场景状态
  const setParamFromStage = useCallback(
    (key: string, value: number) => {
      paramsRef.current = { ...paramsRef.current, [key]: value }
      if (shouldReset(scene, key)) resetState(paramsRef.current)
      const now = performance.now()
      if (now - lastParamSync.current > 60) {
        lastParamSync.current = now
        setParams(paramsRef.current)
      }
      requestRender()
    },
    [scene, resetState, requestRender]
  )

  // ctx 生命周期：场景切换或全屏切换都会重建 SVG DOM，需重建 ctx 绑定
  useEffect(() => {
    if (!stageRef.current || !graphRef.current) return
    const isNewScene = sceneIdRef.current !== scene.id
    const ctx = new SvgCtx(stageRef.current, graphRef.current, {
      getParam: (k) => paramsRef.current[k],
      setParam: setParamFromStage,
      requestRender,
    })
    ctxRef.current = ctx
    if (isNewScene) {
      sceneIdRef.current = scene.id
      paramsRef.current = initialParams(scene)
      setParams(paramsRef.current)
      resetState(paramsRef.current)
    }
    doRenderRef.current()
    return () => {
      ctxRef.current?.clear()
      ctxRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, fullscreen])

  const onStep = useCallback(
    (dt: number) => {
      scene.step?.(dt, paramsRef.current, stateRef.current)
    },
    [scene]
  )
  useAnimationLoop({
    playing,
    speed,
    onStep,
    onFrame: () => doRenderRef.current(),
    onHidden: () => setPlaying(false),
  })

  // 单步：推进 1/60 秒（4 个固定步长）
  const stepOnce = () => {
    if (!scene.step) return
    for (let i = 0; i < 4; i++) scene.step(FIXED_DT, paramsRef.current, stateRef.current)
    doRender(true)
  }

  const reset = () => {
    setPlaying(false)
    resetState(paramsRef.current)
    ctxRef.current?.gclear()
    doRender(true)
  }

  const changeParam = (key: string, value: number) => {
    const p = { ...paramsRef.current, [key]: value }
    paramsRef.current = p
    setParams(p)
    // 过程参数（reset=false）不重置状态：播放中调 μ/F/a 不清零运动
    if (shouldReset(scene, key)) resetState(p)
    doRender(true)
  }

  const applyPreset = (p: SceneParams, state?: Record<string, unknown>) => {
    paramsRef.current = { ...p }
    setParams(paramsRef.current)
    setPlaying(false)
    resetState(paramsRef.current, state)
    ctxRef.current?.gclear()
    doRender(true)
  }

  // 自定义预设（localStorage 按课件 id 存储）
  const savePreset = () => {
    const name = window.prompt('给这组参数起个名字（如：临界角演示）')
    if (!name?.trim()) return
    const next = [...customPresets, { name: name.trim(), params: { ...paramsRef.current } }].slice(-12)
    setCustomPresets(next)
    localStorage.setItem(PRESET_KEY(scene.id), JSON.stringify(next))
  }
  const removePreset = (i: number) => {
    const next = customPresets.filter((_, idx) => idx !== i)
    setCustomPresets(next)
    localStorage.setItem(PRESET_KEY(scene.id), JSON.stringify(next))
  }

  // 「关键预设」直达：从列表页带 ?preset=名称 进入时自动应用
  const initialPresetApplied = useRef(false)
  useEffect(() => {
    if (initialPresetApplied.current || !initialPreset) return
    initialPresetApplied.current = true
    const hit = [...scene.presets, ...customPresets].find((p) => p.name === initialPreset)
    if (hit) applyPreset(hit.params, hit.state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPreset])

  // 全屏模式 Esc 退出
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const hasStatic = !scene.step
  const stage = (
    <div className={fullscreen ? 'flex-1 min-w-0 flex justify-center items-start' : ''}>
      <svg
        ref={stageRef}
        viewBox={`0 0 ${scene.view.w} ${scene.view.h}`}
        className={`w-full h-auto touch-none select-none rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 ${fullscreen ? 'max-h-[76vh] mx-auto' : ''}`}
      />
    </div>
  )
  const graphPanel = (
    <div className={`card p-2 ${!scene.usesGraph ? 'hidden' : ''} ${fullscreen ? 'w-[26rem] shrink-0' : ''}`}>
      <div className="text-xs text-slate-400 px-1 pb-1">图像面板（与舞台同步）</div>
      <svg ref={graphRef} viewBox="0 0 360 220" className="w-full h-auto text-slate-600 dark:text-slate-300" />
    </div>
  )

  const toolbar = (
    <div className={`flex flex-wrap items-center gap-1.5 ${fullscreen ? 'text-base' : ''}`}>
      <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={hasStatic} onClick={() => setPlaying(!playing)}>
        {playing ? '⏸ 暂停' : '▶ 播放'}
      </button>
      <button className="btn-outline !px-3 !py-1.5 text-xs" disabled={hasStatic} onClick={stepOnce}>⏭ 单步</button>
      <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={reset}>↺ 重置</button>
      <select className="input !py-1.5 !px-2 text-xs !w-auto" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="倍速">
        {SPEEDS.map((s) => <option key={s} value={s}>{s}× 倍速</option>)}
      </select>
      <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />
      <button className={`btn-outline !px-3 !py-1.5 text-xs ${opts.showForces ? '!border-primary-400 !text-primary-600' : ''}`} onClick={() => setOpts({ ...opts, showForces: !opts.showForces })}>力箭头</button>
      <button className={`btn-outline !px-3 !py-1.5 text-xs ${opts.showComponents ? '!border-primary-400 !text-primary-600' : ''}`} onClick={() => setOpts({ ...opts, showComponents: !opts.showComponents })}>分量</button>
      <button className={`btn-outline !px-3 !py-1.5 text-xs ${opts.showPoints ? '!border-primary-400 !text-primary-600' : ''}`} onClick={() => setOpts({ ...opts, showPoints: !opts.showPoints })}>受力点</button>
      {!fullscreen && <button className="btn-outline !px-3 !py-1.5 text-xs ml-auto" onClick={() => setFullscreen(true)}>⛶ 全屏课件</button>}
      {fullscreen && <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setFullscreen(false)}>✕ 退出全屏（Esc）</button>}
    </div>
  )

  const presetChips = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-400">典型情景：</span>
      {scene.presets.map((p) => (
        <button key={p.name} className="btn-outline !px-2.5 !py-1 text-xs" onClick={() => applyPreset(p.params, p.state)}>{p.name}</button>
      ))}
      {customPresets.map((p, i) => (
        <span key={p.name + i} className="relative inline-flex">
          <button className="btn-outline !px-2.5 !py-1 text-xs !bg-primary-50 !border-primary-200 dark:!bg-primary-900/30" onClick={() => applyPreset(p.params)}>★ {p.name}</button>
          <button className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-400 text-white text-[10px] leading-4" title="删除该预设" onClick={() => removePreset(i)}>×</button>
        </span>
      ))}
      <button className="btn-outline !px-2.5 !py-1 text-xs text-primary-600" onClick={savePreset}>＋ 存为预设</button>
    </div>
  )

  // 参数面板按模式过滤（ParamDef.modes），如转盘模式不显示圆锥摆参数
  const modeVal = params['mode'] ?? params['method'] ?? 0
  const visibleParams = scene.params.filter((d) => !d.modes || d.modes.includes(Number(modeVal)))

  const paramPanel = (
    <div className="space-y-3">
      {visibleParams.map((d) =>
        d.options ? (
          <div key={d.key}>
            <label className="label">{d.label}</label>
            <select className="input" value={params[d.key] ?? d.default} onChange={(e) => changeParam(d.key, Number(e.target.value))}>
              {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ) : (
          <div key={d.key}>
            <div className="flex items-baseline justify-between">
              <label className="label !mb-0">{d.label}</label>
              <span className="num text-sm font-medium text-primary-600">{fmtNum(params[d.key] ?? d.default)}{d.unit}</span>
            </div>
            {/* range 原生支持 ←→ 键盘微调 */}
            <input
              type="range"
              className="w-full accent-primary-600"
              min={d.min}
              max={d.max}
              step={d.step}
              value={params[d.key] ?? d.default}
              onChange={(e) => changeParam(d.key, Number(e.target.value))}
            />
          </div>
        )
      )}
    </div>
  )

  // 数据面板：全屏（投影）时字号 ≥16px
  const dataPanel = (
    <div className="card p-3">
      <div className={`font-semibold text-slate-400 mb-2 ${fullscreen ? 'text-sm' : 'text-xs'}`}>实时数据</div>
      <dl className="space-y-1.5">
        {Object.entries(data).map(([k, val]) => (
          <div key={k} className={`flex justify-between gap-2 ${fullscreen ? 'text-base' : 'text-sm'}`}>
            <dt className="text-slate-500 shrink-0">{k}</dt>
            <dd className="num text-right font-medium">{val}</dd>
          </div>
        ))}
      </dl>
    </div>
  )

  // —— 全屏课件模式：舞台与图像面板同屏并排、字号放大、参数面板收进抽屉 ——
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col p-4 gap-3 overflow-auto">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{scene.title}</h2>
          <span className="text-sm text-slate-400">{scene.chapter}</span>
          <span className="flex-1" />
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setFullscreen(false)}>✕ 退出全屏（Esc）</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setDrawerOpen(!drawerOpen)}>⚙ 参数</button>
        </div>
        <div className="flex gap-4 items-start flex-1 min-h-0">
          {stage}
          {graphPanel}
          <div className="w-72 shrink-0 space-y-4">
            {dataPanel}
            {!drawerOpen && <div className="card p-4">{paramPanel}</div>}
          </div>
        </div>
        {toolbar}
        {presetChips}
        {drawerOpen && (
          <div className="fixed top-16 right-4 w-72 max-h-[80vh] overflow-auto card p-4 shadow-xl space-y-4 z-10">
            {paramPanel}
          </div>
        )}
      </div>
    )
  }

  // —— 普通模式：usesGraph 课件宽屏三栏（舞台 | 图像面板 | 参数+数据），投屏教学可同屏对比 ——
  const gridCls = scene.usesGraph
    ? 'grid gap-4 items-start md:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_290px]'
    : 'grid gap-4 items-start md:grid-cols-[minmax(0,1fr)_290px]'
  return (
    <div className="space-y-4">
      {toolbar}
      {presetChips}
      <div className={gridCls}>
        <div className="space-y-4 min-w-0">
          {stage}
          {/* 无图像面板的课件也要挂载 graph SVG（引擎依赖），仅隐藏 */}
          {!scene.usesGraph && graphPanel}
        </div>
        {scene.usesGraph && <div className="min-w-0 md:col-start-1 md:row-start-2 xl:col-start-2 xl:row-start-1">{graphPanel}</div>}
        <div className="space-y-4 md:col-start-2 md:row-start-1 xl:col-start-3">
          <div className="card p-4">{paramPanel}</div>
          {dataPanel}
        </div>
      </div>
    </div>
  )
}

/** 该参数是否应重置场景（初始条件参数 true；过程参数在场景中标记 reset:false） */
function shouldReset(scene: LabScene, key: string): boolean {
  const def = scene.params.find((d) => d.key === key)
  return def ? def.reset !== false : true
}

function initialParams(scene: LabScene): SceneParams {
  const p: SceneParams = {}
  for (const d of scene.params) p[d.key] = d.default
  return p
}

function fmtNum(n: number): string {
  const v = clamp(n, -1e6, 1e6)
  return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, '')
}
