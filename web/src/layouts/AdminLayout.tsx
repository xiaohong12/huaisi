import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, ShoppingCart, MessageSquare, Package } from 'lucide-react'
import { clearAdminToken, getAdminToken } from '../auth/adminToken'
import { getApiBase } from '../config'
import './AdminLayout.css'

interface AdminSessionApi {
  code: number
  message: string
  data: {
    adminId: number
    username: string
    displayName: string
  } | null
}

/** 子页面可通过 useOutletContext 读取（可选扩展） */
export type AdminLayoutOutletContext = {
  displayName: string | null
}

/**
 * 管理后台布局：左侧固定菜单，右侧顶栏 + React Router 子路由出口。
 */
export function AdminLayout() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)

  useEffect(() => {
    const token = getAdminToken()
    if (!token) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/admin/auth/session`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await res.json()) as AdminSessionApi
        if (cancelled) return
        if (json.code !== 0 || !json.data) {
          clearAdminToken()
          navigate('/login', { replace: true })
          return
        }
        setDisplayName(json.data.displayName || json.data.username)
        setSessionError(null)
      } catch {
        if (!cancelled) {
          setSessionError('无法校验登录状态，请检查网络或后端服务')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleLogout = () => {
    clearAdminToken()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `admin-layout__nav-link${isActive ? ' admin-layout__nav-link--active' : ''}`

  const outletContext: AdminLayoutOutletContext = { displayName }

  return (
    <div className="admin-layout" lang="zh-CN">
      <aside className="admin-layout__sidebar" aria-label="后台主导航">
        <div className="admin-layout__side-brand">
          <span className="admin-layout__side-mark" aria-hidden="true" />
          <span>华思管理后台</span>
        </div>
        <nav className="admin-layout__nav">
          <NavLink to="/" end className={navClass}>
            <LayoutDashboard className="admin-layout__nav-icon" />
            工作台
          </NavLink>
          <NavLink to="/products" className={navClass}>
            <Package className="admin-layout__nav-icon" />
            商品中心
          </NavLink>
          <NavLink to="/users" className={navClass}>
            <Users className="admin-layout__nav-icon" />
            用户中心
          </NavLink>
          <NavLink to="/orders" className={navClass}>
            <ShoppingCart className="admin-layout__nav-icon" />
            订单中心
          </NavLink>
          <NavLink to="/posts" className={navClass}>
            <MessageSquare className="admin-layout__nav-icon" />
            帖子中心
          </NavLink>
        </nav>
      </aside>

      <div className="admin-layout__body">
        <header className="admin-layout__topbar" role="banner">
          {displayName ? (
            <p className="admin-layout__user">
              当前管理员：<strong>{displayName}</strong>
            </p>
          ) : (
            <p className="admin-layout__user">加载中…</p>
          )}
          <button type="button" className="admin-layout__logout" onClick={handleLogout}>
            退出登录
          </button>
        </header>

        {sessionError ? (
          <p className="admin-layout__banner" role="alert">
            {sessionError}
          </p>
        ) : null}

        <main className="admin-layout__outlet" aria-label="主内容区">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  )
}
