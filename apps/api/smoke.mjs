// API 冒烟测试脚本（node smoke.mjs，验证 M1 全链路）
// 可用 SMOKE_BASE 指向隔离实例（临时数据目录），避免触碰真实库
const BASE = process.env.SMOKE_BASE || 'http://localhost:3210'
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

// 本地日期（与后端统一为系统本地时区口径，避免 UTC 在东八区凌晨取到前一天）
const _now = new Date()
const date = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

// 1. 缺用户名 → 400（新版登录必须账号+密码；不触碰限速计数，故放最前）
let r = await req('POST', '/api/auth/login', { password: 'admin123' })
log('缺用户名拒绝', r.status === 400)

// 2. 正确登录（teacher 账号，scrypt 校验）；失败登录用例已集中到脚本末尾，避免污染登录限速计数
r = await req('POST', '/api/auth/login', { username: 'teacher', password: 'admin123' })
if (r.status === 429) {
  console.error(`⛔ 登录被限速锁定：${r.data?.error || ''}`)
  console.error('   说明：15 分钟内累计 5 次失败登录会触发锁定（10 分钟）。请稍后重试，或重启后端进程后重跑本脚本。')
  process.exit(1)
}
token = r.data?.token
log('登录返回 token', r.status === 200 && !!token)
log('登录返回角色', r.data?.role === 'teacher', `role=${r.data?.role}`)

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
r = await req('POST', '/api/auth/login', { username: 'teacher', password: 'admin456' })
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

// ---------- P1：题库 / AI 出题器 / 分层练习 / 家长报告 ----------

// 31a. 题目手动添加
r = await req('POST', '/api/questions', { stem: '质量 $m=2kg$ 的物体受 $F=4N$ 恒力SMOKEQ，求加速度', answer: '$a=2m/s^2$', solution: '由牛顿第二定律 $a=F/m=2$', pitfall: '注意单位', knowledge_points: ['牛顿第二定律'], difficulty: 2, qtype: '计算', grade: '高一' })
const qid1 = r.data?.id
log('题目手动添加', r.status === 200 && !!qid1, `id=${qid1}`)

// 31b. 批量入库（模拟 AI 出题确认后）
r = await req('POST', '/api/questions/bulk', { questions: [
  { stem: '变式题一', answer: 'A', solution: '略', pitfall: '', knowledge_points: ['牛顿第二定律'], difficulty: 3, qtype: '选择' },
  { stem: '变式题二', answer: '8m/s', solution: '略', pitfall: '', knowledge_points: ['匀变速直线运动'], difficulty: 4, qtype: '计算' },
] })
const bulkIds = r.data?.ids || []
log('题目批量入库', r.status === 200 && bulkIds.length === 2, `ids=${bulkIds.length}`)

// 31c. 批量入库非法数据拒绝（题干全空）
r = await req('POST', '/api/questions/bulk', { questions: [{ stem: '', answer: '' }] })
log('批量入库空题干拒绝', r.status === 400)

// 31d. 题目筛选：关键词 / 题型 / 难度区间 / 知识点
r = await req('GET', '/api/questions?q=加速度')
log('题目关键词搜索', r.status === 200 && r.data.some((x) => x.id === qid1), `n=${r.data?.length}`)
r = await req('GET', '/api/questions?qtype=选择')
log('题目按题型筛选', r.status === 200 && r.data.every((x) => x.qtype === '选择') && r.data.length >= 1, `n=${r.data?.length}`)
r = await req('GET', '/api/questions?min_diff=4')
log('题目按难度下限筛选', r.status === 200 && r.data.every((x) => x.difficulty >= 4), `n=${r.data?.length}`)
r = await req('GET', `/api/questions?kp=${encodeURIComponent('匀变速直线运动')}`)
log('题目按知识点筛选', r.status === 200 && r.data.length >= 1 && r.data.every((x) => (x.knowledge_points || '').includes('匀变速直线运动')), `n=${r.data?.length}`)

