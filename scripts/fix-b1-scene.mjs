// B1 收尾：重配 8 张「标签与题干不匹配」的图 + 置空 2 张模板与情境不符的图（#850 受迫振动竖直弹簧、#878 电磁炉/涡流圆盘）
// 场景校验口径（bank-audit 2b）：图内中文标签每个 ≥2 字 token 至少要有一个字出现在题干中
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../apps/web/src/lib/figure.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = new Database(path.join(ROOT, 'data', 'app.db'))

const RESPEC = [
  { id: 179, spec: { template: 'pv_diagram', params: { pA: 2, VA: 1, pB: 1, VB: 2, label1: 'A', label2: 'B', xlabel: 'V', ylabel: 'p' } }, why: '等温膨胀 p-V：状态点标注改用字母（题干无「初态/末态」字样）' },
  { id: 303, spec: { template: 'projectile', params: { h: 1.25, label: 'v0', place: '' } }, why: '两球平抛比较运动时间：去掉「桌面」字样标注' },
  { id: 441, spec: { template: 'wire_bfield', params: { kind: 'charge', B: '磁场（垂直管轴）', label: 'q' } }, why: '电磁流量计：导电液体中电荷受洛伦兹力示意，去掉题干未出现的「洛伦兹力」字样（保留磁场与电荷）' },
  { id: 479, spec: { template: 'exp_trolley', params: { label: '小车', m2: 'm' } }, why: '小车+纸带实验：砝码标注改用字母 m（题干未出现「钩码」）' },
  { id: 720, spec: { template: 'equipotential', params: { kind: 'parallel', caption: '匀强电场', label: 'v' } }, why: '匀强电场中电势差做功：等势面用平行线，标题用题干出现的「匀强电场」' },
  { id: 739, spec: { template: 'magnet_rect', params: { charge: '+q', label: 'v' } }, why: '回旋加速器 D 形盒磁场：矩形磁场区（B 标注改为图内默认题干用词）' },
  { id: 892, spec: { template: 'freefall', params: { kind: 'down', h: 20, label: '小球' } }, why: '自由落体（楼顶 20m 释放）：原误配平抛桌面图，改竖直下落图' },
  { id: 352, spec: { template: 'optics_refract', params: { kind: 'refract', i: 60, r: 30, n1: '空气', n2: '液体' } }, why: '光从空气射入液体：介质文字与题干用词一致' },
  { id: 418, spec: { template: 'optics_refract', params: { kind: 'refract', i: 53, r: 40, n1: '深水区', n2: '浅水区' } }, why: '水波深水区→浅水区折射：介质文字与题干用词一致' },
  { id: 843, spec: { template: 'optics_refract', params: { kind: 'reflect', i: 45, r: 45, n1: '介质', n2: '空气' } }, why: '全反射临界角：介质/空气与题干用词一致' },
]
const CLEAR = [
  { id: 850, why: '受迫振动（竖直弹簧+偏心轮驱动）无贴合模板，模板图反而误导——恢复无图（题干自包含）' },
  { id: 878, why: '电磁炉/涡流摆动圆盘与「闭合线圈」模板不符——恢复无图（题干自包含）' },
]

const upd = db.prepare('UPDATE questions SET figure = ? WHERE id = ?')
for (const r of RESPEC) {
  const svg = specToSvg(r.spec)
  if (!svg) { console.log(`#${r.id} 渲染失败，跳过`); continue }
  upd.run(JSON.stringify({ kind: 'svg', data: svg }), r.id)
  console.log(`#${r.id} 重配 ✓ ${r.why}`)
}
for (const r of CLEAR) {
  upd.run('', r.id)
  console.log(`#${r.id} 置空 ✓ ${r.why}`)
}
db.close()
