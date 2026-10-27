// 题库页顶部「教材目录」浏览卡：六册封面 + 章节手风琴展开，可当知识地图用
// 点击小节回调 onPickSection（题库页用它设置知识点筛选）
import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import { TEXTBOOK } from '@workbench/shared'

export default function TextbookBrowse({ onPickSection }: { onPickSection?: (section: string) => void }) {
  const [open, setOpen] = useState(false)
  const [volId, setVolId] = useState(TEXTBOOK[0].id)
  const [openCh, setOpenCh] = useState<string | null>(null)
  const vol = TEXTBOOK.find((v) => v.id === volId)!

  return (
    <div className="card p-4">
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(!open)}>
        <BookOpen className="w-8 h-8 text-primary-500 shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold">教材目录 · 人教版 2019</div>
          <p className="text-xs text-slate-500 mt-0.5">六册章节树，点击小节可按知识点筛选题目</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {/* 六册封面（横向滚动） */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TEXTBOOK.map((v) => (
              <button
                key={v.id}
                onClick={() => { setVolId(v.id); setOpenCh(null) }}
                className={`shrink-0 rounded-xl px-3 py-2 text-left bg-gradient-to-br ${v.color} text-white shadow-sm transition-transform ${volId === v.id ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'}`}
              >
                <div className="text-xs font-bold">{v.name}</div>
                <div className="text-[10px] opacity-80">{v.chapters.length} 章</div>
              </button>
            ))}
          </div>

          {/* 章节手风琴 */}
          <div className="space-y-1.5">
            {vol.chapters.map((ch) => {
              const chOpen = openCh === ch.name
              return (
                <div key={ch.name} className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => setOpenCh(chOpen ? null : ch.name)}
                  >
                    <span>{ch.name}</span>
                    <span className="flex-1" />
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${chOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {chOpen && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                      {ch.sections.map((s) => (
                        <button
                          key={s}
                          className="text-xs px-2 py-1 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300 hover:text-primary-600"
                          onClick={() => onPickSection?.(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
