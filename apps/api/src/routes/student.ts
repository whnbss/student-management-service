// 学生工作台（/api/student/*，仅 student 角色可访问，守卫在 auth.ts）
// 学生只能看到自己的数据；「我已重做」走与教师端同一套艾宾浩斯流转并给教师发通知
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db, nowISO, remainingHours, billingModeOf } from '../db'
import { hashPassword, verifyPassword } from '../crypto'
import { REDO_INTERVALS, addDays, localDateStr } from '@workbench/shared'

// 取当前学生账号（含校验：student token、账号存在且启用）
// allowBlocked：me/password 放行「停用/课时耗尽」限制（与 must_change_pwd 同口径）——
// 否则「教师开账号 → 学生首登改密 → 发现没课时」会卡死在改密环节（验收 #21 P3-41）
function myAccount(req: FastifyRequest, reply: FastifyReply, allowBlocked = false): any {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.user!.uid) as any
  if (!acc || acc.role !== 'student') {
    reply.code(403).send({ error: '无权限' })
    return null
  }
  if (!allowBlocked) {
    if (acc.status !== 'active') {
      reply.code(403).send({ error: '该账号已被停用，请联系老师' })
      return null
    }
    // 充值课时模式余额耗尽：拒绝访问（双保险，登录处已拦一道；per_lesson 不受影响）
    if (billingModeOf(acc.student_id) === 'package' && remainingHours(acc.student_id) <= 0) {
      reply.code(403).send({ error: '课时已用完，请联系老师续费' })
      return null
    }
  }
  return acc
}

// 首次登录（初始密码为手机号）强制改密：除 me/password 外全部拦截
function requireReady(req: FastifyRequest, reply: FastifyReply): any {
  const acc = myAccount(req, reply)
  if (!acc) return null
  if (acc.must_change_pwd && !req.url.startsWith('/api/student/password') && !req.url.startsWith('/api/student/me')) {
    reply.code(403).send({ error: '请先修改初始密码' })
    return null
  }
  return acc
}

