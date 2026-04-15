import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import { query, queryOne, transaction } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { batchResolveStoredImagesToClientPaths } from '../utils/imageMedia';
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
  workflow_status: number;
  created_at: Date | string;
  first_product_id: number | null;
  first_title: string | null;
  first_cover: string | null;
}

interface FirstItemSnapshotRow extends RowDataPacket {
  product_id: number;
  product_title: string;
  product_cover_url: string;
  product_price: string | number;
  purchase_quantity: number;
  line_subtotal: string | number;
  detail_images_json: unknown;
  description_snapshot: string | null;
}

/** 解析 mall_order_product_snapshots.detail_images_json 为 string[] */
function parseSnapshotDetailImages(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toMoneyNumber(v: string | number): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** 后台订单流程态与 mall_orders.workflow_status 数值一致 */
const WORKFLOW_STATUS_API = ['pending', 'paid', 'shipped', 'completed', 'cancelled'] as const;
type WorkflowStatusApi = (typeof WORKFLOW_STATUS_API)[number];

function parseWorkflowStatusBody(raw: unknown): WorkflowStatusApi | null {
  if (typeof raw !== 'string') return null;
  return (WORKFLOW_STATUS_API as readonly string[]).includes(raw) ? (raw as WorkflowStatusApi) : null;
}

function workflowApiToDb(status: WorkflowStatusApi): number {
  return WORKFLOW_STATUS_API.indexOf(status);
}

/** 列表查询 ?status= 解析为 workflow_status 数值；空或 all 表示不按状态筛选 */
function parseListStatusFilter(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'all') return null;
  const api = parseWorkflowStatusBody(s);
  if (!api) return null;
  return workflowApiToDb(api);
}

function workflowDbToApi(n: number, paymentFallback: number): WorkflowStatusApi {
  const v = Number(n);
  if (Number.isFinite(v) && v >= 0 && v < WORKFLOW_STATUS_API.length) {
    return WORKFLOW_STATUS_API[v] as WorkflowStatusApi;
  }
  return Number(paymentFallback) === 1 ? 'paid' : 'pending';
}

interface OrderWorkflowRow extends RowDataPacket {
  workflow_status: number;
}

/**
 * PATCH /api/admin/orders/:orderId/workflow-status
 * 管理后台修改订单流程状态（待付款/已付款/已发货/已完成/已取消），必须提交非空理由并写入审计表 mall_order_status_change_logs。
 */
router.patch('/:orderId/workflow-status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.orderId ?? ''), 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      successResponse(res, null, '无效的订单 ID', 400, 200);
      return;
    }

    const next = parseWorkflowStatusBody(req.body?.status);
    if (!next) {
      successResponse(res, null, '无效的状态值', 400, 200);
      return;
    }

    const reasonRaw = req.body?.reason;
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
    if (!reason) {
      successResponse(res, null, '变更理由为必填项', 400, 200);
      return;
    }
    if (reason.length > 2000) {
      successResponse(res, null, '变更理由过长', 400, 200);
      return;
    }

    const toDb = workflowApiToDb(next);

    await transaction(async (conn: PoolConnection) => {
      const [rowsPacket] = await conn.execute(
        `SELECT workflow_status FROM mall_orders WHERE id = ? LIMIT 1 FOR UPDATE`,
        [orderId]
      );
      const head = (rowsPacket as OrderWorkflowRow[])[0];
      if (!head) {
        throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 404 });
      }
      const fromDb = Number(head.workflow_status) || 0;
      if (fromDb === toDb) {
        throw Object.assign(new Error('STATUS_UNCHANGED'), { code: 400 });
      }

      await conn.execute(`UPDATE mall_orders SET workflow_status = ? WHERE id = ?`, [toDb, orderId]);
      await conn.execute(
        `INSERT INTO mall_order_status_change_logs (order_id, from_status, to_status, reason) VALUES (?, ?, ?, ?)`,
        [orderId, fromDb, toDb, reason]
      );
    });

    successResponse(res, { id: orderId, status: next }, '订单状态已更新');
  } catch (error) {
    const err = error as { code?: number; message?: string };
    if (err?.message === 'ORDER_NOT_FOUND') {
      successResponse(res, null, '订单不存在', 404, 200);
      return;
    }
    if (err?.message === 'STATUS_UNCHANGED') {
      successResponse(res, null, '目标状态与当前一致，无需修改', 400, 200);
      return;
    }
    const e = error as Error;
    successResponse(res, null, `订单状态更新失败: ${e.message}`, 500, 500);
  }
});

