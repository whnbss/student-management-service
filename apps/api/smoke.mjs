// API 冒烟测试脚本（node smoke.mjs，验证 M1 全链路）
const BASE = 'http://localhost:3210'
let token = ''
let pass = 0
let fail = 0

function log(name, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`)
  ok ? pass++ : fail++
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

const date = new Date().toISOString().slice(0, 10)

// 1. 错误密码 → 401
let r = await req('POST', '/api/auth/login', { password: 'wrong' })
log('错误密码拒绝', r.status === 401)

// 2. 正确登录
r = await req('POST', '/api/auth/login', { password: 'admin123' })
token = r.data?.token
log('登录返回 token', r.status === 200 && !!token)

// 3. 未登录访问 → 401（临时清掉 token 再请求）
const savedToken = token
token = ''
r = await req('GET', '/api/students')
log('未登录 401', r.status === 401)
token = savedToken

// 4. 建学生
r = await req('POST', '/api/students', { name: '张小明', grade: '高一', school: '实验中学', textbook: '人教版', phone: '13800000000', parent_wechat: 'xm_parent', status: '在读', note: '基础较薄弱' })
const sid = r.data?.id
log('新建学生', r.status === 200 && !!sid, `id=${sid} status=${r.data?.student?.status}`)

// 5. 录课时包 10 课时 3000 元 → 剩余 10
r = await req('POST', `/api/students/${sid}/packages`, { hours: 10, amount: 3000, purchase_date: date })
log('录课时包', r.status === 200 && r.data?.remaining_hours === 10, `remaining=${r.data?.remaining_hours}`)

// 6. 缴费流水（课时包自动生成 1 条）
r = await req('GET', `/api/students/${sid}/payments`)
log('缴费流水自动记录', r.status === 200 && r.data.length === 1 && r.data[0].amount === 3000, `count=${r.data?.length}`)

// 7. 排课：今天周日？用今天 weekday 保证出现在 today
const today = new Date().getDay()
r = await req('POST', `/api/students/${sid}/schedules`, { weekday: today, start_time: '19:00', end_time: '21:00', note: '力学专题' })
const schId = r.data?.id
log('添加排课', r.status === 200 && !!schId)

// 8. 记学情（含下次课重点）
r = await req('POST', `/api/students/${sid}/logs`, { date, type: '上课', content: '复习牛顿第二定律，受力分析不熟练', next_class_key: '受力分析专项训练 10 题' })
log('手动记学情', r.status === 200 && !!r.data?.id)

// 9. 学情时间线 1 条
r = await req('GET', `/api/students/${sid}/logs`)
log('学情时间线', r.status === 200 && r.data.length === 1 && r.data[0].next_class_key.includes('受力分析'))

// 10. 签到到课 → 扣 1 课时，剩余 9
r = await req('POST', '/api/attendance', { student_id: sid, date, status: '到课', schedule_id: schId })
log('签到到课扣课时', r.status === 200 && r.data?.remaining_hours === 9, `remaining=${r.data?.remaining_hours}`)

// 11. 重复签到 → 409
r = await req('POST', '/api/attendance', { student_id: sid, date, status: '到课', schedule_id: schId })
log('重复签到拒绝', r.status === 409)

// 12. 非法状态拒绝
r = await req('POST', '/api/attendance', { student_id: sid, date, status: '迟' })
log('非法签到状态拒绝', r.status === 400)

// 13. today 工作台：含今日课 + 下次课重点
r = await req('GET', '/api/today')
const hasLesson = r.data?.lessons?.some((l) => l.student.id === sid)
const hasPending = r.data?.pending_logs?.some((l) => l.student_id === sid)
log('今日工作台课表', r.status === 200 && hasLesson, `lessons=${r.data?.lessons?.length}`)
log('今日工作台下次课重点', hasPending, `pending=${r.data?.pending_logs?.length}`)

// 14. 学生列表筛选 + 状态（数据库可能有历史数据，断言包含目标学生即可）
r = await req('GET', `/api/students?status=在读&query=小明`)
log('学生列表与筛选', r.status === 200 && r.data.length >= 1 && r.data.every((s) => s.name.includes('小明')) && r.data.every((s) => typeof s.remaining_hours === 'number'), `count=${r.data?.length}`)

// 15. 剩余 ≤3 预警（录 3 课时包后不扣，再消耗 9 次到课？改为直接录 3 课时包 + 11 次到课不现实——用第 2 个学生验证预警字段）
r = await req('POST', '/api/students', { name: '李小红', grade: '高三', status: '在读' })
const sid2 = r.data.id
await req('POST', `/api/students/${sid2}/packages`, { hours: 3, amount: 900, purchase_date: date })
r = await req('GET', '/api/today')
log('剩余课时≤3预警', r.data?.low_hours?.some((s) => s.id === sid2 && s.remaining_hours === 3), `low_hours=${JSON.stringify(r.data?.low_hours)}`)

// 16. 修改密码
r = await req('PUT', '/api/settings/password', { old_password: 'admin123', new_password: 'admin456' })
log('修改密码', r.status === 200 && r.data?.ok)
r = await req('POST', '/api/auth/login', { password: 'admin456' })
log('新密码可登录', r.status === 200)
// 改回默认，方便用户首次使用
await req('PUT', '/api/settings/password', { old_password: 'admin456', new_password: 'admin123' })

// 17. 删除学生（级联删除其数据）
r = await req('DELETE', `/api/students/${sid2}`)
console.log('  delete resp:', JSON.stringify(r))
r = await req('GET', `/api/students/${sid2}`)
log('删除学生', r.status === 404)

// ==================== M2 冒烟 ====================

// 18. AI 配置读写（先备份当前配置，测试完恢复——绝不覆盖用户真实填写的 API Key）
r = await req('GET', '/api/settings/ai')
log('读取 AI 配置', r.status === 200 && Array.isArray(r.data?.providers) && r.data.providers.length >= 1)
const savedProviders = r.data?.providers
const savedActiveId = r.data?.active_id
r = await req('PUT', '/api/settings/ai', { providers: [{ ...r.data.providers[0], id: 'smoke', name: '冒烟测试供应商', base_url: 'https://example.invalid/v1', api_key: 'sk-test', vision_model: 'test-vl', text_model: 'test-text', input_price: 2, output_price: 8 }] })
log('保存 AI 配置', r.status === 200 && r.data?.ok)
r = await req('GET', '/api/settings/ai')
log('AI 配置回读', r.data?.providers?.[0]?.name === '冒烟测试供应商')

// 19. 未配置 key 的 analyze → 400（用无效供应商测试错误路径）
r = await req('POST', '/api/analyze', { student_id: sid, images: [] })
log('analyze 缺图拒绝', r.status === 400)

// 20. 上传接口：非图片拒绝
const fd = new FormData()
fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt')
fd.append('student_id', String(sid))
r = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
let d = await r.json().catch(() => null)
log('上传非图片拒绝', r.status === 400, JSON.stringify(d))

// 21. 上传一张小 PNG 并回读
const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const fd2 = new FormData()
fd2.append('file', new Blob([Buffer.from(pngB64, 'base64')], { type: 'image/png' }), 't.png')
fd2.append('student_id', String(sid))
r = await fetch(BASE + '/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd2 })
d = await r.json().catch(() => null)
const imgPath = d?.path
log('上传图片返回路径', r.status === 200 && typeof imgPath === 'string' && imgPath.startsWith('/uploads/'), imgPath)
if (imgPath) {
  const res = await fetch(BASE + imgPath)
  log('上传图片可访问', res.status === 200)
}

// 22. AI 分析确认入库（带 images + ai_result + 指定错题抽取）
const aiResult = {
  paper_meta: { type: '作业', grade: '高一', score_estimate: 80 },
  items: [
    { no: 1, verdict: '对', error_step: '', error_type: '', knowledge_points: ['匀变速直线运动'], comment: '正确' },
    { no: 2, verdict: '错', error_step: '第二问摩擦力方向', error_type: '概念不清', knowledge_points: ['摩擦力', '受力分析'], comment: '摩擦力方向判断错误' },
    { no: 3, verdict: '部分对', error_step: '末步计算', error_type: '计算失误', knowledge_points: ['动能定理'], comment: '计算粗心' },
  ],
  weak_points: [{ point: '摩擦力方向判断', evidence: '第2题', severity: '高' }],
  framework: [{ chapter: '相互作用', mastered: ['重力'], shaky: ['摩擦力'], missing: [] }],
  next_class_questions: ['摩擦力方向如何确定？', '静摩擦与滑动摩擦的区别？', '受力分析的一般顺序？'],
  suggestions: ['摩擦力专项 10 题'],
  overall_comment: '整体不错，注意受力分析。继续保持！',
  unrecognized: ['第4题图片模糊'],
}
r = await req('POST', `/api/students/${sid}/logs`, {
  date, type: '作业', content: '【作业批改】测试', images: imgPath ? [imgPath] : [],
  ai_result: aiResult, mistake_nos: [2, 3], next_class_key: '摩擦力专项',
})
const logId = r.data?.id
const mkCount = r.data?.mistakes_created
log('AI 学情入库', r.status === 200 && !!logId, `mistakes_created=${mkCount}`)
log('错题按勾选抽取', mkCount === 2, `count=${mkCount}`)

// 23. 学情带图片与 AI 标记
r = await req('GET', `/api/students/${sid}/logs`)
const aiLog = r.data.find((l) => l.id === logId)
log('学情含图片与AI标记', aiLog && JSON.parse(aiLog.images).length === 1 && aiLog.ai_generated === 1 && !!aiLog.ai_result)

// 24. 错题本列表 + 结构
r = await req('GET', `/api/mistakes?student_id=${sid}`)
const mistakes = r.data || []
log('错题列表', r.status === 200 && mistakes.length === 2, `count=${mistakes.length}`)
const mk2 = mistakes[0]
log('错题字段完整', mk2 && mk2.student_name === '张小明' && mk2.source === 'ai_analysis' && mk2.mastery_status === '未掌握' && !!mk2.redo_due && mk2.redo_stage === 0)

// 25. 重做完成流转：redo_stage 0→1，状态 已重做一次，due 后移 3 天
r = await req('PUT', `/api/mistakes/${mk2.id}`, { redo_done: true })
r = await req('GET', `/api/mistakes?student_id=${sid}&status=已重做一次`)
log('重做流转到已重做一次', r.status === 200 && r.data.length === 1 && r.data[0].redo_stage === 1 && r.data[0].redo_due > date, `due=${r.data?.[0]?.redo_due}`)

// 26. 手动添加错题
r = await req('POST', '/api/mistakes', { student_id: sid, stem: '质量 $m=2kg$ 的物体在 $F=10N$ 作用下加速度多大？', error_type: '公式/模型用错', knowledge_points: ['牛顿第二定律'], difficulty: 2 })
const manualMkId = r.data?.id
log('手动添加错题', r.status === 200 && !!manualMkId)

// 27. 举一反三：未配真实 key → 502/400 错误路径（不影响数据）
r = await req('POST', `/api/mistakes/${manualMkId}/variants`)
log('举一反三未配key报错', r.status === 502 || r.status === 400, `status=${r.status} msg=${r.data?.error?.slice(0, 40)}`)

// 28. 变式题列表为空
r = await req('GET', `/api/mistakes/${manualMkId}/variants`)
log('变式题列表', r.status === 200 && r.data.length === 0)

// 29. today 工作台含到期重做（把重做日期调到今天验证）
await req('PUT', `/api/mistakes/${manualMkId}`, { redo_due: date })
r = await req('GET', '/api/today')
log('今日工作台到期重做', Array.isArray(r.data?.due_redos) && r.data.due_redos.some((m) => m.id === mk2.id || m.id === manualMkId), `due=${r.data?.due_redos?.length}`)

// 30. AI 用量统计接口
r = await req('GET', '/api/settings/ai/usage')
log('AI 用量统计', r.status === 200 && Array.isArray(r.data?.summary) && Array.isArray(r.data?.rows))

// 30b. 系统信息接口（关于卡片数据源）
r = await req('GET', '/api/settings/system')
log('系统信息接口', r.status === 200 && typeof r.data?.port === 'number' && typeof r.data?.data_dir === 'string', `port=${r.data?.port}`)

// 30c. 配置导出接口
r = await req('GET', '/api/settings/ai/export')
log('配置导出', r.status === 200 && Array.isArray(r.data?.providers) && typeof r.data?.proxy === 'string', `providers=${r.data?.providers?.length}`)
const savedProxy = r.data?.proxy

// 30d. 连通性测试直传完整 provider（未保存的表单内容，不再依赖 provider_id）
r = await req('POST', '/api/settings/ai/test', { provider: { id: 'temp-x', name: '直传测试', base_url: 'https://example.invalid/v1', api_key: 'sk-x', vision_model: 'x', text_model: '', input_price: 0, output_price: 0 }, kind: 'text' })
log('测试直传provider（错误路径502）', r.status === 502, `status=${r.status} msg=${String(r.data?.error || '').slice(0, 40)}`)
// 缺 base_url → 后端报错路径
r = await req('POST', '/api/settings/ai/test', { provider: { id: 'temp-y', name: '缺URL', base_url: '', api_key: 'sk-x', vision_model: 'x' }, kind: 'text' })
log('测试缺base_url拒绝', r.status === 502 || r.status === 400, `status=${r.status}`)

// 30e. 配置导入：非法结构拒绝；合法结构保存后必须回读一致
r = await req('POST', '/api/settings/ai/import', { proxy: savedProxy })
log('导入缺providers拒绝', r.status === 400)
r = await req('POST', '/api/settings/ai/import', { providers: savedProviders, proxy: savedProxy })
log('配置导入', r.status === 200 && r.data?.ok)
r = await req('GET', '/api/settings/ai')
log('导入后回读', r.status === 200 && r.data?.proxy === savedProxy && Array.isArray(r.data?.providers))

// 30f. 恢复默认接口（测完立即回填用户真实配置）
r = await req('POST', '/api/settings/ai/reset')
log('恢复默认配置', r.status === 200 && r.data?.ok)
r = await req('GET', '/api/settings/ai')
log('恢复默认后active已清空', r.data?.active_id === '' || r.data?.active_id === undefined, `active_id=${JSON.stringify(r.data?.active_id)}`)

// 31. 恢复测试前的 AI 配置 + 清理测试数据（不能 reset 成默认值，会清掉用户真实填写的 Key）
await req('PUT', '/api/settings/ai', { providers: savedProviders || [], proxy: savedProxy, active_id: savedActiveId })
r = await req('GET', '/api/settings/ai')
log('用户AI配置已完整还原', JSON.stringify(r.data?.providers) === JSON.stringify(savedProviders), `providers=${r.data?.providers?.length} proxy=${r.data?.proxy === savedProxy}`)
await req('DELETE', `/api/mistakes/${manualMkId}`)
r = await req('DELETE', `/api/students/${sid}`)
log('清理测试学生', r.status === 200)
r = await req('GET', `/api/mistakes`)
log('错题随学生级联删除', r.status === 200 && !r.data.some((m) => m.student_id === sid))

console.log(`\n结果：${pass} 通过，${fail} 失败`)
process.exit(fail ? 1 : 0)
