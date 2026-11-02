// 一次性脚本：按验收 #68/#69 催办修 5 项轻量缺陷。
// P2-111：删除 data/backups/ 下历史遗留裸快照 app-pre-accept28.db(+ -shm/-wal) 三件
//         （轮转正则 ^backup-\d{8}-…\.zip$ 不匹配，永不清理；-wal 伴生易被误认为可用备份）。
//         backup.ts 轮转段的 app-*.db* 常态清理逻辑在源码中另行修改，本脚本只清现存三件。
// P2-112：#385（共点力合成，填空 D2）应配图未配图——补 3N/4N 垂直力合成矢量图（矩形+对角线合力+θ 角），
//         图内只标 F₁=3 N / F₂=4 N / F / θ（均为题干已知量），不标 5 与 4/3（答案泄露禁绝）；
//         顺带清理 kp 冗余标签「胡克定律（F=kx）」（与题面无关）。
// P1-113：#561（板块模型，计算 D3）图题不符两处——①F 箭头画成朝左（题干「水平向右」）；
//         ②只画物块 A 直接坐地面，缺长木板 B。重画：地面+B 长条木板+A 小物块坐 B 上+F 从左向右红箭头指 A。
// P1-114：#512（测 E 和 r，实验 D2）图内答案泄露两处（同 #230 判例）——
//         电路图「电源 1.5」直给 E=1.50V、「r=1Ω」直给 r=1.0Ω。改「电源」「r」纯符号，答案/解析不动。
// P2-115：#513（薄膜干涉，填空 D2）应配图无图——补平行薄膜垂直入射 SVG
//         （上下表面平行+薄膜(折射率 n)+空气+入射单色光 λ+两束反射光①②+膜厚 d 标注），零答案数值。
// 用法：node scripts/fix-accept69.mjs [--dry-run]
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const FONT = "system-ui,'Microsoft YaHei',sans-serif"
const get = db.prepare('SELECT id, stem, answer, solution, pitfall, qtype, figure, knowledge_points FROM questions WHERE id=?')
const cnt = (s, sub) => s.split(sub).length - 1
const assert = (ok, msg) => {
  if (!ok) throw new Error(`断言失败：${msg}`)
}

// ---------- 通用箭头 / 标注 ----------
const arrow = (sx, sy, dx, dy, color, w) => {
  const len = Math.hypot(dx - sx, dy - sy)
  const ux = (dx - sx) / len, uy = (dy - sy) / len
  const bx = dx - 9 * ux, by = dy - 9 * uy
  const px = -uy, py = ux
  return [
    `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`,
    `<polygon points="${dx.toFixed(1)},${dy.toFixed(1)} ${(bx + 4.5 * px).toFixed(1)},${(by + 4.5 * py).toFixed(1)} ${(bx - 4.5 * px).toFixed(1)},${(by - 4.5 * py).toFixed(1)}" fill="${color}"/>`,
  ].join('')
}
const label = (x, y, text, color, anchor = 'middle', size = 14, weight = 'normal', italic = 'normal') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-family="${FONT}" font-weight="${weight}" font-style="${italic}">${text}</text>`

// ---------- 读取各题原数据 ----------
const q561 = get.get(561)
const q512 = get.get(512)
const q513 = get.get(513)
const q385 = get.get(385)
const q755 = get.get(755)
const q860 = get.get(860)
const q671 = get.get(671)
for (const [id, q] of [[561, q561], [512, q512], [513, q513], [385, q385], [755, q755], [860, q860], [671, q671]]) if (!q) throw new Error(`#${id} 不存在`)

