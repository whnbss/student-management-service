// requestAnimationFrame 动画循环 hook：固定时间步长保证确定性，tab 切换自动暂停
import { useEffect, useRef } from 'react'

export const FIXED_DT = 1 / 240 // 固定物理步长（秒）

export function useAnimationLoop(opts: {
  playing: boolean
  speed: number
  /** 每个固定步长调用一次 */
  onStep: (dt: number) => void
  /** 每渲染帧调用一次（绘制） */
  onFrame: () => void
  /** tab 切到后台时回调（用于自动暂停） */
  onHidden?: () => void
}) {
  // 回调存 ref：避免回调变化导致循环重启
  const cbRef = useRef(opts)
  cbRef.current = opts
  const { playing, speed } = opts

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (ts: number) => {
      // 真实帧间隔 × 倍速，按固定步长切片推进
      acc += Math.min((ts - last) / 1000, 0.1) * cbRef.current.speed
      last = ts
      let n = 0
      const MAX_STEPS = 480 // 单帧步数上限，防止卡顿后螺旋爆炸
      while (acc >= FIXED_DT && n < MAX_STEPS) {
        cbRef.current.onStep(FIXED_DT)
        acc -= FIXED_DT
        n++
      }
      if (acc > FIXED_DT * MAX_STEPS) acc = 0
      cbRef.current.onFrame()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  // tab 切换 / 页面隐藏时自动暂停，回来不追帧
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) cbRef.current.onHidden?.()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
}
