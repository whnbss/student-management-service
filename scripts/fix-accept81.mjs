// 一次性脚本：验收 #81 催办 P1-127 —— 无图存量题甄别后 22 题补图（题库质量维护，零物理改动）+ #377 图内标注规范（P3）。
//   甄别清单：docs/P1-127-无图题甄别清单.md（115 道无图题 → 应配图 22 + 豁免 93，逐题理由入库）。
//   应配图 22（均为空间/光路/装置情境）：选择 18（#268 #341 #416 #450 #501 #505 #633 #654 #690 #707 #715 #773 #823 #845 #846 #856 #878 #884）
//   + 填空 4（#342 #378 #379 #638）；#377 图内「h=20m」（题干未给的推导量）改标「h」。
//   约束（沿用 P1-118/P1-125/P1-126/P1-78 判例）：只改 figure 字段，stem/answer/solution/pitfall 零改动；
//   旧态断言（figure 原为空，防盲写）+ 内容一致幂等跳过 + 写库回读断言；新图禁 NaN/undefined、单 svg 根、
//   图内中文标签必须与题干共享字符（2b 口径自检）、图内数字必须可从题干溯源（零答案泄露）；
//   待判内容零泄露：#707 接触后电量与受力方向、#773 v_B 与 v_t/2 比较、#845 前后表面反射光路与条纹明暗、
//   #884 轨迹弯曲方向、#654 火箭反冲速度、#856 电流方向、#878 涡流与磁化机理、#501/#715 感应电荷与场强均不画。
// 用法：node scripts/fix-accept81.mjs [--dry-run] [--emit]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const EMIT = process.argv.includes('--emit') // 渲染预览：把新图输出 tmp/preview81.html 供目检，不写库
const db = new Database(path.join(ROOT, 'data', 'app.db'))
db.pragma('busy_timeout = 5000')

const get = db.prepare('SELECT id, stem, answer, solution, pitfall, figure FROM questions WHERE id=?')
const cnt = (s, sub) => s.split(sub).length - 1
const assert = (ok, msg) => {
  if (!ok) throw new Error(`断言失败：${msg}`)
}
const FONT = "font-family=\"system-ui,'Microsoft YaHei',sans-serif\""
const SVG_HEAD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240" style="max-width:100%;height:auto"><rect x="0" y="0" width="400" height="240" fill="none"/>'

// ---------- 绘图基元（与既有好图同一视觉语言：#334155 主线 / #ef4444 红 F / #2563eb 蓝 v / #64748b 辅助） ----------
const txt = (x, y, s, fill = '#334155', size = 13, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT}>${s}</text>`
const arrow = (x1, y1, x2, y2, color = '#ef4444', w = 2.5) => {
  const L = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L
  const bx = +(x2 - 9 * ux).toFixed(1), by = +(y2 - 9 * uy).toFixed(1)
  const px = +(-uy).toFixed(3), py = +ux.toFixed(3)
  return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/><polygon points="${x2},${y2} ${(bx + 4.05 * px).toFixed(2)},${(by + 4.05 * py).toFixed(2)} ${(bx - 4.05 * px).toFixed(2)},${(by - 4.05 * py).toFixed(2)}" fill="${color}"/>`
}
const dot = (cx, cy, color = '#334155') => `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}"/>`
const dimH = (x1, x2, y, label) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#64748b" stroke-width="1.2"/><line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}" stroke="#64748b" stroke-width="1.2"/>` +
  txt((x1 + x2) / 2, y + 18, label, '#64748b', 13)
const dimV = (y1, y2, x, label) =>
  `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#64748b" stroke-width="1.2"/><line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" stroke="#64748b" stroke-width="1.2"/><line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}" stroke="#64748b" stroke-width="1.2"/>` +
  txt(x + 12, (y1 + y2) / 2 + 4, label, '#64748b', 13, 'start')
const ground = (y) =>
  `<line x1="40" y1="${y}" x2="360" y2="${y}" stroke="#334155" stroke-width="2"/>` +
  [70, 130, 190, 250, 310].map((x) => `<line x1="${x}" y1="${y + 12}" x2="${x + 12}" y2="${y}" stroke="#94a3b8" stroke-width="1.5"/>`).join('')
