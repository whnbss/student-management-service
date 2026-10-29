// 每日自动备份：SQLite 一致性快照（VACUUM INTO，WAL 下安全）+ uploads（视体积）打 zip 到 data/backups/
// 保留最近 8 份自动轮转；zip 与 backups 目录均在 .gitignore 的 data/ 覆盖范围内，绝不入库
// 另：学生数据重建（purge）等危险操作执行前会额外强制快照一次（见 routes/students.ts）
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { db, getSetting, setSetting, DATA_DIR, UPLOADS_DIR } from './db'

const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const KEEP_COUNT = 14 // 最多保留的备份份数（每日兜底 + purge 前强制快照共用轮转）
const DAY_MS = 24 * 60 * 60 * 1000 // 备份周期：每日兜底一次
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 每 6 小时检查一次是否到期
const UPLOADS_SIZE_LIMIT = 500 * 1024 * 1024 // uploads 超过该体积时仅备份数据库
const ZIP_PREFIX = 'backup-'

// 递归统计目录体积
function dirSize(dir: string): number {
  let total = 0
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) total += dirSize(p)
      else total += st.size
    }
  } catch {
    /* 目录不存在按 0 计 */
  }
  return total
}

// 时间戳（本地时间，用于备份文件名）
function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export async function runBackup(): Promise<{ ok: boolean; file?: string; db_only?: boolean; error?: string }> {
  const tag = stamp()
  const zipPath = path.join(BACKUP_DIR, `${ZIP_PREFIX}${tag}.zip`)
  const snap = path.join(BACKUP_DIR, `app-${tag}.db`)
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    // VACUUM INTO 生成一致性快照（正在写入也安全）
    db.prepare('VACUUM INTO ?').run(snap)
    // uploads 视体积决定是否纳入（避免 zip 过大）
    const dbOnly = dirSize(UPLOADS_DIR) > UPLOADS_SIZE_LIMIT
    const targets = dbOnly ? `'${snap}'` : `'${snap}','${UPLOADS_DIR}'`
    const psCmd = `Compress-Archive -Force -Path ${targets} -DestinationPath '${zipPath}'`
    await new Promise<void>((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { timeout: 10 * 60 * 1000 }, (err) =>
        err ? reject(err) : resolve()
      )
    })
    fs.rmSync(snap, { force: true })
    // 轮转：按文件名（即时间）倒序，超出 KEEP_COUNT 的删除
    const zips = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => new RegExp(`^${ZIP_PREFIX}\\d{8}-\\d{6}\\.zip$`).test(f))
      .sort()
      .reverse()
    for (const f of zips.slice(KEEP_COUNT)) {
      try {
        fs.rmSync(path.join(BACKUP_DIR, f), { force: true })
      } catch {
        /* 被占用等场景跳过，下次轮转再删 */
      }
    }
    setSetting('last_backup_at', String(Date.now()))
    return { ok: true, file: zipPath, db_only: dbOnly }
  } catch (e: any) {
    // 失败时清理残留快照，不阻塞服务
    try {
      fs.rmSync(snap, { force: true })
    } catch {
      /* ignore */
    }
    return { ok: false, error: e?.message || String(e) }
  }
}

// 启动后 30 秒做首次到期检查（避免拖慢启动），之后每 6 小时检查一次
export function scheduleBackups() {
  const check = async () => {
    try {
      const last = Number(getSetting('last_backup_at') || 0)
      if (Date.now() - last >= DAY_MS) {
        const r = await runBackup()
        if (r.ok) console.log(`[backup] 每日备份完成: ${r.file}${r.db_only ? '（uploads 超限，仅含数据库）' : ''}`)
        else console.error(`[backup] 备份失败: ${r.error}`)
      }
    } catch (e: any) {
      console.error(`[backup] 备份检查异常: ${e?.message || e}`)
    }
  }
  setTimeout(() => {
    void check()
    setInterval(() => void check(), CHECK_INTERVAL_MS).unref()
  }, 30_000).unref()
}