// ============================================================
// P1-113 · #561 重画：地面 + 长木板 B + 物块 A（坐 B 上）+ F 向右
// ============================================================
function buildFig561() {
  const GY = 220                      // 地面 y
  const BX = 100, BW = 260, BH = 34   // 木板 B：x 100~360，底 y=220 坐地面
  const BY = GY - BH                  // 186
  const AX = 110, AW = 60, AH = 38    // 物块 A：x 110~170，底 y=186 坐 B 上表面
  const AY = BY - AH                  // 148
  const FY = AY + AH / 2              // F 作用在 A 左侧面中部高度
  const hatch = []
  for (let x = 44; x <= 426; x += 38) hatch.push(`<line x1="${x}" y1="${GY + 10}" x2="${x + 12}" y2="${GY}" stroke="#94a3b8" stroke-width="1.5"/>`)
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 280" width="460" height="280" style="max-width:100%;height:auto">',
    '<rect x="0" y="0" width="460" height="280" fill="none"/>',
    // 地面
    `<line x1="30" y1="${GY}" x2="430" y2="${GY}" stroke="#334155" stroke-width="2"/>`,
    ...hatch,
    // 长木板 B（坐地面）
    `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="2" fill="#fef3c7" stroke="#334155" stroke-width="2"/>`,
    label(BX + BW / 2, BY + 23, 'B', '#334155', 'middle', 15, 'bold'),
    // 物块 A（坐 B 上表面左端）
    `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="4" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>`,
    label(AX + AW / 2, AY + 24, 'A', '#334155', 'middle', 15, 'bold'),
    // F：从左向右的水平恒力，箭头尖指向 A 左侧面
    arrow(46, FY, AX - 2, FY, '#ef4444', 3),
    label(70, FY - 14, 'F', '#ef4444', 'middle', 15, 'bold', 'italic'),
    // 板长 L 尺寸线（题干已知量）
    `<line x1="${BX}" y1="252" x2="${BX + BW}" y2="252" stroke="#64748b" stroke-width="1.2"/>`,
    `<polygon points="${BX},252 ${BX + 8},248.5 ${BX + 8},255.5" fill="#64748b"/>`,
    `<polygon points="${BX + BW},252 ${BX + BW - 8},248.5 ${BX + BW - 8},255.5" fill="#64748b"/>`,
    `<line x1="${BX}" y1="${GY + 4}" x2="${BX}" y2="256" stroke="#94a3b8" stroke-width="0.8"/>`,
    `<line x1="${BX + BW}" y1="${GY + 4}" x2="${BX + BW}" y2="256" stroke="#94a3b8" stroke-width="0.8"/>`,
    label(230, 272, 'L=2 m', '#334155'),
    '</svg>',
  ].join('')

  assert(AY + AH === BY, '#561 A 底边应与 B 上表面重合')
  assert(BY + BH === GY, '#561 B 底边应坐地面')
  assert(AX >= BX && AX + AW <= BX + BW, '#561 A 应在 B 范围内')
  // F 箭头：尖端 x=AX-2 > 尾部 x=46（向右），尖端贴 A 左侧面
  assert(svg.includes(`points="${AX - 2}.0,${FY}.0 `), '#561 F 箭头尖应贴 A 左侧面')
  assert(svg.includes('>A<') && svg.includes('>B<') && svg.includes('>F<') && svg.includes('>L=2 m<'), '#561 A/B/F/L 标注缺失')
  // 防答案泄露：不出现 0.82 / √6 / m/s / 5 N 等结果
  assert(!/0\.82|√|sqrt|\\dfrac|m\/s|5\s*N/.test(svg), '#561 图中出现疑似答案数值')
  assert(!svg.includes('NaN') && !svg.includes('undefined'), '#561 渲染含 NaN/undefined')
  return svg
}

