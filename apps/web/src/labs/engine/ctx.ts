// SVG 保留模式绘制上下文：动画帧内直接增改 SVG 节点，不触发 React 渲染
import type { LabCtx } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

function applyAttrs(el: SVGElement, attrs: Record<string, string | number>) {
  for (const [k, val] of Object.entries(attrs)) {
    if (k === 'text') {
      el.textContent = String(val)
    } else {
      el.setAttribute(k, String(val))
    }
  }
}

export class SvgCtx implements LabCtx {
  w: number
  h: number
  gw: number
  gh: number
  private stageNodes = new Map<string, SVGElement>()
  private graphNodes = new Map<string, SVGElement>()

  constructor(
    private stageSvg: SVGSVGElement,
    private graphSvg: SVGSVGElement,
    private hooks: {
      getParam: (key: string) => number
      setParam: (key: string, value: number) => void
      requestRender: () => void
      onDragEnd?: () => void
    }
  ) {
    const vb = stageSvg.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 640, 420]
    this.w = vb[2]
    this.h = vb[3]
    const gb = graphSvg.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 360, 220]
    this.gw = gb[2]
    this.gh = gb[3]
  }

  set(id: string, tag: string, attrs: Record<string, string | number>): SVGElement {
    let el = this.stageNodes.get(id)
    if (!el || el.tagName.toLowerCase() !== tag.toLowerCase()) {
      el?.remove()
      el = document.createElementNS(SVG_NS, tag)
      this.stageSvg.appendChild(el)
      this.stageNodes.set(id, el)
    }
    applyAttrs(el, attrs)
    return el
  }

  remove(...ids: string[]) {
    for (const id of ids) {
      this.stageNodes.get(id)?.remove()
      this.stageNodes.delete(id)
    }
  }

  clear() {
    for (const el of this.stageNodes.values()) el.remove()
    this.stageNodes.clear()
  }

  gset(id: string, tag: string, attrs: Record<string, string | number>): SVGElement {
    let el = this.graphNodes.get(id)
    if (!el || el.tagName.toLowerCase() !== tag.toLowerCase()) {
      el?.remove()
      el = document.createElementNS(SVG_NS, tag)
      this.graphSvg.appendChild(el)
      this.graphNodes.set(id, el)
    }
    applyAttrs(el, attrs)
    return el
  }

  gremove(...ids: string[]) {
    for (const id of ids) {
      this.graphNodes.get(id)?.remove()
      this.graphNodes.delete(id)
    }
  }

  gclear() {
    for (const el of this.graphNodes.values()) el.remove()
    this.graphNodes.clear()
  }

  point(ev: PointerEvent): { x: number; y: number } {
    const ctm = this.stageSvg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  drag(
    el: SVGElement,
    onMove: (p: { x: number; y: number }, ev: PointerEvent) => void,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    // 幂等：clear() 重建元素后才会重新挂事件
    const anyEl = el as unknown as { __dragBound?: boolean }
    if (anyEl.__dragBound) return
    anyEl.__dragBound = true
    el.style.cursor = 'move'
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      try {
        el.setPointerCapture(ev.pointerId)
      } catch {
        /* 部分环境不支持捕获，忽略 */
      }
      el.classList.add('lab-dragging')
      onStart?.()
      const move = (e2: PointerEvent) => onMove(this.point(e2), e2)
      const up = (e2: PointerEvent) => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
        el.classList.remove('lab-dragging')
        onEnd?.()
        this.hooks.onDragEnd?.() // 拖拽结束统一通知壳层（实验记录表在松手时记一组读数）
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
    })
  }

  setParam(key: string, value: number) {
    this.hooks.setParam(key, value)
  }

  requestRender() {
    this.hooks.requestRender()
  }
}
