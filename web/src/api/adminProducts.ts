import { getAdminToken } from '@/auth/adminToken'
import { getApiBase } from '@/config'

/** 管理后台商品列表项（映射 mall_products 核心字段） */
export interface AdminProductListItem {
  id: number
  title: string
  price: number
  soldCount: number
  stock: number
  coverUrl: string
  coverAspect: number
  detailImages: string[]
  description: string
  status: 0 | 1
  sevenDayNoReason: boolean
  createdAt: string
  updatedAt: string
}

export interface FetchAdminProductListParams {
  page: number
  pageSize: number
  keyword?: string
  status?: '0' | '1'
}

export interface AdminProductListResponse {
  code: number
  message: string
  data: {
    list: AdminProductListItem[]
    total: number
    page: number
    pageSize: number
  } | null
}

export interface CreateAdminProductBody {
  title: string
  price: number
  soldCount: number
  stock: number
  coverUrl: string
  coverAspect: number
  detailImages: string[]
  description: string
  status: 0 | 1
  sevenDayNoReason: boolean
}

export interface CreateAdminProductResponse {
  code: number
  message: string
  data: {
    id: number
  } | null
}

export interface UpdateAdminProductBody extends CreateAdminProductBody {
  id: number
}

export interface DeleteAdminProductResponse {
  code: number
  message: string
  data: {
    id: number
  } | null
}

/**
 * 查询管理后台商品列表，支持关键词和上下架状态筛选。
 */
export async function fetchAdminProductList(
  params: FetchAdminProductListParams
): Promise<AdminProductListResponse> {
  const token = getAdminToken()
  const sp = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.keyword?.trim()) {
    sp.set('keyword', params.keyword.trim())
  }
  if (params.status !== undefined) {
    sp.set('status', params.status)
  }

  const res = await fetch(`${getApiBase()}/api/admin/products?${sp.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminProductListResponse
}

/**
 * 管理后台新增商品，成功后返回新商品 ID。
 */
export async function createAdminProduct(body: CreateAdminProductBody): Promise<CreateAdminProductResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return (await res.json()) as CreateAdminProductResponse
}

/**
 * 管理后台编辑商品，支持更新封面、详情图、状态等字段。
 */
export async function updateAdminProduct(body: UpdateAdminProductBody): Promise<CreateAdminProductResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/products/${body.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      title: body.title,
      price: body.price,
      soldCount: body.soldCount,
      stock: body.stock,
      coverUrl: body.coverUrl,
      coverAspect: body.coverAspect,
      detailImages: body.detailImages,
      description: body.description,
      status: body.status,
      sevenDayNoReason: body.sevenDayNoReason,
    }),
  })
  return (await res.json()) as CreateAdminProductResponse
}

/**
 * 管理后台删除商品。
 */
export async function deleteAdminProduct(id: number): Promise<DeleteAdminProductResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/products/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as DeleteAdminProductResponse
}
