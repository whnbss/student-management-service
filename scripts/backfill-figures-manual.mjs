// B1 存量补图·第三遍（人工定标）：对 AI 两遍都没给出配图、但确有贴合模板的题，逐题人工指定 figure_spec。
// 只处理本文件 HAND 列表中的题目；每条附「贴合理由」备查。真正的纯概念/核反应方程/薄膜等题保持无图（豁免）。
// 用法：npx tsx scripts/backfill-figures-manual.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../apps/web/src/lib/figure.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// 逐题人工定标：id → { spec, why }
const HAND = [
  { id: 180, spec: { template: 'gas_cylinder', params: { label: '气体（等压升温）', p: 'p', thermo: 1 } }, why: '等压升温：气缸+活塞+温度计装置图' },
  { id: 229, spec: { template: 'energy_levels', params: { max_n: 3, from: 3, to: 1 } }, why: 'n=3 激发态跃迁：能级图' },
  { id: 231, spec: { template: 'energy_levels', params: { max_n: 4, from: 4, to: 2 } }, why: 'n=4 一群氢原子跃迁：能级图（画 4→2 可见光）' },
  { id: 643, spec: { template: 'energy_levels', params: { max_n: 3, from: 3, to: 2 } }, why: 'n=3→n=2 跃迁发出可见光：能级图' },
  { id: 350, spec: { template: 'double_slit', params: { d: 'd', L: 'L' } }, why: '双缝干涉条纹间距：双缝装置图' },
  { id: 353, spec: { template: 'double_slit', params: { d: 0.2, L: 0.7 } }, why: '双缝干涉测波长实验：双缝装置图（d/L 与题干一致）' },
  { id: 744, spec: { template: 'double_slit', params: { d: 0.2, L: 1.0 } }, why: '双缝干涉测波长实验：双缝装置图（d/l 与题干一致）' },
  { id: 844, spec: { template: 'double_slit', params: { d: 'd', L: 'l' } }, why: '双缝干涉条纹间距变化：双缝装置图' },
  { id: 507, spec: { template: 'oil_film', params: {} }, why: '油膜法估测分子大小：水面油膜网格图' },
  { id: 801, spec: { template: 'oil_film', params: {} }, why: '油膜法：水面油膜网格图' },
  { id: 900, spec: { template: 'oil_film', params: {} }, why: '油膜法：水面油膜网格图' },
  { id: 685, spec: { template: 'multimeter', params: { ohm: '×100', label: 'Rx' } }, why: '多用电表欧姆挡测电阻：表盘+表笔图' },
  { id: 717, spec: { template: 'accel_plates', params: { kind: 'deflect', U: '200V' } }, why: '平行板电容器两极板电压：双极板装置图（题干未涉及粒子，仅取极板部分）' },
]

const updateFigure = db.prepare('UPDATE questions SET figure = ? WHERE id = ?')
for (const h of HAND) {
  const q = db.prepare('SELECT id, figure FROM questions WHERE id = ?').get(h.id)
  if (!q) { console.log(`#${h.id} 不存在，跳过`); continue }
  if (String(q.figure || '').trim()) { console.log(`#${h.id} 已有配图，跳过`); continue }
  const svg = specToSvg(h.spec)
  if (!svg) { console.log(`#${h.id} 模板 ${h.spec.template} 渲染失败，跳过`); continue }
  if (!DRY) updateFigure.run(JSON.stringify({ kind: 'svg', data: svg }), h.id)
  console.log(`#${h.id} ✓ ${h.spec.template}（${h.why}）${DRY ? ' dry-run 未写入' : ''}`)
}
db.close()
