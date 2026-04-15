import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, queryOne } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { batchResolveStoredImagesToDataUrls, normalizeImageRefForStorage } from '../utils/imageMedia';
import { successResponse } from '../utils/response';

const router = Router();

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

interface AdminProductCountRow extends RowDataPacket {
  c: number;
}

interface AdminProductListRow extends RowDataPacket {
  id: number;
  title: string;
  price: string | number;
  sold_count: number;
  stock: number;
  cover_url: string;
  cover_aspect: string | number;
  detail_images: unknown;
  description: string | null;
  status: number;
  seven_day_no_reason: number;
  created_at: Date | string;
  updated_at: Date | string;
}

/** 统一解析 detail_images 字段，兼容 JSON 字符串和数组两种形态 */
function parseDetailImages(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

function toMoneyNumber(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function toAspectNumber(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/**
 * 统一规范化商品图片引用：
 * - data:image/...;base64,xxx 会落盘到 image/test 并转为 test/xxx；
 * - 已有 test/xxx 或 /image/test/xxx 会校验后保留；
 * - http/https 外链保持原样。
 */
async function normalizeProductImageInputs(payload: {
  coverUrl: string;
  detailImages: string[];
}): Promise<{ coverRef: string; detailRefs: string[] }> {
  const coverRef = await normalizeImageRefForStorage(payload.coverUrl);
  const detailRefs: string[] = [];
  for (const img of payload.detailImages) {
    detailRefs.push(await normalizeImageRefForStorage(img));
  }
  return { coverRef, detailRefs };
}

/**
 * GET /api/admin/products
 * 管理后台商品列表：支持分页、关键词与上下架状态筛选，返回 mall_products 表核心字段。
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
    const statusRaw = req.query.status;
    let statusFilter: 0 | 1 | null = null;
    if (statusRaw !== undefined && statusRaw !== null && String(statusRaw).trim() !== '') {
      const s = parseInt(String(statusRaw), 10);
      if (s === 0 || s === 1) {
        statusFilter = s;
      }
    }

    const whereParts: string[] = [];
    const params: Array<string | number> = [];
    if (keyword) {
      whereParts.push('(p.title LIKE ? OR COALESCE(p.description, \'\') LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw);
    }
    if (statusFilter !== null) {
      whereParts.push('p.status = ?');
      params.push(statusFilter);
    }
    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
    const offset = (page - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(offset));

    const countSql = `SELECT COUNT(*) AS c FROM mall_products p ${whereSql}`;
    const countRow = await queryOne<AdminProductCountRow>(countSql, params.length > 0 ? params : undefined);
    const total = Number(countRow?.c ?? 0);

    const listSql = `
      SELECT
        p.id,
        p.title,
        p.price,
        p.sold_count,
        IFNULL(p.stock, 0) AS stock,
        p.cover_url,
        p.cover_aspect,
        p.detail_images,
        p.description,
        p.status,
        IFNULL(p.seven_day_no_reason, 0) AS seven_day_no_reason,
        p.created_at,
        p.updated_at
      FROM mall_products p
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const rows = await query<AdminProductListRow[]>(listSql, params.length > 0 ? params : undefined);
    const coverMap = await batchResolveStoredImagesToDataUrls(rows.map((row) => row.cover_url));
    const detailImageRefs = rows.flatMap((row) => parseDetailImages(row.detail_images));
    const detailImageMap = await batchResolveStoredImagesToDataUrls(detailImageRefs);

    successResponse(
      res,
      {
        list: rows.map((row) => {
          const coverKey = row.cover_url ?? '';
          const detailRefs = parseDetailImages(row.detail_images);
          return {
            id: row.id,
            title: row.title,
            price: toMoneyNumber(row.price),
            soldCount: Number(row.sold_count) || 0,
            stock: Number(row.stock) || 0,
            coverUrl: coverMap.get(coverKey) ?? coverKey,
            coverAspect: toAspectNumber(row.cover_aspect),
            detailImages: detailRefs.map((ref) => detailImageMap.get(ref) ?? ref),
            description: row.description?.trim() || '',
            status: Number(row.status) === 0 ? 0 : 1,
            sevenDayNoReason: Number(row.seven_day_no_reason) === 1,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
          };
        }),
        total,
        page,
        pageSize: safeLimit,
      },
      '商品列表查询成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `商品列表查询失败: ${err.message}`, 500, 500);
  }
});

/**
 * POST /api/admin/products
 * 管理后台新增商品：插入 mall_products 表并返回新商品 ID。
 */
router.post('/', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const price = Number(req.body?.price);
    const soldCount = Number(req.body?.soldCount ?? 0);
    const stock = Number(req.body?.stock ?? 0);
    const coverUrl = typeof req.body?.coverUrl === 'string' ? req.body.coverUrl.trim() : '';
    const coverAspect = Number(req.body?.coverAspect ?? 1);
    const detailImagesRaw: unknown[] = Array.isArray(req.body?.detailImages) ? req.body.detailImages : [];
    const detailImages = detailImagesRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const status = Number(req.body?.status) === 0 ? 0 : 1;
    const sevenDayNoReason = req.body?.sevenDayNoReason === true ? 1 : 0;

    if (!title) {
      successResponse(res, null, '商品标题不能为空', 400, 200);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      successResponse(res, null, '商品价格必须为非负数', 400, 200);
      return;
    }
    if (!Number.isInteger(soldCount) || soldCount < 0) {
      successResponse(res, null, '已售数量必须为非负整数', 400, 200);
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      successResponse(res, null, '库存必须为非负整数', 400, 200);
      return;
    }
    if (!coverUrl) {
      successResponse(res, null, '封面图地址不能为空', 400, 200);
      return;
    }
    if (!Number.isFinite(coverAspect) || coverAspect <= 0) {
      successResponse(res, null, '封面高宽比必须大于 0', 400, 200);
      return;
    }

    const normalized = await normalizeProductImageInputs({
      coverUrl,
      detailImages,
    });
    const detailImagesJson = JSON.stringify(normalized.detailRefs);
    const result = await execute(
      `INSERT INTO mall_products
       (title, price, sold_count, stock, cover_url, cover_aspect, detail_images, description, status, seven_day_no_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        Number(price.toFixed(2)),
        soldCount,
        stock,
        normalized.coverRef,
        Number(coverAspect.toFixed(3)),
        detailImagesJson,
        description || null,
        status,
        sevenDayNoReason,
      ]
    );

    successResponse(
      res,
      {
        id: Number(result.insertId) || 0,
      },
      '商品新增成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `商品新增失败: ${err.message}`, 500, 500);
  }
});

/**
 * PUT /api/admin/products/:id
 * 管理后台编辑商品：按商品 ID 更新 mall_products 记录，支持 Base64 图片入参自动落盘。
 */
router.put('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id ?? ''), 10);
    if (!Number.isFinite(id) || id <= 0) {
      successResponse(res, null, '无效的商品 ID', 400, 200);
      return;
    }

    const hit = await queryOne<RowDataPacket>(
      `SELECT id FROM mall_products WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!hit) {
      successResponse(res, null, '商品不存在', 404, 200);
      return;
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const price = Number(req.body?.price);
    const soldCount = Number(req.body?.soldCount ?? 0);
    const stock = Number(req.body?.stock ?? 0);
    const coverUrl = typeof req.body?.coverUrl === 'string' ? req.body.coverUrl.trim() : '';
    const coverAspect = Number(req.body?.coverAspect ?? 1);
    const detailImagesRaw: unknown[] = Array.isArray(req.body?.detailImages) ? req.body.detailImages : [];
    const detailImages = detailImagesRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const status = Number(req.body?.status) === 0 ? 0 : 1;
    const sevenDayNoReason = req.body?.sevenDayNoReason === true ? 1 : 0;

    if (!title) {
      successResponse(res, null, '商品标题不能为空', 400, 200);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      successResponse(res, null, '商品价格必须为非负数', 400, 200);
      return;
    }
    if (!Number.isInteger(soldCount) || soldCount < 0) {
      successResponse(res, null, '已售数量必须为非负整数', 400, 200);
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      successResponse(res, null, '库存必须为非负整数', 400, 200);
      return;
    }
    if (!coverUrl) {
      successResponse(res, null, '封面图地址不能为空', 400, 200);
      return;
    }
    if (!Number.isFinite(coverAspect) || coverAspect <= 0) {
      successResponse(res, null, '封面高宽比必须大于 0', 400, 200);
      return;
    }

    const normalized = await normalizeProductImageInputs({
      coverUrl,
      detailImages,
    });

    await execute(
      `UPDATE mall_products
       SET title = ?,
           price = ?,
           sold_count = ?,
           stock = ?,
           cover_url = ?,
           cover_aspect = ?,
           detail_images = ?,
           description = ?,
           status = ?,
           seven_day_no_reason = ?
       WHERE id = ?`,
      [
        title,
        Number(price.toFixed(2)),
        soldCount,
        stock,
        normalized.coverRef,
        Number(coverAspect.toFixed(3)),
        JSON.stringify(normalized.detailRefs),
        description || null,
        status,
        sevenDayNoReason,
        id,
      ]
    );

    successResponse(res, { id }, '商品编辑成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `商品编辑失败: ${err.message}`, 500, 500);
  }
});

/**
 * DELETE /api/admin/products/:id
 * 管理后台删除商品：按商品 ID 物理删除 mall_products 记录。
 */
router.delete('/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id ?? ''), 10);
    if (!Number.isFinite(id) || id <= 0) {
      successResponse(res, null, '无效的商品 ID', 400, 200);
      return;
    }

    const result = await execute(`DELETE FROM mall_products WHERE id = ?`, [id]);
    if (Number(result.affectedRows || 0) === 0) {
      successResponse(res, null, '商品不存在', 404, 200);
      return;
    }

    successResponse(res, { id }, '商品删除成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `商品删除失败: ${err.message}`, 500, 500);
  }
});

export default router;
