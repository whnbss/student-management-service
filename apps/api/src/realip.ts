// 真实客户端 IP 提取：反代/隧道场景下 req.ip 是代理地址，需按请求头解析
// 优先级：CF-Connecting-IP（Cloudflare 官方头）→ X-Forwarded-For 首段 → req.ip（trustProxy 解析结果）→ 'unknown'
import type { FastifyRequest } from 'fastify'

export function realIp(req: FastifyRequest): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf.trim()) return cf.trim()
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim()
    if (first) return first
  }
  return req.ip || 'unknown'
}