// ============================================================
// 同判例全库扫描追加：#671（计算）——与 #561 同一错误模板（F 画成朝左 + A、B 画成单块直接坐地面缺木板），
// 且题干明言「B 足够长，A 始终在 B 上」。重画：地面+B 长板+A 坐 B 左端+F 向右指 A（无 L 尺寸线，题干未给板长）
// ============================================================
function buildFig671() {
  const GY = 220, BX = 100, BW = 260, BH = 34
  const BY = GY - BH
  const AX = 110, AW = 60, AH = 38
  const AY = BY - AH
  const FY = AY + AH / 2
  const hatch = []
  for (let x = 44; x <= 426; x += 38) hatch.push(`<line x1="${x}" y1="${GY + 10}" x2="${x + 12}" y2="${GY}" stroke="#94a3b8" stroke-width="1.5"/>`)
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 260" width="460" height="260" style="max-width:100%;height:auto">',
    '<rect x="0" y="0" width="460" height="260" fill="none"/>',
    `<line x1="30" y1="${GY}" x2="430" y2="${GY}" stroke="#334155" stroke-width="2"/>`,
    ...hatch,
    `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="2" fill="#fef3c7" stroke="#334155" stroke-width="2"/>`,
    label(BX + BW / 2, BY + 23, 'B', '#334155', 'middle', 15, 'bold'),
    `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="4" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>`,
    label(AX + AW / 2, AY + 24, 'A', '#334155', 'middle', 15, 'bold'),
    arrow(46, FY, AX - 2, FY, '#ef4444', 3),
    label(70, FY - 14, 'F', '#ef4444', 'middle', 15, 'bold', 'italic'),
    '</svg>',
  ].join('')

  assert(AY + AH === BY && BY + BH === GY, '#671 A 应坐 B 上、B 应坐地面')
  assert(svg.includes(`points="${AX - 2}.0,${FY}.0 `), '#671 F 箭头尖应贴 A 左侧面且朝右')
  assert(svg.includes('>A<') && svg.includes('>B<') && svg.includes('>F<'), '#671 A/B/F 标注缺失')
  assert(!svg.includes('A、B'), '#671 旧图「A、B」单块残留')
  assert(!/0\.82|√|sqrt|\\dfrac|m\/s|5\s*N|L=/.test(svg), '#671 图中出现疑似答案数值/多余 L 标注')
  assert(!svg.includes('NaN') && !svg.includes('undefined'), '#671 渲染含 NaN/undefined')
  return svg
}

// ============================================================
// P1-114 · #512 图内去泄露：「电源 1.5」→「电源」、「r=1Ω」→「r」
// ============================================================
function buildFig512() {
  assert(q512.figure, '#512 预期已有电路图配图')
  const old = JSON.parse(q512.figure)
  assert(old.kind === 'svg', '#512 配图应为 svg')
  let data = old.data
  // 幂等：已改为符号标注则原样返回
  if (data.includes('>电源<') && !data.includes('>电源 1.5<') && !data.includes('>r=1Ω<')) return data
  assert(cnt(data, '>电源 1.5<') === 1, '#512 「电源 1.5」锚点数量不对')
  assert(cnt(data, '>r=1Ω<') === 1, '#512 「r=1Ω」锚点数量不对')
  data = data.split('>电源 1.5<').join('>电源<').split('>r=1Ω<').join('>r<')
  assert(cnt(data, '>电源<') === 1 && cnt(data, '>r<') === 1, '#512 符号标注替换后数量不对')
  assert(!data.includes('1.5') && !data.includes('1Ω'), '#512 图内仍残留答案数值（1.5 / 1Ω）')
  assert(data.includes('>10<'), '#512 变阻器「10」标注应保留（非答案量）')
  assert(!data.includes('NaN') && !data.includes('undefined'), '#512 渲染含 NaN/undefined')
  return data
}

// ============================================================
// 同判例全库扫描追加：#755（计算）/#860（实验）——与 #512 同一电路图模板，
// 图内「电源 1.5」+「r=…Ω」恰为待求答案（题干未给 E/r，须由数据求出），同 #230/#512 判例泄露
// ============================================================
function buildCircuitLeakFix(id, getQ, rOld) {
  const q = getQ
  assert(q.figure, `#${id} 预期已有电路图配图`)
  const old = JSON.parse(q.figure)
  assert(old.kind === 'svg', `#${id} 配图应为 svg`)
  let data = old.data
  if (data.includes('>电源<') && !data.includes('>电源 1.5<') && !data.includes(rOld)) return data // 幂等
  assert(cnt(data, '>电源 1.5<') === 1, `#${id} 「电源 1.5」锚点数量不对`)
  assert(cnt(data, rOld) === 1, `#${id} 「${rOld}」锚点数量不对`)
  data = data.split('>电源 1.5<').join('>电源<').split(rOld).join('>r<')
  assert(!data.includes('1.5') && !data.includes(rOld), `#${id} 图内仍残留答案数值`)
  assert(!data.includes('NaN') && !data.includes('undefined'), `#${id} 渲染含 NaN/undefined`)
  return data
}

