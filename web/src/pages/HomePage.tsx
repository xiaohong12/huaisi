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
          <h3>内容运营</h3>
          <p>轮播、版块、帖子与互动管理（对应子路由「内容运营」）。</p>
        </article>
        <article className="admin-home__card">
          <h3>商城与订单</h3>
          <p>商品、库存、订单（对应子路由「商城与订单」）。</p>
        </article>
        <article className="admin-home__card">
          <h3>用户与权限</h3>
          <p>用户数据与权限（对应子路由「用户与权限」）。</p>
        </article>
      </div>
    </div>
  )
}
