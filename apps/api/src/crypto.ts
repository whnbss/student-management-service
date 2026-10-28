// 账号安全原语：scrypt 密码哈希、HMAC 角色化 token、登录限速（内存版，零新依赖）
import crypto from 'node:crypto'
import { getSetting, setSetting } from './db'

// ---------- scrypt 密码哈希 ----------

export function hashPassword(pwd: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pwd, salt, 64).toString('hex')
  return { hash, salt }
}

// 恒定时间比较，防时序侧信道
export function verifyPassword(pwd: string, hash: string, salt: string): boolean {
  try {
    const calc = crypto.scryptSync(pwd, salt, 64)
    const stored = Buffer.from(hash, 'hex')
    return calc.length === stored.length && crypto.timingSafeEqual(calc, stored)
  } catch {
    return false
  }
}

// ---------- HMAC 角色化 token：base64url(payload{uid,role,student_id,exp}) + '.' + HMAC ----------
// exp 7 天；签名密钥存 settings（首次生成持久化），旧全局 token 一律失效

export interface TokenPayload {
  uid: number
  role: 'teacher' | 'student'
  student_id: number | null
  exp: number // 秒级时间戳
}

const TOKEN_TTL_SEC = 7 * 24 * 3600

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function tokenSecret(): string {
  let s = getSetting('token_secret')
  if (!s) {
    s = crypto.randomBytes(32).toString('hex')
    setSetting('token_secret', s)
  }
  return s
}

function sign(data: string): string {
  return crypto.createHmac('sha256', tokenSecret()).update(data).digest('base64url')
}

export function issueToken(u: { id: number; role: 'teacher' | 'student'; student_id: number | null }): string {
  const payload: TokenPayload = { uid: u.id, role: u.role, student_id: u.student_id, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expect = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
    if (!p || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null
    if (p.role !== 'teacher' && p.role !== 'student') return null
    return p
  } catch {
    return null
  }
}

// ---------- 登录限速（内存 Map）：每 IP 15 分钟窗口内失败 5 次锁 10 分钟 ----------

const RATE_WINDOW = 15 * 60 * 1000
const RATE_MAX_FAILS = 5
const RATE_LOCK = 10 * 60 * 1000

const rateMap = new Map<string, { fails: number[]; lockUntil: number }>()

function rateEntry(ip: string) {
  let e = rateMap.get(ip)
  if (!e) {
    e = { fails: [], lockUntil: 0 }
    rateMap.set(ip, e)
  }
  return e
}

// 返回 {ok:true} 或 {ok:false, retry_minutes}
export function rateLimitCheck(ip: string): { ok: boolean; retry_minutes?: number } {
  const e = rateEntry(ip)
  if (e.lockUntil > Date.now()) {
    return { ok: false, retry_minutes: Math.ceil((e.lockUntil - Date.now()) / 60000) }
  }
  // 清理 15 分钟窗口外的失败记录
  e.fails = e.fails.filter((t) => Date.now() - t < RATE_WINDOW)
  return { ok: true }
}

export function rateLimitFail(ip: string) {
  const e = rateEntry(ip)
  e.fails.push(Date.now())
  e.fails = e.fails.filter((t) => Date.now() - t < RATE_WINDOW)
  if (e.fails.length >= RATE_MAX_FAILS) {
    e.lockUntil = Date.now() + RATE_LOCK
    e.fails = []
  }
}

export function rateLimitSuccess(ip: string) {
  const e = rateEntry(ip)
  e.fails = []
  e.lockUntil = 0
}
