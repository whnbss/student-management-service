// 通用课件壳：SVG 舞台 + 参数面板 + 实时数据 + 图像面板 + 工具条（播放/单步/重置/倍速/全屏）
// 性能铁律：动画帧内不 setState 渲染场景；实时数据面板节流 ~10Hz；拖拽用 Pointer Events
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LabData, LabScene, LabState, RenderOpts, SceneParams } from './types'
import { encodeLabShare } from './share'
import type { LabShare } from './share'
import { SvgCtx } from './ctx'
import { FIXED_DT, useAnimationLoop } from './useAnimationLoop'
import { clamp, syncLabPalette } from './vec'

const SPEEDS = [0.25, 0.5, 1, 2]
const PRESET_KEY = (id: string) => `labs-preset-${id}`

interface CustomPreset {
  name: string
  params: SceneParams
  state?: Record<string, unknown>
}

/** 实验记录表的一行：参数读数 → 实时数据读数（像真实实验课填写数据表） */
interface LabRecord {
  n: number
  params: Record<string, string>
  data: Record<string, string>
}

// 舞台网格（浅色，随深色模式）；默认关闭（PhET 原则：降低装饰对认知负荷的干扰），工具条可开
function drawGrid(ctx: SvgCtx, show: boolean) {
  if (!show) {
    const ids: string[] = []
    for (let x = 40; x < ctx.w; x += 40) ids.push(`_gx${x}`)
    for (let y = 40; y < ctx.h; y += 40) ids.push(`_gy${y}`)
    ctx.remove(...ids)
    return
  }
  for (let x = 40; x < ctx.w; x += 40) {
    ctx.set(`_gx${x}`, 'line', { x1: x, y1: 0, x2: x, y2: ctx.h, stroke: 'currentColor', 'stroke-opacity': 0.05 })
  }
  for (let y = 40; y < ctx.h; y += 40) {
    ctx.set(`_gy${y}`, 'line', { x1: 0, y1: y, x2: ctx.w, y2: y, stroke: 'currentColor', 'stroke-opacity': 0.05 })
  }
}

