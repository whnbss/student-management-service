// 布局：移动端底部 5 Tab + 右下悬浮按钮（直达拍批流程）；宽屏左侧固定导航
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useToastStore } from '@/stores/auth'

const TABS = [
  { to: '/', label: '今日', icon: '📅' },
  { to: '/students', label: '学生', icon: '👥' },
  { to: '/bank', label: '题库', icon: '📚' },
  { to: '/mistakes', label: '错题', icon: '❌' },
  { to: '/settings', label: '我的', icon: '⚙️' },
]

// 桌面端侧栏：底部 5 Tab 已满，「课件」仅在宽屏导航里出现（移动端从题库页顶部入口进）
const DESKTOP_TABS = [
  ...TABS.slice(0, 3),
  { to: '/labs', label: '课件', icon: '🧪' },
  ...TABS.slice(3),
]

export default function Layout() {
  const { visible, message } = useToastStore()
  const location = useLocation()
  const navigate = useNavigate()
  const onDetail = /^\/students\/\d+/.test(location.pathname)
  // 「我的」设置页与课件页（/labs 全部，详情页会挡参数面板）不显示悬浮拍作业按钮
  const hideFab = location.pathname.startsWith('/settings') || location.pathname.startsWith('/labs')

  return (
    <div className="min-h-screen md:flex">
      {/* 宽屏侧栏 */}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-screen p-4 gap-1">
        <div className="text-lg font-bold text-primary-700 dark:text-primary-300 px-3 mb-4">教学管理工作台</div>
        {DESKTOP_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`
            }
          >
            <span>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </aside>

      <div className="flex-1 pb-20 md:pb-0">
        {/* 顶部标题栏（仅移动端，详情页有返回键） */}
        {onDetail && (
          <header className="sticky top-0 z-10 md:hidden flex items-center gap-2 px-4 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
            <button className="text-primary-600 text-sm" onClick={() => navigate(-1)}>← 返回</button>
          </header>
        )}
        <main className="max-w-3xl md:max-w-5xl mx-auto p-4">
          <Outlet />
        </main>
      </div>

      {/* 右下角悬浮按钮：直达拍作业批改流程（设置页隐藏） */}
      {!hideFab && (
        <button
          onClick={() => navigate('/analyze')}
          className="fixed bottom-24 right-5 md:bottom-8 md:right-10 z-20 h-14 px-5 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 active:scale-95 transition-transform flex items-center gap-2"
          title="拍作业 / AI 批改分析"
        >
          <span className="text-2xl">📷</span>
          <span className="text-sm font-semibold">拍作业</span>
        </button>
      )}

      {/* 移动端底部 Tab */}
      <nav className="fixed bottom-0 inset-x-0 z-10 md:hidden flex bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`
            }
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>

      {/* Toast */}
      {visible && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-slate-900/85 dark:bg-slate-700 text-white text-sm rounded-full px-4 py-2 shadow-lg">
          {message}
        </div>
      )}
    </div>
  )
}
