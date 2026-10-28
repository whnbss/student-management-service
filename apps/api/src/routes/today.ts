// 今日工作台：今日课表、剩余课时预警、下次课重点
import type { FastifyInstance } from 'fastify'
import { db, remainingHours, billingModeOf } from '../db'
import { localDateStr } from '@workbench/shared'

export default async function todayRoutes(app: FastifyInstance) {
  app.get('/api/today', async () => {
    const now = new Date()
    const date = localDateStr(now) // 本地日期（UTC 口径在东八区凌晨 0~8 点会取到前一天）
    const weekday = now.getDay() // 0=周日

    // 今日有课的学生（到课/请假/缺勤状态一并返回）
    const lessons = db.prepare(`
      SELECT s.*, st.name AS student_name, st.grade, a.id AS attendance_id, a.status AS attendance_status
      FROM schedules s
      JOIN students st ON st.id = s.student_id
      LEFT JOIN attendance a ON a.student_id = s.student_id AND a.date = ? AND a.schedule_id = s.id
      WHERE s.weekday = ? AND st.status = '在读'
      ORDER BY s.start_time`).all(date, weekday) as any[]

    const lessonList = lessons.map((l) => ({
      schedule: { id: l.id, student_id: l.student_id, weekday: l.weekday, start_time: l.start_time, end_time: l.end_time, note: l.note },
      student: { id: l.student_id, name: l.student_name, grade: l.grade, remaining_hours: remainingHours(l.student_id), billing_mode: billingModeOf(l.student_id) },
      attendance: l.attendance_id ? { id: l.attendance_id, status: l.attendance_status } : null,
    }))

    // 剩余课时 ≤3 的在读学生预警（一课一结算的学生不按课时预警）
    const active = db.prepare("SELECT id, name FROM students WHERE status = '在读'").all() as any[]
    const low_hours = active
      .filter((s) => billingModeOf(s.id) === 'package')
      .map((s) => ({ id: s.id, name: s.name, remaining_hours: remainingHours(s.id) }))
      .filter((s) => s.remaining_hours <= 3)

    // 到期错题重做（艾宾浩斯节奏，今日工作台提醒）
    const due_redos = db.prepare(`
      SELECT m.id, m.student_id, m.stem, m.knowledge_points, m.mastery_status, m.redo_due, st.name AS student_name
      FROM mistakes m JOIN students st ON st.id = m.student_id
      WHERE m.redo_due IS NOT NULL AND m.redo_due <= ? AND m.mastery_status != '已掌握'
      ORDER BY m.redo_due ASC LIMIT 20`).all(date)

    // 各学生最近一条学情日志的「下次课重点」
    const pending_logs = db.prepare(`
      SELECT l.id, l.student_id, l.next_class_key, l.date, st.name AS student_name
      FROM study_logs l JOIN students st ON st.id = l.student_id
      WHERE l.next_class_key != '' AND l.id IN (
        SELECT MAX(id) FROM study_logs WHERE next_class_key != '' GROUP BY student_id
      )
      ORDER BY l.date DESC`).all() as any[]

    return { date, weekday, lessons: lessonList, low_hours, due_redos, pending_logs }
  })
}
