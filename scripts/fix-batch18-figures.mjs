// 一次性脚本：专项④续批（验收 #55 催办⑤）——修正 AI 补图 3 处不合格
// #288：orbit 双「行星」标注（中心与卫星同名）→ center=行星 / label=卫星
// #356：graph_lines 把正弦式 e=311sin(100πt) 画成直线（物理错误）→ vibrate 正弦 e-t 图（xlabel/ylabel 自定义）
// #884：projectile h=0m 图与「光滑水平面」情境不符 → 置空（题干自包含）
// 用法：npx tsx scripts/fix-batch18-figures.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { specToSvg } from '../packages/shared/src/figure.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const upd = db.prepare('UPDATE questions SET figure=? WHERE id=?')
const get = db.prepare('SELECT figure FROM questions WHERE id=?')
const apply = (id, figJson, asserts) => {
  for (const [ok, msg] of asserts) if (!ok) throw new Error(`#${id} 断言失败：${msg}`)
  if (!DRY) {
    upd.run(figJson, id)
    if (get.get(id).figure !== figJson) throw new Error(`#${id} 回读不一致`)
    console.log(`#${id} 已写库并回读一致`)
  } else console.log(`#${id} dry-run 断言全过`)
}

// #288：卫星标注改「卫星」，中心天体=行星
{
  const svg = specToSvg({ template: 'orbit', params: { kind: 'circle', R: 'R', label: '卫星', center: '行星' } })
  if (!svg || svg.includes('NaN')) throw new Error('#288 渲染失败')
  apply(288, JSON.stringify({ kind: 'svg', data: svg }), [
    [svg.includes('>行星<') && svg.includes('>卫星<'), '行星/卫星标注缺失'],
    [(svg.match(/>行星</g) || []).length === 1, '「行星」仍多处出现'],
  ])
}
// #356：正弦 e-t 图（T=0.02s，峰值 311V）
{
  const svg = specToSvg({
    template: 'vibrate',
    params: { T: 0.02, A: 311, xlabel: 't/s', ylabel: 'e/V', tlabel: 'T=0.02s', alabel: 'Eₘ=311V' },
  })
  if (!svg || svg.includes('NaN')) throw new Error('#356 渲染失败')
  apply(356, JSON.stringify({ kind: 'svg', data: svg }), [
    [svg.includes('>e/V<') && svg.includes('>t/s<'), '轴标签缺失'],
    [svg.includes('Eₘ=311V') && svg.includes('T=0.02s'), '峰值/周期标注缺失'],
    [svg.includes('polyline'), '正弦曲线缺失'],
    [!svg.includes('e=311sin(100πt)'), '直线图旧标注残留'],
  ])
}
// #884：置空（题干自包含的概念辨析，projectile h=0 图与情境不符）
{
  const cur = get.get(884)
  if (!cur?.figure) throw new Error('#884 无配图可置空')
  apply(884, '', [[true, '']])
}

console.log(DRY ? 'dry-run 完成未写库' : '全部完成')
db.close()
