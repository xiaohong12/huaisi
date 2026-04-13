import './HomePage.css'

/**
 * 订单中心子路由占位页：订单列表、状态与售后等后续在此展开。
 */
export function MallOrdersPage() {
  return (
    <div className="admin-subpage">
      <h1 className="admin-subpage__title">订单中心</h1>
      <p className="admin-subpage__lead">
        商城订单查询、发货与售后处理。可在此接入 server mall 订单相关管理接口。
      </p>
    </div>
  )
}
