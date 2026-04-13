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
