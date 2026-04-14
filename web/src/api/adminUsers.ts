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
  status: number
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
  /** 模糊匹配用户名/昵称/手机号 */
  keyword?: string
}

export interface UpdateAdminUserPayload {
  /** 用户名 */
  username: string
  /** 用户昵称 */
  nickname: string
  /** 头像地址 */
  avatar: string
  /** 用户性别：male/female/unknown */
  gender: 'male' | 'female' | 'unknown'
  /** 用户手机号 */
  phone: string | null
  /** 用户状态：1=激活 0=拉黑 */
  status: 0 | 1
}

export interface AdminUserUpdateResponse {
  code: number
  message: string
  data: {
    id: number
    status: number
  } | null
}

export interface UploadImageResponse {
  code: number
  message: string
  data: {
    fileName: string
    imageBase64: string
  } | null
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
  if (params.keyword?.trim()) {
    sp.set('keyword', params.keyword.trim())
  }
  const res = await fetch(`${getApiBase()}/api/admin/users?${sp.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminUserListResponse
}

/**
 * 管理后台更新小程序用户信息（昵称、手机号、状态）。
 */
export async function updateAdminUser(
  userId: number,
  payload: UpdateAdminUserPayload
): Promise<AdminUserUpdateResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  return (await res.json()) as AdminUserUpdateResponse
}

/**
 * 上传用户头像图片到后端公共文件服务，返回文件名和预览 Base64。
 */
export async function uploadAdminUserAvatar(file: File): Promise<UploadImageResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${getApiBase()}/api/common/upload-image`, {
    method: 'POST',
    body: formData,
  })
  return (await res.json()) as UploadImageResponse
}
