// 一次性脚本：按验收 #39 的指令修 P3-67——#31 装置图方向残留
// #31 题干是竖直悬挂实验（「弹簧上端固定，下端悬挂不同数量钩码」，L=14.0cm 竖直方向），
// 但图仍是水平墙面弹簧 + 地面钩码块的 spring 模板样式（P1-20 同源遗留，上轮只改了标签没改装置）。
// 修法：新增 spring_vertical 模板（天花板固定+竖直弹簧+下端钩码，标 L₀=10.0cm 与 L=14.0cm），
// 用 specToSvg 重渲染后整体替换 #31 的 figure。
// 用法：npx tsx scripts/fix-accept39.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../packages/shared/src/figure.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

const svg = specToSvg({ template: 'spring_vertical', params: { label: '钩码', l0: '10.0cm', l: '14.0cm' } })
if (!svg || !svg.startsWith('<svg')) throw new Error('spring_vertical 模板渲染失败，拒执行')
if (!svg.includes('L₀=10.0cm') || !svg.includes('L=14.0cm') || !svg.includes('>钩码<')) {
  throw new Error('渲染结果缺少 L₀/L/钩码 标注，拒执行')
}
if (svg.includes('NaN')) throw new Error('渲染结果含 NaN，拒执行')
const next = JSON.stringify({ kind: 'svg', data: svg })

// 水平装置特征：左侧竖直墙面线（x1=70 y1=80 x2=70 y2=200）——新图必须是天花板（水平线 y1=y2）而非竖直墙
const cur = db.prepare('SELECT id, figure FROM questions WHERE id = 31').get()
if (!cur) throw new Error('#31 不存在')
const oldFig = String(JSON.parse(String(cur.figure || 'null'))?.data || '')
if (!oldFig.includes('<line x1="70" y1="80" x2="70" y2="200"')) throw new Error('#31 未呈现旧水平装置特征，拒绝盲替换')
if (oldFig.includes('L₀=10.0cm')) throw new Error('#31 已是新竖直装置（幂等保护），拒重复执行')

if (DRY) {
  console.log('[dry-run] #31 将替换为 spring_vertical 渲染结果，长度', next.length)
  console.log(svg)
} else {
  db.prepare('UPDATE questions SET figure = @figure WHERE id = @id').run({ figure: next, id: 31 })
  const after = db.prepare('SELECT figure FROM questions WHERE id = 31').get()
  const s = String(after?.figure || '')
  const ok =
    s.includes('L₀=10.0cm') && s.includes('L=14.0cm') && s.includes('>钩码<') &&
    !s.includes('<line x1="70" y1="80" x2="70" y2="200"') && !s.includes('压缩量') && !s.includes('NaN')
  if (!ok) throw new Error('#31 更新后断言未通过')
  console.log('✓ #31 已替换为竖直悬挂装置（天花板固定+竖直弹簧+钩码，L₀=10.0cm/L=14.0cm）并断言通过')
}

// 全库残留复查：钩码/悬挂题是否仍有「竖直墙+水平弹簧」的 spring 模板装置（P3-67 同型残留）
const WALL = '<line x1="70" y1="80" x2="70" y2="200"'
const bad = db.prepare('SELECT id, figure FROM questions WHERE figure LIKE ?').all('%x1=\\"70\\" y1=\\"80\\" x2=\\"70\\" y2=\\"200\\"%')
  .map((r) => ({ id: r.id, data: String(JSON.parse(String(r.figure || 'null'))?.data || '') }))
  .filter((r) => r.data.includes(WALL) && /钩码|悬挂/.test(r.data))
console.log(bad.length ? `✗ 仍存在悬挂语境配水平装置：${bad.map((r) => '#' + r.id).join(' ')}` : '✓ 全库悬挂/钩码语境无水平墙面弹簧装置残留')
db.close()
