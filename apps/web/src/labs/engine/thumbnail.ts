// 课件缩略图：离屏一次性渲染场景首帧 → 静态 SVG 字符串（列表页封面用，PhET 首页式卡片）
import { SvgCtx } from './ctx'
import type { LabScene, SceneParams } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** 渲染场景首帧为静态 SVG 字符串（舞台视图；失败返回空串不阻塞列表） */
export function renderThumbnail(scene: LabScene): string {
  const stage = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
  stage.setAttribute('viewBox', `0 0 ${scene.view.w} ${scene.view.h}`)
  stage.setAttribute('xmlns', SVG_NS)
  const graph = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
  graph.setAttribute('viewBox', '0 0 360 220')
  const params: SceneParams = {}
  for (const d of scene.params) params[d.key] = d.default
  const ctx = new SvgCtx(stage, graph, {
    getParam: (k) => params[k] ?? 0,
    setParam: () => {},
    requestRender: () => {},
  })
  try {
    scene.render(ctx, params, scene.init(params), { showForces: true, showComponents: false, showPoints: false })
  } catch {
    return ''
  }
  return stage.outerHTML
}
