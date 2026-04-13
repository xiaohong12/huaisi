import './HomePage.css'

/**
 * 帖子中心子路由占位页：版块、帖子、评论与互动等后续在此展开。
 */
export function ContentOpsPage() {
  return (
    <div className="admin-subpage">
      <h1 className="admin-subpage__title">帖子中心</h1>
      <p className="admin-subpage__lead">
        轮播、版块、帖子、评论与点赞收藏等管理。对接 server posts 相关接口后可在此实现列表与审核。
      </p>
    </div>
  )
}
