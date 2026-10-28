// 课件状态分享链接：把当前参数 + 画面状态序列化进 URL（备课→课堂衔接）
// 备课时调好参数/拖好位置 → 「分享状态」复制链接 → 课堂上（另一台设备/全屏）打开即还原同一状态
import type { LabState, ParamDef, SceneParams } from './types'

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

/**
 * 按场景参数定义白名单清洗分享参数：丢弃未知键与非有限数值，
 * 滑块值夹取到 [min, max]、枚举值必须是合法选项，
 * 防止被篡改的链接把字符串/NaN/脏键带进数据面板；缺失键由调用方的默认值兜底。
 */
export function sanitizeLabShare(share: LabShare | null, defs: ParamDef[]): LabShare | null {
  if (!share) return null
  const raw = share.p as Record<string, unknown>
  const p: SceneParams = {}
  for (const d of defs) {
    const v = raw[d.key]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue // 非数值/NaN/Infinity → 用默认值
    if (d.options) {
      if (d.options.some((o) => o.value === v)) p[d.key] = v // 枚举参数：必须是合法选项值
      continue
    }
    // 滑块参数：夹取到 [min, max]，容差 1e-9 应对编码精度误差
    const eps = 1e-9
    p[d.key] = Math.min(d.max + eps, Math.max(d.min - eps, v))
  }
  return { p, s: share.s }
}