/**
 * GET /api/admin/orders/:orderId/first-product-snapshot
 * 管理后台按订单 ID 查询「第一件订单明细」对应的商品快照（下单时固化的标题/单价/数量/详情图/文案），用于订单列表弹窗展示，避免与当前商品库不一致。
 */
router.get(
  '/:orderId/first-product-snapshot',
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(String(req.params.orderId ?? ''), 10);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        successResponse(res, null, '无效的订单 ID', 400, 200);
        return;
      }

      const row = await queryOne<FirstItemSnapshotRow>(
        `SELECT
          s.product_id,
          s.product_title,
          s.product_cover_url,
          s.product_price,
          s.purchase_quantity,
          s.line_subtotal,
          s.detail_images_json,
          s.description_snapshot
        FROM mall_order_product_snapshots s
        INNER JOIN mall_order_items mi ON mi.id = s.order_item_id
        WHERE s.order_id = ?
        ORDER BY mi.id ASC
        LIMIT 1`,
        [orderId]
      );

      if (!row) {
        successResponse(res, null, '未找到该订单的商品快照（可能为历史订单）', 404, 200);
        return;
      }

      const detailImages = parseSnapshotDetailImages(row.detail_images_json);
      const coverKey = row.product_cover_url ?? '';
      const imageKeys = [coverKey, ...detailImages];
      const resolvedMap = await batchResolveStoredImagesToClientPaths(imageKeys);

      const coverResolved = resolvedMap.get(coverKey) ?? coverKey;
      const detailResolved = detailImages.map((k) => resolvedMap.get(k) ?? k);

      successResponse(
        res,
        {
          productId: Number(row.product_id) || 0,
          title: row.product_title ?? '',
          coverUrl: coverResolved,
          unitPrice: toMoneyNumber(row.product_price),
          purchaseQuantity: Number(row.purchase_quantity) || 0,
          lineSubtotal: toMoneyNumber(row.line_subtotal),
          detailImages: detailResolved,
          description: (row.description_snapshot ?? '').trim(),
        },
        '订单商品快照查询成功'
      );
    } catch (error) {
      const err = error as Error;
      successResponse(res, null, `订单商品快照查询失败: ${err.message}`, 500, 500);
    }
  }
);

/**
 * GET /api/admin/orders
 * 管理后台订单列表：分页查询商城订单，并返回每笔订单第一件商品的名称与主图（首图）用于表格展示。
 * 查询参数：page（默认 1）、pageSize（默认 10，最大 50）、keyword（可选，匹配订单号/用户名/商品名）、status（可选，按 workflow_status：pending|paid|shipped|completed|cancelled）。
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
    const statusDb = parseListStatusFilter(req.query.status);

    /** LIMIT/OFFSET 使用安全整数内联，避免部分 MySQL 对预编译参数报错。 */
    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
    const offset = (page - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(offset));

    const whereParts: string[] = [];
    const whereParams: Array<string | number> = [];
    if (keyword) {
      const kw = `%${keyword}%`;
      whereParts.push(`(
        o.order_no LIKE ?
        OR COALESCE(u.username, '') LIKE ?
        OR EXISTS (
          SELECT 1
          FROM mall_order_items mi
          WHERE mi.order_id = o.id AND mi.title LIKE ?
        )
      )`);
      whereParams.push(kw, kw, kw);
    }
    if (statusDb !== null) {
      whereParts.push('o.workflow_status = ?');
      whereParams.push(statusDb);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

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
        o.workflow_status,
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

    const firstCoverMap = await batchResolveStoredImagesToClientPaths(rows.map((r) => r.first_cover));

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
            status: workflowDbToApi(Number(r.workflow_status), Number(r.payment_status)),
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
