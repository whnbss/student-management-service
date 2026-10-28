// 第六批补题入库验证（只读）：新题分布/节名对齐/缺图/难度
import { ALL_TEXTBOOK_SECTIONS } from '../packages/shared/src/textbook.ts'

const tok = (await (await fetch('http://localhost:3210/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'teacher', password: 'admin123' }) })).json()).token
const qs: any[] = await (await fetch('http://localhost:3210/api/questions', { headers: { Authorization: 'Bearer ' + tok } })).json()
const neu = qs.filter((q) => q.id >= 371).sort((a, b) => a.id - b.id)
console.log('新入库题数:', neu.length, 'id范围:', neu[0].id, '-', neu[neu.length - 1].id)

const byCh: Record<string, number> = {}
for (const q of neu) byCh[q.chapter || '(无章节)'] = (byCh[q.chapter || '(无章节)'] || 0) + 1
console.log('章节字段分布:', JSON.stringify(byCh, null, 1))

const byT: Record<string, number> = {}, byD: Record<string, number> = {}
for (const q of neu) { byT[q.qtype] = (byT[q.qtype] || 0) + 1; byD[String(q.difficulty)] = (byD[String(q.difficulty)] || 0) + 1 }
console.log('新题题型:', JSON.stringify(byT), '难度:', JSON.stringify(byD))

function kpOf(raw: unknown): string[] {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as string[]) || [] } catch { return [] }
}
const secs = new Set(ALL_TEXTBOOK_SECTIONS)
let aligned = 0, misaligned: string[] = [], missingFig = 0, noAnswer = 0
for (const q of neu) {
  const kps = kpOf(q.knowledge_points)
  if (kps.some((k) => secs.has(k))) aligned++
  else misaligned.push(`#${q.id} ${kps.join('、')}`)
  if (/如图|图所示/.test(q.stem || '') && !q.figure) missingFig++
  if (!q.answer) noAnswer++
}
console.log(`节名精确对齐: ${aligned}/${neu.length}`)
if (misaligned.length) console.log('未对齐:\n- ' + misaligned.join('\n- '))
console.log('缺图:', missingFig, '缺答案:', noAnswer)

// 五个目标章节的覆盖明细
const targets = ['电磁振荡（LC 回路）', '电磁波的发射与接收', '无线电波的传播与应用', '实验：探究小车速度随时间变化的规律', '匀变速直线运动的速度与时间的关系', '匀变速直线运动的位移与时间的关系', '速度与位移的关系（v²−v₀²=2ax）', '匀变速直线运动的推论（逐差相等/中间时刻速度）', '自由落体运动', '竖直上抛运动', '综合专题：刹车问题（停止时间判断）', '综合专题：追及与相遇问题', '重力与重心', '形变与弹力（方向判断）', '胡克定律（F=kx）', '滑动摩擦力', '静摩擦力与最大静摩擦', '摩擦力突变与临界问题', '力的合成', '力的分解（正交分解）', '共点力平衡（解析法）', '共点力平衡（图解法/矢量三角形）', '受力分析方法（整体法与隔离法）', '磁场 磁感线', '磁感应强度', '磁通量', '电磁感应现象及产生条件', '楞次定律（感应电流方向）', '电磁感应定律（初步）', '波的形成和传播', '横波与纵波', '波速、波长与频率的关系（λ=vT）', '波的图像', '质点振动方向与波传播方向（上下坡法）', '波的干涉', '综合专题：振动图像与波的图像综合（双图互推）']
const allKps = qs.flatMap((q) => kpOf(q.knowledge_points))
const before = 358
const coveredNow = targets.filter((s) => allKps.some((k) => k === s))
console.log(`目标 36 节中已覆盖: ${coveredNow.length}`)
const notCovered = targets.filter((s) => !allKps.some((k) => k === s))
console.log('仍未覆盖节:', JSON.stringify(notCovered))
// 新题中实验/压轴
console.log('新题实验:', neu.filter((q) => q.qtype === '实验').length, '新题D5:', neu.filter((q) => q.difficulty === 5).length, '新题压轴位(D4-5):', neu.filter((q) => q.difficulty >= 4).length)
