// 登录页
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { post } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

export default function Login() {
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
      const { token } = await post<{ ok: boolean; token: string }>('/api/auth/login', { password })
      useAuthStore.getState().login(token)
      navigate('/', { replace: true })
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
        <label className="label">登录密码</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
          autoFocus
        />
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        <button className="btn-primary w-full mt-6 h-11" disabled={loading}>
          {loading ? '登录中…' : '登 录'}
        </button>
        <p className="text-xs text-slate-400 text-center mt-4">首次使用默认密码 admin123，登录后请在「我的」中修改</p>
      </form>
    </div>
  )
}
