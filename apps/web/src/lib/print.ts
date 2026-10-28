// 打印导出统一管线：题库组卷 / 分层练习 / 家长报告 共用
// 原理：新开窗口写入自包含 HTML，加载后自动弹出浏览器打印（用户选「另存为 PDF」）
// LaTeX 在打印前用 katex 预渲染成 MathML 内联（浏览器原生渲染，无需字体/网络，见 lib/tex.ts）
import { texToMathml } from './tex'
import { figureHtml } from './figure'

const PRINT_CSS = `
  body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111}
  h1{text-align:center;font-size:20px;margin:8px 0}
  .info{text-align:center;color:#444;font-size:13px;margin:6px 0;line-height:1.8}
  .namefill{font-size:14px;margin:10px 0 0;text-align:center;letter-spacing:1px}
  .ansnote{text-align:center;color:#888;font-size:12px}
  .q{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}
  .no{color:#666;font-size:13px}
  .stem{margin:6px 0;white-space:pre-wrap;line-height:1.9;font-size:14px}
  .fig{margin:8px 0 4px;text-align:center}
  .ans{background:#f6f6f6;padding:8px;border-radius:6px;font-size:13px;margin-top:6px;white-space:pre-wrap;line-height:1.8}
  .sec{page-break-inside:avoid;margin:14px 0 4px}
  .sec h2{font-size:15px;border-left:4px solid #4f46e5;padding-left:8px;margin:0 0 6px}
  .sec li{margin:4px 0;line-height:1.7}
  .anssheet{page-break-before:always;margin-top:12px}
  .anssheet h2{font-size:16px;text-align:center;margin:0 0 10px}
  .tier{display:inline-block;background:#eef2ff;color:#4f46e5;border-radius:4px;padding:0 6px;font-size:11px}
  .blank{position:relative;height:150px;border:1px dashed #bbb;border-radius:6px;margin-top:10px}
  .blank>span{position:absolute;top:4px;left:8px;color:#aaa;font-size:11px}
  .blank2{height:120px;border:1px dashed #bbb;border-radius:6px;margin-top:10px}
  @media print{.noprint{display:none}}
`

export function printHtml(title: string, bodyHtml: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
    `<style>${PRINT_CSS}</style></head><body>${bodyHtml}` +
    `<script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`
  )
  w.document.close()
  return true
}

// 题目卡片打印片段（题干/公式经 MathML 预渲染，含配图内联）
// 注意：姓名/日期行用 .namefill，打印可见；仅 .noprint 的元素打印时隐藏
export function questionPrintHtml(
  q: { stem: string; answer: string; solution: string; pitfall: string; figure?: string },
  index: number,
  withAnswer: boolean,
  meta = ''
): string {
  const fig = figureHtml(q.figure, window.location.origin)
  return `<div class="q">
    <div class="no">${index + 1}. ${meta}</div>
    <div class="stem">${texToMathml(q.stem)}</div>
    ${fig ? `<div class="fig">${fig}</div>` : ''}
    ${withAnswer ? `<div class="ans"><b>答案：</b>${texToMathml(q.answer || '（未填写）')}</div><div class="ans"><b>解析：</b>${texToMathml(q.solution || '（未填写）')}</div>${q.pitfall ? `<div class="ans"><b>易错点：</b>${texToMathml(q.pitfall)}</div>` : ''}` : ''}
  </div>`
}

// ---------- 试卷（组卷）构建：按题型分大题、组内难度升序、题号连续、答案集中卷尾 ----------

export const QTYPE_ORDER = ['选择', '填空', '实验', '计算'] as const
export const SECTION_NO = ['一', '二', '三', '四', '五', '六'] as const
// 各题型默认分值（可在组卷预览里改）
export const DEFAULT_SCORES: Record<string, number> = { 选择: 5, 填空: 6, 实验: 10, 计算: 12 }
// 智能出题草稿「组成试卷」场景的默认分值（课时练习卷，与整卷考试不同）
export const QUIZ_SCORES: Record<string, number> = { 选择: 3, 填空: 4, 实验: 8, 计算: 12 }

export interface PaperQuestion {
  id: number
  stem: string
  answer: string
  solution: string
  pitfall: string
  qtype: string
  difficulty: number
  figure?: string
}

// 把题目列表整理成大题结构：题型按 选择→填空→实验→计算 分组，组内难度升序
export function groupByQtype(questions: PaperQuestion[]): Array<{ qtype: string; items: PaperQuestion[] }> {
  const map = new Map<string, PaperQuestion[]>()
  for (const q of questions) {
    const list = map.get(q.qtype) || []
    list.push(q)
    map.set(q.qtype, list)
  }
  const ordered: Array<{ qtype: string; items: PaperQuestion[] }> = QTYPE_ORDER
    .filter((t) => map.has(t))
    .map((t) => ({
      qtype: t as string,
      items: (map.get(t as string) || []).slice().sort((a, b) => a.difficulty - b.difficulty),
    }))
  // 非标准题型排在最后
  for (const [t, items] of map) {
    if (!(QTYPE_ORDER as readonly string[]).includes(t)) ordered.push({ qtype: t, items: items.slice().sort((a, b) => a.difficulty - b.difficulty) })
  }
  return ordered
}

