import { BASE_URL, request } from "@/utils/request";
import type { ApiError, ApiResponse } from "@/types/api";

/**
 * 通用测试接口数据结构。
 */
export interface CommonTestData {
  name: string;
  now: string;
}

/**
 * 图片 Base64 接口数据结构。
 */
export interface CommonImageData {
  imageBase64: string;
}

/**
 * 远程下载图片 Base64 接口数据结构。
 */
export interface RemoteImageData {
  imageBase64: string;
}

/**
 * 远程示例图接口数据结构（与 remote-image-base64 一致，均为 Base64）。
 */
export interface RemoteImageUrlData {
  imageBase64: string;
}

/**
 * 上传图片接口数据结构（文件在服务端 image/test，不再返回可直链 URL）。
 */
export interface UploadImageData {
  fileName: string;
  imageBase64: string;
}

/**
 * 用户列表接口数据结构。
 */
export interface UserItem {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  avatar: string;
  gender: "male" | "female" | "unknown";
  created_at: string;
}

/**
 * 登录接口请求参数结构（手机号 + 密码）。
 */
export interface LoginPayload {
  phone: string;
  password: string;
}

/**
 * 登录接口返回数据结构。
 */
export interface LoginData {
  token: string;
  expiresAt: string;
  user: {
    id: number;
    username: string;
    nickname: string;
    avatar: string;
    gender: "male" | "female" | "unknown";
  };
}

/**
 * 微信小程序登录请求参数。
 */
export interface WechatMiniLoginPayload {
  code: string;
  nickname?: string;
  avatar?: string;
  gender?: number;
}

/**
 * 微信手机号接口返回结构。
 */
export interface WechatPhoneData {
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode: string;
}

/**
 * 调用后端测试接口，获取服务基础信息。
 */
export const getCommonTestApi = (): Promise<ApiResponse<CommonTestData>> => {
  return request<CommonTestData>({
    url: "/api/common/test",
    method: "GET",
  });
};

/**
 * 调用后端图片接口，获取预置图片 Base64 数据。
 */
export const getCommonImageApi = (): Promise<ApiResponse<CommonImageData>> => {
  return request<CommonImageData>({
    url: "/api/common/image-url",
    method: "GET",
  });
};

/**
 * 调用后端远程下载接口，返回远程图片 Base64。
 */
export const getRemoteImageApi = (): Promise<ApiResponse<RemoteImageData>> => {
  return request<RemoteImageData>({
    url: "/api/common/remote-image-base64",
    method: "GET",
  });
};

/**
 * 调用后端远程示例图接口，返回 Base64 数据（与 getRemoteImageApi 行为一致）。
 */
export const getRemoteImageUrlApi = (): Promise<ApiResponse<RemoteImageUrlData>> => {
  return request<RemoteImageUrlData>({
    url: "/api/common/remote-image-url",
    method: "GET",
  });
};

/**
 * 上传图片到后端 image/test 目录，返回文件名与 Base64 data URL。
 * @param filePath 小程序临时文件路径
 */
export const uploadImageApi = (filePath: string): Promise<ApiResponse<UploadImageData>> => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync("token") as string | undefined;
    const header: Record<string, string> = {};
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }
    uni.uploadFile({
      url: `${BASE_URL}/api/common/upload-image`,
      filePath,
      name: "file",
      header,
      success: (res) => {
        const data = JSON.parse(res.data) as ApiResponse<UploadImageData>;
        resolve(data);
      },
      fail: (err) => {
        reject(err as ApiError);
      },
    });
  });
};

/**
 * 获取用户表全部数据，供前端列表展示。
 */
export const getUsersApi = (): Promise<ApiResponse<UserItem[]>> => {
  return request<UserItem[]>({
    url: "/api/common/users",
    method: "GET",
  });
};

/**
 * 调用登录接口，校验手机号与密码并返回 token。
 * @param payload 登录参数（手机号和密码）
 */
export const loginApi = (payload: LoginPayload): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: "/api/auth/login",
    method: "POST",
    data: payload as unknown as Record<string, unknown>,
  });
};

/**
 * 微信小程序登录：前端上传 code，服务端换 openid 并处理注册/登录。
 * @param payload 包含 uni.login 拿到的 code
 */
export const wechatMiniLoginApi = (payload: WechatMiniLoginPayload): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: "/api/auth/wechat-mini-login",
    method: "POST",
    data: payload as unknown as Record<string, unknown>,
  });
};

/**
 * 微信手机号获取接口：用 getPhoneNumber 的 code 换手机号。
 * @param code 微信手机号凭证 code
 */
export const wechatMiniPhoneApi = (code: string): Promise<ApiResponse<WechatPhoneData>> => {
  return request<WechatPhoneData>({
    url: "/api/auth/wechat-mini-phone",
    method: "POST",
    data: { code },
  });
};
