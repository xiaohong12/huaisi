import { Response } from 'express';

/**
 * 统一接口响应结构，前后端约定均按该格式进行数据交互。
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
}

/**
 * 返回成功响应。
 * @param res Express 响应对象
 * @param data 业务数据
 * @param message 返回说明
 * @param code 业务状态码
 * @param statusCode HTTP 状态码
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message = 'Success',
  code = 0,
  statusCode = 200
): void => {
  const response: ApiResponse<T> = {
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  res.status(statusCode).json(response);
};

/**
 * 返回错误响应。
 * @param res Express 响应对象
 * @param message 错误信息
 * @param statusCode HTTP 状态码
 * @param code 业务状态码
 */
export const errorResponse = (
  res: Response,
  message: string,
  statusCode = 500,
  code = statusCode
): void => {
  const response: ApiResponse<null> = {
    code,
    message,
    data: null,
    timestamp: new Date().toISOString()
  };
  res.status(statusCode).json(response);
};
