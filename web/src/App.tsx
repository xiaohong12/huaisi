import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { ContentOpsPage } from './pages/ContentOpsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MallOrdersPage } from './pages/MallOrdersPage'
import { UsersAdminPage } from './pages/UsersAdminPage'

/**
 * 管理端路由：登录 `/login`；已登录后为左侧菜单 + 右侧嵌套子路由。
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="users" element={<UsersAdminPage />} />
          <Route path="orders" element={<MallOrdersPage />} />
          <Route path="posts" element={<ContentOpsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
