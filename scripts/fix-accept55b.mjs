// 一次性脚本：按验收 #55 催办①②修配图（P0-98 / P1-97）
// ① P0-98：#30 配图斜面方向与解析物理相反——图是「/」形（左低右高），解析按「\」形（左高右低）
//    推导 N=mgcosθ+ma·sinθ、f=mgsinθ−ma·cosθ（f 沿斜面向上）。把整图水平镜像成「\」形；
//    F 推力箭头与 a 加速度箭头保持向右不变（F 重新贴到新斜面体左下角）。
// ② P1-97：two_cars 模板把 v₁/v₂ 下标硬编码为「前车/后车」，与 #164 题干「v₁=10 为后车甲、
//    v₂=4 为前车乙」冲突——模板新增 label_front/label_rear 自定义标注，#164/#166 按题干符号重渲染。
// 用法：node scripts/fix-accept55b.mjs [--dry-run]
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
const apply = (id, svg, asserts) => {
  for (const [ok, msg] of asserts) if (!ok) throw new Error(`#${id} 断言失败：${msg}`)
  if (svg.includes('NaN')) throw new Error(`#${id} 渲染含 NaN，拒执行`)
  console.log(`#${id} 断言全过`)
  if (!DRY) {
    const cur = get.get(id)
    upd.run(JSON.stringify({ kind: 'svg', data: svg }), id)
    const back = JSON.parse(get.get(id).figure).data
    if (back !== svg) throw new Error(`#${id} 回读不一致`)
    console.log(`#${id} 已写库并回读一致`)
  }
}

// ---------- ① P0-98：#30 水平镜像 ----------
{
  const q = get.get(30)
  if (!q?.figure) throw new Error('#30 无配图')
  const svg = String(JSON.parse(q.figure).data)
  // 幂等保护：已是「\」形（顶点在左）则跳过
  if (svg.includes('132.15') && !svg.includes('267.846')) {
    console.log('#30 已是镜像后版本，跳过（幂等）')
  } else {
    if (!svg.includes('267.8460969082653,70')) throw new Error('#30 未匹配到旧「/」形顶点锚点，中止')
    // 按元素逐一手写镜像结果（x → 400−x；文字锚点 middle 不变；圆弧 sweep 0→1）
    let out = svg
      // 斜面体三角形：顶点从右上(267.85,70)→左上(132.15,70)，底边 60..300 → 100..340
      .replace('<polygon points="60,190 267.8460969082653,70.00000000000001 300,190"',
        '<polygon points="340,190 132.15390309173469,70 100,190"')
      // 地面线
      .replace('<line x1="40" y1="190" x2="320" y2="190"', '<line x1="360" y1="190" x2="80" y2="190"')
      // 地面斜纹（7 条）
      .replace('<line x1="46" y1="200" x2="56" y2="190"', '<line x1="354" y1="200" x2="344" y2="190"')
      .replace('<line x1="82" y1="200" x2="92" y2="190"', '<line x1="318" y1="200" x2="308" y2="190"')
      .replace('<line x1="118" y1="200" x2="128" y2="190"', '<line x1="282" y1="200" x2="272" y2="190"')
      .replace('<line x1="154" y1="200" x2="164" y2="190"', '<line x1="246" y1="200" x2="236" y2="190"')
      .replace('<line x1="190" y1="200" x2="200" y2="190"', '<line x1="210" y1="200" x2="200" y2="190"')
      .replace('<line x1="226" y1="200" x2="236" y2="190"', '<line x1="174" y1="200" x2="164" y2="190"')
      .replace('<line x1="262" y1="200" x2="272" y2="190"', '<line x1="138" y1="200" x2="128" y2="190"')
      // 斜面上的物块
      .replace('<polygon points="159.59292143521046,132.5 189.03778516388135,115.50000000000001 178.03778516388135,96.44744111674237 148.59292143521046,113.44744111674234"',
        '<polygon points="240.40707856478954,132.5 210.96221483611865,115.5 221.96221483611865,96.44744111674237 251.40707856478954,113.44744111674234"')
      .replace('<text x="163.3153532995459" y="100.94744111674237"', '<text x="236.6846467004541" y="100.94744111674237"')
      // θ 角标注与圆弧：移到底边右角（新斜面与地面夹角处），圆弧 sweep 翻转
      .replace('<text x="100" y="178"', '<text x="300" y="178"')
      .replace('<path d="M 96 190 A 36 36 0 0 0 91.17691453623979 172"', '<path d="M 304 190 A 36 36 0 0 1 308.82308546376021 172"')
      // F 推力箭头：保持水平向右，重新贴到新斜面体左下角（底边现从 x=100 起）
      .replace('<line x1="22" y1="190" x2="55" y2="190" stroke="#334155" stroke-width="2" marker-end="url(#ah30)"/>',
        '<line x1="62" y1="190" x2="96" y2="190" stroke="#334155" stroke-width="2" marker-end="url(#ah30)"/>')
      .replace('<text x="30" y="181"', '<text x="70" y="181"')
      // a 加速度箭头与 M 标注：方向/位置不变（a 恒向右；228,172 仍在新斜面体内部）
    if (out === svg) throw new Error('#30 镜像替换未命中任何锚点，中止')
    // 断言：顶点已在左、F 向右、a 向右、θ 在右下、无旧顶点残留
    apply(30, out, [
      [out.includes('<polygon points="340,190 132.15390309173469,70 100,190"'), '新「\\」形顶点缺失'],
      [!out.includes('267.846'), '旧「/」形顶点残留'],
      [out.includes('<line x1="62" y1="190" x2="96" y2="190"') && out.includes('marker-end="url(#ah30)"'), 'F 推力箭头缺失'],
      [out.includes('x1="150" y1="50" x2="200" y2="50"') && out.includes('marker-end="url(#ah30r)"'), 'a 箭头缺失'],
      [out.includes('<text x="300" y="178"'), 'θ 标注未移到右下角'],
      [out.includes('A 36 36 0 0 1'), '圆弧 sweep 未翻转'],
    ])
  }
}