// ============================================================
// P2-115 · #513 补图：平行薄膜垂直入射干涉
// ============================================================
function buildFig513() {
  // 幂等：已补图则原样返回
  if (q513.figure && JSON.parse(q513.figure).data.includes('薄膜（折射率 n）')) return JSON.parse(q513.figure).data
  const TOPY = 150, BOTY = 230          // 薄膜上/下表面（平行水平线）
  const FX = 150, FW = 200              // 薄膜横向范围 150~350
  const IX = 230                        // 入射光竖直路径 x
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 290" width="480" height="290" style="max-width:100%;height:auto">',
    '<rect x="0" y="0" width="480" height="290" fill="none"/>',
    // 薄膜（上下表面平行的均匀厚膜）+ 空气
    `<rect x="${FX}" y="${TOPY}" width="${FW}" height="${BOTY - TOPY}" fill="#bfdbfe" fill-opacity="0.75"/>`,
    `<line x1="${FX}" y1="${TOPY}" x2="${FX + FW}" y2="${TOPY}" stroke="#334155" stroke-width="2.5"/>`,
    `<line x1="${FX}" y1="${BOTY}" x2="${FX + FW}" y2="${BOTY}" stroke="#334155" stroke-width="2.5"/>`,
    label(272, 196, '薄膜（折射率 n）', '#1e40af', 'start', 13),
    label(70, 120, '空气', '#475569', 'middle', 13),
    label(392, 268, '空气', '#475569', 'middle', 13),
    // 入射单色光 λ：竖直向下垂直照射上表面
    arrow(IX, 42, IX, TOPY - 6, '#f59e0b', 2.6),
    label(120, 52, '单色光 λ', '#b45309', 'middle', 13),
    label(120, 70, '垂直照射', '#b45309', 'middle', 12),
    // 反射光①：在上表面反射（略作偏移画出，避免与入射光重叠）
    arrow(IX - 4, TOPY - 4, 176, 46, '#ef4444', 2.4),
    label(166, 40, '①', '#ef4444', 'middle', 13, 'bold'),
    // 膜内透射光：继续向下到达下表面
    arrow(IX, TOPY + 4, IX, BOTY - 4, '#94a3b8', 2),
    // 反射光②：在下表面反射后向上穿出（略作偏移画出）
    arrow(IX + 4, BOTY - 4, 262, 46, '#ef4444', 2.4),
    label(274, 40, '②', '#ef4444', 'middle', 13, 'bold'),
    // 膜厚 d 尺寸线（题干已知量）
    `<line x1="382" y1="${TOPY}" x2="382" y2="${BOTY}" stroke="#64748b" stroke-width="1.2"/>`,
    `<polygon points="382,${TOPY} 378.5,${TOPY + 8} 385.5,${TOPY + 8}" fill="#64748b"/>`,
    `<polygon points="382,${BOTY} 378.5,${BOTY - 8} 385.5,${BOTY - 8}" fill="#64748b"/>`,
    `<line x1="${FX + FW}" y1="${TOPY}" x2="386" y2="${TOPY}" stroke="#94a3b8" stroke-width="0.8"/>`,
    `<line x1="${FX + FW}" y1="${BOTY}" x2="386" y2="${BOTY}" stroke="#94a3b8" stroke-width="0.8"/>`,
    label(400, 194, 'd', '#334155', 'middle', 14, 'bold', 'italic'),
    '</svg>',
  ].join('')

  assert(!q513.figure, '#513 预期原无配图')
  // 上下表面平行：两条水平线等长、y 各为 TOPY/BOTY
  assert(cnt(svg, `x2="${FX + FW}" y2="${TOPY}"`) === 1 && cnt(svg, `x2="${FX + FW}" y2="${BOTY}"`) === 1, '#513 上下表面平行线缺失')
  // 入射光竖直向下（tip 固定在 (IX, TOPY-6)，x 不变即竖直）
  assert(svg.includes(`points="${IX}.0,${TOPY - 6}.0 `), '#513 入射光应为竖直向下箭头')
  assert(svg.includes('①') && svg.includes('②'), '#513 两束反射光 ①② 标注缺失')
  assert(svg.includes('折射率 n') && svg.includes('λ') && svg.includes('>d<'), '#513 n/λ/d 标注缺失')
  assert(svg.includes('空气'), '#513 空气标注缺失')
  // 防答案泄露：不出现 2nd / λ/2 / kλ / 相长 等结论
  assert(!/2nd|λ\/2|\\dfrac|k=|相长/.test(svg), '#513 图中出现疑似答案表达式')
  assert(!svg.includes('NaN') && !svg.includes('undefined'), '#513 渲染含 NaN/undefined')
  return svg
}

