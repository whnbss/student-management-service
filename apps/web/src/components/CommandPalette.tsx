// 命令面板 Ctrl/Cmd+K：跨学生/错题/课件/题库关键词搜索，键盘直达（P2）
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, BookOpen, FlaskConical, GraduationCap, X } from 'lucide-react'
import { get } from '@/lib/api'
import { SCENES } from '@/labs/registry'

interface Item {
  key: string
  icon: React.ReactNode
  title: string
  sub: string
  to: string
}

const ICONS = {
  student: <User className="w-4 h-4 text-primary-500" />,
  mistake: <BookOpen className="w-4 h-4 text-red-400" />,
  lab: <FlaskConical className="w-4 h-4 text-violet-500" />,
  question: <GraduationCap className="w-4 h-4 text-amber-500" />,
}

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 全局快捷键 + 侧栏入口按钮的自定义事件
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    const onToggle = () => setOpen((v) => !v)
    window.addEventListener('keydown', onKey)
    window.addEventListener('commandpalette:toggle', onToggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('commandpalette:toggle', onToggle)
    }
  }, [])

  // 打开时聚焦
  useEffect(() => {
    if (open) {
      setText('')
      setItems([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // 防抖搜索：学生/错题/题目走接口，课件走本地注册表
  useEffect(() => {
    const kw = text.trim()
    if (!open || !kw) { setItems([]); return }
    const timer = setTimeout(async () => {
      const out: Item[] = []
      // 课件（本地匹配，零延迟）
      for (const s of SCENES) {
        if (s.title.includes(kw) || s.chapter.includes(kw) || s.tags.some((t) => t.includes(kw))) {
          out.push({ key: `lab-${s.id}`, icon: ICONS.lab, title: s.title, sub: `${s.grade} · ${s.chapter}`, to: `/labs/${s.id}` })
        }
        if (out.length >= 5) break
      }
      // 学生
      try {
        const st = await get<Array<{ id: number; name: string; grade: string; status: string }>>(`/api/students?query=${encodeURIComponent(kw)}`)
        for (const s of st.slice(0, 4)) out.push({ key: `stu-${s.id}`, icon: ICONS.student, title: s.name, sub: `${s.grade || '—'} · ${s.status}`, to: `/students/${s.id}` })
      } catch { /* ignore */ }
      // 错题
      try {
        const mk = await get<Array<{ id: number; stem: string; student_name: string }>>(`/api/mistakes?q=${encodeURIComponent(kw)}`)
        for (const m of mk.slice(0, 4)) out.push({ key: `mk-${m.id}`, icon: ICONS.mistake, title: m.stem.replace(/\s+/g, ' ').slice(0, 40), sub: `错题 · ${m.student_name}`, to: `/mistakes?id=${m.id}` })
      } catch { /* ignore */ }
      // 题目
      try {
        const qs = await get<Array<{ id: number; stem: string; qtype: string }>>(`/api/questions?q=${encodeURIComponent(kw)}`)
        for (const q of qs.slice(0, 4)) out.push({ key: `q-${q.id}`, icon: ICONS.question, title: q.stem.replace(/\s+/g, ' ').slice(0, 40), sub: `题库 · ${q.qtype}`, to: `/bank?q=${encodeURIComponent(kw)}` })
      } catch { /* ignore */ }
      setItems(out.slice(0, 12))
      setActive(0)
    }, 200)
    return () => clearTimeout(timer)
  }, [text, open])

  const go = (item: Item) => {
    setOpen(false)
    navigate(item.to)
  }

  if (!open) return null
  return (
    // 遮罩层：点击空白处关闭
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && items[active]) go(items[active])
            }}
            placeholder="搜索学生 / 错题 / 题目 / 课件…"
            className="flex-1 py-3.5 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {text.trim() && items.length === 0 && <p className="text-center text-xs text-slate-400 py-6">无匹配结果</p>}
          {!text.trim() && (
            <p className="text-center text-xs text-slate-400 py-6">
              输入关键词搜索；<span className="num">↑↓</span> 选择，<span className="num">Enter</span> 打开
            </p>
          )}
          {items.map((it, i) => (
            <button
              key={it.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
            >
              <span className="shrink-0">{it.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{it.title}</span>
                <span className="block text-[11px] text-slate-400 truncate">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