// 构建试卷 HTML：学生版只有题干；含答案版题干同卷、答案与解析集中放卷尾「参考答案」区
export function buildExamHtml(p: {
  title: string
  duration?: number
  questions: PaperQuestion[] // 已按 groupByQtype 排好序的平铺列表（含连续题号信息）
  sections: Array<{ qtype: string; items: PaperQuestion[] }>
  scoreOf: (q: PaperQuestion) => number
  withAnswer: boolean
}): { header: string; body: string } {
  const total = p.questions.reduce((s, q) => s + p.scoreOf(q), 0)
  const typeCount = (t: string) => p.sections.find((s) => s.qtype === t)?.items.length || 0
  const header = `<h1>${p.title}</h1>
    <div class="namefill">班级：＿＿＿＿＿＿　姓名：＿＿＿＿＿＿　日期：＿＿＿＿＿＿</div>
    <div class="info">${p.duration ? `考试时长：${p.duration} 分钟 · ` : ''}共 ${p.questions.length} 题 · 满分 ${total} 分</div>
    ${p.withAnswer ? '<div class="ansnote">（含答案版 · 答案与解析见卷尾）</div>' : ''}`

  let no = 0
  let body = ''
  p.sections.forEach((sec, si) => {
    const scoreSum = sec.items.reduce((s, q) => s + p.scoreOf(q), 0)
    body += `<div class="sec"><h2>${SECTION_NO[si] || si + 1}、${sec.qtype}题（共 ${sec.items.length} 题，${scoreSum} 分）</h2></div>`
    for (const q of sec.items) {
      no += 1
      body += questionPrintHtml(q, no - 1, false, `${sec.qtype} · 难度 ${q.difficulty} · ${p.scoreOf(q)} 分`)
    }
  })
  // 含答案版：答案集中卷尾（教师批改习惯）
  if (p.withAnswer) {
    let ansHtml = '<div class="anssheet"><h2>参考答案与解析</h2>'
    no = 0
    for (const sec of p.sections) {
      for (const q of sec.items) {
        no += 1
        ansHtml += `<div class="q"><div class="no">${no}.（${sec.qtype} · ${p.scoreOf(q)} 分）</div>
          <div class="ans"><b>答案：</b>${texToMathml(q.answer || '（未填写）')}</div>
          ${q.solution ? `<div class="ans"><b>解析：</b>${texToMathml(q.solution)}</div>` : ''}
          ${q.pitfall ? `<div class="ans"><b>易错点：</b>${texToMathml(q.pitfall)}</div>` : ''}</div>`
      }
    }
    ansHtml += '</div>'
    body += ansHtml
  }
  return { header, body }
}

// ---------- 错题重做练习单：到期错题合成一张「考试卷」（题干+配图+空白作答区，不含正确解法与错因） ----------

export interface RedoSheetItem {
  stem: string
  image?: string // 原题图片（uploads 相对路径或绝对 URL）
  student_name?: string
  kp?: string // 知识点（顿号串）
}

// 构建重做单 HTML（header+body，与 buildExamHtml 同构，复用 printHtml 打印）
export function buildRedoSheetHtml(p: { title: string; items: RedoSheetItem[] }): { header: string; body: string } {
  const header = `<h1>${p.title}</h1>
    <div class="namefill">班级：＿＿＿＿＿＿　姓名：＿＿＿＿＿＿　日期：＿＿＿＿＿＿</div>
    <div class="info">错题重做练习单 · 共 ${p.items.length} 题 · 独立完成后拍照交给老师智能批改</div>`
  let body = ''
  p.items.forEach((m, i) => {
    const img = m.image
      ? `<div class="fig"><img src="${m.image.startsWith('http') ? m.image : window.location.origin + m.image}" style="max-width:100%"></div>`
      : ''
    body += `<div class="q">
      <div class="no">${i + 1}. ${[m.student_name, m.kp].filter(Boolean).join(' · ')}</div>
      <div class="stem">${texToMathml(m.stem)}</div>
      ${img}
      <div class="blank"><span>作答区</span></div>
      <div class="blank2"></div>
    </div>`
  })
  return { header, body }
}

// 重做单打印入口：错题数据（Mistake 或今日页 due_redos 均可）→ 打印窗口
export function printRedoSheet(
  items: Array<{ stem: string; image?: string; student_name?: string; knowledge_points?: string }>,
  title = '错题重做练习单'
): boolean {
  if (!items.length) return false
  const { header, body } = buildRedoSheetHtml({ title, items })
  return printHtml(title, header + body)
}