const arcArrow = (cx, cy, r, a1, a2, color = '#334155') => {
  const P = (a) => [+(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1), +(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)]
  const [x1, y1] = P(a1), [x2, y2] = P(a2)
  const dx = -Math.sin((a2 * Math.PI) / 180), dy = Math.cos((a2 * Math.PI) / 180)
  const tip = [+(x2 + 9 * dx).toFixed(1), +(y2 + 9 * dy).toFixed(1)]
  const px = -dy, py = dx
  const b1 = [+(x2 + 4.05 * px).toFixed(1), +(y2 + 4.05 * py).toFixed(1)]
  const b2 = [+(x2 - 4.05 * px).toFixed(1), +(y2 - 4.05 * py).toFixed(1)]
  return `<path d="M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2"/><polygon points="${tip[0]},${tip[1]} ${b1[0]},${b1[1]} ${b2[0]},${b2[1]}" fill="${color}"/>`
}
// ---------- 本轮新增基元 ----------
// 简笔人（头+躯干+双腿），站在 y=feet 上
const person = (cx, feet, h = 62) => {
  const headR = 8, headCy = feet - h + headR
  const bodyTop = headCy + headR + 2, hipY = feet - h * 0.36
  return (
    `<circle cx="${cx}" cy="${headCy}" r="${headR}" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    `<line x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${hipY}" stroke="#334155" stroke-width="2.5"/>` +
    `<line x1="${cx}" y1="${hipY}" x2="${cx - 9}" y2="${feet}" stroke="#334155" stroke-width="2.5"/>` +
    `<line x1="${cx}" y1="${hipY}" x2="${cx + 9}" y2="${feet}" stroke="#334155" stroke-width="2.5"/>`
  )
}
// 车辆（矩形车身 + 两轮），底边贴 y=wheelY
const vehicle = (x, y, w, h, fill = '#cbd5e1') => {
  const wheelY = y + h + 8
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="${x + w * 0.25}" cy="${wheelY}" r="8" fill="#ffffff" stroke="#334155" stroke-width="2"/>` +
    `<circle cx="${x + w * 0.75}" cy="${wheelY}" r="8" fill="#ffffff" stroke="#334155" stroke-width="2"/>`
  )
}
// 接地符号（竖线 + 三短横），从 (x, yTop) 画到 (x, y0)
const groundSymbol = (x, yTop, y0) =>
  `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${y0}" stroke="#334155" stroke-width="2"/>` +
  [16, 10, 4].map((hw, i) => `<line x1="${x - hw}" y1="${y0 + i * 5}" x2="${x + hw}" y2="${y0 + i * 5}" stroke="#334155" stroke-width="2"/>`).join('')
// 支架（竖线 + 底座 + 斜撑线）
const stand = (x, yTop, yBot) =>
  `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" stroke="#334155" stroke-width="2"/>` +
  `<line x1="${x - 18}" y1="${yBot}" x2="${x + 18}" y2="${yBot}" stroke="#334155" stroke-width="2"/>` +
  `<line x1="${x - 14}" y1="${yBot + 8}" x2="${x - 4}" y2="${yBot}" stroke="#94a3b8" stroke-width="1.5"/>` +
  `<line x1="${x + 4}" y1="${yBot}" x2="${x + 14}" y2="${yBot + 8}" stroke="#94a3b8" stroke-width="1.5"/>`

// ================= 逐题新图 =================
// #268：电梯箱体+同学+地板+竖直向上 v（各阶段超失重判断不画）
const FIG_268 =
  SVG_HEAD +
  `<rect x="140" y="46" width="120" height="156" fill="#fde68a" stroke="#334155" stroke-width="2.5"/>` +
  `<line x1="140" y1="184" x2="260" y2="184" stroke="#334155" stroke-width="2"/>` +
  `<line x1="200" y1="30" x2="200" y2="46" stroke="#64748b" stroke-width="2"/>` +
  person(196, 182, 60) +
  txt(200, 222, '电梯', '#334155', 13) +
  txt(172, 128, '同学', '#334155', 12, 'end') +
  arrow(252, 178, 252, 88) + txt(266, 136, 'v', '#ef4444', 14, 'start') +
  '</svg>'

// #823：电梯+体重秤+同学（同上，加体重秤；各阶段超失重与示数比较不画）
const FIG_823 =
  SVG_HEAD +
  `<rect x="140" y="42" width="120" height="160" fill="#fde68a" stroke="#334155" stroke-width="2.5"/>` +
  `<line x1="140" y1="186" x2="260" y2="186" stroke="#334155" stroke-width="2"/>` +
  `<rect x="178" y="176" width="40" height="10" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
  person(198, 174, 56) +
  txt(200, 224, '电梯', '#334155', 13) +
  `<line x1="218" y1="181" x2="264" y2="192" stroke="#94a3b8" stroke-width="1.2"/>` +
  txt(270, 196, '体重秤', '#334155', 12, 'start') +
  arrow(254, 178, 254, 86) + txt(268, 134, 'v', '#ef4444', 14, 'start') +
  '</svg>'

// #341：导线(L、S)→拉长箭头→细长导线(2L)
const FIG_341 =
  SVG_HEAD +
  `<rect x="48" y="104" width="120" height="30" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  txt(62, 96, 'S', '#334155', 13) + dimH(48, 168, 156, 'L') +
  arrow(188, 119, 228, 119) + txt(208, 104, '拉长', '#ef4444', 12) +
  `<rect x="242" y="113" width="128" height="12" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  dimH(242, 370, 152, '2L') +
  '</svg>'

// #342：同族（电阻丝拉长 2 倍），布局错位防同指纹
const FIG_342 =
  SVG_HEAD +
  `<rect x="52" y="66" width="110" height="26" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  txt(66, 58, 'S', '#334155', 13) + dimH(52, 162, 114, 'L') +
  arrow(178, 79, 216, 79) + txt(197, 64, '拉长', '#ef4444', 12) +
  `<rect x="230" y="75" width="140" height="8" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  dimH(230, 370, 106, '2L') +
  txt(210, 180, '电阻丝', '#334155', 12) +
  '</svg>'

// #416：火车 v₀=30m/s 驶近观察者，f₀=500Hz（听到频率不标）
const FIG_416 =
  SVG_HEAD +
  ground(188) +
  vehicle(66, 112, 112, 52, '#cbd5e1') +
  `<rect x="80" y="122" width="22" height="16" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
  txt(122, 104, 'f₀=500 Hz', '#334155', 12) +
  txt(122, 196, '火车', '#334155', 12) +
  arrow(186, 138, 234, 138) + txt(210, 126, 'v₀=30 m/s', '#ef4444', 12) +
  person(310, 186, 56) +
  txt(310, 212, '观察者', '#334155', 12) +
  '</svg>'

// #505：观察者在左，救护车驶离（v 向右远离），f₀=680Hz
const FIG_505 =
  SVG_HEAD +
  ground(188) +
  person(86, 186, 56) +
  txt(86, 212, '观察者', '#334155', 12) +
  vehicle(232, 112, 116, 52, '#fde68a') +
  `<rect x="246" y="122" width="22" height="16" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
  txt(290, 104, 'f₀=680 Hz', '#334155', 12) +
  txt(290, 196, '救护车', '#334155', 12) +
  arrow(238, 84, 288, 84) + txt(263, 72, 'v=20 m/s', '#ef4444', 12) +
  '</svg>'

// #690：救护车驶向观察者（v 向右朝向观察者），f₀=680Hz
const FIG_690 =
  SVG_HEAD +
  ground(188) +
  vehicle(64, 112, 116, 52, '#fde68a') +
  `<rect x="78" y="122" width="22" height="16" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
  txt(122, 104, 'f₀=680 Hz', '#334155', 12) +
  txt(122, 196, '救护车', '#334155', 12) +
  arrow(186, 138, 234, 138) + txt(210, 126, 'v=20 m/s', '#ef4444', 12) +
  person(312, 186, 56) +
  txt(312, 212, '观察者', '#334155', 12) +
  '</svg>'

// #450：椭圆跑道+A 点+沿道跑动箭头（位移/平均速度结论不画）
const FIG_450 =
  SVG_HEAD +
  `<ellipse cx="200" cy="122" rx="138" ry="72" fill="none" stroke="#334155" stroke-width="2.5"/>` +
  `<ellipse cx="200" cy="122" rx="106" ry="46" fill="none" stroke="#94a3b8" stroke-width="1.2"/>` +
  dot(338, 122, '#334155') + txt(352, 128, 'A', '#334155', 14, 'start') +
  arcArrow(200, 122, 59, -85, -35, '#ef4444') +
  txt(200, 226, '400m 跑道', '#334155', 13) +
  '</svg>'

// #501：带电金属球壳+壳内验电器+接地导线（感应电荷分布/张角变化/电流方向不画）
const FIG_501 =
  SVG_HEAD +
  `<circle cx="150" cy="112" r="56" fill="#ffffff" stroke="#334155" stroke-width="3"/>` +
  dot(150, 96) +
  `<line x1="150" y1="100" x2="150" y2="132" stroke="#334155" stroke-width="2"/>` +
  `<line x1="150" y1="132" x2="141" y2="148" stroke="#334155" stroke-width="2"/>` +
  `<line x1="150" y1="132" x2="159" y2="148" stroke="#334155" stroke-width="2"/>` +
  txt(118, 122, '验电器', '#334155', 12, 'end') +
  `<line x1="122" y1="118" x2="140" y2="116" stroke="#94a3b8" stroke-width="1.2"/>` +
  txt(150, 34, '金属球壳', '#334155', 13) +
  groundSymbol(206, 112, 190) +
  txt(224, 208, '接地', '#334155', 12, 'start') +
  '</svg>'

// #715：空心球壳（顶部小孔）+带电小球自孔外缓慢移近（感应电荷/场强分布不画）
const FIG_715 =
  SVG_HEAD +
  `<circle cx="160" cy="142" r="60" fill="none" stroke="#334155" stroke-width="2.5"/>` +
  `<circle cx="160" cy="142" r="46" fill="none" stroke="#334155" stroke-width="2"/>` +
  `<rect x="153" y="78" width="14" height="16" fill="#ffffff"/>` +
  txt(160, 62, '小孔', '#334155', 12) +
  stand(160, 202, 218) +
  txt(160, 234, '绝缘支架', '#334155', 11) +
  `<circle cx="300" cy="86" r="10" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(300, 66, '带电小球', '#334155', 12) +
  arrow(288, 100, 258, 122) + txt(296, 128, '缓慢移近', '#ef4444', 12, 'start') +
  '</svg>'

// #633：门口→书店(东80m)→折行向西120m→邮局（不共轴，位移不作图防泄露）
const FIG_633 =
  SVG_HEAD +
  dot(70, 84) + txt(70, 108, '学校门口', '#334155', 12) +
  dot(250, 84) + txt(272, 76, '书店', '#334155', 12, 'start') +
  arrow(78, 84, 240, 84) + dimH(70, 250, 46, '80m') +
  arrow(300, 84, 342, 84, '#334155', 1.8) + txt(322, 70, '东', '#334155', 13) +
  `<line x1="250" y1="92" x2="250" y2="158" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  arrow(242, 158, 70, 158) +
  dot(70, 158) + txt(70, 146, '邮局', '#334155', 12) +
  dimH(70, 250, 184, '120m') +
  '</svg>'

// #638：xOy 坐标系+门口→书店(东300m)→邮局(北400m)+位移虚线（500/方向不标）
const FIG_638 =
  SVG_HEAD +
  arrow(80, 200, 366, 200, '#334155', 1.8) + txt(360, 218, 'x', '#334155', 13) +
  arrow(80, 200, 80, 54, '#334155', 1.8) + txt(64, 60, 'y', '#334155', 13) +
  txt(70, 216, 'O', '#334155', 12) +
  txt(342, 190, '东', '#334155', 12) + txt(94, 70, '北', '#334155', 12, 'start') +
  `<line x1="80" y1="200" x2="230" y2="200" stroke="#334155" stroke-width="2"/>` +
  `<line x1="230" y1="200" x2="230" y2="84" stroke="#334155" stroke-width="2"/>` +
  `<line x1="80" y1="200" x2="230" y2="84" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 4"/>` +
  txt(70, 190, '学校门口', '#334155', 11, 'end') +
  dot(230, 200) + txt(220, 190, '书店', '#334155', 12, 'end') +
  dot(230, 84) + txt(242, 88, '邮局', '#334155', 12, 'start') +
  dimH(80, 230, 220, '300m') +
  dimV(84, 200, 262, '400m') +
  '</svg>'

// #654：光滑水平面上的玩具火箭+竖直向下喷燃气 v₁=20m/s（火箭反冲速度不画）
const FIG_654 =
  SVG_HEAD +
  ground(222) +
  `<rect x="182" y="64" width="36" height="96" rx="9" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  `<polygon points="182,64 218,64 200,42" fill="#fde68a" stroke="#334155" stroke-width="2"/>` +
  `<line x1="182" y1="160" x2="162" y2="220" stroke="#334155" stroke-width="2"/>` +
  `<line x1="218" y1="160" x2="238" y2="220" stroke="#334155" stroke-width="2"/>` +
  arrow(200, 168, 200, 214) +
  txt(190, 198, '燃气 v₁=20 m/s', '#ef4444', 12, 'end') +
  txt(142, 100, '玩具火箭', '#334155', 12, 'end') +
  txt(330, 210, '光滑水平面', '#334155', 11, 'start') +
  '</svg>'

// #707：甲乙两金属球+绝缘柄+相距 r（接触后电量与受力方向不画）
const FIG_707 =
  SVG_HEAD +
  `<circle cx="110" cy="108" r="20" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(110, 113, '甲', '#334155', 13) +
  `<circle cx="290" cy="108" r="20" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(290, 113, '乙', '#334155', 13) +
  stand(110, 128, 176) + stand(290, 128, 176) +
  txt(84, 196, '绝缘柄', '#334155', 12) +
  dimH(132, 268, 62, 'r') +
  '</svg>'

// #773：匀加速直线 A/B/C（B 为中点）+v_A/v_C 箭头（v_B 与 v_t/2 比较不画）
const FIG_773 =
  SVG_HEAD +
  `<line x1="56" y1="150" x2="352" y2="150" stroke="#334155" stroke-width="2"/>` +
  dot(90, 150) + txt(90, 174, 'A', '#334155', 14) +
  dot(200, 150) + txt(200, 174, 'B', '#334155', 14) +
  dot(310, 150) + txt(310, 174, 'C', '#334155', 14) +
  `<line x1="196" y1="186" x2="204" y2="186" stroke="#64748b" stroke-width="1.5"/>` +
  txt(200, 206, '中点', '#334155', 12) +
  arrow(66, 116, 98, 116, '#2563eb') + txt(80, 104, 'v_A', '#2563eb', 12) +
  arrow(276, 116, 340, 116, '#2563eb') + txt(308, 104, 'v_C', '#2563eb', 12) +
  '</svg>'

// #845：竖直楔形肥皂膜+前/后表面+垂直入射单色光（反射光路与条纹明暗不画，防泄答案）
const FIG_845 =
  SVG_HEAD +
  `<polygon points="192,48 204,48 216,200 192,200" fill="#dbeafe" fill-opacity="0.55" stroke="none"/>` +
  `<line x1="192" y1="48" x2="192" y2="200" stroke="#334155" stroke-width="2"/>` +
  `<line x1="204" y1="48" x2="216" y2="200" stroke="#334155" stroke-width="2"/>` +
  `<line x1="192" y1="48" x2="204" y2="48" stroke="#334155" stroke-width="2"/>` +
  `<line x1="192" y1="200" x2="216" y2="200" stroke="#334155" stroke-width="2"/>` +
  txt(240, 128, '肥皂膜', '#334155', 12, 'start') +
  txt(184, 124, '前表面', '#334155', 11, 'end') +
  txt(226, 76, '后表面', '#334155', 11, 'start') +
  arrow(92, 92, 182, 92, '#2563eb') + arrow(92, 152, 182, 152, '#2563eb') +
  txt(120, 78, '单色光', '#2563eb', 12) +
  '</svg>'

// #846：双面板——单缝衍射（中央亮纹带）+ 圆孔衍射（同心圆环），现象均为题干已述复述
const FIG_846 =
  SVG_HEAD +
  arrow(36, 102, 76, 102, '#2563eb', 2) + arrow(36, 128, 76, 128, '#2563eb', 2) +
  `<line x1="90" y1="58" x2="90" y2="104" stroke="#334155" stroke-width="4"/>` +
  `<line x1="90" y1="126" x2="90" y2="192" stroke="#334155" stroke-width="4"/>` +
  txt(90, 48, '单缝', '#334155', 12) +
  `<line x1="172" y1="58" x2="172" y2="192" stroke="#334155" stroke-width="3"/>` +
  txt(180, 70, '光屏', '#334155', 12, 'start') +
  `<rect x="167" y="82" width="10" height="12" fill="#cbd5e1"/>` +
  `<rect x="166" y="100" width="12" height="50" fill="#fbbf24"/>` +
  `<rect x="167" y="156" width="10" height="12" fill="#cbd5e1"/>` +
  txt(116, 216, '中央亮纹', '#334155', 11) +
  arrow(212, 102, 252, 102, '#2563eb', 2) + arrow(212, 128, 252, 128, '#2563eb', 2) +
  `<line x1="268" y1="58" x2="268" y2="116" stroke="#334155" stroke-width="4"/>` +
  `<line x1="268" y1="134" x2="268" y2="192" stroke="#334155" stroke-width="4"/>` +
  txt(268, 48, '圆孔', '#334155', 12) +
  `<line x1="352" y1="58" x2="352" y2="192" stroke="#334155" stroke-width="3"/>` +
  txt(360, 70, '光屏', '#334155', 12, 'start') +
  `<circle cx="352" cy="122" r="24" fill="none" stroke="#94a3b8" stroke-width="1.5"/>` +
  `<circle cx="352" cy="122" r="13" fill="none" stroke="#94a3b8" stroke-width="1.5"/>` +
  dot(352, 122, '#f59e0b') +
  txt(352, 216, '同心圆环', '#334155', 11) +
  '</svg>'

// #856：导线纵剖+横截面 S 虚线+自由电子+定向移动速率 v（电流方向不画，防泄选项 A 辨析）
const FIG_856 =
  SVG_HEAD +
  `<rect x="56" y="100" width="284" height="46" fill="#f1f5f9" stroke="#334155" stroke-width="2"/>` +
  `<line x1="152" y1="92" x2="152" y2="154" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4"/>` +
  txt(152, 84, 'S', '#334155', 13) +
  dot(102, 116) + dot(128, 132) + dot(206, 114) + dot(262, 132) + dot(308, 114) +
  `<line x1="102" y1="96" x2="102" y2="110" stroke="#94a3b8" stroke-width="1.2"/>` +
  txt(102, 90, '自由电子', '#334155', 11) +
  arrow(172, 134, 238, 134) + txt(205, 124, 'v', '#ef4444', 13) +
  txt(340, 92, '导线', '#334155', 12, 'end') +
  '</svg>'

// #878：双面板——电磁炉+铁锅+塑料勺；蹄形磁铁两极间悬吊金属圆盘（涡流/磁化机理不画）
const FIG_878 =
  SVG_HEAD +
  `<rect x="40" y="152" width="130" height="24" rx="4" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 64 152 A 31 31 0 0 1 126 152" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  txt(95, 106, '铁锅', '#334155', 12) +
  `<ellipse cx="148" cy="148" rx="11" ry="4" fill="#ffffff" stroke="#334155" stroke-width="1.5"/>` +
  `<line x1="157" y1="146" x2="172" y2="138" stroke="#334155" stroke-width="1.5"/>` +
  txt(152, 128, '塑料勺', '#334155', 11) +
  txt(105, 198, '电磁炉', '#334155', 12) +
  `<rect x="248" y="62" width="22" height="96" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  `<rect x="330" y="62" width="22" height="96" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>` +
  `<path d="M 249 156 Q 300 206 351 156" fill="none" stroke="#cbd5e1" stroke-width="18"/>` +
  `<path d="M 249 166 Q 300 216 351 166" fill="none" stroke="#334155" stroke-width="2"/>` +
  txt(238, 92, '蹄形磁铁', '#334155', 12, 'end') +
  `<line x1="300" y1="26" x2="300" y2="80" stroke="#64748b" stroke-width="1.5"/>` +
  txt(310, 40, '悬线', '#334155', 11, 'start') +
  `<circle cx="300" cy="108" r="28" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>` +
  txt(266, 130, '金属圆盘', '#334155', 12, 'end') +
  '</svg>'

// #884：光滑水平面+物块+v 向右（题干给定）+F 竖直向下（题干给定）；轨迹弯曲方向不画
const FIG_884 =
  SVG_HEAD +
  ground(162) +
  `<rect x="180" y="122" width="42" height="40" fill="#c7d2fe" stroke="#334155" stroke-width="2"/>` +
  txt(201, 146, '物体', '#334155', 11) +
  arrow(228, 142, 274, 142, '#2563eb') + txt(251, 130, 'v', '#2563eb', 13) +
  arrow(201, 164, 201, 208) + txt(215, 192, 'F', '#ef4444', 13, 'start') +
  txt(56, 232, '光滑水平面', '#334155', 12, 'start') +
  '</svg>'

// #378：匀加速直线 A/B/C 三点+AB=6m、BC=10m 尺寸+运动方向箭头
const FIG_378 =
  SVG_HEAD +
  ground(168) +
  dot(100, 168) + txt(100, 192, 'A', '#334155', 14) +
  dot(190, 168) + txt(190, 192, 'B', '#334155', 14) +
  dot(300, 168) + txt(300, 192, 'C', '#334155', 14) +
  dimH(100, 190, 96, '6m') + dimH(190, 300, 96, '10m') +
  arrow(110, 140, 158, 140) +
  '</svg>'

// #379：连续相等时间间隔三段位移 x₁/x₂/x₃+T 括线（数值不标，题干纸带式数据）
const FIG_379 =
  SVG_HEAD +
  `<line x1="56" y1="150" x2="356" y2="150" stroke="#334155" stroke-width="2"/>` +
  dot(80, 150) + dot(170, 150) + dot(260, 150) + dot(350, 150) +
  dimH(80, 170, 168, 'x₁') + dimH(170, 260, 168, 'x₂') + dimH(260, 350, 168, 'x₃') +
  `<line x1="80" y1="106" x2="170" y2="106" stroke="#64748b" stroke-width="1.2"/>` +
  `<line x1="80" y1="100" x2="80" y2="112" stroke="#64748b" stroke-width="1.2"/>` +
  `<line x1="170" y1="100" x2="170" y2="112" stroke="#64748b" stroke-width="1.2"/>` +
  txt(125, 96, 'T', '#64748b', 13) +
  '</svg>'

// ================= 替换执行 =================
const FIGS = [
  [268, FIG_268, '电梯+同学+地板+竖直向上 v（超失重判断不画）'],
  [823, FIG_823, '电梯+体重秤+同学+v 向上（各阶段超失重与示数不画）'],
  [341, FIG_341, '导线(L、S)→拉长→细长导线(2L) 几何变化'],
  [342, FIG_342, '电阻丝(L、S)→拉长→2L 细丝（同族错位布局）'],
  [416, FIG_416, '火车 v₀=30m/s 驶近观察者+f₀=500Hz（听到频率不标）'],
  [505, FIG_505, '观察者+救护车驶离 v=20m/s+f₀=680Hz'],
  [690, FIG_690, '救护车驶向观察者 v=20m/s+f₀=680Hz'],
  [450, FIG_450, '椭圆跑道+A 点+沿道跑动弧箭头（位移结论不画）'],
  [501, FIG_501, '金属球壳+壳内验电器+接地导线（感应电荷/张角不画）'],
  [715, FIG_715, '空心球壳+小孔+带电小球缓慢移近（感应电荷/场强不画）'],
  [633, FIG_633, '门口→书店(东80m)→折行西120m→邮局（位移不作图）'],
  [638, FIG_638, 'xOy+门口→书店(300m)→邮局(400m)+位移虚线（值不标）'],
  [654, FIG_654, '玩具火箭+向下燃气 v₁=20m/s（反冲速度不画）'],
  [707, FIG_707, '甲乙两球+绝缘柄+相距 r（接触后电量/受力不画）'],
  [773, FIG_773, '直线 A/B/C+B 中点+v_A/v_C 箭头（v_B 比较不画）'],
  [845, FIG_845, '楔形肥皂膜+前/后表面+垂直入射单色光（反射光路不画）'],
  [846, FIG_846, '单缝→屏中央亮纹带+圆孔→同心圆环（题干已述现象复述）'],
  [856, FIG_856, '导线纵剖+截面 S+电子+漂移 v（电流方向不画）'],
  [878, FIG_878, '电磁炉+铁锅+塑料勺｜蹄形磁铁+悬吊金属圆盘（机理不画）'],
  [884, FIG_884, '光滑水平面+物体+v 右+F 下（轨迹弯曲不画）'],
  [378, FIG_378, '直线 A/B/C+AB=6m/BC=10m+运动方向箭头'],
  [379, FIG_379, '等时三段 x₁/x₂/x₃+T 括线'],
]

assert(FIGS.length === 22, `应恰好 22 题，实得 ${FIGS.length}`)
const seen = new Set()
for (const [id] of FIGS) {
  assert(!seen.has(id), `题号重复：${id}`)
  seen.add(id)
}

// 新图自检：无 NaN/undefined、单 svg 根、图内中文标签与题干共享字符（2b 口径）、图内数字可从题干溯源
function checkNewSvg(id, svg, stem) {
  assert(cnt(svg, 'NaN') === 0 && cnt(svg, 'undefined') === 0, `#${id} 新图含 NaN/undefined`)
  assert((svg.match(/<svg/g) || []).length === 1 && svg.startsWith(SVG_HEAD) && svg.endsWith('</svg>'), `#${id} 新图 svg 结构不合法`)
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ')
  for (const m of texts.matchAll(/[一-龥]{2,}/g)) {
    const t = m[0]
    assert([...t].some((ch) => stem.includes(ch)), `#${id} 图内中文标签「${t}」与题干无共享字符（2b 口径）`)
  }
  for (const m of texts.matchAll(/\d+(?:\.\d+)?/g)) {
    assert(stem.includes(m[0]), `#${id} 图内数字「${m[0]}」未在题干出现（泄露防线）`)
  }
}

if (EMIT) {
  const fs = await import('node:fs')
  const rowsHtml = FIGS.map(([id, svg, note]) => {
    const stem = String(get.get(id).stem || '').replace(/\\\$/g, '$').replace(/\$/g, '').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').slice(0, 60)
    return `<div style="margin:8px 0;padding:8px;border:1px solid #ccc"><div style="font:bold 13px sans-serif">#${id} ${note}</div><div style="color:#888;font-size:12px">${stem}</div>${svg}</div>`
  }).join('')
  fs.writeFileSync(path.join(ROOT, 'tmp', 'preview81.html'), '<!doctype html><meta charset="utf-8">' + rowsHtml)
  console.log(`已输出 tmp/preview81.html（${FIGS.length} 图）`)
  db.close()
  process.exit(0)
}

for (const [id, svg, note] of FIGS) {
  const q = get.get(id)
  assert(q, `#${id} 不存在`)
  const figNew = JSON.stringify({ kind: 'svg', data: svg })
  if (q.figure === figNew) {
    console.log(`#${id} figure 已是新图，幂等跳过`)
    continue
  }
  assert(!String(q.figure || '').trim(), `#${id} 旧态断言失败：figure 应为空（防盲替换，现值：${String(q.figure).slice(0, 40)}）`)
  checkNewSvg(id, svg, String(q.stem))
  if (!DRY) {
    db.prepare('UPDATE questions SET figure=? WHERE id=?').run(figNew, id)
    const r = get.get(id)
    assert(r.figure === figNew, `#${id} figure 回读失败`)
    assert(r.stem === q.stem && r.answer === q.answer && r.solution === q.solution && r.pitfall === q.pitfall, `#${id} stem/answer/solution/pitfall 必须零改动`)
    console.log(`#${id} 已补图：${note}`)
  } else {
    console.log(`[dry-run] #${id} 校验全过，未写入（${note}）`)
  }
}

// ---------- #377 P3：图内「h=20m」（题干未给的推导量标注）改标「h」 ----------
{
  const q = get.get(377)
  assert(q, '#377 不存在')
  assert(q.figure && q.figure.includes('"svg"'), '#377 figure 应为 svg')
  const old = JSON.parse(q.figure)
  const n = cnt(old.data, 'h=20m')
  assert(n <= 1, `#377 图内 h=20m 出现 ${n} 次（应 ≤1）`)
  if (n === 0) {
    console.log('#377 图内已无 h=20m，幂等跳过')
  } else {
    const dataNew = old.data.replace('>h=20m<', '>h<')
    assert(cnt(dataNew, 'h=20m') === 0 && cnt(dataNew, '>h<') >= 1, '#377 标注替换失败')
    const figNew = JSON.stringify({ kind: 'svg', data: dataNew })
    assert((dataNew.match(/<svg/g) || []).length === 1 && dataNew.endsWith('</svg>'), '#377 新 svg 结构不合法')
    if (!DRY) {
      db.prepare('UPDATE questions SET figure=? WHERE id=?').run(figNew, 377)
      const r = get.get(377)
      assert(r.figure === figNew, '#377 figure 回读失败')
      assert(r.stem === q.stem && r.answer === q.answer && r.solution === q.solution && r.pitfall === q.pitfall, '#377 stem/answer/solution/pitfall 必须零改动')
      console.log('#377 已修复：图内标注 h=20m → h（推导量不再以数值形式出现）')
    } else {
      console.log('[dry-run] #377 校验全过，未写入')
    }
  }
}

db.close()
console.log('fix-accept81 done')
