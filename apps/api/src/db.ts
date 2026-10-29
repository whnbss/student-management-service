// 数据库初始化与迁移：SQLite 单文件，全部建表 IF NOT EXISTS，可安全重复启动
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { sanitizeAiText } from '@workbench/shared'

// data 目录默认在项目根（apps/api 向上两级）；可用 WORKBENCH_DATA_DIR 环境变量覆盖，
// 供隔离实例（如冒烟测试的临时库）使用，避免测试触碰真实数据
export const DATA_DIR = process.env.WORKBENCH_DATA_DIR
  ? path.resolve(process.env.WORKBENCH_DATA_DIR)
  : path.resolve(import.meta.dirname, '../../..', 'data')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
export const DB_PATH = path.join(DATA_DIR, 'app.db')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade TEXT DEFAULT '',
  school TEXT DEFAULT '',
  textbook TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  parent_wechat TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '在读' CHECK(status IN ('在读','停课','结课')),
  billing_mode TEXT NOT NULL DEFAULT 'package' CHECK(billing_mode IN ('package','per_lesson')),
  lesson_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hour_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  hours INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  purchase_date TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT DEFAULT '',
  paid_at TEXT NOT NULL,
  package_id INTEGER,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('到课','请假','缺勤')),
  schedule_id INTEGER,
  deducted INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS study_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('上课','作业','考试','其他')),
  content TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  ai_result TEXT,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  next_class_key TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  log_id INTEGER,
  image TEXT DEFAULT '',
  stem TEXT NOT NULL,
  correct_solution TEXT DEFAULT '',
  wrong_solution TEXT DEFAULT '',
  error_type TEXT DEFAULT '',
  knowledge_points TEXT NOT NULL DEFAULT '[]',
  chapter TEXT DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 3,
  mastery_status TEXT NOT NULL DEFAULT '未掌握' CHECK(mastery_status IN ('未掌握','已重做一次','已掌握')),
  redo_due TEXT,
  redo_stage INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mistakes_student ON mistakes(student_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_due ON mistakes(redo_due);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stem TEXT NOT NULL,
  answer TEXT DEFAULT '',
  solution TEXT DEFAULT '',
  pitfall TEXT DEFAULT '',
  knowledge_points TEXT NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL DEFAULT 3,
  qtype TEXT DEFAULT '计算',
  source TEXT NOT NULL DEFAULT 'manual',
  mistake_id INTEGER,
  grade TEXT DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  model TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'parent_report',
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('teacher','student')),
  student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  pwd_hash TEXT NOT NULL,
  pwd_salt TEXT NOT NULL,
  phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  must_change_pwd INTEGER NOT NULL DEFAULT 0,
  last_login TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_student ON accounts(student_id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_role TEXT NOT NULL DEFAULT 'teacher',
  target_user_id INTEGER,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  ref_id INTEGER,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_role, read);
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settlements_student ON settlements(student_id, date);
`)

// ---------- settings 读写 ----------

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

// ---------- 轻量迁移：老库升级 + 存量数据一次性清洗 ----------

// 清洗文本里字面残留的 \n / \\（AI JSON 双重转义遗留，见 sanitizeAiText）
function sanitizeStoredText(s: string): string {
  if (!s.includes('\\')) return s
  return sanitizeAiText(s)
}

function migrateSchema() {
  // questions 表补 figure 列（题目配图：SVG 模板渲染结果或上传图片路径）
  let cols = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'figure')) {
    db.exec("ALTER TABLE questions ADD COLUMN figure TEXT NOT NULL DEFAULT ''")
  }
  // Phase 3：学生课时结算模式（package 充值课时 | per_lesson 一课一结算）+ 单次课费用
  cols = db.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'billing_mode')) {
    db.exec("ALTER TABLE students ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'package'")
  }
  if (!cols.some((c) => c.name === 'lesson_price')) {
    db.exec('ALTER TABLE students ADD COLUMN lesson_price REAL NOT NULL DEFAULT 0')
  }
  // 存量题目一次性清洗：字面 \n → 真实换行、字面 \\ → \（只跑一次，标记在 settings）
  if (!getSetting('question_text_sanitized_v1')) {
    const rows = db.prepare('SELECT id, stem, answer, solution, pitfall FROM questions').all() as Array<{
      id: number; stem: string; answer: string; solution: string; pitfall: string
    }>
    const upd = db.prepare('UPDATE questions SET stem=?, answer=?, solution=?, pitfall=? WHERE id=?')
    for (const r of rows) {
      const [stem, answer, solution, pitfall] = [r.stem, r.answer, r.solution, r.pitfall].map(sanitizeStoredText)
      if (stem !== r.stem || answer !== r.answer || solution !== r.solution || pitfall !== r.pitfall) {
        upd.run(stem, answer, solution, pitfall, r.id)
      }
    }
    setSetting('question_text_sanitized_v1', '1')
  }
}
migrateSchema()

export function nowISO() {
  return new Date().toISOString()
}

// ---------- 账号：首次启动种子数据与老库迁移 ----------

// 老库迁移：把 settings 里的明文密码升级为 teacher 账号的 scrypt 哈希（一次性）
export function initAuth() {
  if (!getSetting('port')) {
    setSetting('port', '3210')
  }
  const teacher = db.prepare("SELECT id FROM accounts WHERE role = 'teacher' LIMIT 1").get() as { id: number } | undefined
  if (!teacher) {
    // 沿用现有密码值（默认 admin123）；settings.password 同步保留一份仅作找回备份，登录校验只走哈希
    const pwd = getSetting('password') || 'admin123'
    if (!getSetting('password')) setSetting('password', pwd)
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(pwd, salt, 64).toString('hex')
    db.prepare(`INSERT INTO accounts(role, student_id, username, pwd_hash, pwd_salt, phone, status, must_change_pwd, created_at)
      VALUES('teacher', NULL, 'teacher', ?, ?, '', 'active', 0, ?)`).run(hash, salt, nowISO())
  }
  // 旧版全局 token 不再使用：清理掉，迁移后教师重新登录
  if (getSetting('auth_token')) {
    db.prepare('DELETE FROM settings WHERE key = ?').run('auth_token')
  }
}

// 同步更新 settings.password（仅作找回备份；登录校验一律走 accounts 的 scrypt 哈希）
export function syncBackupPassword(pwd: string) {
  setSetting('password', pwd)
}

// ---------- 学生剩余课时：课时包合计 − 已扣课时 ----------

export function remainingHours(studentId: number): number {
  const bought = db.prepare('SELECT COALESCE(SUM(hours),0) AS s FROM hour_packages WHERE student_id = ?').get(studentId) as { s: number }
  const used = db.prepare("SELECT COALESCE(SUM(deducted),0) AS s FROM attendance WHERE student_id = ? AND status = '到课'").get(studentId) as { s: number }
  return bought.s - used.s
}

// ---------- Phase 3：课时两种结算模式（package 充值课时 | per_lesson 一课一结算） ----------

export type BillingMode = 'package' | 'per_lesson'

export function billingModeOf(studentId: number): BillingMode {
  const st = db.prepare('SELECT billing_mode FROM students WHERE id = ?').get(studentId) as { billing_mode?: BillingMode } | undefined
  return st?.billing_mode === 'per_lesson' ? 'per_lesson' : 'package'
}

// package 模式余额耗尽 → 自动停用该生的学生账号（登录被拒）；per_lesson 不受课时影响
// 返回 true 表示本次发生了「自动停用」
export function suspendStudentAccountIfDepleted(studentId: number): boolean {
  if (billingModeOf(studentId) !== 'package') return false
  if (remainingHours(studentId) > 0) return false
  const r = db.prepare("UPDATE accounts SET status = 'suspended' WHERE student_id = ? AND role = 'student' AND status = 'active'").run(studentId)
  return r.changes > 0
}

// package 模式续费加课时后余额 > 0 → 自动恢复被「课时耗尽」停用的账号
// （教师手动停用的账号也会被恢复，这是按已批方案的简化设计：续费即恢复）
// 返回 true 表示本次发生了「自动恢复」
export function restoreStudentAccountIfRenewed(studentId: number): boolean {
  if (billingModeOf(studentId) !== 'package') return false
  if (remainingHours(studentId) <= 0) return false
  const r = db.prepare("UPDATE accounts SET status = 'active' WHERE student_id = ? AND role = 'student' AND status = 'suspended'").run(studentId)
  return r.changes > 0
}
