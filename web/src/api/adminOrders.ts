import { getAdminToken } from '@/auth/adminToken'
import { getApiBase } from '@/config'

export type AdminOrderStatus = 'pending' | 'paid'

export interface AdminOrderListItem {
  id: number
  orderNo: string
  userId: number
  username: string
  totalAmount: number
  status: AdminOrderStatus
  createdAt: string
  /** 订单第一件商品 id，用于后台查看商品详情 */
  productId: number
  /** 订单第一件商品名称（用于后台列表直观识别订单商品） */
  productName: string
  /** 订单第一件商品主图（第一张图） */
  productCover: string
}

export interface FetchAdminOrderListParams {
  page: number
  pageSize: number
  keyword?: string
}

export interface AdminOrderListResponse {
  code: number
  message: string
  data: {
    list: AdminOrderListItem[]
    total: number
    page: number
    pageSize: number
  } | null
}

export interface AdminMallProductDetail {
  id: number
  title: string
  price: number
  soldCount: number
  stock: number
  coverUrl: string
  detailImages: string[]
  description: string
  sevenDayNoReason?: boolean
}

export interface AdminMallProductDetailResponse {
  code: number
  message: string
  data: AdminMallProductDetail | null
}

/**
 * 请求管理后台订单分页列表（包含商品主图与商品名）。
 */
export async function fetchAdminOrderList(
  params: FetchAdminOrderListParams
): Promise<AdminOrderListResponse> {
  const token = getAdminToken()
  const sp = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.keyword?.trim()) {
    sp.set('keyword', params.keyword.trim())
  }

  const res = await fetch(`${getApiBase()}/api/admin/orders?${sp.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  return (await res.json()) as AdminOrderListResponse
}

/**
 * 按商品 id 获取商品详情（复用商城详情接口），用于后台订单页弹窗展示多图与详情文案。
 */
export async function fetchAdminMallProductDetail(
  productId: number
): Promise<AdminMallProductDetailResponse> {
  const res = await fetch(`${getApiBase()}/api/mall/products/${productId}`)
  return (await res.json()) as AdminMallProductDetailResponse
}
