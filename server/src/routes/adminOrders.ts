import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query, queryOne } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { batchResolveStoredImagesToDataUrls } from '../utils/imageMedia';
import { successResponse } from '../utils/response';

const router = Router();

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

interface CountRow extends RowDataPacket {
  c: number;
}

interface AdminOrderListRow extends RowDataPacket {
  id: number;
  order_no: string;
  user_id: number;
  username: string | null;
  total_amount: string | number;
  payment_status: number;
  created_at: Date | string;
  first_product_id: number | null;
  first_title: string | null;
  first_cover: string | null;
}

/**
 * GET /api/admin/orders
 * 管理后台订单列表：分页查询商城订单，并返回每笔订单第一件商品的名称与主图（首图）用于表格展示。
 * 查询参数：page（默认 1）、pageSize（默认 10，最大 50）、keyword（可选，匹配订单号/用户名/商品名）。
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
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';

    /** LIMIT/OFFSET 使用安全整数内联，避免部分 MySQL 对预编译参数报错。 */
    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
    const offset = (page - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(offset));

    const whereParams: string[] = [];
    let whereSql = '';
    if (keyword) {
      const kw = `%${keyword}%`;
      whereSql = `WHERE (
        o.order_no LIKE ?
        OR COALESCE(u.username, '') LIKE ?
        OR EXISTS (
          SELECT 1
          FROM mall_order_items mi
          WHERE mi.order_id = o.id AND mi.title LIKE ?
        )
      )`;
      whereParams.push(kw, kw, kw);
    }

    const countSql = `
      SELECT COUNT(*) AS c
      FROM mall_orders o
      LEFT JOIN users u ON u.id = o.user_id
      ${whereSql}
    `;
    const countRow = await queryOne<CountRow>(countSql, whereParams.length > 0 ? whereParams : undefined);
    const total = Number(countRow?.c ?? 0);

    const listSql = `
      SELECT
        o.id,
        o.order_no,
        o.user_id,
        u.username,
        o.total_amount,
        o.payment_status,
        o.created_at,
        (SELECT i.product_id FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_product_id,
        (SELECT i.title FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_title,
        (SELECT i.cover_url FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_cover
      FROM mall_orders o
      LEFT JOIN users u ON u.id = o.user_id
      ${whereSql}
      ORDER BY o.id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const rows = await query<AdminOrderListRow[]>(
      listSql,
      whereParams.length > 0 ? whereParams : undefined
    );

    const firstCoverMap = await batchResolveStoredImagesToDataUrls(rows.map((r) => r.first_cover));

    successResponse(
      res,
      {
        list: rows.map((r) => {
          const coverKey = r.first_cover ?? '';
          return {
            id: r.id,
            orderNo: r.order_no,
            userId: Number(r.user_id) || 0,
            username: (r.username || '').trim() || `user_${Number(r.user_id) || 0}`,
            totalAmount: Number(r.total_amount) || 0,
            status: Number(r.payment_status) === 1 ? 'paid' : 'pending',
            createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
            productId: Number(r.first_product_id) || 0,
            productName: r.first_title ?? '',
            productCover: firstCoverMap.get(coverKey) ?? coverKey,
          };
        }),
        total,
        page,
        pageSize: safeLimit,
      },
      '订单列表查询成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `订单列表查询失败: ${err.message}`, 500, 500);
  }
});

export default router;
