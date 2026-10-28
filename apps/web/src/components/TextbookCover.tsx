// 教材封面卡（六册统一质感）：内联 style 渐变（不依赖 Tailwind JIT 扫描 packages 目录，避免封面发白），
// 「书」的质感：左侧书脊亮线 + 右上角学科图标水印 + 册名大字 + 章/小节数徽章
import { Atom, BookOpen, Magnet, Orbit, Ruler, Waves, Zap } from 'lucide-react'
import type { TextbookVolume } from '@workbench/shared'

const ICONS: Record<string, typeof Atom> = {
  bxF1: Ruler, // 力学基础
  bxF2: Orbit, // 圆周/引力
  bxF3: Zap, // 电与磁初步
  xxF1: Waves, // 动量/振动/波/光
  xxF2: Magnet, // 磁场/电磁感应
  xxF3: Atom, // 热学/原子
}

export default function TextbookCover({
  vol,
  active,
  onClick,
}: {
  vol: TextbookVolume
  /** 是否选中态（ring 高亮 + 微放大） */
  active: boolean
  onClick: () => void
}) {
  const Icon = ICONS[vol.id] ?? BookOpen
  const chapters = vol.chapters.length
  const sections = vol.chapters.reduce((s, c) => s + c.sections.length, 0)
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl px-3 py-2.5 text-left text-white shadow-sm transition-transform ${
        active ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-slate-900 scale-[1.02]' : 'opacity-85 hover:opacity-100'
      }`}
      style={{ background: `linear-gradient(135deg, ${vol.color}, ${vol.color2})` }}
    >
      {/* 书脊亮线 */}
      <span className="absolute inset-y-0 left-0 w-1.5 bg-white/30" aria-hidden />
      {/* 学科图标水印 */}
      <span className="absolute -right-3 -top-3 opacity-20" aria-hidden>
        <Icon className="w-14 h-14" />
      </span>
      <div className="text-[13px] font-bold leading-tight">{vol.name}</div>
      <div className="text-[10px] opacity-85 mt-0.5">{vol.hint}</div>
      <div className="mt-1.5 flex items-center gap-1 relative">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/25 num">{chapters} 章</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/25 num">{sections} 节</span>
      </div>
    </button>
  )
}
