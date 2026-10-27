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

// ---------- P1：题库 / AI 出题器 / 分层练习 / 家长报告 ----------

// 31a. 题目手动添加
r = await req('POST', '/api/questions', { stem: '质量 $m=2kg$ 的物体受 $F=4N$ 恒力，求加速度', answer: '$a=2m/s^2$', solution: '由牛顿第二定律 $a=F/m=2$', pitfall: '注意单位', knowledge_points: ['牛顿第二定律'], difficulty: 2, qtype: '计算', grade: '高一' })
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
r = await req('PUT', `/api/questions/${qid1}`, { stem: '质量 $m=2kg$ 的物体受 $F=6N$ 恒力，求加速度', difficulty: 99 })
r = await req('GET', `/api/questions?q=${encodeURIComponent('恒力')}`)
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
r = await req('GET', `/api/questions?q=${encodeURIComponent('恒力')}`)
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
