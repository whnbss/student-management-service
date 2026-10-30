// 统计与经营：每周/每月课时数与收入曲线、学生留存/续费率（P2）
// B3 统计入账口径：收入 = payments（课时包缴费）+ settlements（一课一结算入账），周/月/累计统一口径；
// 新增按日入账明细（可选日期，默认今天）：当日总额 + 逐笔明细（学生/类型/金额）
import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { localDateStr } from '@workbench/shared'

// 周桶：以周一为起点，label 形如 09-01
function weekStart(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const day = (d.getDay() + 6) % 7 // 周一=0
  d.setDate(d.getDate() - day)
  return localDateStr(d)
}

// 把日期字段归一到 YYYY-MM-DD（payments.paid_at / settlements.date 均为日期文本）
const dayOf = (s: string | null | undefined): string => String(s || '').slice(0, 10)

export async function statsRoutes(app: FastifyInstance) {
  // 近 N 周课时（到课次数）与收入（课时包缴费 + 按次结算）；近 N 月月度趋势；学生留存/续费率
  app.get('/api/stats/overview', async (req) => {
    const q = req.query as { weeks?: string; months?: string }
    const nWeeks = Math.min(52, Math.max(4, Number(q.weeks) || 12))
    const nMonths = Math.min(24, Math.max(3, Number(q.months) || 6))

    // ---- 周桶：以今天所在周的周一对齐，向前推 nWeeks 周 ----
    const thisMonday = new Date(localDateStr() + 'T00:00:00')
    thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7))
    const weekKeys: string[] = []
    for (let i = nWeeks - 1; i >= 0; i--) {
      const d = new Date(thisMonday)
      d.setDate(d.getDate() - i * 7)
      weekKeys.push(localDateStr(d))
    }
    const weekIdx = new Map(weekKeys.map((k, i) => [k, i]))
    const weekly = weekKeys.map((k) => ({ week: k, label: k.slice(5).replace('-', '/'), hours: 0, income: 0 }))

    // 到课次数 → 课时
    const att = db.prepare("SELECT date, COUNT(*) AS n FROM attendance WHERE status = '到课' GROUP BY date").all() as Array<{ date: string; n: number }>
    for (const a of att) {
      const ws = weekStart(a.date)
      const i = weekIdx.get(ws)
      if (i !== undefined) weekly[i].hours += a.n
    }
    // 入账（B3 统一口径）：课时包缴费 + 一课一结算
    const pays = db.prepare('SELECT paid_at, amount FROM payments').all() as Array<{ paid_at: string; amount: number }>
    const settles = db.prepare('SELECT date, amount FROM settlements').all() as Array<{ date: string; amount: number }>
    for (const p of pays) {
      const i = weekIdx.get(weekStart(dayOf(p.paid_at)))
      if (i !== undefined) weekly[i].income += p.amount
    }
    for (const s of settles) {
      const i = weekIdx.get(weekStart(dayOf(s.date)))
      if (i !== undefined) weekly[i].income += s.amount
    }

    // ---- 月桶（近 nMonths 个自然月，含当月）----
    const today = new Date()
    const monthKeys: string[] = []
    for (let i = nMonths - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const monthIdx = new Map(monthKeys.map((k, i) => [k, i]))
    const monthly = monthKeys.map((k) => ({ month: k, label: k.replace('-', '/'), hours: 0, income: 0 }))
    for (const a of att) {
      const mk = (a.date || '').slice(0, 7)
      const i = monthIdx.get(mk)
      if (i !== undefined) monthly[i].hours += a.n
    }
    for (const p of pays) {
      const i = monthIdx.get(dayOf(p.paid_at).slice(0, 7))
      if (i !== undefined) monthly[i].income += p.amount
    }
    for (const s of settles) {
      const i = monthIdx.get(dayOf(s.date).slice(0, 7))
      if (i !== undefined) monthly[i].income += s.amount
    }

    // ---- 学生留存/续费 ----
    const students = db.prepare('SELECT id, status FROM students').all() as Array<{ id: number; status: string }>
    const payPerStudent = db.prepare('SELECT student_id, COUNT(DISTINCT COALESCE(package_id, -id)) AS n FROM payments GROUP BY student_id').all() as Array<{ student_id: number; n: number }>
    const paidCount = payPerStudent.length
    const renewed = payPerStudent.filter((r) => r.n >= 2).length
    const byStatus = (s: string) => students.filter((x) => x.status === s).length

    return {
      weekly,
      monthly,
      totals: {
        // 累计收入 = 课时包缴费 + 按次结算入账（B3 口径）
        total_income: Number((pays.reduce((s, p) => s + (p.amount || 0), 0) + settles.reduce((s, x) => s + (x.amount || 0), 0)).toFixed(2)),
        total_hours: att.reduce((s, a) => s + a.n, 0),
      },
      students: {
        total: students.length,
        active: byStatus('在读'),
        paused: byStatus('停课'),
        done: byStatus('结课'),
        paid_students: paidCount,
        renewal_rate: paidCount ? Number(((renewed / paidCount) * 100).toFixed(1)) : 0, // 续费率 = 缴费≥2次的学生占比
      },
    }
  })

  // ---- B3：按日入账明细（可选日期，默认今天）：当日总额 + 逐笔明细（学生/类型/金额） ----
  app.get('/api/stats/daily', async (req) => {
    const q = req.query as { date?: string }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date! : localDateStr()
    // 逐笔：课时包缴费（payments）+ 按次结算（settlements），统一按日期匹配
    const pays = db
      .prepare('SELECT p.id, p.student_id, st.name AS student_name, p.amount, p.method, p.note FROM payments p JOIN students st ON st.id = p.student_id WHERE p.paid_at = ? ORDER BY p.id DESC')
      .all(date) as any[]
    const settles = db
      .prepare('SELECT s.id, s.student_id, st.name AS student_name, s.amount, s.note FROM settlements s JOIN students st ON st.id = s.student_id WHERE s.date = ? ORDER BY s.id DESC')
      .all(date) as any[]
    const items = [
      ...pays.map((p) => ({ id: `p${p.id}`, student_id: p.student_id, student_name: p.student_name, type: '课时包', amount: Number(p.amount) || 0, note: p.note || p.method || '课时包缴费' })),
      ...settles.map((s) => ({ id: `s${s.id}`, student_id: s.student_id, student_name: s.student_name, type: '按次结算', amount: Number(s.amount) || 0, note: s.note || '一课一结算' })),
    ]
    return { date, total: Number(items.reduce((s, x) => s + x.amount, 0).toFixed(2)), items }
  })
}