// ---------- ② P1-97：#164 / #166 按题干符号重渲染 ----------
// #164：题干 v₁=10m/s 为后车甲、v₂=4m/s 为前车乙，乙在甲前方 x₀=20m
{
  const svg = specToSvg({
    template: 'two_cars',
    params: { label1: '乙', label2: '甲', label_front: 'v₂=4m/s', label_rear: 'v₁=10m/s', gap: 'x₀=20m' },
  })
  if (!svg || !svg.startsWith('<svg')) throw new Error('#164 two_cars 渲染失败')
  apply(164, svg, [
    [svg.includes('>v₂=4m/s<'), '前车乙的 v₂=4m/s 标注缺失'],
    [svg.includes('>v₁=10m/s<'), '后车甲的 v₁=10m/s 标注缺失'],
    [svg.includes('>乙<') && svg.includes('>甲<'), '车名标注缺失'],
    [svg.includes('>x₀=20m<'), 'x₀ 间距标注缺失'],
    [!svg.includes('v₁=4') && !svg.includes('v₂=10'), '旧错误下标残留'],
  ])
}
// #166：题干 v₀=8m/s 为匀速的甲（前车示意）、a=2m/s² 为从静止加速的乙（后车）；同地出发无 gap
{
  const svg = specToSvg({
    template: 'two_cars',
    params: { label1: '甲', label2: '乙', label_front: 'v₀=8m/s', label_rear: 'a=2m/s²' },
  })
  if (!svg || !svg.startsWith('<svg')) throw new Error('#166 two_cars 渲染失败')
  apply(166, svg, [
    [svg.includes('>v₀=8m/s<'), '前车甲的 v₀=8m/s 标注缺失'],
    [svg.includes('>a=2m/s²<'), '后车乙的 a=2m/s² 标注缺失'],
    [!svg.includes('v₁=8') && !svg.includes('a₂=2'), '旧错误下标残留'],
    [!svg.includes('x₀'), '同地出发不应有 x₀ 间距线'],
  ])
}

console.log(DRY ? 'dry-run 完成未写库' : '全部完成')
db.close()
