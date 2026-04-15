import { getAdminToken } from '@/auth/adminToken'
import { getApiBase } from '@/config'

export interface AdminWorkbenchMetrics {
  activeUsersToday: number
  orderCountToday: number
  postCountToday: number
  tradeAmountToday: number
  newUsersToday: number
  averageOrderAmountToday: number
}

export interface AdminWorkbenchHourlyTrendItem {
  hour: string
  orderCount: number
  postCount: number
  activeUsers: number
}

export interface AdminWorkbenchDailyTrendItem {
  date: string
  label: string
  orderCount: number
  postCount: number
  activeUsers: number
}

export interface AdminWorkbenchLatestTradeItem {
  id: number
  orderNo: string
  userId: number
  username: string
  totalAmount: number
  workflowStatus: string
  createdAt: string
}

export interface AdminWorkbenchTodayResponse {
  code: number
  message: string
  data: {
    metrics: AdminWorkbenchMetrics
    hourlyTrend: AdminWorkbenchHourlyTrendItem[]
    dailyTrend: AdminWorkbenchDailyTrendItem[]
    latestTrades: AdminWorkbenchLatestTradeItem[]
  } | null
}

/**
 * 拉取管理后台工作台今日聚合数据：核心指标、小时趋势、最新交易列表。
 */
export async function fetchAdminWorkbenchToday(): Promise<AdminWorkbenchTodayResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/workbench/today`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminWorkbenchTodayResponse
}
