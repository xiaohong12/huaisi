import type { ApiResponse, ApiError } from "@/types/api";

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

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data: bodyPayload as Record<string, unknown> | string | ArrayBuffer,
      header: { ...authHeader, ...jsonHeader, ...header },
      success: (res) => {
        const payload = res.data as ApiResponse<T>;
        resolve(payload);
      },
      fail: (err) => {
        reject(err as ApiError);
      },
    });
  });
};
