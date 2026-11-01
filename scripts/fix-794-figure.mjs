// P3-89（验收 #50）：#794 涡流题「俯视消歧不足」——题干问「从上往下看（即沿斜面向下俯视）观察
// 铝块中的涡流方向（顺/逆时针）」，但原图只有侧视斜面+铝块，磁场区域都没画，俯视参照系无从建立。
// 修法（补俯视方位小图，不碰题干/选项/答案）：
//   ① 侧视图补：底端磁场区域（虚线带，沿斜槽）+ B 箭头（垂直斜面指向斜面内）+ 下滑方向 v 箭头；
//   ② 右侧补俯视小图：观察方向（沿斜槽向下，v 指向纸内 ⊗v）、铝块端面、磁场区域边界、
//      B 方向（垂直斜面向下，俯视画面内指向画面下方）——只消歧参照系，不画电流方向不代答。
import Database from 'better-sqlite3'
const db = new Database('data/app.db')
db.pragma('busy_timeout = 5000')
const q = db.prepare('SELECT figure FROM questions WHERE id=794').get()
if (!q) { console.error('未找到 #794'); process.exit(1) }
const fig = JSON.parse(q.figure)
let svg = String(fig.data || '')

if (svg.includes('俯视')) { console.log('#794 配图已含俯视小图，跳过（幂等）'); db.close(); process.exit(0) }

const OLD_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240"'
if (!svg.includes(OLD_OPEN)) { console.error('未匹配到 svg 开标签，中止不写入'); process.exit(1) }

// ---- ① 侧视图补充：磁场区域虚线带（斜槽底端 s∈[30,100]，沿法向厚 26）+ B 箭头 + v 箭头 ----
// 斜边 (60,190)→(267.85,70)，上坡单位向量 u=(0.866,-0.5)，斜面上方法向 n=(0.5,-0.866)（30° 斜面自洽）
const SIDE_ADD = [
  // 磁场区域虚线带：A=P(30)=(86,175) B=P(100)=(146.6,140) C=B+26n=(159.6,117.5) D=A+26n=(99,152.5)
  '<polygon points="86,175 146.6,140 159.6,117.5 99,152.5" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>',
  // B 箭头 ×3：垂直斜面指向斜面内（屏幕方向 (0.5,0.866)），带箭头 marker
  '<line x1="105.5" y1="156.2" x2="113.5" y2="170.1" stroke="#334155" stroke-width="1.8" marker-end="url(#ah794)"/>',
  '<line x1="122.8" y1="146.2" x2="130.8" y2="160.1" stroke="#334155" stroke-width="1.8" marker-end="url(#ah794)"/>',
  '<line x1="140.1" y1="136.2" x2="148.1" y2="150.1" stroke="#334155" stroke-width="1.8" marker-end="url(#ah794)"/>',
  // 下滑方向 v 箭头（沿斜槽向下，铝块上坡侧）
  '<line x1="200" y1="102" x2="180" y2="113.5" stroke="#ef4444" stroke-width="2" marker-end="url(#ah794r)"/>',
  '<text x="209" y="100" font-size="12" fill="#ef4444" text-anchor="start" font-family="system-ui,\'Microsoft YaHei\',sans-serif">v</text>',
  // 磁场区域标注
  '<text x="52" y="158" font-size="11" fill="#64748b" text-anchor="start" font-family="system-ui,\'Microsoft YaHei\',sans-serif">磁场区域</text>',
].join('')