// ============================================================
// P2-112 · #385 补图：3N/4N 垂直共点力合成 + kp 清理
// ============================================================
function buildFig385() {
  // 幂等：已补图则原样返回
  if (q385.figure && JSON.parse(q385.figure).data.includes('>F₁=3 N<')) return JSON.parse(q385.figure).data
  const OX = 90, OY = 280               // 作用点 O
  const S = 60                          // 比例尺 60 px/N
  const F1X = OX + 3 * S                // F₁(3N) 水平向右 → tip (270,280)
  const F2Y = OY - 4 * S                // F₂(4N) 竖直向上 → tip (90,40)
  const th = Math.atan2(4, 3)           // F 与 F₁ 夹角（53.13°）
  // 合力 F 标注：对角线中点沿法线外移
  const mx = (OX + F1X) / 2, my = (OY + F2Y) / 2
  const len = Math.hypot(F1X - OX, F2Y - OY)
  const nx = -(F2Y - OY) / len, ny = (F1X - OX) / len
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 340" width="400" height="340" style="max-width:100%;height:auto">',
    '<rect x="0" y="0" width="400" height="340" fill="none"/>',
    // 平行四边形（矩形）辅助虚线
    `<line x1="${F1X}" y1="${OY}" x2="${F1X}" y2="${F2Y}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>`,
    `<line x1="${OX}" y1="${F2Y}" x2="${F1X}" y2="${F2Y}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>`,
    // F₁（水平向右）/ F₂（竖直向上）
    arrow(OX, OY, F1X, OY, '#2563eb', 2.8),
    arrow(OX, OY, OX, F2Y, '#059669', 2.8),
    label((OX + F1X) / 2, OY + 22, 'F₁=3 N', '#1d4ed8', 'middle', 13, 'bold'),
    label(OX - 12, (OY + F2Y) / 2, 'F₂=4 N', '#047857', 'end', 13, 'bold'),
    // 合力 F：矩形对角线（红色实线）
    arrow(OX, OY, F1X, F2Y, '#ef4444', 3),
    label(mx + nx * 20 - 12, my + ny * 20, 'F', '#ef4444', 'middle', 15, 'bold', 'italic'),
    // 直角标记（F₁⊥F₂）
    `<polyline points="${OX},${OY - 12} ${OX + 12},${OY - 12} ${OX + 12},${OY}" fill="none" stroke="#475569" stroke-width="1.2"/>`,
    // θ 角弧：合力 F 与 F₁ 之间
    `<path d="M ${OX + 34} ${OY} A 34 34 0 0 0 ${(OX + 34 * Math.cos(th)).toFixed(1)} ${(OY - 34 * Math.sin(th)).toFixed(1)}" fill="none" stroke="#475569" stroke-width="1.3"/>`,
    label(OX + 48 * Math.cos(th / 2), OY - 48 * Math.sin(th / 2) + 5, 'θ', '#475569', 'middle', 14, 'normal', 'italic'),
    // 作用点 O
    `<circle cx="${OX}" cy="${OY}" r="3.5" fill="#334155"/>`,
    label(OX - 14, OY + 18, 'O', '#334155', 'middle', 14, 'bold', 'italic'),
    '</svg>',
  ].join('')

  assert(!q385.figure, '#385 预期原无配图')
  // 比例尺自洽：F₁=3N→180px，F₂=4N→240px，合力箭头尖到矩形对角顶点 (270,40)
  assert(F1X === OX + 180 && F2Y === OY - 240, '#385 比例尺应 60px/N')
  assert(svg.includes(`points="${F1X}.0,${F2Y}.0 `), '#385 合力箭头尖应到矩形对角顶点')
  assert(svg.includes('>F₁=3 N<') && svg.includes('>F₂=4 N<'), '#385 F₁/F₂ 标注缺失（题干已知量）')
  assert(svg.includes('>θ<') && svg.includes('>F<') && svg.includes('>O<'), '#385 θ/F/O 标注缺失')
  assert(svg.includes('stroke-dasharray'), '#385 平行四边形辅助虚线缺失')
  // 防答案泄露：不出现 5 N / 4/3 / tan
  assert(!/5\s*N|4\/3|\\dfrac|tan/.test(svg), '#385 图中出现疑似答案数值（5 或 4/3）')
  assert(!svg.includes('NaN') && !svg.includes('undefined'), '#385 渲染含 NaN/undefined')
  return svg
}

