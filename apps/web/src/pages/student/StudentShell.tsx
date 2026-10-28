// 学生工作台壳：底部 4 Tab 导航 + 首次登录强制改密弹层 + 退出登录
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CircleX, Clock, FileText, FlaskConical } from 'lucide-react'
import { get, put } from '@/lib/api'
import { useAuthStore, useToastStore } from '@/stores/auth'
import type { StudentMe } from '@workbench/shared'

const TABS = [
  { to: '/student', end: true, label: '错题', icon: <CircleX className="w-5 h-5" /> },
  { to: '/student/hours', label: '课时', icon: <Clock className="w-5 h-5" /> },
  { to: '/student/reports', label: '报告', icon: <FileText className="w-5 h-5" /> },
  { to: '/student/labs', label: '课件', icon: <FlaskConical className="w-5 h-5" /> },
]

export default function StudentShell() {
  const { username, mustChangePwd, clearMustChangePwd, logout } = useAuthStore()
  const navigate = useNavigate()
  const show = useToastStore((s) => s.show)
  const [me, setMe] = useState<StudentMe | null>(null)
  const [forcePwd, setForcePwd] = useState(false) // 强制改密弹层
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    get<StudentMe>('/api/student/me')
      .then((r) => {
        setMe(r)
        if (r.must_change_pwd || mustChangePwd) setForcePwd(true)
      })
      .catch((e) => show(e.message || '加载失败'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const changePwd = async () => {
    if (!oldPwd || !newPwd) { show('请填写完整'); return }
    if (newPwd !== confirmPwd) { show('两次输入的新密码不一致'); return }
    setSaving(true)
    try {
      await put('/api/student/password', { old_password: oldPwd, new_password: newPwd })
      clearMustChangePwd()
      // 首改后整页刷新：让被「强制改密」拦截的业务数据重新加载
      window.location.reload()
    } catch (e: any) {
      show(e.message || '修改失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* 顶部：学生姓名 + 改密/退出 */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold text-primary-700 dark:text-primary-300">我的物理学习台</span>
        {me && <span className="text-xs text-slate-400">{me.name}</span>}
        <span className="flex-1" />
        <button className="text-xs text-slate-400" onClick={() => setForcePwd(true)}>改密码</button>
        <button
          className="text-xs text-slate-400 hover:text-red-500"
          onClick={() => {
            if (!window.confirm('确定退出登录吗？')) return
            logout()
            navigate('/login', { replace: true })
          }}
        >
          退出
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        <Outlet context={{ me, reloadMe: () => get<StudentMe>('/api/student/me').then(setMe).catch(() => {}) }} />
      </main>

      {/* 学生底部 4 Tab */}
      <nav className="fixed bottom-0 inset-x-0 z-10 flex bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`
            }
          >
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>

      {/* 首次登录 / 主动改密弹层 */}
      {forcePwd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="card w-full max-w-sm p-6 space-y-3 bg-white dark:bg-slate-900">
            <h2 className="font-semibold text-sm">修改密码</h2>
            <p className="text-xs text-slate-500">初始密码为手机号，为保护隐私请先设置一个新密码（至少 6 位）。</p>
            <input type="password" className="input" placeholder="当前密码（初始为手机号）" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            <input type="password" className="input" placeholder="新密码（至少 6 位）" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <input type="password" className="input" placeholder="确认新密码" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            <button className="btn-primary w-full" disabled={saving} onClick={changePwd}>{saving ? '保存中…' : '确认修改'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