export default async function studentRoutes(app: FastifyInstance) {
  // 我的信息（放行停用/课时耗尽：学生可看到自己的账号状态与剩余课时）
  app.get('/api/student/me', async (req, reply) => {
    const acc = myAccount(req, reply, true)
    if (!acc) return
    const st = db.prepare('SELECT * FROM students WHERE id = ?').get(acc.student_id) as any
    if (!st) { reply.code(404).send({ error: '学生档案不存在' }); return }
    return {
      ok: true,
      username: acc.username,
      name: st.name,
      grade: st.grade,
      status: st.status,
      remaining_hours: remainingHours(st.id),
      billing_mode: billingModeOf(st.id),
      // 隐私（B2）：学生端一切金额不下发——单价恒为 0，费用只在教师端可见
      lesson_price: 0,
      must_change_pwd: !!acc.must_change_pwd,
      account_status: acc.status,
    }
  })

  // 修改自己的密码（首次登录强制改密走这里；停用/课时耗尽也放行，避免首次改密被卡死）
  app.put('/api/student/password', async (req, reply) => {
    const acc = myAccount(req, reply, true)
    if (!acc) return
    const { old_password, new_password } = (req.body || {}) as { old_password?: string; new_password?: string }
    if (!old_password || !verifyPassword(old_password, acc.pwd_hash, acc.pwd_salt)) {
      reply.code(400).send({ error: '原密码错误' }); return
    }
    if (!new_password || new_password.length < 6) {
      reply.code(400).send({ error: '新密码至少 6 位' }); return
    }
    const { hash, salt } = hashPassword(new_password)
    db.prepare('UPDATE accounts SET pwd_hash = ?, pwd_salt = ?, must_change_pwd = 0 WHERE id = ?').run(hash, salt, acc.id)
    return { ok: true }
  })

  // 我的错题（仅自己的）
  app.get('/api/student/mistakes', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    return db.prepare('SELECT * FROM mistakes WHERE student_id = ? ORDER BY created_at DESC').all(acc.student_id)
  })

  // 我已重做：与教师端同一套艾宾浩斯流转（未掌握 → 已重做一次 → … → 已掌握），并通知教师
  app.post('/api/student/mistakes/:id/redo', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    const { id } = req.params as { id: string }
    const m = db.prepare('SELECT * FROM mistakes WHERE id = ?').get(id) as any
    if (!m || m.student_id !== acc.student_id) { reply.code(404).send({ error: '错题不存在' }); return }
    if (m.mastery_status === '已掌握') { reply.code(400).send({ error: '该题已掌握，无需重做' }); return }
    const stage = Math.min(m.redo_stage + 1, REDO_INTERVALS.length)
    const mastered = stage >= REDO_INTERVALS.length
    db.prepare('UPDATE mistakes SET redo_stage = ?, mastery_status = ?, redo_due = ? WHERE id = ?').run(
      stage,
      mastered ? '已掌握' : '已重做一次',
      mastered ? null : addDays(localDateStr(), REDO_INTERVALS[stage]),
      id
    )
    // 同步通知教师（今日页通知铃）
    const kps = (() => { try { return JSON.parse(m.knowledge_points || '[]').join('、') } catch { return '' } })()
    db.prepare(`INSERT INTO notifications(target_role, target_user_id, type, title, body, ref_id, read, created_at)
      VALUES('teacher', NULL, 'redo', ?, ?, ?, 0, ?)`).run(
      `${acc.username} 已重做一道错题`,
      `知识点：${kps || '未分类'} · 状态 → ${mastered ? '已掌握' : '已重做一次'}`,
      m.id,
      nowISO()
    )
    return { ok: true, mastery_status: mastered ? '已掌握' : '已重做一次', redo_due: mastered ? null : addDays(localDateStr(), REDO_INTERVALS[stage]) }
  })

  // 我的课时：剩余课时 + 课时包 + 最近签到 +（一课一结算时）本月上课次数
  // 隐私要求：按次结算学生端不下发任何费用信息（单价/金额/合计），费用只在教师端可见
  app.get('/api/student/hours', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    const mode = billingModeOf(acc.student_id)
    // 隐私要求：课时包只下发次数/日期/备注，金额（amount）等费用字段一律不下发（费用只在教师端可见）
    const packages = db.prepare('SELECT id, hours, purchase_date, note FROM hour_packages WHERE student_id = ? ORDER BY purchase_date DESC, id DESC').all(acc.student_id)
    const attendance = db.prepare('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC, id DESC LIMIT 30').all(acc.student_id)
    const month = localDateStr().slice(0, 7)
    // per_lesson 只返回上课日期（供「本月已上课时 N 次」计数），金额一律不下发
    const settlements = mode === 'per_lesson'
      ? (db.prepare("SELECT * FROM settlements WHERE student_id = ? AND date LIKE ? ORDER BY date DESC, id DESC LIMIT 50").all(acc.student_id, `${month}-%`) as any[])
          .map((s) => ({ id: s.id, date: s.date }))
      : []
    return { ok: true, remaining_hours: remainingHours(acc.student_id), billing_mode: mode, packages, attendance, settlements }
  })

  // 我的课表
  app.get('/api/student/schedules', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    return db.prepare('SELECT * FROM schedules WHERE student_id = ? ORDER BY weekday, start_time').all(acc.student_id)
  })

  // 我的学情日志：学生只读，看到老师记录的每次课/作业流水（不含 ai_result 内部分析明细）
  // C3：含「下次课作业布置」（homework，老师填了才下发内容；前端无该字段时显示为无作业）
  app.get('/api/student/logs', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    return db.prepare(`
      SELECT id, date, type, content, images, next_class_key, homework, created_at
      FROM study_logs WHERE student_id = ? ORDER BY date DESC, id DESC LIMIT 100`).all(acc.student_id)
  })

  // C4：老师讲义列表（学生只能看到自己的；下载走带鉴权的静态路径 /uploads/reports/...）
  app.get('/api/student/report-files', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    return db.prepare(
      'SELECT id, title, filename, path, mime, size, created_at FROM report_files WHERE student_id = ? ORDER BY id DESC'
    ).all(acc.student_id)
  })

  // 我的报告：教师生成的阶段报告（分享链接同源数据），学生端只读
  app.get('/api/student/reports', async (req, reply) => {
    const acc = requireReady(req, reply)
    if (!acc) return
    const rows = db.prepare('SELECT id, title, payload, expires_at, created_at FROM shares WHERE student_id = ? ORDER BY id DESC LIMIT 20').all(acc.student_id) as any[]
    const now = Date.now()
    return rows.map((r) => {
      let report = null
      try { report = JSON.parse(r.payload)?.report || null } catch { /* 损坏跳过 */ }
      return { id: r.id, title: r.title, report, expires_at: r.expires_at, created_at: r.created_at, expired: new Date(r.expires_at).getTime() < now }
    })
  })
}
