// 数据库初始化与迁移：SQLite 单文件，全部建表 IF NOT EXISTS，可安全重复启动
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

// data 目录固定在项目根（apps/api 向上两级）
const DATA_DIR = path.resolve(import.meta.dirname, '../../..', 'data')
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
`)

// ---------- settings 读写 ----------

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function nowISO() {
  return new Date().toISOString()
}

// ---------- 鉴权：首次启动生成持久 token 与默认密码 ----------

export function initAuth() {
  if (!getSetting('auth_token')) {
    setSetting('auth_token', crypto.randomBytes(24).toString('hex'))
  }
  if (!getSetting('password')) {
    setSetting('password', 'admin123') // 首次登录默认密码，登录后可在设置中修改
  }
  if (!getSetting('port')) {
    setSetting('port', '3210')
  }
}

export function getAuthToken() {
  return getSetting('auth_token') as string
}

// ---------- 学生剩余课时：课时包合计 − 已扣课时 ----------

export function remainingHours(studentId: number): number {
  const bought = db.prepare('SELECT COALESCE(SUM(hours),0) AS s FROM hour_packages WHERE student_id = ?').get(studentId) as { s: number }
  const used = db.prepare("SELECT COALESCE(SUM(deducted),0) AS s FROM attendance WHERE student_id = ? AND status = '到课'").get(studentId) as { s: number }
  return bought.s - used.s
}
