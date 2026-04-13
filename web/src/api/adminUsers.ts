import { getAdminToken } from '@/auth/adminToken'
import { getApiBase } from '@/config'

export interface AdminUserListItem {
  id: number
  username: string
  nickname: string
  phone: string | null
  openid: string | null
  avatar: string
  gender: string
  created_at: string
}

export interface AdminUserListResponse {
  code: number
  message: string
  data: {
    list: AdminUserListItem[]
    total: number
    page: number
    pageSize: number
  } | null
}

export interface FetchAdminUserListParams {
  page: number
  pageSize: number
  /** 模糊匹配用户名 */
  username?: string
}

/**
 * 请求管理后台用户分页列表（需已登录管理员）。
 */
export async function fetchAdminUserList(
  params: FetchAdminUserListParams
): Promise<AdminUserListResponse> {
  const token = getAdminToken()
  const sp = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.username?.trim()) {
    sp.set('username', params.username.trim())
  }
  const res = await fetch(`${getApiBase()}/api/admin/users?${sp.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminUserListResponse
}
