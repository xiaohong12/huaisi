import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { queryOne } from "../db";
import { successResponse } from "../utils/response";

interface TokenRow extends RowDataPacket {
  user_id: number;
}

/**
 * 从 Authorization: Bearer &lt;token&gt; 或 X-Token 头解析登录凭证。
 */
export function extractToken(req: Request): string {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  const x = req.headers["x-token"];
  if (typeof x === "string" && x.trim()) {
    return x.trim();
  }
  return "";
}

/**
 * 可选鉴权：若请求携带有效 token，则写入 req.userId；无效或缺失 token 不报错，供公开接口按需增强数据（如是否已点赞）。
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const row = await queryOne<TokenRow>(
      `SELECT ut.user_id AS user_id
       FROM user_tokens ut
       INNER JOIN users u ON u.id = ut.user_id
       WHERE ut.token = ? AND ut.is_revoked = 0 AND ut.expires_at > NOW() AND u.status = 1
       LIMIT 1`,
      [token]
    );
    if (row) {
      req.userId = row.user_id;
    }
    next();
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `鉴权查询失败: ${err.message}`, 500, 500);
  }
}

/**
 * 鉴权中间件：校验 user_tokens 表，通过后把 userId 挂到 req.userId。
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    successResponse(res, null, "请先登录", 401, 401);
    return;
  }

  try {
    const row = await queryOne<TokenRow>(
      `SELECT ut.user_id AS user_id
       FROM user_tokens ut
       INNER JOIN users u ON u.id = ut.user_id
       WHERE ut.token = ? AND ut.is_revoked = 0 AND ut.expires_at > NOW() AND u.status = 1
       LIMIT 1`,
      [token]
    );
    if (!row) {
      successResponse(res, null, "登录已失效，请重新登录", 401, 401);
      return;
    }
    req.userId = row.user_id;
    next();
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `鉴权失败: ${err.message}`, 500, 500);
  }
}
