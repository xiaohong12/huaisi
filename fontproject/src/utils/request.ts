import type { ApiResponse, ApiError } from "@/types/api";
import { clearLocalLoginState } from "@/utils/clearAuthStorage";

/** 这些接口返回 401 时多为账号错误等业务原因，不应自动清空本地登录态 */
const URL_SKIP_AUTO_CLEAR_ON_401 = ["/api/auth/login", "/api/auth/wechat-mini-login", "/api/auth/wechat-mini-phone"];

/**
 * 是否因鉴权失败而自动清理本地 token（避免登录接口误伤）。
 */
const shouldClearSessionOn401 = (relativeUrl: string): boolean => {
  return !URL_SKIP_AUTO_CLEAR_ON_401.some((path) => relativeUrl.includes(path));
};

/**
 * 后端服务基础地址，所有请求均基于该地址拼接。
 */
export const BASE_URL = "http://192.168.31.57:7001";

/**
 * 将相对资源路径（如 /image/xxx）转为可访问的完整地址；已是 http(s) 则原样返回。
 */
export const resolveAssetUrl = (pathOrUrl: string): string => {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${BASE_URL}${p}`;
};

/**
 * 通用请求参数定义。
 */
interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  data?: Record<string, unknown> | string | ArrayBuffer;
  header?: Record<string, string>;
}

/**
 * 将对象序列化为查询串；保留值为 0、false 的键（部分环境下 uni.request 的 GET data 会丢掉 0，导致如 paymentStatus=0 无法传到后端）。
 */
const buildQueryString = (query: Record<string, unknown>): string => {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(query)) {
    if (val === undefined || val === null) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
  }
  return parts.join("&");
};

/**
 * 通用请求方法：封装 uni.request，统一返回 ApiResponse 结构。
 * @param options 请求配置
 */
export const request = <T>(options: RequestOptions): Promise<ApiResponse<T>> => {
  const { url, method = "GET", data, header = {} } = options;
  const token = uni.getStorageSync("token") as string | undefined;
  const authHeader: Record<string, string> = {};
  if (token) {
    authHeader.Authorization = `Bearer ${token}`;
  }

  const methodUpper = (method || "GET").toUpperCase();
  const useJsonBody =
    (methodUpper === "POST" || methodUpper === "PUT") &&
    data !== undefined &&
    data !== null &&
    typeof data === "object" &&
    !(data instanceof ArrayBuffer);

  /** 小程序 POST 需显式 JSON，否则服务端 req.body 可能为空，导致校验失败或误逻辑 */
  const bodyPayload = useJsonBody ? JSON.stringify(data) : data;
  const jsonHeader: Record<string, string> = useJsonBody ? { "Content-Type": "application/json" } : {};

  /** GET：自行拼 query，避免 paymentStatus=0 等被运行时省略 */
  let requestUrl = `${BASE_URL}${url}`;
  let requestData: Record<string, unknown> | string | ArrayBuffer | undefined =
    bodyPayload as Record<string, unknown> | string | ArrayBuffer;
  if (
    methodUpper === "GET" &&
    data !== undefined &&
    data !== null &&
    typeof data === "object" &&
    !(data instanceof ArrayBuffer)
  ) {
    const qs = buildQueryString(data as Record<string, unknown>);
    if (qs) {
      requestUrl += url.includes("?") ? `&${qs}` : `?${qs}`;
    }
    requestData = undefined;
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: requestUrl,
      method,
      data: requestData as Record<string, unknown> | string | ArrayBuffer,
      header: { ...authHeader, ...jsonHeader, ...header },
      success: (res) => {
        const payload = res.data as ApiResponse<T>;
        const status = res.statusCode ?? 200;
        if (
          shouldClearSessionOn401(url) &&
          (status === 401 || payload?.code === 401)
        ) {
          clearLocalLoginState();
        }
        resolve(payload);
      },
      fail: (err) => {
        reject(err as ApiError);
      },
    });
  });
};
