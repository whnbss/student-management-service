// 登录页：账号 + 密码（teacher / student 双角色，按角色跳转）
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { post } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { LoginResp } from '@workbench/shared'

export default function Login() {
  const [username, setUsername] = useState('teacher')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      const r = await post<LoginResp>('/api/auth/login', { username: username.trim(), password })
      useAuthStore.getState().login(r)
      navigate(r.role === 'student' ? '/student' : '/', { replace: true })
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-800 via-primary-700 to-indigo-900 p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 bg-white/95 dark:bg-slate-900/95">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">⚛️</div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">教学管理工作台</h1>
          <p className="text-sm text-slate-500 mt-1">高中物理 · 本地部署</p>
        </div>
        <label className="label">账号</label>
        <input
          type="text"
          className="input mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="教师账号 teacher，学生用姓名"
          autoFocus
        />
        <label className="label">密码</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
        />
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        <button className="btn-primary w-full mt-6 h-11" disabled={loading}>
          {loading ? '登录中…' : '登 录'}
        </button>
        <p className="text-xs text-slate-400 text-center mt-4">教师首次使用默认账号 teacher / admin123；学生账号由老师开通（初始密码为手机号）</p>
      </form>
    </div>
  )
}
