// 统一 fetch 封装：自动带 token、统一错误提示、401 跳登录
import { useAuthStore } from '@/stores/auth'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  // 无请求体时不设置 Content-Type，避免 Fastify 对空 JSON body 报 400（DELETE 等场景）
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  }
  const res = await fetch(path, { ...options, headers })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    /* 空响应体 */
  }
  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new ApiError(401, data?.error || '登录已失效')
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `请求失败(${res.status})`)
  }
  return data as T
}

export const get = <T = any,>(path: string) => api<T>(path)
export const post = <T = any,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const put = <T = any,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })
export const del = <T = any,>(path: string) => api<T>(path, { method: 'DELETE' })