// ============================================================
// 锚点断言（对原数据；已修复的题跳过「旧状态」锚点）
// ============================================================
const fig561 = buildFig561()
const fig512 = buildFig512()
const fig513 = buildFig513()
const fig385 = buildFig385()
const fig755 = buildCircuitLeakFix(755, q755, '>r=0.5Ω<')
const fig860 = buildCircuitLeakFix(860, q860, '>r=1Ω<')
const fig671 = buildFig671()

const done561 = q561.figure && JSON.parse(q561.figure).data.includes('fef3c7')
const done512 = q512.figure && JSON.parse(q512.figure).data.includes('>电源<') && !JSON.parse(q512.figure).data.includes('>电源 1.5<')
const done513 = q513.figure && JSON.parse(q513.figure).data.includes('薄膜（折射率 n）')
const done385 = q385.figure && JSON.parse(q385.figure).data.includes('>F₁=3 N<')
const done755 = q755.figure && JSON.parse(q755.figure).data.includes('>电源<') && !JSON.parse(q755.figure).data.includes('>电源 1.5<')
const done860 = q860.figure && JSON.parse(q860.figure).data.includes('>电源<') && !JSON.parse(q860.figure).data.includes('>电源 1.5<')
const done671 = q671.figure && JSON.parse(q671.figure).data.includes('fef3c7')

// #561 锚点
assert(q561.qtype === '计算', '#561 题型应为「计算」')
assert(q561.figure, '#561 预期有旧配图')
if (!done561) {
  const old561 = JSON.parse(q561.figure)
  assert(old561.kind === 'svg' && old561.data.includes('99,150.05') && !old561.data.includes('>B<'), '#561 旧图锚点不匹配（非 F 朝左单物块图），中止')
}
assert(q561.stem.includes('水平向右的恒力') && q561.stem.includes('长木板B'), '#561 题干锚点缺失')
assert(q561.answer.includes('0.82'), '#561 答案 0.82 锚点缺失（修复不应波及）')
// #671 锚点（旧状态锚点在幂等轮跳过）
// #512 锚点
assert(q512.qtype === '实验', '#512 题型应为「实验」')
assert(q512.answer.includes('1.50') && q512.answer.includes('1.0'), '#512 答案锚点缺失')
// #513 锚点
assert(q513.qtype === '填空' && q513.stem.includes('薄膜') && q513.stem.includes('半波损失'), '#513 题干锚点缺失')
// #385 锚点：kp 必含待清理的「胡克定律（F=kx）」（幂等轮已清理则跳过）
const kp385 = JSON.parse(q385.knowledge_points)
if (!done385) assert(kp385.includes('胡克定律（F=kx）') && kp385.includes('力的合成'), '#385 kp 锚点不匹配，中止')
assert(q385.stem.includes('F_1=3') && q385.stem.includes('F_2=4'), '#385 题干锚点缺失')
const kp385New = JSON.stringify(kp385.filter((k) => k !== '胡克定律（F=kx）'))
// #755/#860 锚点：题干不得给 E/r（值须由数据求出，图内出现即泄露）；答案必须含图内泄露值（证明确系答案）
for (const [id, q, leak] of [[755, q755, ['1.5', '0.5']], [860, q860, ['1.5', '1.0']]]) {
  assert(!/E\s*=\s*[\d.]/.test(q.stem) && !/r\s*=\s*[\d.]/.test(q.stem), `#${id} 题干含 E/r 数值，不属泄露判例，中止`)
  for (const v of leak) assert(q.answer.includes(v), `#${id} 答案应含 ${v}（泄露锚点）`)
}

