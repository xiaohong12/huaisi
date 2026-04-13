import './HomePage.css'

/**
 * 用户与权限子路由占位页：C 端用户与管理员角色后续在此展开。
 */
export function UsersAdminPage() {
  return (
    <div className="admin-subpage">
      <h1 className="admin-subpage__title">用户与权限</h1>
      <p className="admin-subpage__lead">
        小程序用户数据查看；管理员账号与角色扩展。可与 users / admin_users 等表及接口对接。
      </p>
    </div>
  )
}
