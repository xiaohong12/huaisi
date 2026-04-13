import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getAdminToken } from '../auth/adminToken'

/**
 * 未携带有效 admin_token 时重定向到登录页，避免未登录访问后台首页。
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!getAdminToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
