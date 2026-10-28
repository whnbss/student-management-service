// 教师端通知铃：30s 轮询未读（学生「我已重做」等事件），点击展开下拉列表
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { del, get, post } from '@/lib/api'
import type { NotificationItem } from '@workbench/shared'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await get<{ items: NotificationItem[]; unread: number }>('/api/notifications')
      setUnread(r.unread || 0)
      setItems(r.items || [])
    } catch {
      /* 轮询失败静默，下轮再试 */
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  // 点外面关闭
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // 删除单条 / 清空全部（失败静默，本地先移除保证界面即时反馈）
  const removeOne = async (id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    try { await del(`/api/notifications/${id}`) } catch { /* 静默 */ }
  }
  const clearAll = async () => {
    setItems([])
    setUnread(0)
    try { await del('/api/notifications') } catch { /* 静默 */ }
  }

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      // 打开即全部已读（本地立刻清零，失败不打扰）
      setUnread(0)
      try { await post('/api/notifications/read-all') } catch { /* 静默 */ }
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
        title="同步通知（学生重做进度）"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] num flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] card p-2 shadow-xl max-h-96 overflow-y-auto">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span>同步通知</span>
            {items.length > 0 && (
              <button onClick={clearAll} className="text-slate-400 hover:text-red-500 font-normal" title="清空全部通知">
                清空
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-slate-400">暂无通知</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`group relative px-2 py-2 pr-7 rounded-lg text-sm ${n.read ? '' : 'bg-primary-50/60 dark:bg-primary-900/20'}`}
              >
                <p className="font-medium text-slate-700 dark:text-slate-200 text-[13px]">{n.title}</p>
                {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-slate-400 num mt-0.5">{timeAgo(n.created_at)}</p>
                <button
                  onClick={() => removeOne(n.id)}
                  className="absolute top-1.5 right-1.5 p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  title="删除该通知"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
