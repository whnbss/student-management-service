import React from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Today from '@/pages/Today'
import Students from '@/pages/Students'
import StudentDetail from '@/pages/StudentDetail'
import Settings from '@/pages/Settings'
import Analyze from '@/pages/Analyze'
import Mistakes from '@/pages/Mistakes'
import Labs from '@/pages/Labs'
import LabDetail from '@/pages/LabDetail'
import Bank from '@/pages/Bank'
import Placeholder from '@/pages/Placeholder'
void Placeholder // 暂留：M3 题库/讲义占位时复用

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// 使用 data router（createBrowserRouter）：Settings 页的 useBlocker 未保存拦截依赖它
const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Today /> },
      { path: 'students', element: <Students /> },
      { path: 'students/:id', element: <StudentDetail /> },
      { path: 'analyze', element: <Analyze /> },
      { path: 'bank', element: <Bank /> },
      { path: 'mistakes', element: <Mistakes /> },
      { path: 'labs', element: <Labs /> },
      { path: 'labs/:id', element: <LabDetail /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
