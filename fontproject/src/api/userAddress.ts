import { request } from "@/utils/request";
import type { ApiResponse } from "@/types/api";

/**
 * 单条收货地址（与后端 user_addresses 映射字段一致）。
 */
export interface UserAddressDTO {
  id: number;
  consignee: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * GET /api/user/addresses 返回的列表载荷。
 */
export interface UserAddressListData {
  list: UserAddressDTO[];
}

/**
 * 新增/更新地址时提交的表单体。
 */
export interface UserAddressPayload {
  consignee: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

/**
 * 拉取当前登录用户的收货地址列表（默认地址优先）。
 */
export const getUserAddressListApi = (): Promise<ApiResponse<UserAddressListData>> => {
  return request<UserAddressListData>({ url: "/api/user/addresses" });
};

/**
 * 按 id 获取单条地址，供编辑页回填。
 */
export const getUserAddressDetailApi = (id: number): Promise<ApiResponse<UserAddressDTO>> => {
  return request<UserAddressDTO>({ url: `/api/user/addresses/${id}` });
};

/**
 * 新增收货地址。
 */
export const createUserAddressApi = (
  payload: UserAddressPayload
): Promise<ApiResponse<{ id: number }>> => {
  return request<{ id: number }>({
    url: "/api/user/addresses",
    method: "POST",
    data: payload as unknown as Record<string, unknown>,
  });
};

/**
 * 更新收货地址。
 */
export const updateUserAddressApi = (
  id: number,
  payload: UserAddressPayload
): Promise<ApiResponse<{ id: number }>> => {
  return request<{ id: number }>({
    url: `/api/user/addresses/${id}`,
    method: "PUT",
    data: payload as unknown as Record<string, unknown>,
  });
};

/**
 * 删除收货地址。
 */
export const deleteUserAddressApi = (id: number): Promise<ApiResponse<{ id: number }>> => {
  return request<{ id: number }>({
    url: `/api/user/addresses/${id}`,
    method: "DELETE",
  });
};
