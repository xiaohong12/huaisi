import { Router, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, queryOne } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { successResponse } from '../utils/response';
import { batchResolveStoredAvatarsForClient } from '../utils/imageMedia';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * 手机号格式校验：允许空值；非空时必须是中国大陆 11 位号码（1 开头）。
 */
function isValidMainlandPhone(phone: string): boolean {
  if (!phone) return true;
  return /^1\d{10}$/.test(phone);
}

interface UserListRow extends RowDataPacket {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  openid: string | null;
  avatar: string;
  gender: string;
  status: number;
  created_at: Date | string;
}

interface CountRow extends RowDataPacket {
  c: number;
}

/**
 * GET /api/admin/users
 * 管理后台：分页查询小程序端 users 表，支持按用户名/昵称/手机号模糊筛选；需管理员 Bearer token。
 * 查询参数：page（默认 1）、pageSize（默认 20，最大 100）、keyword（可选，模糊匹配 username/nickname/phone）。
 * 兼容参数：username（旧参数名，会被视为 keyword）。
 */
router.get('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const pageRaw = parseInt(String(req.query.page ?? '1'), 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    let pageSize = parseInt(String(req.query.pageSize ?? String(DEFAULT_PAGE_SIZE)), 10);
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      pageSize = DEFAULT_PAGE_SIZE;
    }
    pageSize = Math.min(MAX_PAGE_SIZE, pageSize);
    const keywordKw =
      typeof req.query.keyword === 'string'
        ? req.query.keyword.trim()
        : typeof req.query.username === 'string'
          ? req.query.username.trim()
          : '';

    /** 分页用整数，供 LIMIT/OFFSET 内联（避免部分 MySQL 对预处理 LIMIT/OFFSET 报 stmt_execute 参数错误） */
    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(Number(pageSize))));
    const offset = (page - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(Number(offset)));

    const whereParams: string[] = [];
    let whereSql = '';
    if (keywordKw) {
      whereSql = 'WHERE (username LIKE ? OR nickname LIKE ? OR phone LIKE ?)';
      const kw = `%${keywordKw}%`;
      whereParams.push(kw, kw, kw);
    }

    const countRow = await queryOne<CountRow>(
      `SELECT COUNT(*) AS c FROM users ${whereSql}`,
      whereParams.length > 0 ? whereParams : undefined
    );
    const total = Number(countRow?.c ?? 0);

    const listSql = `SELECT id, username, nickname, phone, openid, avatar, gender, status, created_at FROM users ${whereSql} ORDER BY id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const rows = await query<UserListRow[]>(listSql, whereParams.length > 0 ? whereParams : undefined);

    /** 头像返回规则：本地 image/test 转 base64；http/https 外链原样返回。 */
    const avatarMap = await batchResolveStoredAvatarsForClient(rows.map((r) => r.avatar));

    successResponse(
      res,
      {
        list: rows.map((r) => ({
          id: r.id,
          username: r.username,
          nickname: r.nickname,
          phone: r.phone,
          openid: r.openid,
          avatar: avatarMap.get(String(r.avatar ?? '')) ?? r.avatar,
          gender: r.gender,
          status: Number(r.status) === 1 ? 1 : 0,
          created_at:
            r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        })),
        total,
        page,
        pageSize: safeLimit,
      },
      '用户列表查询成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `用户列表查询失败: ${err.message}`, 500, 500);
  }
});

interface UpdateUserBody {
  username?: string;
  nickname?: string;
  avatar?: string;
  gender?: string;
  phone?: string | null;
  status?: number;
}

interface UserStatusRow extends RowDataPacket {
  id: number;
  status: number;
}

/**
 * PUT /api/admin/users/:id
 * 管理后台更新小程序用户信息：支持修改 avatar、username、nickname、gender、phone 和 status（1 激活 / 0 拉黑）。
 * 当用户被拉黑时，会同步吊销其 user_tokens，确保小程序端立即失效。
 */
router.put('/:id', requireAdminAuth, async (req: Request<{ id: string }, unknown, UpdateUserBody>, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      successResponse(res, null, '用户 ID 无效', 400, 400);
      return;
    }
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const nickname = typeof req.body.nickname === 'string' ? req.body.nickname.trim() : '';
    const avatar = typeof req.body.avatar === 'string' ? req.body.avatar.trim() : '';
    const gender = typeof req.body.gender === 'string' ? req.body.gender.trim() : '';
    const phoneRaw = req.body.phone;
    const phone = typeof phoneRaw === 'string' ? phoneRaw.trim() : '';
    const statusRaw = Number(req.body.status);
    const status = statusRaw === 1 ? 1 : statusRaw === 0 ? 0 : -1;

    if (!username) {
      successResponse(res, null, '用户名不能为空', 400, 400);
      return;
    }
    if (username.length > 64) {
      successResponse(res, null, '用户名长度不能超过 64 个字符', 400, 400);
      return;
    }
    if (!nickname) {
      successResponse(res, null, '昵称不能为空', 400, 400);
      return;
    }
    if (nickname.length > 64) {
      successResponse(res, null, '昵称长度不能超过 64 个字符', 400, 400);
      return;
    }
    if (avatar.length > 2048) {
      successResponse(res, null, '头像地址长度不能超过 2048 个字符', 400, 400);
      return;
    }
    if (gender !== 'male' && gender !== 'female' && gender !== 'unknown') {
      successResponse(res, null, '性别值无效', 400, 400);
      return;
    }
    if (phone.length > 20) {
      successResponse(res, null, '手机号长度不能超过 20 个字符', 400, 400);
      return;
    }
    if (!isValidMainlandPhone(phone)) {
      successResponse(res, null, '手机号格式不正确，请输入 11 位大陆手机号', 400, 400);
      return;
    }
    if (status !== 0 && status !== 1) {
      successResponse(res, null, '状态值无效', 400, 400);
      return;
    }

    const existed = await queryOne<UserStatusRow>('SELECT id, status FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!existed) {
      successResponse(res, null, '用户不存在', 404, 404);
      return;
    }

    const dupUsername = await queryOne<RowDataPacket>(
      'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
      [username, userId]
    );
    if (dupUsername) {
      successResponse(res, null, '用户名已被其他用户使用', 400, 400);
      return;
    }

    const phoneValue = phone || null;
    if (phone) {
      const dupPhone = await queryOne<RowDataPacket>(
        'SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1',
        [phone, userId]
      );
      if (dupPhone) {
        successResponse(res, null, '手机号已被其他用户使用', 400, 400);
        return;
      }
    }

    await execute(
      'UPDATE users SET avatar = ?, username = ?, nickname = ?, gender = ?, phone = ?, status = ? WHERE id = ?',
      [avatar, username, nickname, gender, phoneValue, status, userId]
    );

    if (status === 0) {
      await execute('UPDATE user_tokens SET is_revoked = 1 WHERE user_id = ?', [userId]);
    }

    successResponse(
      res,
      {
        id: userId,
        status,
      },
      '用户信息更新成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `用户信息更新失败: ${err.message}`, 500, 500);
  }
});

export default router;
