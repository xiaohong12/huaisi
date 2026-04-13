import { request } from "@/utils/request";
import type { ApiResponse } from "@/types/api";

/**
 * 修改登录密码请求体：服务端校验原密码后更新，并吊销当前用户所有 token。
 */
export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

/**
 * 修改密码成功后的占位数据结构。
 */
export interface ChangePasswordResult {
  ok: boolean;
}

/**
 * 调用后端修改密码接口：需携带有效 token；成功后服务端吊销登录态，前端应清理本地并跳转登录。
 * @param payload 原密码与新密码
 */
export const changeUserPasswordApi = (
  payload: ChangePasswordPayload
): Promise<ApiResponse<ChangePasswordResult>> => {
  return request<ChangePasswordResult>({
    url: "/api/user/password",
    method: "PUT",
    data: payload as unknown as Record<string, unknown>,
  });
};
