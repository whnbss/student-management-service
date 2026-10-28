// 课件状态分享链接：把当前参数 + 画面状态序列化进 URL（备课→课堂衔接）
// 备课时调好参数/拖好位置 → 「分享状态」复制链接 → 课堂上（另一台设备/全屏）打开即还原同一状态
import type { LabState, SceneParams } from './types'

/** URL 参数值载体：p=参数，s=场景内部状态（可选，暂停位置/拖后坐标等） */
export interface LabShare {
  p: SceneParams
  s?: LabState
}

/** 序列化为 URL 参数值（base64url，不含 +/=，可安全放 query）；序列化失败返回空串 */
export function encodeLabShare(params: SceneParams, state: LabState): string {
  try {
    const json = JSON.stringify({ p: params, s: state })
    return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch {
    return ''
  }
}

/** 从 URL 参数值还原；非法/被篡改的输入返回 null，调用方按「无分享」处理 */
export function decodeLabShare(v: string | null): LabShare | null {
  if (!v) return null
  try {
    const b64 = v.replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
    const obj = JSON.parse(json)
    if (!obj || typeof obj.p !== 'object' || obj.p === null) return null
    return { p: obj.p, s: typeof obj.s === 'object' && obj.s !== null ? obj.s : undefined }
  } catch {
    return null
  }
}
