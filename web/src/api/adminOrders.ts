import { getAdminToken } from '@/auth/adminToken'
import { getApiBase } from '@/config'

/** 管理后台订单流程态（与 mall_orders.workflow_status 一致） */
export type AdminOrderWorkflowStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'

export interface AdminOrderListItem {
  id: number
  orderNo: string
  userId: number
  username: string
  totalAmount: number
  status: AdminOrderWorkflowStatus
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
  /** 按订单流程态筛选，不传或空字符串表示全部 */
  status?: AdminOrderWorkflowStatus
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

/** 订单首件商品快照（与 mall_order_product_snapshots 对应，图片已解析为可展示地址） */
export interface AdminOrderProductSnapshot {
  productId: number
  title: string
  coverUrl: string
  unitPrice: number
  purchaseQuantity: number
  lineSubtotal: number
  detailImages: string[]
  description: string
}

export interface AdminOrderProductSnapshotResponse {
  code: number
  message: string
  data: AdminOrderProductSnapshot | null
}

export interface PatchAdminOrderWorkflowResponse {
  code: number
  message: string
  data: { id: number; status: AdminOrderWorkflowStatus } | null
}

/**
 * 请求管理后台订单分页列表（包含商品主图与商品名）；可选 status 按流程态筛选。
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
  if (params.status) {
    sp.set('status', params.status)
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

/**
 * 按订单 ID 拉取第一件明细对应的下单商品快照，用于后台订单列表弹窗展示固化信息。
 */
export async function fetchAdminOrderFirstProductSnapshot(
  orderId: number
): Promise<AdminOrderProductSnapshotResponse> {
  const token = getAdminToken()
  const res = await fetch(
    `${getApiBase()}/api/admin/orders/${orderId}/first-product-snapshot`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  )
  return (await res.json()) as AdminOrderProductSnapshotResponse
}

/**
 * 管理后台修改订单流程状态，理由必填，服务端写入 mall_order_status_change_logs。
 */
export async function patchAdminOrderWorkflowStatus(
  orderId: number,
  body: { status: AdminOrderWorkflowStatus; reason: string }
): Promise<PatchAdminOrderWorkflowResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/orders/${orderId}/workflow-status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return (await res.json()) as PatchAdminOrderWorkflowResponse
}
