import "express-serve-static-core";

/**
 * 扩展 Express Request：鉴权中间件解析 token 后写入当前用户 ID。
 */
declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
    /** 管理后台 admin_tokens 解析后的管理员 ID */
    adminId?: number;
  }
}
