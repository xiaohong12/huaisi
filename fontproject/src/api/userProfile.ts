import { request } from "@/utils/request";

/**
 * 更新资料接口返回的用户字段（与登录缓存 loginUser 对齐）。
 */
export interface ProfileUserDto {
  id: number;
  username: string;
  nickname: string;
  phone: string;
  avatar: string;
  gender: "male" | "female" | "unknown";
}

/** 更新资料时可传的字段，至少包含一项 */
export type UpdateUserProfilePayload = {
  avatar?: string;
  nickname?: string;
  phone?: string;
};

/**
 * GET /api/user/profile
 * 拉取当前登录用户资料（与登录后缓存字段一致，头像已为可展示的 data URL 或外链）。
 */
export const getUserProfileApi = () => {
  return request<{ user: ProfileUserDto }>({
    url: "/api/user/profile",
    method: "GET",
  });
};

/**
 * PUT /api/user/profile
 * 更新当前用户资料（avatar / nickname / phone 至少传一项；头像为相对路径或 http(s) 外链）。
 */
export const updateUserProfileApi = (data: UpdateUserProfilePayload) => {
  return request<{ user: ProfileUserDto }>({
    url: "/api/user/profile",
    method: "PUT",
    data: data as Record<string, unknown>,
  });
};
