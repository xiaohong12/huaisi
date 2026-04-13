import { Router, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query, queryOne } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { successResponse } from '../utils/response';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface UserListRow extends RowDataPacket {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  openid: string | null;
  avatar: string;
  gender: string;
  created_at: Date | string;
}

interface CountRow extends RowDataPacket {
  c: number;
}

/**
 * GET /api/admin/users
 * 管理后台：分页查询小程序端 users 表，支持按用户名模糊筛选；需管理员 Bearer token。
 * 查询参数：page（默认 1）、pageSize（默认 20，最大 100）、username（可选，模糊匹配 username 字段）。
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
    const usernameKw = typeof req.query.username === 'string' ? req.query.username.trim() : '';

    /** 分页用整数，供 LIMIT/OFFSET 内联（避免部分 MySQL 对预处理 LIMIT/OFFSET 报 stmt_execute 参数错误） */
    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(Number(pageSize))));
    const offset = (page - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(Number(offset)));

    const whereParams: string[] = [];
    let whereSql = '';
    if (usernameKw) {
      whereSql = 'WHERE username LIKE ?';
      whereParams.push(`%${usernameKw}%`);
    }

    const countRow = await queryOne<CountRow>(
      `SELECT COUNT(*) AS c FROM users ${whereSql}`,
      whereParams.length > 0 ? whereParams : undefined
    );
    const total = Number(countRow?.c ?? 0);

    const listSql = `SELECT id, username, nickname, phone, openid, avatar, gender, created_at FROM users ${whereSql} ORDER BY id DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const rows = await query<UserListRow[]>(listSql, whereParams.length > 0 ? whereParams : undefined);

    successResponse(
      res,
      {
        list: rows.map((r) => ({
          id: r.id,
          username: r.username,
          nickname: r.nickname,
          phone: r.phone,
          openid: r.openid,
          avatar: r.avatar,
          gender: r.gender,
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

export default router;
