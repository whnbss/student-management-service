// 登录态：token 持久化到 localStorage
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  login: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      login: (token) => set({ token }),
      logout: () => set({ token: null }),
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
