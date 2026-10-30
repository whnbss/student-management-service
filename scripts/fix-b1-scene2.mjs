// B1 收尾 2：重配 7 张标签仍不匹配的图（用补丁后的模板重新渲染，标签默认值已参数化）
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../apps/web/src/lib/figure.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = new Database(path.join(ROOT, 'data', 'app.db'))

const RESPEC = [
  { id: 285, spec: { template: 'orbit', params: { kind: 'circle', center: '地球', label: '卫星', R: '' } }, why: '第一宇宙速度（近地圆轨道）：去「引力」字样的轨道图' },
  { id: 613, spec: { template: 'orbit', params: { kind: 'circle', center: '地球', label: '甲、乙', R: '' } }, why: '两卫星轨道半径比较：去「引力」字样' },
  { id: 614, spec: { template: 'orbit', params: { kind: 'circle', center: '地球', label: '甲、乙', R: '' } }, why: '北斗双卫星轨道比较：去「引力」字样' },
  { id: 352, spec: { template: 'optics_refract', params: { kind: 'refract', i: 60, r: 30, n1: '空气', n2: '液体', normal: '0' } }, why: '折射率计算：去「法线」字样（题干未出现）' },
  { id: 418, spec: { template: 'optics_refract', params: { kind: 'refract', i: 53, r: 40, n1: '深水区', n2: '浅水区', normal: '0' } }, why: '水波折射：去「法线」字样' },
  { id: 843, spec: { template: 'optics_refract', params: { kind: 'reflect', i: 45, r: 45, n1: '介质', n2: '空气', normal: '0' } }, why: '全反射临界角：去「法线」字样' },
  { id: 739, spec: { template: 'magnet_rect', params: { charge: '+q', label: 'v', caption: '磁场' } }, why: '回旋加速器：磁场区标题用题干出现的「磁场」' },
]

const upd = db.prepare('UPDATE questions SET figure = ? WHERE id = ?')
for (const r of RESPEC) {
  const svg = specToSvg(r.spec)
  if (!svg) { console.log(`#${r.id} 渲染失败，跳过`); continue }
  upd.run(JSON.stringify({ kind: 'svg', data: svg }), r.id)
  console.log(`#${r.id} 重配 ✓ ${r.why}`)
}
db.close()
