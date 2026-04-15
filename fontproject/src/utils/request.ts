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
export const BASE_URL = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BASE_URL
  || "http://192.168.31.57:7001").trim();

/**
 * 图片资源对外访问地址（内网穿透/公网域名）：
 * - 帖子图片等静态资源优先走 HTTPS 穿透地址，避免真机拦截内网 http 图片。
 * - 未配置时回退为 BASE_URL。
 */
export const ASSET_BASE_URL = ((import.meta as { env?: Record<string, string | undefined> }).env
  ?.VITE_ASSET_BASE_URL || "").trim();

/**
 * 获取最终生效的图片资源基础地址，去掉末尾斜杠避免拼接双斜杠。
 */
const getAssetBaseUrl = (): string => {
  const base = (ASSET_BASE_URL || BASE_URL).trim();
  return base.replace(/\/+$/, "");
};

/**
 * 判断是否为局域网/本机地址（用于识别需要走内网穿透改写的图片 URL）。
 */
const isPrivateHost = (hostname: string): boolean => {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  return false;
};

/**
 * 将局域网图片绝对地址改写为穿透域名地址，仅处理 /image/... 路径，避免误改业务接口 URL。
 */
const rewritePrivateImageUrl = (raw: string): string => {
  try {
    const parsed = new URL(raw);
    if (!isPrivateHost(parsed.hostname) || !parsed.pathname.startsWith("/image/")) {
      return raw;
    }
    return `${getAssetBaseUrl()}${parsed.pathname}${parsed.search || ""}`;
  } catch {
    return raw;
  }
};

/**
 * 将相对资源路径（如 /image/xxx）转为可访问的完整地址。
 * 已是 http(s)、data URL（后端 Base64 预览）、小程序本地文件路径时原样返回，避免拼成非法 URL。
 */
export const resolveAssetUrl = (pathOrUrl: string): string => {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return rewritePrivateImageUrl(pathOrUrl);
  }
  if (/^data:image\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith("blob:") || pathOrUrl.startsWith("wxfile://")) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getAssetBaseUrl()}${p}`;
};

/**
 * 仅处理图片资源字符串：
 * - http/https、data:image、blob、wxfile 保持原样；
 * - /image/... 或 image/... 自动补全服务端地址；
 * - test/... 视为 image 目录下文件，补全为 /image/test/...
 */
const normalizeImageAssetString = (raw: string): string => {
  if (!raw) return raw;
  const isImageFileRef = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(raw);
  if (raw.startsWith("http://") || raw.startsWith("https://")) return rewritePrivateImageUrl(raw);
  if (/^data:image\//i.test(raw)) return raw;
  if (raw.startsWith("blob:") || raw.startsWith("wxfile://")) return raw;
  if (raw.startsWith("/image/")) return `${getAssetBaseUrl()}${raw}`;
  if (raw.startsWith("image/")) return `${getAssetBaseUrl()}/${raw}`;
  if (raw.startsWith("test/") && isImageFileRef) return `${getAssetBaseUrl()}/image/${raw}`;
  return raw;
};

/**
 * 递归扫描接口响应中的字符串字段，统一处理图片地址。
 */
const normalizeImageAssetsDeep = <T>(value: T): T => {
  const walked = new WeakSet<object>();
  const walk = (input: unknown): unknown => {
    if (typeof input === "string") {
      return normalizeImageAssetString(input);
    }
    if (Array.isArray(input)) {
      return input.map((item) => walk(item));
    }
    if (!input || typeof input !== "object") {
      return input;
    }
    if (walked.has(input as object)) {
      return input;
    }
    walked.add(input as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = walk(v);
    }
    return out;
  };
  return walk(value) as T;
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
        const payload = normalizeImageAssetsDeep(res.data as ApiResponse<T>);
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
