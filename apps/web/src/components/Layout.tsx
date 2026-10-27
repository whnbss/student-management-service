// 布局：移动端底部 5 Tab + 右下悬浮按钮（直达拍批流程）；宽屏左侧固定导航 + 命令面板
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Users, BookOpen, CircleX, Settings as SettingsIcon, FlaskConical, ChartLine, Camera, Search } from 'lucide-react'
import { useToastStore } from '@/stores/auth'
import CommandPalette from '@/components/CommandPalette'

const TABS = [
  { to: '/', label: '今日', icon: <CalendarDays className="w-5 h-5" /> },
  { to: '/students', label: '学生', icon: <Users className="w-5 h-5" /> },
  { to: '/bank', label: '题库', icon: <BookOpen className="w-5 h-5" /> },
  { to: '/mistakes', label: '错题', icon: <CircleX className="w-5 h-5" /> },
  { to: '/settings', label: '我的', icon: <SettingsIcon className="w-5 h-5" /> },
]

// 桌面端侧栏：底部 5 Tab 已满，「课件」「统计」仅在宽屏导航里出现（移动端从题库页/我的页入口进）
const DESKTOP_TABS = [
  ...TABS.slice(0, 3),
  { to: '/labs', label: '课件', icon: <FlaskConical className="w-4 h-4" /> },
  ...TABS.slice(3),
  { to: '/stats', label: '统计', icon: <ChartLine className="w-4 h-4" /> },
]

export default function Layout() {
  const { visible, message } = useToastStore()
  const location = useLocation()
  const navigate = useNavigate()
  const onDetail = /^\/students\/\d+/.test(location.pathname)
  // 课件详情页：隐藏宽屏侧栏，把宽度全部让给舞台（1440 窗口下舞台 ≥600px，投影可读）
  const isLabDetail = /^\/labs\/.+/.test(location.pathname)
  // 「我的」设置页、统计页与课件页（/labs 全部，详情页会挡参数面板）不显示悬浮拍作业按钮
  const hideFab = location.pathname.startsWith('/settings') || location.pathname.startsWith('/labs') || location.pathname.startsWith('/stats')

  return (
    <div className="min-h-screen md:flex">
      {/* 全局命令面板：Ctrl/Cmd+K 跨学生/错题/题目/课件搜索 */}
      <CommandPalette />
      {/* 宽屏侧栏（课件详情页隐藏：投屏时舞台最大化，顶部有「← 全部课件」返回） */}
      <aside className={`hidden md:flex md:flex-col w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-screen p-4 gap-1 ${isLabDetail ? 'md:hidden' : ''}`}>
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
        {/* 命令面板入口提示 */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('commandpalette:toggle'))}
          className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="全局搜索（Ctrl+K）"
        >
          <Search className="w-3.5 h-3.5" /> 全局搜索 <span className="num ml-auto text-[10px] border border-slate-300 dark:border-slate-600 rounded px-1">Ctrl K</span>
        </button>
      </aside>

      <div className="flex-1 pb-20 md:pb-0">
        {/* 顶部标题栏（仅移动端，详情页有返回键） */}
        {onDetail && (
          <header className="sticky top-0 z-10 md:hidden flex items-center gap-2 px-4 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
            <button className="text-primary-600 text-sm" onClick={() => navigate(-1)}>← 返回</button>
          </header>
        )}
        {/* 课件详情页放开宽度上限：1440 窗口下舞台可达 ~645px、图像面板 ~430px（三栏）或 ~1376px（单栏） */}
        <main className={`max-w-3xl mx-auto p-4 ${isLabDetail ? 'md:max-w-none' : 'md:max-w-6xl'}`}>
          <Outlet />
        </main>
      </div>

      {/* 右下角悬浮按钮：直达拍作业批改流程（设置页/统计页/课件页隐藏） */}
      {!hideFab && (
        <button
          onClick={() => navigate('/analyze')}
          className="fixed bottom-24 right-5 md:bottom-8 md:right-10 z-20 h-14 px-5 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 active:scale-95 transition-transform flex items-center gap-2"
          title="拍作业 / 智能批改分析"
        >
          <Camera className="w-5 h-5" />
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
            {t.icon}
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
