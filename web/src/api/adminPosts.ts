import { getAdminToken } from '@/auth/adminToken'
import { getApiBase } from '@/config'

export interface AdminPostListItem {
  id: number
  /** 发布者展示名：优先昵称，其次用户名 */
  authorDisplayName: string
  title: string
  /** 数据库中的列表摘要字段 excerpt */
  excerpt: string
  likeCount: number
  commentCount: number
  /** 与 posts.status 一致：0 草稿 1 已发布 2 已隐藏 3 已删除 */
  status: number
  createdAt: string
}

export interface AdminPostListResponse {
  code: number
  message: string
  data: {
    list: AdminPostListItem[]
    total: number
    page: number
    pageSize: number
  } | null
}

/** 帖子状态筛选项：空字符串表示不按状态过滤（与 posts.status 数值一致） */
export type AdminPostStatusFilterValue = '' | '0' | '1' | '2' | '3'

export interface FetchAdminPostListParams {
  page: number
  pageSize: number
  /** 模糊匹配标题、正文、摘要、发布者昵称/用户名 */
  keyword?: string
  /** 按帖子 status 筛选；不传或空字符串表示全部 */
  status?: AdminPostStatusFilterValue
}

/**
 * 请求管理后台帖子分页列表（需已登录管理员）。
 */
export async function fetchAdminPostList(
  params: FetchAdminPostListParams
): Promise<AdminPostListResponse> {
  const token = getAdminToken()
  const sp = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.keyword?.trim()) {
    sp.set('keyword', params.keyword.trim())
  }
  if (params.status !== undefined && params.status !== '') {
    sp.set('status', params.status)
  }
  const res = await fetch(`${getApiBase()}/api/admin/posts?${sp.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminPostListResponse
}

/** 与 C 端评论列表项一致，管理端只读展示 */
export interface AdminPostDetailComment {
  id: number
  userId: number
  nickname: string
  content: string
  parentId: number | null
  replyToUserId: number | null
  replyToNickname: string | null
  createdAt: string
}

/** 管理端帖子详情主体（对齐小程序首页帖子 DTO 核心字段） */
export interface AdminPostDetail {
  id: number
  title: string
  content: string
  excerpt: string
  commentCount: number
  likeCount: number
  favoriteCount: number
  nickname: string
  avatar: string
  sectionName: string
  imageUrls: string[]
  status: number
  createdAt: string
}

export interface AdminPostDetailResponse {
  code: number
  message: string
  data: {
    post: AdminPostDetail
    comments: AdminPostDetailComment[]
  } | null
}

/**
 * 拉取单条帖子详情及可见评论（管理后台预览，需 admin token）。
 */
export async function fetchAdminPostDetail(postId: number): Promise<AdminPostDetailResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/posts/${postId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminPostDetailResponse
}

export interface AdminPostDeleteResponse {
  code: number
  message: string
  data: { id: number } | null
}

/**
 * 管理后台删除帖子：后端将 status 置为 3（软删除），需 admin token。
 */
export async function deleteAdminPost(postId: number): Promise<AdminPostDeleteResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/posts/${postId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminPostDeleteResponse
}

/**
 * 管理后台恢复帖子：后端将 status 恢复为 1（已发布），需 admin token。
 */
export async function restoreAdminPost(postId: number): Promise<AdminPostDeleteResponse> {
  const token = getAdminToken()
  const res = await fetch(`${getApiBase()}/api/admin/posts/${postId}/restore`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return (await res.json()) as AdminPostDeleteResponse
}