// 31e. 收藏切换 + 只看收藏
r = await req('PUT', `/api/questions/${qid1}`, { favorite: true })
r = await req('GET', '/api/questions?favorite=1')
log('题目收藏与筛选', r.status === 200 && r.data.some((x) => x.id === qid1), `n=${r.data?.length}`)

// 31f. 编辑题目 + 非法难度收敛
r = await req('PUT', `/api/questions/${qid1}`, { stem: '质量 $m=2kg$ 的物体受 $F=6N$ 恒力SMOKEQ，求加速度', difficulty: 99 })
r = await req('GET', `/api/questions?q=SMOKEQ`)
log('题目编辑（难度收敛5）', r.status === 200 && r.data[0]?.difficulty === 5 && r.data[0]?.stem.includes('6N'), `diff=${r.data[0]?.difficulty}`)

// 31g. AI 出题器：缺知识点拒绝
r = await req('POST', '/api/quiz/generate', { kps: [] })
log('出题缺知识点拒绝', r.status === 400)

// 31g2. 文本清洗：字面 \n 入库时转真实换行；figure 非法 JSON 收敛为空
r = await req('POST', '/api/questions', { stem: '字面换行测试题', solution: '第一段。\\n第二段。', answer: 'ok', knowledge_points: ['牛顿第二定律'], figure: '{bad json' })
const qidSan = r.data?.id
r = await req('GET', `/api/questions?q=${encodeURIComponent('字面换行测试题')}`)
log('字面\\n入库清洗', r.status === 200 && !r.data[0]?.solution?.includes('\\n') && r.data[0]?.solution?.includes('\n'), JSON.stringify(r.data?.[0]?.solution))
r = await req('GET', `/api/questions?q=${encodeURIComponent('字面换行测试题')}`)
log('非法figure收敛为空', r.data?.[0]?.figure === '', `figure=${JSON.stringify(r.data?.[0]?.figure)}`)

