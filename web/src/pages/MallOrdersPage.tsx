import './HomePage.css'

/**
 * 商城与订单子路由占位页：商品、库存、订单后续在此展开。
 */
export function MallOrdersPage() {
  return (
    <div className="admin-subpage">
      <h1 className="admin-subpage__title">商城与订单</h1>
      <p className="admin-subpage__lead">商品、库存、订单查询与处理。可在此接入 mall 相关管理接口。</p>
    </div>
  )
}
