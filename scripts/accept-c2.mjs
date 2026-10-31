// C2 验收实测：用 6 张真实试卷/答题卡照片走完整两阶段批改流水线
// 用法：node scripts/accept-c2.mjs [--save] [--baseline]
//   --save：分析后真实落库（学情 + 错题），否则只跑分析回读验证
//   --baseline：跑完后逐项对照 #42 验收基准表断言（PASS/FAIL 明细 + 总体结论，FAIL 时 exit 1）
// 输出逐题判定表 + 与验收口径的自动核对结果
import fs from 'node:fs'
import path from 'node:path'
import { Agent } from 'undici'

// P0-71②：监督者 #41/#42 建立的独立基准（逐题人工求解 + 放大核图），固化为离线回归断言。
// 注意：基准里的「标准答案」是唯一真值；学生填涂与红叉是卷面事实。系统判定应向它收敛。
const BASELINE = {
  choice_std: { 1: 'C', 2: 'B', 3: 'C', 4: 'A', 5: 'B', 6: 'D', 7: 'C', 8: 'A', 9: 'B', 10: 'D', 11: 'C' },
  choice_student: { 1: 'D', 2: 'B', 3: 'C', 4: 'A', 5: 'B', 6: 'D', 7: 'B', 8: 'D', 9: 'D', 10: 'C', 11: 'C' },
  wrong_expected: ['1', '7', '8', '9', '10'], // 错题集基准（各 -4 分 = -20）
  blank12: [
    { key: '(1)', verdict: '错', correct: 'AD' },
    { key: '(2)', verdict: '对', correct: '2.4' },
    { key: '(3)', verdict: '对' },
    { key: '(4)', verdict: '错', correct: '大于' },
    { key: '(5)', verdict: '对' },
  ],
  full_score: ['13', '14'], // 13 满分；14 满分（μ=0.1，m_A=0.8kg）
  value_checks: [
    { no: '14(2)', contains: ['0.8'] }, // 14(2) 标准解 m_A=0.8kg（学生 0.8 应判对）
    { no: '15(3)', contains: ['3750'] }, // 学生 3600J 漏减初动能，正确 3750J
    { no: '16(3)', contains: ['8.625'] }, // 学生 9.625J 误读，正确 8.625J
  ],
}

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3210'
// 两阶段批改（pro 级求解 + 复核）可能 >5 分钟：放宽脚本侧响应头超时
const lazyDispatcher = new Agent({ headersTimeout: 900_000, bodyTimeout: 900_000 })
void lazyDispatcher
// node fetch 全局 dispatcher（脚本只打 localhost，不涉代理）
const { setGlobalDispatcher } = await import('undici')
setGlobalDispatcher(lazyDispatcher)
const IMG_DIR = 'D:\\Download\\HONOR E Link20261030-173355'
// 实测图片角色：-1=试卷p4(14~16) -2=答题卡p1 -3=试卷p3(12~13) -4=答题卡p2 -5=试卷p1(1~6) -6=试卷p2(7~11)
const FILES = [
  ['20261030-173355.765-1.jpg', 'paper'],
  ['20261030-173355.765-2.jpg', 'sheet'],
  ['20261030-173355.765-3.jpg', 'paper'],
  ['20261030-173355.765-4.jpg', 'sheet'],
  ['20261030-173355.765-5.jpg', 'paper'],
  ['20261030-173355.765-6.jpg', 'paper'],
]
const DO_SAVE = process.argv.includes('--save')
const DO_BASELINE = process.argv.includes('--baseline')

// 字母集合提取（与后端 answersAgree 同口径）
const lettersOf = (s) => [...new Set(String(s || '').replace(/[^ABCD]/g, '').split(''))].sort().join('')