export default function LabFrame({ scene, initialPreset, initialShare }: { scene: LabScene; initialPreset?: string; initialShare?: LabShare | null }) {
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
  const doRenderRef = useRef<(forceData?: boolean) => void>(() => {})

  const [params, setParams] = useState<SceneParams>(() => initialParams(scene))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [data, setData] = useState<LabData>({})
  // 实验数据记录表（最近 8 组）：dataRef 保存最近一帧实时数据，供记录时读取
  const dataRef = useRef<LabData>({})
  const recordsRef = useRef<LabRecord[]>([])
  const [records, setRecords] = useState<LabRecord[]>([])
  const [opts, setOpts] = useState<RenderOpts>({ showForces: true, showComponents: false, showPoints: true })
  const [showGrid, setShowGrid] = useState(false)
  // 挑战模式（先预测后揭示）：null=未作答；number=已选选项索引
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengePick, setChallengePick] = useState<number | null>(null)
  const [challengeRevealed, setChallengeRevealed] = useState(false)
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

  // 记录一组实验数据（参数读数 → 实时数据读数）：读数与上一组完全相同则不重复记，最多保留 8 组
  const commitRecord = useCallback(() => {
    const p: Record<string, string> = {}
    for (const d of scene.params) {
      if (d.key === 'mode' || d.key === 'method') continue // 模式参数不进数据表
      const val = paramsRef.current[d.key] ?? d.default
      p[d.label] = d.options ? d.options.find((o) => o.value === val)?.label ?? String(val) : `${fmtNum(val)}${d.unit}`
    }
    const data = { ...dataRef.current }
    const last = recordsRef.current[recordsRef.current.length - 1]
    if (last && JSON.stringify(last.params) === JSON.stringify(p) && JSON.stringify(last.data) === JSON.stringify(data)) return
    const row: LabRecord = { n: (last?.n ?? 0) + 1, params: p, data }
    recordsRef.current = [...recordsRef.current, row].slice(-8)
    setRecords(recordsRef.current)
  }, [scene])

  const clearRecords = () => {
    recordsRef.current = []
    setRecords([])
  }

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
      drawGrid(ctx, gridRef.current)
      const d = scene.render(ctx, paramsRef.current, stateRef.current, optsRef.current)
      dataRef.current = d
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

  // 网格开关切换时重绘（走 ref 避免闭包过期）
  const gridRef = useRef(showGrid)
  gridRef.current = showGrid
  useEffect(() => {
    if (playingRef.current) return
    cancelAnimationFrame(onceRaf.current)
    onceRaf.current = requestAnimationFrame(() => doRenderRef.current())
  }, [showGrid])

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

  // 舞台拖拽结束 → 记一组实验读数（与滑块松手同等对待；commitRecord 走 ref 防闭包过期）
  const commitRecordRef = useRef(commitRecord)
  commitRecordRef.current = commitRecord

  // ctx 生命周期：场景切换或全屏切换都会重建 SVG DOM，需重建 ctx 绑定
  useEffect(() => {
    if (!stageRef.current || !graphRef.current) return
    const isNewScene = sceneIdRef.current !== scene.id
    const ctx = new SvgCtx(stageRef.current, graphRef.current, {
      getParam: (k) => paramsRef.current[k],
      setParam: setParamFromStage,
      requestRender,
      onDragEnd: () => commitRecordRef.current(),
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
    commitRecord() // 切换情景 = 完成一次「实验」，自动记录读数
  }

  // —— 挑战模式（先预测后揭示）——
  const openChallenge = () => {
    setChallengePick(null)
    setChallengeRevealed(false)
    setChallengeOpen(true)
  }
  // 揭示：应用预设/参数（动态课件自动播放，演示正确答案）
  const revealChallenge = () => {
    const ch = scene.challenge
    if (!ch) return
    if (ch.reveal_preset) {
      const hit = [...scene.presets, ...customPresets].find((p) => p.name === ch.reveal_preset)
      if (hit) applyPreset(hit.params, hit.state)
    } else if (ch.reveal_params) {
      const merged = { ...initialParams(scene), ...ch.reveal_params }
      applyPreset(merged)
    }
    setChallengeRevealed(true)
    // 动态课件：揭示后自动播放，让「正确答案」动起来（PhET：predict → reveal）
    if (scene.step) setTimeout(() => setPlaying(true), 600)
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

  // 「关键预设」直达：从列表页带 ?preset=名称 进入时自动应用（分享链接优先级更高，二者同时存在时不重复应用）
  const initialPresetApplied = useRef(false)
  useEffect(() => {
    if (initialPresetApplied.current || !initialPreset || initialShare) return
    initialPresetApplied.current = true
    const hit = [...scene.presets, ...customPresets].find((p) => p.name === initialPreset)
    if (hit) applyPreset(hit.params, hit.state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPreset])

  // 「分享状态」直达：带 ?s=编码 进入时还原分享的参数与画面状态（备课→课堂衔接）
  const initialShareApplied = useRef(false)
  useEffect(() => {
    if (initialShareApplied.current || !initialShare) return
    initialShareApplied.current = true
    paramsRef.current = { ...initialParams(scene), ...initialShare.p }
    setParams(paramsRef.current)
    setPlaying(false)
    resetState(paramsRef.current, initialShare.s)
    ctxRef.current?.gclear()
    doRender(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShare])

  // 生成当前状态分享链接：复制到剪贴板；非安全上下文（局域网 HTTP）剪贴板不可用时弹窗手动复制
  const shareStateLink = () => {
    const enc = encodeLabShare(paramsRef.current, stateRef.current)
    if (!enc) {
      window.alert('当前状态无法生成分享链接')
      return
    }
    const url = `${location.origin}${location.pathname}?s=${enc}`
    navigator.clipboard?.writeText(url).then(
      () => window.alert('状态链接已复制，发给另一台设备打开即可还原当前参数与画面'),
      () => window.prompt('自动复制不可用，请长按/全选下面的链接手动复制：', url)
    )
  }

  // 全屏模式 Esc 退出
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // 深色/浅色切换：语义色 C 是「读时求值」的代理，切换后重绘一帧即可整体换色
  useEffect(() => {
    syncLabPalette()
    const ob = new MutationObserver(() => {
      if (syncLabPalette()) doRenderRef.current(true)
    })
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => ob.disconnect()
  }, [])

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
      <button className={`btn-outline !px-3 !py-1.5 text-xs ${showGrid ? '!border-primary-400 !text-primary-600' : ''}`} onClick={() => setShowGrid(!showGrid)}>网格</button>
      {scene.challenge && <button className="btn-outline !px-3 !py-1.5 text-xs !border-amber-400 !text-amber-600" onClick={openChallenge}>🎯 挑战</button>}
      <button className="btn-outline !px-3 !py-1.5 text-xs" title="把当前参数与画面状态做成链接，课堂上打开即还原（备课→课堂衔接）" onClick={shareStateLink}>🔗 分享状态</button>
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
            <select className="input" value={params[d.key] ?? d.default} onChange={(e) => { changeParam(d.key, Number(e.target.value)); commitRecord() }}>
              {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ) : (
          <div key={d.key}>
            <div className="flex items-baseline justify-between">
              <label className="label !mb-0">{d.label}</label>
              <span className="num text-sm font-medium text-primary-600">{fmtNum(params[d.key] ?? d.default)}{d.unit}</span>
            </div>
            {/* range 原生支持 ←→ 键盘微调；松手/松键即记入实验记录表 */}
            <input
              type="range"
              className="w-full accent-primary-600"
              min={d.min}
              max={d.max}
              step={d.step}
              value={params[d.key] ?? d.default}
              onChange={(e) => changeParam(d.key, Number(e.target.value))}
              onPointerUp={commitRecord}
              onKeyUp={commitRecord}
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

  // 实验数据记录表：拖参数/切情景后自动记录最近 8 组「参数 → 数据」，像真实实验课填写数据表
  const lastRec = records[records.length - 1]
  const recParamKeys = lastRec ? Object.keys(lastRec.params) : []
  const recDataKeys = lastRec ? Object.keys(lastRec.data).slice(0, 4) : []
  const recordPanel = (
    <div className="card p-3">
      <div className="flex items-center mb-2">
        <div className={`font-semibold text-slate-400 ${fullscreen ? 'text-sm' : 'text-xs'}`}>实验记录（最近 8 组）</div>
        <span className="flex-1" />
        {records.length > 0 && <button className="text-[11px] text-slate-400 hover:text-red-500" onClick={clearRecords}>清空</button>}
      </div>
      {records.length === 0 ? (
        <p className="text-xs text-slate-400 leading-relaxed">拖动参数滑块（松手时）或切换情景，会自动把「参数 → 实时数据」记入此表，供课堂读数与找规律</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs num whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left font-normal pr-2 py-1">#</th>
                {recParamKeys.map((k) => <th key={k} className="text-right font-normal px-2 py-1">{k}</th>)}
                {recDataKeys.map((k) => <th key={k} className="text-right font-normal pl-2 py-1">{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.n} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="pr-2 py-1 text-slate-400">{r.n}</td>
                  {recParamKeys.map((k) => <td key={k} className="px-2 py-1 text-right">{r.params[k] ?? '—'}</td>)}
                  {recDataKeys.map((k) => <td key={k} className="pl-2 py-1 text-right font-medium">{r.data[k] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // —— 挑战面板（先预测后揭示）：遮罩弹层，先作答再揭示并自动演示 ——
  const ch = scene.challenge
  const challengePanel = ch && challengeOpen ? (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => setChallengeOpen(false)}>
      <div className="w-full max-w-md card !bg-white dark:!bg-slate-900 p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base font-bold">🎯 挑战：先预测再看结果</span>
          <button className="ml-auto text-slate-400 hover:text-slate-600 text-lg leading-none" onClick={() => setChallengeOpen(false)} aria-label="关闭">×</button>
        </div>
        <p className="text-sm mb-4 leading-relaxed">{ch.question}</p>
        <div className="space-y-2">
          {ch.options.map((o, i) => {
            const picked = challengePick === i
            const isRight = ch.answer === i
            let cls = 'btn-outline w-full !justify-start text-left text-sm'
            if (challengePick !== null || challengeRevealed) {
              if (isRight) cls += ' !border-green-500 !bg-green-50 !text-green-700 dark:!bg-green-900/30 dark:!text-green-300'
              else if (picked) cls += ' !border-red-400 !bg-red-50 !text-red-600 dark:!bg-red-900/30'
            }
            return (
              <button key={i} className={cls} disabled={challengeRevealed} onClick={() => setChallengePick(i)}>
                <span className="num mr-2 opacity-60">{'ABCD'[i]}.</span>{o}
                {challengePick !== null && isRight && <span className="ml-auto">✓</span>}
                {picked && !isRight && <span className="ml-auto">✗</span>}
              </button>
            )
          })}
        </div>
        {challengePick !== null && !challengeRevealed && (
          <div className={`mt-3 text-sm font-medium ${challengePick === ch.answer ? 'text-green-600' : 'text-red-500'}`}>
            {challengePick === ch.answer ? '✓ 答对了！' : '✗ 再想想，也可以直接揭示答案看演示'}
          </div>
        )}
        {challengeRevealed && (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 leading-relaxed">
            <span className="font-semibold">解答：</span>{ch.explanation}
          </div>
        )}
        <div className="mt-4 flex gap-2 justify-end">
          {!challengeRevealed && (
            <button className="btn-primary !px-4 !py-1.5 text-xs" disabled={challengePick === null} onClick={revealChallenge}>
              揭示答案（自动演示）
            </button>
          )}
          {challengeRevealed && (
            <button className="btn-outline !px-4 !py-1.5 text-xs" onClick={() => setChallengeOpen(false)}>关闭挑战</button>
          )}
        </div>
      </div>
    </div>
  ) : null

  // —— 全屏课件模式：舞台与图像面板同屏并排、字号放大、参数面板收进抽屉 ——
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col p-4 gap-3 overflow-auto">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{scene.title}</h2>
          <span className="text-sm text-slate-400">{scene.chapter}</span>
          <span className="flex-1" />
          <button className="btn-outline !px-3 !py-1.5 text-xs" title="把当前参数与画面状态做成链接（备课→课堂衔接）" onClick={shareStateLink}>🔗 分享状态</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setFullscreen(false)}>✕ 退出全屏（Esc）</button>
          <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setDrawerOpen(!drawerOpen)}>⚙ 参数</button>
        </div>
        <div className="flex gap-4 items-start flex-1 min-h-0">
          {stage}
          {graphPanel}
          <div className="w-72 shrink-0 space-y-4">
            {dataPanel}
            {recordPanel}
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
        {challengePanel}
      </div>
    )
  }

  // —— 普通模式：usesGraph 课件宽屏三栏（舞台 | 图像面板 | 参数+数据），投屏教学可同屏对比 ——
  // 布局规则写在 index.css 的 .lab-grid 组件类里（不依赖 Tailwind 任意值，避免 JIT 生成失败导致布局塌陷）
  return (
    <div className="space-y-4">
      {toolbar}
      {presetChips}
      <div className={`lab-grid ${scene.usesGraph ? 'uses-graph' : ''}`}>
        <div className="lab-cell-stage space-y-4 min-w-0">
          {stage}
          {/* 无图像面板的课件也要挂载 graph SVG（引擎依赖），仅隐藏 */}
          {!scene.usesGraph && graphPanel}
        </div>
        {scene.usesGraph && <div className="lab-cell-graph min-w-0">{graphPanel}</div>}
        <div className="lab-cell-side space-y-4">
          <div className="card p-4">{paramPanel}</div>
          {dataPanel}
          {recordPanel}
        </div>
      </div>
      {challengePanel}
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
