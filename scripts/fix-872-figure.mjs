// P0-83（验收 #45/#46）：#872 配图与题干不符——题干「v₀ 与竖直边界 MN 夹角 θ=30°」，
// 原图 v₀ 与水平成 ~30°（即与 MN 成 ~60°），图题不符（答案按题干 30° 计算无错）。
// 修法：只改 (1) 问 v₀ 箭头方向——改为与 MN（竖直线）成 30°（即与水平成 60°，更陡），
// 30° 标注移到 MN 与 v₀ 之间的楔形内；(2) 问 A 点与 v 箭头、(3) 问 d 虚线几何已验正确勿动。
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')
const q = db.prepare('SELECT figure FROM questions WHERE id=872').get()
if (!q) { console.error('未找到 #872'); process.exit(1) }
const fig = JSON.parse(q.figure)
let svg = String(fig.data || '')

// 原元素（与水平成 ~30° 的 v₀ 箭头 + 旧标注），精确匹配防止误伤 (2) 问 v 箭头
const OLD_LINE = '<line x1="116" y1="146" x2="158" y2="122" stroke="#ef4444" stroke-width="2.5" marker-end="url(#ah)" stroke-linecap="round"/>'
const OLD_V0 = '<text x="150" y="112" font-size="13" fill="#ef4444" text-anchor="middle" font-family="system-ui,\'Microsoft YaHei\',sans-serif">v₀</text>'
const OLD_ANG = '<text x="146" y="150" font-size="13" fill="#334155" text-anchor="middle" font-family="system-ui,\'Microsoft YaHei\',sans-serif">30°</text>'
// 新元素：P(110,150) 出发，方向 (cos60°, −sin60°)（与竖直边界 MN 成 30°，斜向磁场一侧）；
// 30° 标注放在 MN 与 v₀ 之间的楔形内（y=112 处楔形宽 ~22px）
const FONT = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const NEW_LINE = '<line x1="114" y1="143" x2="138" y2="102" stroke="#ef4444" stroke-width="2.5" marker-end="url(#ah)" stroke-linecap="round"/>'
const NEW_V0 = `<text x="150" y="98" font-size="13" fill="#ef4444" text-anchor="middle" ${FONT}>v₀</text>`
const NEW_ANG = `<text x="120" y="112" font-size="12" fill="#334155" text-anchor="middle" ${FONT}>30°</text>`

for (const [name, old] of [['v₀箭头', OLD_LINE], ['v₀标注', OLD_V0], ['30°标注', OLD_ANG]]) {
  if (!svg.includes(old)) { console.error(`未匹配到原${name}，中止不写入`); process.exit(1) }
}
svg = svg.replace(OLD_LINE, NEW_LINE).replace(OLD_V0, NEW_V0).replace(OLD_ANG, NEW_ANG)

// 自检：新箭头与竖直线夹角应 ≈30°（即 |dx/dy| = tan30° ≈ 0.577）
const m = NEW_LINE.match(/x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"/)
const dx = Math.abs(+m[3] - +m[1]); const dy = Math.abs(+m[4] - +m[2])
const angFromVertical = Math.atan2(dx, dy) * 180 / Math.PI
console.log(`新 v₀ 与 MN（竖直）夹角 = ${angFromVertical.toFixed(1)}°（应为 ~30°）`)
if (Math.abs(angFromVertical - 30) > 2) { console.error('角度自检失败，中止不写入'); process.exit(1) }

fig.data = svg
db.prepare('UPDATE questions SET figure=? WHERE id=872').run(JSON.stringify(fig))
console.log('#872 配图已更新：v₀ 改为与边界 MN 成 30°，(2)(3) 问几何未动')
db.close()