const j = async (r) => {
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(d)?.slice(0, 300)}`)
  return d
}

const login = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'teacher', password: process.env.TEST_PWD || 'admin123' }),
}))
const auth = { Authorization: `Bearer ${login.token}` }
console.log('[1] 登录 OK（role=%s）', login.role)

// 测试学生：验收测试生（不碰叶子青 id=7）
const students = await j(await fetch(`${BASE}/api/students`, { headers: auth }))
let stu = students.find((s) => s.name === '验收测试生')
if (!stu) {
  stu = await j(await fetch(`${BASE}/api/students`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '验收测试生', grade: '高三', status: '在读' }),
  }))
  console.log('[2] 已建测试学生 id=%s', stu.id)
} else console.log('[2] 复用测试学生 id=%s', stu.id)

// 上传 6 张图（带角色）
const images = []
for (let i = 0; i < FILES.length; i++) {
  const [fn, role] = FILES[i]
  const fd = new FormData()
  fd.append('file', new Blob([fs.readFileSync(path.join(IMG_DIR, fn))], { type: 'image/jpeg' }), fn)
  fd.append('student_id', String(stu.id))
  const up = await j(await fetch(`${BASE}/api/upload`, { method: 'POST', headers: auth, body: fd }))
  images.push({ path: up.path, role })
  console.log(`[3] 上传 ${fn} → ${up.path}（${role}）`)
}

// 两阶段分析
console.log('[4] 开始两阶段批改（转录 → 独立求解 → 读答题卡 → 比对），约 2~5 分钟…')
const t0 = Date.now()
const r = await j(await fetch(`${BASE}/api/analyze`, {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: stu.id, images }),
}))
console.log('[4] 分析完成（%s，用时 %d 秒，tokens=%d/%d）', r.pipeline, Math.round((Date.now() - t0) / 1000), r.usage.prompt_tokens, r.usage.completion_tokens)

const a = r.analysis
fs.writeFileSync('tmp/c2-result.json', JSON.stringify(r, null, 2), 'utf8')
console.log('\n===== 逐题判定 =====')
for (const it of a.items) {
  console.log(`第${it.no}题 [${it.verdict}] 学生=${(it.student_answer || '—').slice(0, 40)} | 标准=${(it.reference_answer || '—').slice(0, 40)}`)
  for (const sa of it.sub_answers || []) {
    console.log(`   ${sa.key} [${sa.verdict}] 学生=${(sa.student || '—').slice(0, 30)} | 标准=${(sa.correct || '—').slice(0, 30)}${sa.note ? ' | ' + sa.note.slice(0, 60) : ''}`)
  }
  if (it.error_step) console.log(`   错误步骤：${it.error_step.slice(0, 100)}`)
  if (it.error_type) console.log(`   错因：${it.error_type} | 知识点：${it.knowledge_points.join('、')}`)
}
console.log('\n===== 待确认 ====='); (a.unrecognized || []).forEach((u) => console.log(' -', u))
console.log('预估得分：', a.paper_meta.score_estimate)

// 验收口径自动核对
const flat = []
for (const it of a.items) {
  if (it.sub_answers?.length) for (const sa of it.sub_answers) flat.push({ no: `${it.no}${sa.key}`, ...sa })
  else flat.push({ no: String(it.no), verdict: it.verdict, student: it.student_answer, correct: it.reference_answer, note: it.comment })
}
const wrong = flat.filter((x) => x.verdict === '错')
console.log('\n===== 验收口径核对 =====')
console.log('选择题判定数：', flat.filter((x) => /^[1-9]\d*$|^(1[01])$/.test(x.no) && x.verdict).length)
console.log('判错题：', wrong.map((x) => x.no).join('、') || '无')
const has3600 = JSON.stringify(r).includes('3600')
const has3750 = JSON.stringify(r).includes('3750')
const has9625 = JSON.stringify(r).includes('9.625')
const has8625 = JSON.stringify(r).includes('8.625')
console.log(`15(3) 数值出现：3600=${has3600} 3750=${has3750}；16(3) 数值出现：9.625=${has9625} 8.625=${has8625}`)

// ---------- P0-71②：基准表逐项断言（--baseline） ----------
if (DO_BASELINE) {
  console.log('\n===== 基准表断言（监督者 #41/#42 独立基准） =====')
  const itemOf = (no) => a.items.find((x) => String(Number(x.no)) === String(no))
  const rows = []
  const push = (item, ok, note) => rows.push({ item, ok, note })

  // ① 选择题标准答案（reference_answer 的字母集合 vs 基准）
  for (const [no, std] of Object.entries(BASELINE.choice_std)) {
    const it = itemOf(no)
    const got = lettersOf(it?.reference_answer)
    const pending = it?.verdict === '无法识别' || /待确认/.test(it?.reference_answer || '')
    push(`第${no}题标准答案(基准${std})`, pending ? null : got === lettersOf(std), pending ? '待确认（未强行判定）' : `系统=${it?.reference_answer?.slice(0, 30) || '—'}`)
  }
  // ② 学生填涂（student_answer vs 基准卷面）
  for (const [no, stu] of Object.entries(BASELINE.choice_student)) {
    const it = itemOf(no)
    push(`第${no}题学生填涂(基准${stu})`, lettersOf(it?.student_answer) === lettersOf(stu), `系统=${(it?.student_answer || '—').slice(0, 20)}`)
  }
  // ③ 错题集合
  const wrongGot = a.items.filter((it) => it.verdict === '错').map((it) => String(it.no)).sort((x, y) => Number(x) - Number(y))
  const okSet = wrongGot.length === BASELINE.wrong_expected.length && BASELINE.wrong_expected.every((n) => wrongGot.includes(n))
  push(`错题集合(基准 ${BASELINE.wrong_expected.join(',')})`, okSet, `系统={${wrongGot.join(',')}}`)
  // ④ 12 题逐空
  const q12 = itemOf(12)
  for (const b of BASELINE.blank12) {
    const sa = (q12?.sub_answers || []).find((x) => String(x.key).includes(b.key.replace(/[()]/g, '')) || String(x.key) === b.key)
    push(`12${b.key} 判定(基准${b.verdict})`, sa ? sa.verdict === b.verdict : false, sa ? `系统=${sa.verdict} 学生=${String(sa.student || '—').slice(0, 20)}` : '未找到该空')
    if (b.correct) push(`12${b.key} 正解(基准${b.correct})`, sa && String(sa.correct || '').replace(/\s/g, '').includes(b.correct.replace(/\s/g, '')), sa ? `系统=${String(sa.correct || '—').slice(0, 30)}` : '')
  }
  // ⑤ 满分题
  for (const no of BASELINE.full_score) {
    const it = itemOf(no)
    const subs = it?.sub_answers || []
    const allOk = subs.length ? subs.every((s) => s.verdict === '对') : it?.verdict === '对'
    push(`第${no}题满分(基准)`, !!allOk, subs.length ? `逐 ${subs.length} 空：${subs.map((s) => s.verdict).join('/')}` : `整体=${it?.verdict}`)
  }
  // ⑥ 关键数值
  for (const vc of BASELINE.value_checks) {
    const it = itemOf(vc.no.replace(/\(.*\),?$/, '').replace(/\(.*\)/, '')) || itemOf(vc.no.split('(')[0])
    const hit = vc.contains.some((v) => JSON.stringify(it || {}).includes(v))
    push(`${vc.no} 含正确数值 ${vc.contains.join('/')}`, hit, hit ? '在判定/解析中出现' : '未出现')
  }
  let fails = 0, pendings = 0
  for (const r of rows) {
    if (r.ok === false) fails++
    if (r.ok === null) pendings++
    const mark = r.ok === true ? '✓' : r.ok === null ? '⏳' : '✗'
    console.log(` ${mark} ${r.item} — ${r.note}`)
  }
  console.log(`\n基准断言：PASS ${rows.filter((r) => r.ok === true).length} / FAIL ${fails} / 待确认 ${pendings}`)
  if (fails > 0) {
    console.error('⛔ 未达基准（FAIL 非零）')
    process.exitCode = 1
  } else {
    console.log('✅ 全部达标（待确认项符合「不强行判定」纪律）')
  }
}

if (DO_SAVE) {
  const nos = a.items.filter((it) => it.verdict === '错' || it.verdict === '部分对').map((it) => it.no)
  const save = await j(await fetch(`${BASE}/api/students/${stu.id}/logs`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10), type: '考试',
      content: `【C2验收】${a.paper_meta.type}批改：` + a.items.map((it) => `第${it.no}题${it.verdict}`).join('、'),
      images: images.map((x) => x.path), ai_result: a, create_mistakes: true, mistake_nos: nos,
      photo_bank: true, photo_bank_nos: a.items.filter((it) => it.stem).map((it) => it.no),
      homework: '（C3 验收）重做 15(3)、16(3)',
    }),
  }))
  console.log('[5] 已落库：log=%s 错题=%d 原题入库=%d', save.id, save.mistakes_created, save.bank_questions_created)
  const logs = await j(await fetch(`${BASE}/api/students/${stu.id}/logs`, { headers: auth }))
  console.log('[5] 日志回读 homework 字段 =', JSON.stringify(logs[0]?.homework))
  console.log('\n（--save 已执行：保留数据供人工核对，学生为「验收测试生」）')
}
console.log('\n完整结果已存 tmp/c2-result.json')