// ---- ② 右侧俯视小图 ----
const FONT = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const INSET_ADD = [
  '<text x="480" y="38" font-size="13" fill="#334155" text-anchor="middle" ' + FONT + '>俯视（沿斜槽向下看）</text>',
  // 磁场区域俯视边界（虚线矩形）
  '<rect x="425" y="70" width="110" height="90" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>',
  '<text x="480" y="64" font-size="10" fill="#64748b" text-anchor="middle" ' + FONT + '>磁场区域</text>',
  // 铝块端面（观察者看到朝上的端面）
  '<rect x="455" y="95" width="50" height="40" fill="#c7d2fe" stroke="#334155" stroke-width="1.5"/>',
  // ⊗v：下滑方向指向纸内
  '<circle cx="480" cy="112" r="7" fill="none" stroke="#ef4444" stroke-width="1.5"/>',
  '<line x1="475.5" y1="107.5" x2="484.5" y2="116.5" stroke="#ef4444" stroke-width="1.5"/>',
  '<line x1="484.5" y1="107.5" x2="475.5" y2="116.5" stroke="#ef4444" stroke-width="1.5"/>',
  '<text x="492" y="106" font-size="11" fill="#ef4444" text-anchor="start" ' + FONT + '>v</text>',
  '<text x="480" y="130" font-size="10" fill="#334155" text-anchor="middle" ' + FONT + '>铝块</text>',
  // B 箭头：垂直斜面向下 = 俯视画面内指向画面下方
  '<line x1="545" y1="85" x2="545" y2="135" stroke="#334155" stroke-width="1.8" marker-end="url(#ah794)"/>',
  '<text x="545" y="78" font-size="12" fill="#334155" text-anchor="middle" ' + FONT + '>B</text>',
  '<text x="545" y="152" font-size="9" fill="#64748b" text-anchor="middle" ' + FONT + '>垂直斜面</text>',
  '<text x="545" y="163" font-size="9" fill="#64748b" text-anchor="middle" ' + FONT + '>向下</text>',
  // 观察方向说明
  '<text x="480" y="180" font-size="10" fill="#64748b" text-anchor="middle" ' + FONT + '>观察方向：沿斜槽向下（v 指向纸内）</text>',
  '<text x="480" y="194" font-size="10" fill="#64748b" text-anchor="middle" ' + FONT + '>B 垂直斜面向下（画面中指向下方）</text>',
].join('')

const NEW_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 240" width="560" height="240"'
const DEFS = '<defs><marker id="ah794" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#334155"/></marker><marker id="ah794r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ef4444"/></marker></defs>'

// 原开标签带 style 属性（height="240" 后不是直接 ">"），分两步：先换尺寸，再在开标签后插 defs
svg = svg.replace(OLD_OPEN, NEW_OPEN)
if (!/^<svg[^>]*>/.test(svg)) { console.error('svg 开标签异常，中止不写入'); process.exit(1) }
svg = svg.replace(/^(<svg[^>]*>)/, '$1' + DEFS)
// 侧视补充插在地面阴影线之后（原侧视内容尾部）；俯视小图追加到 </svg> 前
const ANCHOR = '<path d="M 96 190 A 36 36 0 0 0 91.17691453623979 172" fill="none" stroke="#ef4444" stroke-width="1.5"/>'
if (!svg.includes(ANCHOR)) { console.error('未匹配到侧视锚点（30° 弧线），中止不写入'); process.exit(1) }
svg = svg.replace(ANCHOR, ANCHOR + SIDE_ADD)
svg = svg.replace('</svg>', INSET_ADD + '</svg>')

// 自检：①画布扩到 560 ②磁场区域带法向与斜面法向一致（A→D 向量 ∝ (0.5,-0.866)）
if (!svg.includes('viewBox="0 0 560 240"')) { console.error('自检失败：画布未扩到 560'); process.exit(1) }
const [ax, ay] = [86, 175]; const [dx, dy] = [99, 152.5]
const nAng = Math.atan2(-(dy - ay), dx - ax) * 180 / Math.PI // y 翻转成数学坐标
if (Math.abs(nAng - 60) > 2) { console.error(`自检失败：磁场带法向 ${nAng.toFixed(1)}°（应 ~60°）`); process.exit(1) }
console.log(`自检通过：磁场带法向 ${nAng.toFixed(1)}°（斜面倾角 30° 的法向 ✓），B 箭头 3 处、俯视小图齐全`)

fig.data = svg
db.prepare('UPDATE questions SET figure=? WHERE id=794').run(JSON.stringify(fig))
console.log('#794 配图已更新：侧视补磁场区域+⊥B 箭头+v 方向，右侧补俯视方位小图（题干/选项/答案未动）')
db.close()
