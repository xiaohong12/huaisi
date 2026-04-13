import './HomePage.css'

/**
 * 内容运营子路由占位页：轮播、版块、帖子等后续在此展开。
 */
export function ContentOpsPage() {
  return (
    <div className="admin-subpage">
      <h1 className="admin-subpage__title">内容运营</h1>
      <p className="admin-subpage__lead">
        轮播、版块、帖子与互动管理。对接 server 已有接口后，可替换为本模块实际列表与表单。
      </p>
    </div>
  )
}
