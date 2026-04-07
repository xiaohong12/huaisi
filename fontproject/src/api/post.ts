import { request } from "@/utils/request";
import type { ApiResponse } from "@/types/api";

/**
 * 与后端 `PublishSectionKey` 一致：电影文化 / 动漫·协会 / 其他模块。
 */
export type PublishSectionKey = "film_culture" | "anime_association" | "other";

/**
 * 创建帖子接口请求体。
 */
export interface CreatePostPayload {
  title: string;
  content: string;
  sectionKey: PublishSectionKey;
  /** 每项为 `test/文件名`（上传接口返回 fileName 时拼上 test/）、data URL 或可访问的图片 URL */
  imageUrls?: string[];
}

/**
 * 创建帖子接口返回数据。
 */
export interface CreatePostData {
  id: number;
  sectionId: number;
}

/**
 * 调用发帖接口：保存标题、正文、版块与图片地址（需登录，请求头自动带 token）。
 */
export const createPostApi = (payload: CreatePostPayload): Promise<ApiResponse<CreatePostData>> => {
  return request<CreatePostData>({
    url: "/api/posts",
    method: "POST",
    data: payload as unknown as Record<string, unknown>,
  });
};

/**
 * 首页信息流单条数据结构（与后端 GET /api/posts 返回 list 项一致）。
 */
export interface PostFeedItemDTO {
  id: number;
  title: string;
  excerpt: string;
  commentCount: number;
  likeCount: number;
  /** 收藏数（与 posts.favorite_count 一致） */
  favoriteCount: number;
  nickname: string;
  avatar: string;
  sectionName: string;
  /** 帖子配图 data URL（Base64），与后端列表接口一致 */
  imageUrls: string[];
  /** 当前登录用户是否已点赞；未登录时为 false */
  liked: boolean;
  /** 当前登录用户是否已收藏；未登录时为 false */
  favorited: boolean;
}

/**
 * 首页帖子流分页数据。
 */
export interface PostFeedData {
  list: PostFeedItemDTO[];
  page: number;
  pageSize: number;
}

/**
 * 拉取首页帖子列表（已发布 status=1，按创建时间倒序；无需登录）。
 * @param page 页码，从 1 开始
 * @param pageSize 每页条数，最大 50
 */
export const getPostFeedApi = (page = 1, pageSize = 20): Promise<ApiResponse<PostFeedData>> => {
  const q = `page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`;
  return request<PostFeedData>({
    url: `/api/posts?${q}`,
    method: "GET",
  });
};

/**
 * 切换点赞：已赞则取消。需登录；成功时 data 为与列表项一致的完整帖子对象，便于单条刷新。
 */
export const togglePostLikeApi = (postId: number): Promise<ApiResponse<PostFeedItemDTO>> => {
  return request<PostFeedItemDTO>({
    url: `/api/posts/${postId}/like`,
    method: "POST",
    data: {},
  });
};

/**
 * 切换收藏：已收藏则取消。需登录；成功时 data 为完整帖子对象。
 */
export const togglePostFavoriteApi = (postId: number): Promise<ApiResponse<PostFeedItemDTO>> => {
  return request<PostFeedItemDTO>({
    url: `/api/posts/${postId}/favorite`,
    method: "POST",
    data: {},
  });
};

/**
 * 单条评论（与 GET/POST /api/posts/:id/comments 返回结构一致）。
 */
export interface PostCommentDTO {
  id: number;
  userId: number;
  nickname: string;
  content: string;
  parentId: number | null;
  replyToUserId: number | null;
  replyToNickname: string | null;
  createdAt: string;
}

/**
 * 帖子评论列表数据。
 */
export interface PostCommentsData {
  list: PostCommentDTO[];
}

/**
 * 发表评论接口返回：新评论 + 帖子评论总数（用于更新列表上的数字）。
 */
export interface CreateCommentResultData {
  comment: PostCommentDTO;
  commentCount: number;
}

/**
 * 拉取某帖下的评论（时间正序，支持楼中楼展示）。
 */
export const getPostCommentsApi = (
  postId: number,
  limit = 80
): Promise<ApiResponse<PostCommentsData>> => {
  const q = `limit=${encodeURIComponent(String(limit))}`;
  return request<PostCommentsData>({
    url: `/api/posts/${postId}/comments?${q}`,
    method: "GET",
  });
};

/**
 * 发表评论或回复：传 parentId 表示回复该条评论。
 */
export const createPostCommentApi = (
  postId: number,
  payload: { content: string; parentId?: number }
): Promise<ApiResponse<CreateCommentResultData>> => {
  const data: Record<string, unknown> = { content: payload.content };
  if (payload.parentId != null) {
    data.parentId = payload.parentId;
  }
  return request<CreateCommentResultData>({
    url: `/api/posts/${postId}/comments`,
    method: "POST",
    data,
  });
};
