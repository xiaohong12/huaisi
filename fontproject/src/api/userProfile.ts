import { request } from "@/utils/request";

/**
 * 更新资料接口返回的用户字段（与登录缓存 loginUser 对齐）。
 */
export interface ProfileUserDto {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: "male" | "female" | "unknown";
}

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
 * 更新当前用户资料（头像 avatar 为相对路径如 /image/test/xxx.png 或完整 http(s) 外链）。
 */
export const updateUserProfileApi = (data: { avatar: string }) => {
  return request<{ user: ProfileUserDto }>({
    url: "/api/user/profile",
    method: "PUT",
    data: data as Record<string, unknown>,
  });
};
