// 「从教材选择」级联选择器：六册彩色封面卡 Tab → 章列表（手风琴）→ 小节复选/点选
// multi 模式：勾选小节，点「确定」一次性回传（出题器知识点录入、手动添加错题）
// single 模式：点小节即回传并关闭（错题本/题库筛选、学情看板定位）
import { useState } from 'react'
import { BookOpen, ChevronDown, X } from 'lucide-react'
import { TEXTBOOK } from '@workbench/shared'
import TextbookCover from './TextbookCover'

export default function TextbookPicker({
  mode = 'multi',
  initial = [],
  onPick,
  onConfirm,
  onClose,
}: {
  mode?: 'multi' | 'single'
  /** multi 模式的初始已选小节 */
  initial?: string[]
  /** single 模式：点中小节回传 */
  onPick?: (section: string) => void
  /** multi 模式：确定回传 */
  onConfirm?: (sections: string[]) => void
  onClose: () => void
}) {
  const [volId, setVolId] = useState(TEXTBOOK[0].id)
  const [openCh, setOpenCh] = useState<string | null>(TEXTBOOK[0].chapters[0]?.name ?? null)
  const [checked, setChecked] = useState<Set<string>>(new Set(initial))

  const vol = TEXTBOOK.find((v) => v.id === volId)!
  const toggle = (s: string) => {
    if (mode === 'single') {
      onPick?.(s)
      onClose()
      return
    }
    setChecked((p) => {
      const n = new Set(p)
      n.has(s) ? n.delete(s) : n.add(s)
      return n
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-600" />
          <h2 className="font-semibold text-sm">从教材选择（人教版 2019）</h2>
          <span className="flex-1" />
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* 六册封面卡 Tab */}
        <div className="grid grid-cols-3 gap-2">
          {TEXTBOOK.map((v) => (
            <TextbookCover
              key={v.id}
              vol={v}
              active={volId === v.id}
              onClick={() => { setVolId(v.id); setOpenCh(v.chapters[0]?.name ?? null) }}
            />
          ))}
        </div>

        {/* 章列表（手风琴）+ 小节 */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
          {vol.chapters.map((ch) => {
            const open = openCh === ch.name
            return (
              <div key={ch.name} className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={() => setOpenCh(open ? null : ch.name)}
                >
                  <span>{ch.name}</span>
                  {open && <span className="text-[10px] text-slate-400">{ch.sections.length} 节</span>}
                  <span className="flex-1" />
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
                    {ch.sections.map((s) => {
                      const on = checked.has(s)
                      return (
                        <button
                          key={s}
                          onClick={() => toggle(s)}
                          className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                            on
                              ? 'bg-primary-600 border-primary-600 text-white'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300'
                          }`}
                        >
                          {on && '✓ '}{s}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {mode === 'multi' && (
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              className="btn-primary w-full"
              disabled={checked.size === 0}
              onClick={() => { onConfirm?.([...checked]); onClose() }}
            >
              确定（已选 {checked.size} 个知识点）
            </button>
          </div>
        )}
        {mode === 'single' && (
          <p className="text-[11px] text-slate-400 text-center">点击小节即选中该知识点</p>
        )}
      </div>
    </div>
  )
}
