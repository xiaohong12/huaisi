import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchAdminWorkbenchToday } from '@/api/adminWorkbench'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import './HomePage.css'

interface DashboardMetricCard {
  key: string
  label: string
  value: string
  hint: string
}

function formatMoney(amount: number): string {
  return `¥${Number(amount || 0).toFixed(2)}`
}

function formatDateTime(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN')
}

/**
 * 工作台子路由（`/`）：展示运营核心指标、小时趋势与最新交易明细。
 */
export function HomePage() {
  const navigate = useNavigate()
  const [trendMode, setTrendMode] = useState<'hour' | 'day'>('hour')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState({
    activeUsersToday: 0,
    orderCountToday: 0,
    postCountToday: 0,
    tradeAmountToday: 0,
    newUsersToday: 0,
    averageOrderAmountToday: 0,
  })
  const [hourlyTrend, setHourlyTrend] = useState<
    { hour: string; orderCount: number; postCount: number; activeUsers: number }[]
  >([])
  const [dailyTrend, setDailyTrend] = useState<
    { date: string; label: string; orderCount: number; postCount: number; activeUsers: number }[]
  >([])
  const [latestTrades, setLatestTrades] = useState<
    {
      id: number
      orderNo: string
      userId: number
      username: string
      totalAmount: number
      workflowStatus: string
      createdAt: string
    }[]
  >([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const json = await fetchAdminWorkbenchToday()
        if (json.code !== 0 || !json.data) {
          setError(json.message || '工作台数据加载失败')
          setMetrics({
            activeUsersToday: 0,
            orderCountToday: 0,
            postCountToday: 0,
            tradeAmountToday: 0,
            newUsersToday: 0,
            averageOrderAmountToday: 0,
          })
          setHourlyTrend([])
          setDailyTrend([])
          setLatestTrades([])
          return
        }
        setMetrics(json.data.metrics)
        setHourlyTrend(json.data.hourlyTrend)
        setDailyTrend(json.data.dailyTrend || [])
        setLatestTrades(json.data.latestTrades)
      } catch {
        setError('网络错误，请检查后端服务')
        setMetrics({
          activeUsersToday: 0,
          orderCountToday: 0,
          postCountToday: 0,
          tradeAmountToday: 0,
          newUsersToday: 0,
          averageOrderAmountToday: 0,
        })
        setHourlyTrend([])
        setDailyTrend([])
        setLatestTrades([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const metricCards = useMemo<DashboardMetricCard[]>(
    () => [
      {
        key: 'activeUsersToday',
        label: '活跃人数',
        value: String(metrics.activeUsersToday),
        hint: '按发帖/评论/点赞/收藏/下单行为去重',
      },
      {
        key: 'orderCountToday',
        label: '订单成交量',
        value: String(metrics.orderCountToday),
        hint: '仅统计已支付订单',
      },
      {
        key: 'postCountToday',
        label: '发帖量',
        value: String(metrics.postCountToday),
        hint: '按帖子创建时间统计',
      },
      {
        key: 'tradeAmountToday',
        label: '交易额',
        value: formatMoney(metrics.tradeAmountToday),
        hint: '已支付订单总金额',
      },
      {
        key: 'newUsersToday',
        label: '新增用户',
        value: String(metrics.newUsersToday),
        hint: '用户中心可查看明细',
      },
      {
        key: 'averageOrderAmountToday',
        label: '客单价',
        value: formatMoney(metrics.averageOrderAmountToday),
        hint: '交易额 / 成交订单数',
      },
    ],
    [metrics]
  )

  /**
   * 趋势图数据源切换：小时模式显示今日 24 小时；天模式显示最近 7 天。
   */
  const trendData = useMemo(() => {
    if (trendMode === 'day') {
      return dailyTrend.map((item) => ({
        axisLabel: item.label,
        orderCount: item.orderCount,
        postCount: item.postCount,
        activeUsers: item.activeUsers,
      }))
    }
    return hourlyTrend.map((item) => ({
      axisLabel: item.hour,
      orderCount: item.orderCount,
      postCount: item.postCount,
      activeUsers: item.activeUsers,
    }))
  }, [trendMode, dailyTrend, hourlyTrend])

  return (
    <div className="admin-home">
      <Card className="bg-white rounded-[30px] border-none shadow-sm">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-normal">工作台</CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {error ? (
            <p className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <section className="admin-home__metric-grid" aria-label="核心指标">
            {metricCards.map((card) => (
              <article key={card.key} className="admin-home__metric-card">
                <p className="admin-home__metric-label">{card.label}</p>
                <p className="admin-home__metric-value">{loading ? '加载中…' : card.value}</p>
                <p className="admin-home__metric-hint">{card.hint}</p>
              </article>
            ))}
          </section>

          <div className="admin-home__content-grid">
            <section className="admin-home__panel" aria-label="趋势图">
              <div className="admin-home__panel-head">
                <h3>趋势图（小时 / 天）</h3>
                <p>支持切换今日 24 小时与最近 7 天的数据走势。</p>
              </div>
              <div className="admin-home__trend-switch">
                <Button
                  type="button"
                  size="sm"
                  variant={trendMode === 'hour' ? 'default' : 'outline'}
                  className="h-8 rounded-md px-3"
                  onClick={() => setTrendMode('hour')}
                >
                  按小时
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={trendMode === 'day' ? 'default' : 'outline'}
                  className="h-8 rounded-md px-3"
                  onClick={() => setTrendMode('day')}
                >
                  按天（近7天）
                </Button>
              </div>
              <div className="admin-home__chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="axisLabel" tick={{ fontSize: 12 }} interval={trendMode === 'hour' ? 3 : 0} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={36} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="activeUsers"
                      name="活跃人数"
                      stroke="#22c55e"
                      fill="url(#activeGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="orderCount"
                      name="成交订单"
                      stroke="#3b82f6"
                      fill="url(#orderGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="postCount"
                      name="发帖量"
                      stroke="#f97316"
                      fill="transparent"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="admin-home__panel" aria-label="最新交易列表">
              <div className="admin-home__panel-head">
                <h3>最新 10 笔交易</h3>
                <p>点击任意交易可直接跳到订单中心并自动带入订单号搜索。</p>
              </div>
              <div className="admin-home__trade-list">
                {loading ? (
                  <p className="admin-home__trade-empty">加载中…</p>
                ) : latestTrades.length === 0 ? (
                  <p className="admin-home__trade-empty">今天暂无成交订单</p>
                ) : (
                  latestTrades.map((trade) => (
                    <button
                      key={trade.id}
                      type="button"
                      className="admin-home__trade-item"
                      onClick={() => navigate(`/orders?keyword=${encodeURIComponent(trade.orderNo)}`)}
                    >
                      <div className="admin-home__trade-top">
                        <span className="admin-home__trade-order">{trade.orderNo}</span>
                        <span className="admin-home__trade-amount">{formatMoney(trade.totalAmount)}</span>
                      </div>
                      <div className="admin-home__trade-bottom">
                        <span>{trade.username}</span>
                        <span>{trade.workflowStatus}</span>
                        <span>{formatDateTime(trade.createdAt)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
