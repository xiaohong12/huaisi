import './HomePage.css'

/**
 * 工作台子路由（`/`）：概览卡片，具体业务从左侧菜单进入子路由。
 */
export function HomePage() {
  return (
    <div className="admin-home">
      <h1 className="admin-home__title">工作台</h1>
      <p className="admin-home__subtitle">
        欢迎进入华思 PC 管理端。请从左侧菜单进入各模块；下方为快捷说明。
      </p>
      <div className="admin-home__cards">
        <article className="admin-home__card">
          <h3>用户中心</h3>
          <p>C 端用户资料与查询（左侧菜单「用户中心」）。</p>
        </article>
        <article className="admin-home__card">
          <h3>订单中心</h3>
          <p>商城订单与履约（左侧菜单「订单中心」）。</p>
        </article>
        <article className="admin-home__card">
          <h3>帖子中心</h3>
          <p>内容版块与帖子互动（左侧菜单「帖子中心」）。</p>
        </article>
      </div>
    </div>
  )
}
