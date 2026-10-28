// 登录态：token + 角色 持久化到 localStorage（teacher / student 双角色）
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AccountRole } from '@workbench/shared'

interface AuthState {
  token: string | null
  role: AccountRole | null
  username: string
  mustChangePwd: boolean
  login: (payload: { token: string; role: AccountRole; username: string; must_change_pwd: boolean }) => void
  clearMustChangePwd: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      username: '',
      mustChangePwd: false,
      login: ({ token, role, username, must_change_pwd }) =>
        set({ token, role, username, mustChangePwd: must_change_pwd }),
      clearMustChangePwd: () => set({ mustChangePwd: false }),
      logout: () => set({ token: null, role: null, username: '', mustChangePwd: false }),
    }),
    { name: 'workbench-auth' }
  )
)

// Toast 轻提示
interface ToastState {
  message: string
  visible: boolean
  show: (message: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  visible: false,
  show: (message) => {
    set({ message, visible: true })
    setTimeout(() => set({ visible: false }), 2200)
  },
}))