// 31g3. figure 合法 svg 保存与回读
const figSvg = JSON.stringify({ kind: 'svg', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"></svg>' })
r = await req('PUT', `/api/questions/${qidSan}`, { figure: figSvg })
r = await req('GET', `/api/questions?q=${encodeURIComponent('字面换行测试题')}`)
log('figure svg 保存回读', r.data?.[0]?.figure && JSON.parse(r.data[0].figure).kind === 'svg')

// 31g4. 知识点全库列表接口
r = await req('GET', '/api/questions/kps')
log('知识点全库接口', r.status === 200 && Array.isArray(r.data?.kps) && r.data.kps.includes('牛顿第二定律'), `n=${r.data?.kps?.length}`)

// 31g5. 批量入库查重：同知识点+题干前40字相同 → 返回疑似重复；force 后入库
const dupQ = { stem: '查重测试题干内容保持一致即可触发查重逻辑', answer: '1', solution: '略', knowledge_points: ['牛顿第二定律'], difficulty: 2, qtype: '计算' }
r = await req('POST', '/api/questions', { ...dupQ }) // 先入库一道原题
const dupFirst = r.data?.id
r = await req('POST', '/api/questions/bulk', { questions: [dupQ] })
log('批量入库查重拦截', r.data?.ok === false && Array.isArray(r.data?.duplicates) && r.data.duplicates.length >= 1, JSON.stringify(r.data?.duplicates?.[0]))
r = await req('POST', '/api/questions/bulk', { questions: [dupQ], force: true })
const dupId = r.data?.ids?.[0]
log('批量入库force入库', r.status === 200 && !!dupId, `id=${dupId}`)

// 31g6. 搜索覆盖解析与知识点
r = await req('GET', `/api/questions?q=${encodeURIComponent('第二段')}`)
log('搜索覆盖解析', r.status === 200 && r.data.some((x) => x.id === qidSan))


// 31h. AI 出题器：未配 Key / 调用失败错误路径
r = await req('POST', '/api/quiz/generate', { kps: ['牛顿第二定律'], qtypes: ['计算'], count: 5, level: '基础' })
log('出题无Key/调用错误路径', r.status === 400 || r.status === 502, `status=${r.status} msg=${String(r.data?.error || '').slice(0, 30)}`)

// 31i. 分层练习：缺学生拒绝 / 学生不存在 404
r = await req('POST', '/api/practice/tiered', {})
log('分层练习缺学生拒绝', r.status === 400)
r = await req('POST', '/api/practice/tiered', { student_id: 99999999 })
log('分层练习学生不存在', r.status === 404)

// 31j. 家长报告：参数校验 + 错误路径
r = await req('POST', '/api/reports/parent', {})
log('报告缺学生拒绝', r.status === 400)
r = await req('POST', '/api/reports/parent', { student_id: 99999999 })
log('报告学生不存在', r.status === 404)

// 31k. 删除题目
r = await req('DELETE', `/api/questions/${qid1}`)
r = await req('GET', `/api/questions?q=SMOKEQ`)
log('题目删除', r.status === 200 && r.data.length === 0)
for (const id of bulkIds) await req('DELETE', `/api/questions/${id}`)
await req('DELETE', `/api/questions/${qidSan}`)
await req('DELETE', `/api/questions/${dupId}`)
await req('DELETE', `/api/questions/${dupFirst}`)

// ==================== P2 冒烟：H5 只读分享链接 ====================

// 31m. 生成分享链接：报告结构不完整拒绝 / 正常生成返回 token 与过期时间
r = await req('POST', '/api/reports/share', { student_id: sid, report: { summary: 'x' } })
log('分享报告结构不完整拒绝', r.status === 400)
const shareReport = { summary: '总体进步明显', glow: ['受力分析更规范'], grow: ['计算准确率待提升'], plan: ['下周做力学综合卷'], payment_hint: '' }
r = await req('POST', '/api/reports/share', { student_id: sid, report: shareReport, range: { from: date, to: date }, expires_hours: 24 })
const shareToken = r.data?.token
log('生成分享链接', r.status === 200 && !!shareToken && !!r.data?.expires_at, `expires=${r.data?.expires_at}`)

// 31n. 公开访问：免登录（无 token）可读 / 错误 token 404
const savedTok = token
token = ''
r = await req('GET', `/api/public/share/${shareToken}`)
log('公开访问分享报告', r.status === 200 && r.data?.ok && r.data?.report?.summary === '总体进步明显' && r.data?.student_name === '张小明')
r = await req('GET', '/api/public/share/not-a-real-token')
log('错误 token 404', r.status === 404)
token = savedTok

// 31o. 分享列表 + 撤销：列表含该分享，删除后公开访问 404
r = await req('GET', `/api/reports/share?student_id=${sid}`)
const shareId = r.data?.shares?.[0]?.id
log('分享列表可查', r.status === 200 && r.data?.shares?.some((s) => s.token === shareToken) && r.data.shares[0].expired === false)
r = await req('DELETE', `/api/reports/share/${shareId}`)
token = ''
r = await req('GET', `/api/public/share/${shareToken}`)
log('撤销后公开访问 404', r.status === 404)
token = savedTok

// ==================== Phase 2 冒烟：学生账号系统 + 同步通知 ====================

// 32a. 账号列表：含 teacher；张小明（有手机号）在可开通列表里
r = await req('GET', '/api/accounts')
log('账号列表含教师', r.status === 200 && r.data?.accounts?.some((a) => a.role === 'teacher' && a.username === 'teacher'))
log('可开通学生列表', r.data?.openable_students?.some((s) => s.id === sid), `n=${r.data?.openable_students?.length}`)

// 32b. 开通学生账号（初始密码 = 手机号）
r = await req('POST', '/api/accounts', { student_id: sid })
const accId = r.data?.id
const accUsername = r.data?.username
log('开通学生账号', r.status === 200 && !!accId && accUsername === '张小明', `id=${accId} username=${accUsername}`)

// 32c. 重复开通 → 409
r = await req('POST', '/api/accounts', { student_id: sid })
log('重复开通拒绝', r.status === 409)

// 32d. 学生登录：初始密码手机号，must_change_pwd=true
r = await req('POST', '/api/auth/login', { username: '张小明', password: '13800000000' })
const stuToken0 = r.data?.token
log('学生首次登录', r.status === 200 && r.data?.role === 'student' && r.data?.must_change_pwd === true, `role=${r.data?.role}`)

// 32e. 学生未改密时：只能 me/password，其他学生接口 403
const savedTeacherToken = token
token = stuToken0
r = await req('GET', '/api/student/mistakes')
log('未改密拦截业务接口', r.status === 403, `status=${r.status}`)
r = await req('PUT', '/api/student/password', { old_password: '13800000000', new_password: 'stud123456' })
log('学生改密', r.status === 200 && r.data?.ok)
r = await req('GET', '/api/student/me')
log('改密后 me 正常', r.status === 200 && r.data?.name === '张小明' && r.data?.must_change_pwd === false)

// 32f. 学生只能看自己的错题（前面为张小明建了 2 条）
r = await req('GET', '/api/student/mistakes')
const myMistakes = r.data || []
log('学生看自己错题', r.status === 200 && myMistakes.length >= 2 && myMistakes.every((m) => m.student_id === sid), `count=${myMistakes.length}`)

// 32g. 学生访问教师接口 → 403
r = await req('GET', '/api/students')
log('学生访问学生列表 403', r.status === 403)
r = await req('GET', '/api/questions')
log('学生访问题库 403', r.status === 403)
r = await req('GET', '/api/settings/ai')
log('学生访问智能配置 403', r.status === 403)

// 32h. 学生「我已重做」→ 状态流转 + 教师收到通知
const redoTarget = myMistakes.find((m) => m.mastery_status !== '已掌握')
r = await req('POST', `/api/student/mistakes/${redoTarget.id}/redo`)
log('学生提交重做', r.status === 200 && r.data?.mastery_status === '已重做一次' && r.data?.redo_due > date, `status=${r.data?.mastery_status} due=${r.data?.redo_due}`)
r = await req('GET', `/api/student/mistakes`)
log('重做后状态回读', r.data.find((m) => m.id === redoTarget.id)?.mastery_status === '已重做一次')

token = savedTeacherToken
r = await req('GET', '/api/notifications')
const redoNotif = (r.data?.items || []).find((n) => n.type === 'redo' && n.title.includes('张小明'))
log('教师收到重做通知', r.status === 200 && !!redoNotif, `unread=${r.data?.unread}`)
r = await req('POST', '/api/notifications/read-all')
r = await req('GET', '/api/notifications')
log('全部已读', r.data?.unread === 0, `unread=${r.data?.unread}`)

// 32h2. 删除单条通知（新增 DELETE 接口）
r = await req('DELETE', `/api/notifications/${redoNotif.id}`)
r = await req('GET', '/api/notifications')
log('删除单条通知', r.status === 200 && !(r.data?.items || []).some((n) => n.id === redoNotif.id))

// 32h3. 再提交一次重做，留一条通知用于「删除学生级联清通知」验证
const redoTarget2 = myMistakes.find((m) => m.mastery_status !== '已掌握' && m.id !== redoTarget.id)
let cascadeNotifRef = null
if (redoTarget2) {
  token = stuToken0
  r = await req('POST', `/api/student/mistakes/${redoTarget2.id}/redo`)
  token = savedTeacherToken
  r = await req('GET', '/api/notifications')
  const cascadeNotif = (r.data?.items || []).find((n) => n.type === 'redo' && n.ref_id === redoTarget2.id)
  cascadeNotifRef = cascadeNotif?.ref_id ?? null
  log('级联验证用通知已生成', !!cascadeNotif)
}

// 32i. 学生课时 / 报告 / 课表接口
token = stuToken0
r = await req('GET', '/api/student/hours')
log('学生课时接口', r.status === 200 && typeof r.data?.remaining_hours === 'number' && Array.isArray(r.data?.packages))
// P2-38：package 模式学生端课时包也不得携带金额字段（amount 等费用只在教师端可见）
log('学生端课时包不含金额', (r.data?.packages || []).length >= 1 && (r.data?.packages || []).every((p) => !('amount' in p)), `n=${r.data?.packages?.length}`)
r = await req('GET', '/api/student/reports')
log('学生报告接口', r.status === 200 && Array.isArray(r.data))
// 32i2. 学生端「学习日志」：教师记的学情日志学生可读，且不暴露 ai_result 内部分析
r = await req('GET', '/api/student/logs')
log('学生看学习日志', r.status === 200 && Array.isArray(r.data) && r.data.length >= 1 && (r.data[0].content || '').length > 0, `n=${r.data?.length}`)
log('学生日志不含内部分析', r.data?.every((l) => !('ai_result' in l)))
token = savedTeacherToken

// 32i3. 教师改学生手机号 → 登录账号同步：accounts.phone 跟上、重置密码用新手机号、新手机号可直接登录
r = await req('PUT', `/api/students/${sid}`, { phone: '13811112222' })
log('教师改学生手机号', r.status === 200)
r = await req('GET', '/api/accounts')
const accSynced = (r.data?.accounts || []).find((a) => a.id === accId)
log('改手机号后账号同步', accSynced?.phone === '13811112222', `phone=${accSynced?.phone}`)
r = await req('POST', `/api/accounts/${accId}/reset-password`)
log('重置密码用新手机号', r.status === 200 && r.data?.password === '13811112222', `pwd=${r.data?.password}`)
r = await req('POST', '/api/auth/login', { username: '13811112222', password: '13811112222' })
log('新手机号可作为账号登录', r.status === 200 && r.data?.role === 'student', `status=${r.status}`)
token = savedTeacherToken
r = await req('PUT', `/api/accounts/${accId}`, { password: 'stud123456' }) // 恢复原密码，保持 32j/32k 口径
r = await req('PUT', `/api/students/${sid}`, { phone: '13800000000' }) // 改回原手机号
r = await req('GET', '/api/accounts')
const accBack = (r.data?.accounts || []).find((a) => a.id === accId)
log('改回手机号账号同步', accBack?.phone === '13800000000', `phone=${accBack?.phone}`)

// 32j. 停用账号 → 学生登录被拒；启用恢复
r = await req('PUT', `/api/accounts/${accId}`, { status: 'suspended' })
log('停用账号', r.status === 200)
r = await req('POST', '/api/auth/login', { username: '张小明', password: 'stud123456' })
log('停用后登录被拒', r.status === 403)
r = await req('PUT', `/api/accounts/${accId}`, { status: 'active' })
r = await req('POST', '/api/auth/login', { username: '张小明', password: 'stud123456' })
log('启用后可登录', r.status === 200)

// 32k. 教师重置密码为手机号
r = await req('POST', `/api/accounts/${accId}/reset-password`)
log('重置密码为手机号', r.status === 200 && r.data?.password === '13800000000')
r = await req('POST', '/api/auth/login', { username: '张小明', password: '13800000000' })
log('重置后手机号可登录', r.status === 200 && r.data?.must_change_pwd === true)

// 32l. 批量开通接口（空目标也返回 ok 结构）
r = await req('POST', '/api/accounts/batch-open', {})
log('批量开通接口', r.status === 200 && r.data?.ok && Array.isArray(r.data?.results))

// 32m. 删除学生账号
r = await req('DELETE', `/api/accounts/${accId}`)
log('删除学生账号', r.status === 200)
r = await req('POST', '/api/auth/login', { username: '张小明', password: '13800000000' })
log('删除后登录被拒', r.status === 401)

// ==================== Phase 3 课时结算模式（package / per_lesson） ====================

// 35a. 建「按次结算」学生 + 开通账号
r = await req('POST', '/api/students', { name: '结算测试生', grade: '高二', status: '在读', phone: '13900000000', billing_mode: 'per_lesson', lesson_price: 200 })
const sid3 = r.data?.id
log('新建按次结算学生', r.status === 200 && r.data?.student?.billing_mode === 'per_lesson' && r.data?.student?.lesson_price === 200)
r = await req('POST', '/api/accounts', { student_id: sid3 })
log('开通按次结算学生账号', r.status === 200)

// 35b. 到课签到：per_lesson 不扣课时，自动生成结算记录（金额 = 单次课费）
r = await req('POST', '/api/attendance', { student_id: sid3, date, status: '到课' })
const settleId = r.data?.settlement_id
log('按次结算签到不扣课时', r.status === 200 && r.data?.deducted === 0 && r.data?.remaining_hours === 0 && r.data?.billing_mode === 'per_lesson', `deducted=${r.data?.deducted}`)
log('按次结算自动记账', !!settleId && r.data?.settlement_amount === 200, `settlement_id=${settleId} amount=${r.data?.settlement_amount}`)

// 35b2. 按次结算学生不进课时预警
r = await req('GET', '/api/today')
log('按次结算学生不进课时预警', r.status === 200 && !(r.data?.low_hours || []).some((s) => s.id === sid3))

// 35c. 结算记录查询（按月）+ 合计
r = await req('GET', `/api/students/${sid3}/settlements?month=${date.slice(0, 7)}`)
log('结算记录按月查询', r.status === 200 && r.data?.items?.length === 1 && r.data?.total === 200, `total=${r.data?.total}`)

// 35d. per_lesson 余额为 0 也能登录（不受课时影响）；首登强制改密后查学生端数据
r = await req('POST', '/api/auth/login', { username: '结算测试生', password: '13900000000' })
log('按次结算余额0可登录', r.status === 200 && r.data?.role === 'student')
const stuToken3 = r.data?.token
token = stuToken3
r = await req('PUT', '/api/student/password', { old_password: '13900000000', new_password: 'stud654321' })
log('按次结算学生改密', r.status === 200)
r = await req('GET', '/api/student/me')
log('me 返回结算模式(单价不下发)', r.status === 200 && r.data?.billing_mode === 'per_lesson' && r.data?.lesson_price === 0, `lesson_price=${r.data?.lesson_price}`)
r = await req('GET', '/api/student/hours')
const stuHoursData = r.data || {}
log('学生端结算模式仅上课次数', r.status === 200 && stuHoursData.billing_mode === 'per_lesson' && stuHoursData.settlements?.length === 1 && stuHoursData.settlements[0]?.date, `settlements=${stuHoursData.settlements?.length}`)
log('学生端费用已隐藏', !('amount' in (stuHoursData.settlements?.[0] || {})) && stuHoursData.month_total === undefined && stuHoursData.lesson_price === undefined, `amount泄露=${'amount' in (stuHoursData.settlements?.[0] || {})}`)
token = savedTeacherToken

// 35e. 切回 package 模式 → 余额 0：账号立即自动停用，登录被拒「课时已用完」
r = await req('PUT', `/api/students/${sid3}`, { billing_mode: 'package' })
log('切回充值课时模式', r.status === 200 && r.data?.student?.billing_mode === 'package')
r = await req('POST', '/api/auth/login', { username: '结算测试生', password: 'stud654321' })
log('课时耗尽登录被拒', r.status === 403 && (r.data?.error || '').includes('课时已用完'), r.data?.error)

// 35f. 续费加课时 → 账号自动恢复，登录恢复
r = await req('POST', `/api/students/${sid3}/packages`, { hours: 1, amount: 600, purchase_date: date })
log('续费自动恢复账号', r.status === 200 && r.data?.account_restored === true && r.data?.remaining_hours === 1, `restored=${r.data?.account_restored} remaining=${r.data?.remaining_hours}`)
r = await req('POST', '/api/auth/login', { username: '结算测试生', password: 'stud654321' })
log('恢复后可登录', r.status === 200)

// 35g. 再签到耗尽 → 账号自动停用（suspended），登录被拒
r = await req('POST', '/api/attendance', { student_id: sid3, date: `${date}T22`, status: '到课' })
log('耗尽签到自动停用', r.status === 200 && r.data?.account_suspended === true && r.data?.remaining_hours === 0, `suspended=${r.data?.account_suspended} remaining=${r.data?.remaining_hours}`)
r = await req('POST', '/api/auth/login', { username: '结算测试生', password: 'stud654321' })
log('停用后登录被拒', r.status === 403)

// 35g2. P3-41：停用/课时耗尽账号的 password/me 放行（首登改密不被「课时已用完」卡死），其余接口仍拦截
token = stuToken3
r = await req('GET', '/api/student/me')
log('P3-41 停用账号 me 放行', r.status === 200 && r.data?.account_status === 'suspended', `status=${r.status} account_status=${r.data?.account_status}`)
r = await req('PUT', '/api/student/password', { old_password: 'stud654321', new_password: 'stud654321x' })
log('P3-41 停用账号可改密', r.status === 200, `status=${r.status} err=${r.data?.error || ''}`)
r = await req('PUT', '/api/student/password', { old_password: 'stud654321x', new_password: 'stud654321' })
log('P3-41 改回原密码', r.status === 200)
r = await req('GET', '/api/student/mistakes')
log('P3-41 其他接口仍拦截', r.status === 403, `status=${r.status}`)
token = savedTeacherToken

// 35h. 再续费 → 再恢复；package 模式余额 ≤3 进入预警
r = await req('POST', `/api/students/${sid3}/packages`, { hours: 1, amount: 300, purchase_date: date })
log('再次续费恢复', r.status === 200 && r.data?.account_restored === true && r.data?.remaining_hours === 1)
r = await req('GET', '/api/today')
log('package余额≤3进预警', r.status === 200 && (r.data?.low_hours || []).some((s) => s.id === sid3 && s.remaining_hours === 1))

// 35i. 清理 sid3
r = await req('DELETE', `/api/students/${sid3}`)
log('清理按次结算学生', r.status === 200)

// 36. 数据重建：课时包/缴费流水单条删除 + purge 分类型清空（用独立学生，避免污染主测试学生）
r = await req('POST', '/api/students', { name: '重建测试生', grade: '高一' })
const sidPurge = r.data?.id
r = await req('POST', `/api/students/${sidPurge}/packages`, { hours: 10, amount: 2000, purchase_date: date })
log('purge准备-录课时包', r.status === 200 && r.data?.remaining_hours === 10)
const pkgIdPurge = (await req('GET', `/api/students/${sidPurge}/packages`)).data?.[0]?.id
r = await req('POST', '/api/attendance', { student_id: sidPurge, date: `${date}T21`, status: '到课' })
log('purge准备-签到扣课时', r.status === 200 && r.data?.remaining_hours === 9)
r = await req('POST', `/api/students/${sidPurge}/logs`, { date, type: '上课', content: 'purge测试日志' })
const logIdPurge = (await req('GET', `/api/students/${sidPurge}/logs`)).data?.[0]?.id
r = await req('POST', '/api/mistakes', { student_id: sidPurge, stem: 'purge测试错题', knowledge_points: ['测试点'] })
const mkIdPurge = r.data?.id
// 36a. 单条删除课时包：剩余课时随之减少（10-1签到-10包 → 负数？不，删包后 = 0-1，此处验证返回 remaining）
// P3①：pid 必须归属该学生——不存在的 pid、别的学生的 pid 都要 404
r = await req('DELETE', `/api/students/${sidPurge}/packages/999999`)
log('删除课时包-pid不存在404', r.status === 404, `status=${r.status}`)
const sidPkgOther = (await req('GET', `/api/students/${sid}/packages`)).data?.[0]?.id
r = await req('DELETE', `/api/students/${sidPurge}/packages/${sidPkgOther}`)
log('删除课时包-跨学生404', r.status === 404, `status=${r.status}`)
r = await req('DELETE', `/api/students/${sidPurge}/packages/${pkgIdPurge}`)
const remainAfterPkgDel = r.data?.remaining_hours
log('删除课时包', r.status === 200 && typeof remainAfterPkgDel === 'number', `remaining=${remainAfterPkgDel}`)
r = await req('GET', `/api/students/${sidPurge}/payments`)
const payIdPurge = r.data?.[0]?.id
r = await req('DELETE', `/api/students/${sidPurge}/payments/${payIdPurge}`)
r = await req('GET', `/api/students/${sidPurge}/payments`)
log('删除缴费流水', r.status === 200 && r.data.length === 0)
// 36b. purge mistakes：清空该生错题（P2-39：purge 执行前强制快照备份，返回 backup_ok=1）
r = await req('POST', `/api/students/${sidPurge}/purge`, { mistakes: true })
log('purge清空错题', r.status === 200 && r.data?.mistakes === 1)
log('purge前已快照备份', r.data?.backup_ok === 1, `backup_ok=${r.data?.backup_ok}`)
r = await req('GET', `/api/mistakes?student_id=${sidPurge}`)
log('purge后错题为空', r.data.length === 0)
// 36c. purge logs：清空学情日志
r = await req('POST', `/api/students/${sidPurge}/purge`, { logs: true })
log('purge清空学情日志', r.status === 200 && r.data?.logs === 1)
// 36d. purge billing：课时包+缴费+结算+签到成组清空（余额归零）
r = await req('POST', `/api/students/${sidPurge}/purge`, { billing: true })
log('purge清空课时缴费', r.status === 200 && r.data?.remaining_hours === 0)
r = await req('GET', `/api/students/${sidPurge}`)
log('purge后学生仍在可重建', r.status === 200 && r.data?.id === sidPurge)
r = await req('DELETE', `/api/students/${sidPurge}`)
log('清理重建测试学生', r.status === 200)

// 31. 恢复测试前的 AI 配置 + 清理测试数据（不能 reset 成默认值，会清掉用户真实填写的 Key）
await req('PUT', '/api/settings/ai', { providers: savedProviders || [], proxy: savedProxy, active_id: savedActiveId })
r = await req('GET', '/api/settings/ai')
log('用户AI配置已完整还原', JSON.stringify(r.data?.providers) === JSON.stringify(savedProviders), `providers=${r.data?.providers?.length} proxy=${r.data?.proxy === savedProxy}`)
await req('DELETE', `/api/mistakes/${manualMkId}`)
r = await req('DELETE', `/api/students/${sid}`)
log('清理测试学生', r.status === 200)
r = await req('GET', `/api/mistakes`)
log('错题随学生级联删除', r.status === 200 && !r.data.some((m) => m.student_id === sid))

// 通知随学生级联删除（32h3 留下的重做通知）
r = await req('GET', '/api/notifications')
log('通知随学生级联删除', r.status === 200 && (cascadeNotifRef === null || !(r.data?.items || []).some((n) => n.ref_id === cascadeNotifRef)))

// 33. 错误密码 → 401（失败登录会计入登录限速，本脚本所有失败登录用例集中到末尾）
r = await req('POST', '/api/auth/login', { username: 'teacher', password: 'wrong' })
log('错误密码拒绝', r.status === 401)

// 34. 末次成功登录：成功登录会清空限速计数，保证连续多轮跑冒烟不会累计触发锁定
r = await req('POST', '/api/auth/login', { username: 'teacher', password: 'admin123' })
log('末次成功登录清空限速计数', r.status === 200 && !!r.data?.token)
token = r.data?.token

console.log(`\n结果：${pass} 通过，${fail} 失败`)
console.log('提示：本脚本失败登录用例共 2 次（删除账号后登录、错误密码），且末尾以成功登录清空限速计数，正常不会触发登录锁定（15 分钟 5 次失败才锁 10 分钟）。')
process.exit(fail ? 1 : 0)
