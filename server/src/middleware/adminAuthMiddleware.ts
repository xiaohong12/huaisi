import type { Request, Response, NextFunction } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { queryOne } from '../db';
import { successResponse } from '../utils/response';
import { extractToken } from './authMiddleware';

interface AdminTokenRow extends RowDataPacket {
  admin_id: number;
}

/**
 * 鉴权中间件：校验 admin_tokens 表中的 Bearer token，通过后写入 req.adminId。
 * 与普通用户 requireAuth（user_tokens）隔离，避免混用。
 */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    successResponse(res, null, '请先登录管理后台', 401, 401);
    return;
  }

  try {
    const row = await queryOne<AdminTokenRow>(
      `SELECT admin_id AS admin_id FROM admin_tokens
       WHERE token = ? AND is_revoked = 0 AND expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    if (!row) {
      successResponse(res, null, '登录已失效，请重新登录', 401, 401);
      return;
    }
    req.adminId = row.admin_id;
    next();
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `鉴权失败: ${err.message}`, 500, 500);
  }
}
