import { BASE_URL, request } from "@/utils/request";
import { clearLocalLoginState } from "@/utils/clearAuthStorage";
import type { ApiResponse } from "@/types/api";

/**
 * 通用测试接口数据结构。
 */
export interface CommonTestData {
  name: string;
  now: string;
}

/**
 * 图片地址接口数据结构：支持 /image 下相对路径或 http/https 绝对地址。
 */
export interface CommonImageData {
  imageUrl: string;
}

/**
 * 远程下载图片接口数据结构：服务端直接返回图片地址。
 */
export interface RemoteImageData {
  imageUrl: string;
}

/**
 * 远程示例图接口数据结构：服务端直接返回图片地址。
 */
export interface RemoteImageUrlData {
  imageUrl: string;
}

/**
 * 上传图片接口数据结构（文件保存在服务端 image/test）。
 */
export interface UploadImageData {
  fileName: string;
  imageUrl?: string;
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
 * 手机号注册接口请求参数：手机号、密码及头像、姓名、性别。
 */
export interface RegisterPayload {
  phone: string;
  password: string;
  /** 展示姓名，对应服务端 users.nickname */
  nickname: string;
  gender: "male" | "female" | "unknown";
  /** 上传接口返回的路径，如 /image/test/xxx.png */
  avatar: string;
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
 * 登录态校验接口返回：当前 token 对应用户 ID。
 */
export interface AuthSessionData {
  userId: number;
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
 * 调用后端图片接口，获取可直接展示的图片地址。
 */
export const getCommonImageApi = (): Promise<ApiResponse<CommonImageData>> => {
  return request<CommonImageData>({
    url: "/api/common/image-url",
    method: "GET",
  });
};

/**
 * 调用后端远程下载接口，返回远程图片地址。
 */
export const getRemoteImageApi = (): Promise<ApiResponse<RemoteImageData>> => {
  return request<RemoteImageData>({
    url: "/api/common/remote-image-base64",
    method: "GET",
  });
};

/**
 * 调用后端远程示例图接口，返回图片地址（与 getRemoteImageApi 行为一致）。
 */
export const getRemoteImageUrlApi = (): Promise<ApiResponse<RemoteImageUrlData>> => {
  return request<RemoteImageUrlData>({
    url: "/api/common/remote-image-url",
    method: "GET",
  });
};

/**
 * 上传图片可选配置：注册等未登录场景不传 token，避免无效 Authorization 经网关/后续鉴权扩展时干扰上传。
 */
export interface UploadImageOptions {
  omitAuth?: boolean;
}

/**
 * 解析 uni.uploadFile 返回的 data：各端可能是 string 或已解析的 object，非法 JSON 时抛出明确错误。
 */
const parseUploadFileResponse = (raw: unknown): ApiResponse<UploadImageData> => {
  if (raw && typeof raw === "object" && "code" in (raw as object)) {
    return raw as ApiResponse<UploadImageData>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error("上传接口返回空响应，请检查服务地址与网络");
    }
    try {
      return JSON.parse(trimmed) as ApiResponse<UploadImageData>;
    } catch {
      const hint = trimmed.startsWith("<") ? "服务端返回了非 JSON（常为网关/代理错误页）" : "上传接口响应不是合法 JSON";
      throw new Error(`${hint}，HTTP 或代理状态请查看开发者工具 Network`);
    }
  }
  throw new Error("上传接口响应格式异常");
};

/**
 * 上传图片到后端 image/test 目录，返回文件名；前端按约定拼接 `/image/test/<fileName>` 使用。
 * @param filePath 小程序临时文件路径
 * @param options 可选；注册页等未登录上传建议传 { omitAuth: true }
 */
export const uploadImageApi = (
  filePath: string,
  options?: UploadImageOptions
): Promise<ApiResponse<UploadImageData>> => {
  return new Promise((resolve, reject) => {
    const omitAuth = Boolean(options?.omitAuth);
    const token = omitAuth ? "" : ((uni.getStorageSync("token") as string | undefined) || "");
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
        const status = res.statusCode ?? 200;
        let data: ApiResponse<UploadImageData>;
        try {
          data = parseUploadFileResponse(res.data);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "解析上传响应失败";
          resolve({
            code: status >= 400 ? status : 500,
            message: msg,
            data: null,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        if (token && (status === 401 || data.code === 401)) {
          clearLocalLoginState();
        }
        if (status >= 400 && (data.code === 0 || data.code === 200)) {
          resolve({
            code: status,
            message: data.message || `HTTP ${status}`,
            data: null,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        resolve(data);
      },
      fail: (err) => {
        const msg =
          typeof err?.errMsg === "string"
            ? err.errMsg
            : "上传请求失败（请检查 BASE_URL、本机与手机是否同网段、小程序合法域名）";
        reject(new Error(msg));
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
 * 手机号注册：后端校验资料完整后创建用户并签发 token（与登录成功返回结构一致）。
 * @param payload 注册参数（手机号、密码、昵称、性别、头像路径）
 */
export const registerApi = (payload: RegisterPayload): Promise<ApiResponse<LoginData>> => {
  return request<LoginData>({
    url: "/api/auth/register",
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

/**
 * 校验当前本地 token 在服务端是否仍有效（未过期、未吊销）。
 */
export const validateAuthSessionApi = (): Promise<ApiResponse<AuthSessionData>> => {
  return request<AuthSessionData>({
    url: "/api/auth/session",
    method: "GET",
  });
};
