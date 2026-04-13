import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, queryOne } from '../db';
import { successResponse } from '../utils/response';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';

const router = Router();

/** 未勾选「记住我」时的 token 有效天数 */
const TOKEN_EXPIRE_DAYS_DEFAULT = 7;
/** 勾选「记住我」时的 token 有效天数 */
const TOKEN_EXPIRE_DAYS_REMEMBER = 30;

interface AdminLoginBody {
  /** 管理员登录名，对应 admin_users.username */
  username?: string;
  password?: string;
  /** 为 true 时签发更长有效期的 token */
  remember?: boolean;
}

interface AdminUserRow extends RowDataPacket {
  id: number;
  username: string;
  display_name: string;
  password: string;
  status: number;
}

/** GET /session 查询管理员展示信息 */
interface AdminSessionRow extends RowDataPacket {
  id: number;
  username: string;
  display_name: string;
}

/**
 * 生成登录 token（随机字符串），写入 admin_tokens。
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 按天数计算 token 过期时间，返回 MySQL DATETIME 常用格式字符串。
 */
function getTokenExpireAt(days: number): string {
  const expire = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expire.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * 管理员登录成功：写入/覆盖 admin_tokens，并更新 last_login_at。
 */
async function issueAdminToken(admin: Pick<AdminUserRow, 'id' | 'username' | 'display_name'>, remember: boolean) {
  const token = generateToken();
  const days = remember ? TOKEN_EXPIRE_DAYS_REMEMBER : TOKEN_EXPIRE_DAYS_DEFAULT;
  const expiresAt = getTokenExpireAt(days);
  await execute(
    `INSERT INTO admin_tokens (admin_id, token, expires_at, is_revoked)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       token = VALUES(token),
       expires_at = VALUES(expires_at),
       is_revoked = 0`,
    [admin.id, token, expiresAt]
  );
  await execute('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [admin.id]);
  return {
    token,
    expiresAt,
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.display_name || admin.username
    }
  };
}

/**
 * POST /api/admin/auth/login
 * 管理后台登录：校验 admin_users 用户名与密码，签发 admin_tokens（与小程序 user_tokens 隔离）。
 */
router.post('/login', async (req: Request<unknown, unknown, AdminLoginBody>, res: Response) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = req.body.password;
    const remember = req.body.remember === true;

    if (!username || !password) {
      successResponse(res, null, '用户名和密码不能为空', 400, 400);
      return;
    }

    const admin = await queryOne<AdminUserRow>(
      'SELECT id, username, display_name, password, status FROM admin_users WHERE username = ? LIMIT 1',
      [username]
    );

    if (!admin || admin.status !== 1) {
      successResponse(res, null, '用户名或密码错误', 401, 401);
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, admin.password);
    if (!isPasswordMatch) {
      successResponse(res, null, '用户名或密码错误', 401, 401);
      return;
    }

    const loginData = await issueAdminToken(admin, remember);
    successResponse(res, loginData, '登录成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `登录失败: ${err.message}`, 500, 500);
  }
});

/**
 * GET /api/admin/auth/session
 * 校验当前 Bearer 是否为有效管理员 token，供前端启动时探测登录态。
 */
router.get('/session', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminId = req.adminId as number;
    const row = await queryOne<AdminSessionRow>(
      'SELECT id, username, display_name FROM admin_users WHERE id = ? AND status = 1 LIMIT 1',
      [adminId]
    );
    if (!row) {
      successResponse(res, null, '账号不可用', 403, 403);
      return;
    }
    successResponse(
      res,
      {
        adminId: row.id,
        username: row.username,
        displayName: row.display_name || row.username
      },
      '登录态有效'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `校验失败: ${err.message}`, 500, 500);
  }
});

export default router;
