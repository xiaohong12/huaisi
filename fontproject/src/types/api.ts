/**
 * 前后端统一接口响应结构定义。
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
}

/**
 * 请求异常对象定义，兼容 uni.request/uni.uploadFile 错误结构。
 */
export interface ApiError {
  errMsg?: string;
  [key: string]: unknown;
}