// 幂等保护：六题全部已生效则跳过写库
const idempotent = done561 && done512 && done513 && done385 && done755 && done860 && done671
if (!process.argv.includes('--force') && idempotent) {
  console.log('#561/#671/#512/#755/#860/#513/#385 均已修正，跳过写库（幂等）')
} else if (!DRY) {
  // ---------- 写库 + 回读（仅动 figure（#385 附带 kp）；stem/answer/solution/pitfall 全不动） ----------
  db.prepare('UPDATE questions SET figure=? WHERE id=561').run(JSON.stringify({ kind: 'svg', data: fig561 }))
  db.prepare('UPDATE questions SET figure=? WHERE id=512').run(JSON.stringify({ kind: 'svg', data: fig512 }))
  db.prepare('UPDATE questions SET figure=? WHERE id=513').run(JSON.stringify({ kind: 'svg', data: fig513 }))
  db.prepare('UPDATE questions SET figure=?, knowledge_points=? WHERE id=385').run(JSON.stringify({ kind: 'svg', data: fig385 }), kp385New)
  db.prepare('UPDATE questions SET figure=? WHERE id=755').run(JSON.stringify({ kind: 'svg', data: fig755 }))
  db.prepare('UPDATE questions SET figure=? WHERE id=860').run(JSON.stringify({ kind: 'svg', data: fig860 }))
  db.prepare('UPDATE questions SET figure=? WHERE id=671').run(JSON.stringify({ kind: 'svg', data: fig671 }))

  const back561 = get.get(561), back512 = get.get(512), back513 = get.get(513), back385 = get.get(385), back755 = get.get(755), back860 = get.get(860), back671 = get.get(671)
  for (const [tag, q0, b] of [['#561', q561, back561], ['#512', q512, back512], ['#513', q513, back513], ['#385', q385, back385], ['#755', q755, back755], ['#860', q860, back860], ['#671', q671, back671]]) {
    if (b.stem !== q0.stem || b.answer !== q0.answer || b.solution !== q0.solution || b.pitfall !== q0.pitfall)
      throw new Error(`${tag} stem/answer/solution/pitfall 不应变化`)
  }
  if (JSON.parse(back561.figure).data !== fig561) throw new Error('#561 配图回读不一致')
  if (JSON.parse(back512.figure).data !== fig512) throw new Error('#512 配图回读不一致')
  if (JSON.parse(back513.figure).data !== fig513) throw new Error('#513 配图回读不一致')
  if (JSON.parse(back385.figure).data !== fig385) throw new Error('#385 配图回读不一致')
  if (JSON.parse(back755.figure).data !== fig755) throw new Error('#755 配图回读不一致')
  if (JSON.parse(back860.figure).data !== fig860) throw new Error('#860 配图回读不一致')
  if (JSON.parse(back671.figure).data !== fig671) throw new Error('#671 配图回读不一致')
  const kpBack = JSON.parse(back385.knowledge_points)
  if (kpBack.length !== 1 || kpBack[0] !== '力的合成') throw new Error('#385 kp 回读不一致')
  console.log('#561/#671 图重画(地面+B板+A+F向右)；#512/#755/#860 图内 E/r 泄露改符号标注；#513 补平行薄膜干涉图；#385 补力合成矢量图+kp 清「胡克定律」——回读一致')
} else {
  console.log('六题断言全过（dry-run，未写库）')
}

// ============================================================
// P2-111 · 清理 data/backups/ 残留裸快照 app-pre-accept28.db(+ -shm/-wal)
// ============================================================
const backupDir = path.join(ROOT, 'data', 'backups')
const residue = fs.existsSync(backupDir)
  ? fs.readdirSync(backupDir).filter((f) => /^app-.*\.db(-shm|-wal)?$/.test(f) && !/^app-\d{8}-/.test(f))
  : []
if (!DRY) {
  for (const f of residue) {
    fs.rmSync(path.join(backupDir, f), { force: true })
    console.log(`[P2-111] 已删除残留快照: ${f}`)
  }
  const left = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter((f) => /^app-/.test(f)) : []
  if (left.length) throw new Error(`backups 目录仍有 app-* 残留: ${left.join(', ')}`)
  console.log('[P2-111] backups 目录 app-* 裸快照清零')
} else {
  console.log(`[P2-111] dry-run：将删除 ${residue.length} 件残留`)
}
