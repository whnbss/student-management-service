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
import Stats from '@/pages/Stats'
import ShareReport from '@/pages/ShareReport'
import StudentShell from '@/pages/student/StudentShell'
import { StudentMistakes, StudentHours, StudentReports, StudentLogs } from '@/pages/student/StudentViews'
import Placeholder from '@/pages/Placeholder'
void Placeholder // 暂留：M3 题库/讲义占位时复用

// 教师区：未登录 → 登录页；学生 → 自己的工作台
function RequireTeacher({ children }: { children: React.ReactNode }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (role === 'student') return <Navigate to="/student" replace />
  return <>{children}</>
}

// 学生区：未登录 → 登录页；教师 → 工作台
function RequireStudent({ children }: { children: React.ReactNode }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (role !== 'student') return <Navigate to="/" replace />
  return <>{children}</>
}

// 课件区双角色共用（纯只读，不含教师数据）：学生套学生壳，教师套工作台壳
function LabsLayout() {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return role === 'student' ? <StudentShell /> : <Layout />
}

// 使用 data router（createBrowserRouter）：Settings 页的 useBlocker 未保存拦截依赖它
// future 标志提前启用 v7 行为，消除 React Router future-flag 控制台警告
const router = createBrowserRouter([

  { path: '/login', element: <Login /> },
  // 只读分享页（家长 H5 报告）：凭随机 token 访问，不走登录
  { path: '/share/:token', element: <ShareReport /> },
  {
    path: '/',
    element: (
      <RequireTeacher>
        <Layout />
      </RequireTeacher>
    ),
    children: [
      { index: true, element: <Today /> },
      { path: 'students', element: <Students /> },
      { path: 'students/:id', element: <StudentDetail /> },
      { path: 'analyze', element: <Analyze /> },
      { path: 'bank', element: <Bank /> },
      { path: 'mistakes', element: <Mistakes /> },
      { path: 'settings', element: <Settings /> },
      { path: 'stats', element: <Stats /> },
    ],
  },
  {
    // 课件：教师与学生共用路由（Labs/LabDetail 组件内部链接都指向 /labs）
    path: '/labs',
    element: <LabsLayout />,
    children: [
      { index: true, element: <Labs /> },
      { path: ':id', element: <LabDetail /> },
    ],
  },
  {
    // 学生工作台：我的错题 / 我的课时 / 我的报告 / 学习日志 / 我的课件
    path: '/student',
    element: (
      <RequireStudent>
        <StudentShell />
      </RequireStudent>
    ),
    children: [
      { index: true, element: <StudentMistakes /> },
      { path: 'hours', element: <StudentHours /> },
      { path: 'reports', element: <StudentReports /> },
      { path: 'logs', element: <StudentLogs /> },
      { path: 'labs', element: <Labs /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], {
  future: { v7_relativeSplatPath: true },
})

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />
}
