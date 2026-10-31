// 一次性脚本：按验收 #38 的指令修正 P1-20（spring 模板「压缩量 x=…」标签系统性错配）+ P3-65/P3-66
// 独立核对（每题均以题干为准重判，不依赖监督描述）：
// - #31（P1-20）：竖直悬挂钩码拉伸实验（钩码→弹簧必拉伸，伸长量=L−L₀=14.0−10.0=4.0cm=0.04m 可导）
//   图标「压缩量 x=0.04m」→「伸长量 x=0.04m」
// - #384（P1-20）：题干明写「沿弹簧轴线方向拉伸」，伸长量=F/k=6/200=0.03m 可导
//   图标「压缩量 x=0.03m」→「伸长量 x=0.03m」
// - #466（P1-20）：水平弹簧振子，A=5.0cm 是振幅（最大位移），非单向压缩量
//   图标「压缩量 x=0.05m」→「振幅 A=5.0cm」
// - #783（P1-20）：纯符号简谐运动题（题干无任何数值），幻数值标签
//   图标「压缩量 x=0.1m」→「x（位移示意）」（题干含「最大位移处」，场景校验可过）
// - #848（P1-20）：符号题 x_P>0（振子位置，弹簧被拉伸），幻数值+方向反
//   图标「压缩量 x=0.1m」→「x_P（位置示意）」
// - #29（同根因补修，监督清单外但命中同一错配规则）：竖直悬挂弹簧拉伸题，题干两处「伸长量」
//   图标「压缩量 x=0.2m」→「伸长量 x=0.2m」（0.2m 题干明写）
// - #844（P3-65）：双缝干涉符号题，图标「L=lm」「d=dmm」应为「l」「d」；
//   另有一处游离于 <text> 之外的裸文本「S₁」占位残留 → 删除（S₁ 已有正常标注）
// - #843（P3-66）：全反射题图标「i=45°」实为(1)问临界角示意 →「C=45°(临界角)」，与题干(2)问 60° 入射角区分
// 长期防护：bank-audit.mts 新增 2e 弹簧标签守卫（方向词错配 + 幻数值不可溯源）
// 用法：node scripts/fix-accept38.mjs [--dry-run]
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')

const db = new Database(path.join(ROOT, 'data', 'app.db'))

// 逐题标签替换表：old 文本节点完整内容 → new 文本节点完整内容
const LABEL_MAP = {
  31: { old: '压缩量 x=0.04m', neu: '伸长量 x=0.04m' },
  384: { old: '压缩量 x=0.03m', neu: '伸长量 x=0.03m' },
  466: { old: '压缩量 x=0.05m', neu: '振幅 A=5.0cm' },
  783: { old: '压缩量 x=0.1m', neu: 'x（位移示意）' },
  848: { old: '压缩量 x=0.1m', neu: 'x_P（位置示意）' },
  29: { old: '压缩量 x=0.2m', neu: '伸长量 x=0.2m' },
}

const patches = []

// ---------- P1-20 五题 + #29 同根因：替换 figure 内文本标签 ----------
for (const [id, m] of Object.entries(LABEL_MAP)) {
  patches.push({
    id: Number(id),
    figure: (cur) => {
      const f = JSON.parse(cur.figure)
      if (!f.data.includes(`>${m.old}<`)) throw new Error(`#${id} 图内未找到标签「${m.old}」，拒执行`)
      f.data = f.data.replace(`>${m.old}<`, `>${m.neu}<`)
      return JSON.stringify(f)
    },
    expect: (q) => String(q.figure || '').includes(`>${m.neu}<`) && !String(q.figure || '').includes(m.old),
  })
}

// ---------- #844（P3-65）：删裸 S₁ 占位 + L=lm → l、d=dmm → d ----------
{
  patches.push({
    id: 844,
    figure: (cur) => {
      const f = JSON.parse(cur.figure)
      if (!f.data.includes('/>S₁<text')) throw new Error('#844 未找到裸 S₁ 占位，拒执行')
      f.data = f.data.replace('/>S₁<text', '/><text')
      f.data = f.data.replace('>L=lm<', '>l<').replace('>d=dmm<', '>d<')
      return JSON.stringify(f)
    },
    expect: (q) => !String(q.figure || '').includes('L=lm') && !String(q.figure || '').includes('d=dmm') && !/>S₁<text/.test(String(q.figure || '')),
  })
}

// ---------- #843（P3-66）：i=45° → C=45°(临界角) ----------
{
  patches.push({
    id: 843,
    figure: (cur) => {
      const f = JSON.parse(cur.figure)
      if (!f.data.includes('>i=45°<')) throw new Error('#843 未找到标签「i=45°」，拒执行')
      f.data = f.data.replace('>i=45°<', '>C=45°(临界角)<')
      return JSON.stringify(f)
    },
    expect: (q) => String(q.figure || '').includes('C=45°(临界角)') && !String(q.figure || '').includes('i=45°'),
  })
}

// ---------- 执行（动态 SET + cur 回退 + 空值拒执行 + 逐题回读断言） ----------
if (DRY) {
  console.log('[dry-run] 待更新', patches.map((p) => `#${p.id}`).join(' '))
} else {
  let n = 0
  for (const p of patches) {
    const cur = db.prepare('SELECT * FROM questions WHERE id = ?').get(p.id)
    if (!cur) throw new Error(`#${p.id} 不存在`)
    const v = p.figure(cur)
    if (!v || !v.trim()) throw new Error(`#${p.id} 修正值为空，拒执行（cur 回退防护）`)
    db.prepare('UPDATE questions SET figure = @figure WHERE id = @id').run({ figure: v, id: p.id })
    const after = db.prepare('SELECT * FROM questions WHERE id = ?').get(p.id)
    if (!p.expect(after)) throw new Error(`#${p.id} 更新后断言未通过`)
    console.log(`✓ #${p.id} 已修正并断言通过`)
    n++
  }
  console.log(`共更新 ${n} 题`)
}

// ---------- 全库残留复查：压缩量标签与题干拉伸语境错配 ----------
const bad = db.prepare("SELECT id, stem, figure FROM questions WHERE figure LIKE '%>压缩量%'").all()
  .filter((r) => /拉伸|伸长|钩码|悬挂/.test(String(r.stem || '')))
console.log(bad.length ? `✗ 仍错配：${bad.map((r) => '#' + r.id).join(' ')}` : '✓ 全库「压缩量」标签与题干拉伸/悬挂语境错配 0')
db.close()
