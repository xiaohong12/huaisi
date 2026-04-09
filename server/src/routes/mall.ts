import { Router } from "express";
import type { Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { execute, query, queryOne } from "../db";
import { requireAuth } from "../middleware/authMiddleware";
import { successResponse, errorResponse } from "../utils/response";

const router = Router();

/** 列表/详情共用的数据库行（价格 DECIMAL 在驱动中常为 string） */
interface MallProductRow extends RowDataPacket {
  id: number;
  title: string;
  price: string | number;
  sold_count: number;
  /** 可售库存件数（列缺失或 NULL 时由 SQL IFNULL 归为 0） */
  stock?: number;
  cover_url: string;
  cover_aspect: string | number;
  detail_images: unknown;
  description: string | null;
  status: number;
  /** 1=支持七天无理由，列表/详情展示标签用 */
  seven_day_no_reason?: number;
}

/** 购物车行：同一用户 + 同一商品在表内唯一一条，数量可累加 */
interface MallCartRow extends RowDataPacket {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  checked: number;
  created_at: string;
  updated_at: string;
}

/** 购物车列表查询结果（含商品信息） */
interface MallCartListRow extends RowDataPacket {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  checked: number;
  created_at: string;
  updated_at: string;
  title: string;
  price: string | number;
  stock: number;
  cover_url: string;
  cover_aspect: string | number;
  status: number;
  seven_day_no_reason?: number;
}

/** 解析详情轮播图 JSON 列为 string[] */
function parseDetailImages(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toPriceNumber(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function toAspectNumber(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/** 是否支持七天无理由（库字段缺省时视为不支持） */
function toSevenDayNoReason(row: MallProductRow): boolean {
  return Number(row.seven_day_no_reason) === 1;
}

/**
 * GET /api/mall/products
 * 商城瀑布流分页列表：返回上架商品（含库存、是否七天无理由等字段），供双列瀑布流展示。
 */
router.get("/products", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize || "10"), 10) || 10));
    const offset = (page - 1) * pageSize;
    /** LIMIT/OFFSET 不用占位符：部分 MySQL 对预处理 LIMIT 绑定会报 ER_WRONG_ARGUMENTS */
    const limitN = Math.floor(pageSize);
    const offsetN = Math.floor(offset);
    if (limitN < 1 || limitN > 50 || offsetN < 0) {
      errorResponse(res, "分页参数无效", 400);
      return;
    }

    const countRows = await query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM mall_products WHERE status = 1"
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<MallProductRow[]>(
      `SELECT id, title, price, sold_count, IFNULL(stock, 0) AS stock, cover_url, cover_aspect,
              IFNULL(seven_day_no_reason, 0) AS seven_day_no_reason
       FROM mall_products
       WHERE status = 1
       ORDER BY id DESC
       LIMIT ${limitN} OFFSET ${offsetN}`
    );

    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      price: toPriceNumber(r.price),
      soldCount: Number(r.sold_count) || 0,
      stock: Number(r.stock) || 0,
      coverUrl: r.cover_url,
      coverAspect: toAspectNumber(r.cover_aspect),
      sevenDayNoReason: toSevenDayNoReason(r),
    }));

    successResponse(
      res,
      {
        list,
        total,
        page,
        pageSize,
        hasMore: offset + list.length < total,
      },
      "Success"
    );
  } catch (e) {
    console.error("[mall] list", e);
    errorResponse(res, "商品列表获取失败", 500);
  }
});

/**
 * GET /api/mall/products/:id
 * 商品详情：轮播图、价格、销量、库存、七天无理由、标题与详情文案，供淘宝式详情页展示。
 */
router.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      errorResponse(res, "无效的商品 ID", 400);
      return;
    }

    const row = await queryOne<MallProductRow>(
      `SELECT id, title, price, sold_count, IFNULL(stock, 0) AS stock, cover_url, cover_aspect, detail_images, description,
              IFNULL(seven_day_no_reason, 0) AS seven_day_no_reason
       FROM mall_products
       WHERE id = ? AND status = 1`,
      [id]
    );

    if (!row) {
      errorResponse(res, "商品不存在或已下架", 404);
      return;
    }

    const detailImages = parseDetailImages(row.detail_images);
    const images =
      detailImages.length > 0 ? detailImages : row.cover_url ? [row.cover_url] : [];

    successResponse(
      res,
      {
        id: row.id,
        title: row.title,
        price: toPriceNumber(row.price),
        soldCount: Number(row.sold_count) || 0,
        stock: Number(row.stock) || 0,
        coverUrl: row.cover_url,
        coverAspect: toAspectNumber(row.cover_aspect),
        sevenDayNoReason: toSevenDayNoReason(row),
        detailImages: images,
        description: row.description?.trim() || "",
      },
      "Success"
    );
  } catch (e) {
    console.error("[mall] detail", e);
    errorResponse(res, "商品详情获取失败", 500);
  }
});

/**
 * POST /api/mall/cart/add
 * 加入购物车：同一用户重复加入同一商品时，购物车数量自动累加。
 */
router.post("/cart/add", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }

    const productId = Number(req.body?.productId);
    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(productId) || productId <= 0) {
      errorResponse(res, "商品 ID 无效", 400);
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errorResponse(res, "加入数量必须为正整数", 400);
      return;
    }

    const product = await queryOne<MallProductRow>(
      `SELECT id, status, IFNULL(stock, 0) AS stock
       FROM mall_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );
    if (!product || Number(product.status) !== 1) {
      errorResponse(res, "商品不存在或已下架", 404);
      return;
    }

    const currentStock = Number(product.stock) || 0;
    if (currentStock <= 0) {
      errorResponse(res, "该商品库存不足", 400);
      return;
    }

    await execute(
      `INSERT INTO mall_cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, productId, quantity]
    );

    const cartRow = await queryOne<MallCartRow>(
      `SELECT id, user_id, product_id, quantity, checked, created_at, updated_at
       FROM mall_cart_items
       WHERE user_id = ? AND product_id = ?
       LIMIT 1`,
      [userId, productId]
    );

    successResponse(
      res,
      {
        id: cartRow?.id ?? 0,
        userId,
        productId,
        quantity: Number(cartRow?.quantity ?? quantity),
      },
      "加入购物车成功"
    );
  } catch (e) {
    console.error("[mall] cart add", e);
    errorResponse(res, "加入购物车失败", 500);
  }
});

/**
 * GET /api/mall/cart
 * 获取当前登录用户的购物车列表，含商品信息与结算金额。
 */
router.get("/cart", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }

    const rows = await query<MallCartListRow[]>(
      `SELECT c.id, c.user_id, c.product_id, c.quantity, c.checked, c.created_at, c.updated_at,
              p.title, p.price, IFNULL(p.stock, 0) AS stock, p.cover_url, p.cover_aspect, p.status,
              IFNULL(p.seven_day_no_reason, 0) AS seven_day_no_reason
       FROM mall_cart_items c
       INNER JOIN mall_products p ON p.id = c.product_id
       WHERE c.user_id = ?
       ORDER BY c.id DESC`,
      [userId]
    );

    const list = rows.map((r) => {
      const price = toPriceNumber(r.price);
      const quantity = Number(r.quantity) || 0;
      const subtotal = Number((price * quantity).toFixed(2));
      return {
        id: r.id,
        productId: r.product_id,
        title: r.title,
        price,
        quantity,
        checked: Number(r.checked) === 1,
        stock: Number(r.stock) || 0,
        coverUrl: r.cover_url,
        coverAspect: toAspectNumber(r.cover_aspect),
        status: Number(r.status) || 0,
        sevenDayNoReason: Number(r.seven_day_no_reason) === 1,
        subtotal,
      };
    });

    const totalAmount = Number(
      list
        .filter((item) => item.checked)
        .reduce((sum, item) => sum + item.subtotal, 0)
        .toFixed(2)
    );

    successResponse(
      res,
      {
        list,
        totalCount: list.length,
        totalAmount,
      },
      "Success"
    );
  } catch (e) {
    console.error("[mall] cart list", e);
    errorResponse(res, "购物车列表获取失败", 500);
  }
});

/**
 * PUT /api/mall/cart/select-all
 * 全选/取消全选：批量更新当前用户所有购物车行的勾选状态，供底部「全选」与合计联动。
 * 注意：必须注册在 /cart/:id 之前，否则会被当成 id。
 */
router.put("/cart/select-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    if (typeof req.body?.checked !== "boolean") {
      errorResponse(res, "checked 必须为布尔值", 400);
      return;
    }
    const checked = req.body.checked ? 1 : 0;
    await execute(`UPDATE mall_cart_items SET checked = ? WHERE user_id = ?`, [checked, userId]);
    successResponse(res, { checked: req.body.checked }, "全选状态已更新");
  } catch (e) {
    console.error("[mall] cart select all", e);
    errorResponse(res, "全选更新失败", 500);
  }
});

/**
 * PUT /api/mall/cart/:id
 * 修改购物车项：可单独或同时更新数量、是否勾选结算（仅当前登录用户自己的数据）。
 */
router.put("/cart/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    const cartId = Number(req.params.id);
    const body = req.body ?? {};
    const hasQuantity = body.quantity !== undefined && body.quantity !== null;
    const hasChecked = body.checked !== undefined && body.checked !== null;

    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    if (!Number.isInteger(cartId) || cartId <= 0) {
      errorResponse(res, "购物车项 ID 无效", 400);
      return;
    }
    if (!hasQuantity && !hasChecked) {
      errorResponse(res, "请提供 quantity 或 checked", 400);
      return;
    }

    let quantity: number | undefined;
    if (hasQuantity) {
      quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        errorResponse(res, "数量必须为正整数", 400);
        return;
      }
    }

    let checkedVal: 0 | 1 | undefined;
    if (hasChecked) {
      if (typeof body.checked !== "boolean") {
        errorResponse(res, "checked 必须为布尔值", 400);
        return;
      }
      checkedVal = body.checked ? 1 : 0;
    }

    const hit = await queryOne<MallCartRow>(
      `SELECT id, user_id, product_id, quantity, checked, created_at, updated_at
       FROM mall_cart_items
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [cartId, userId]
    );
    if (!hit) {
      errorResponse(res, "购物车项不存在", 404);
      return;
    }

    if (hasQuantity && hasChecked) {
      const q = quantity as number;
      const c = checkedVal as 0 | 1;
      await execute(
        `UPDATE mall_cart_items
         SET quantity = ?, checked = ?
         WHERE id = ? AND user_id = ?`,
        [q, c, cartId, userId]
      );
    } else if (hasQuantity) {
      const q = quantity as number;
      await execute(
        `UPDATE mall_cart_items
         SET quantity = ?
         WHERE id = ? AND user_id = ?`,
        [q, cartId, userId]
      );
    } else {
      const c = checkedVal as 0 | 1;
      await execute(
        `UPDATE mall_cart_items
         SET checked = ?
         WHERE id = ? AND user_id = ?`,
        [c, cartId, userId]
      );
    }

    const nextQty = hasQuantity ? quantity! : Number(hit.quantity) || 0;
    const nextChecked = hasChecked ? checkedVal === 1 : Number(hit.checked) === 1;

    successResponse(
      res,
      {
        id: cartId,
        quantity: nextQty,
        checked: nextChecked,
      },
      "购物车更新成功"
    );
  } catch (e) {
    console.error("[mall] cart update", e);
    errorResponse(res, "购物车更新失败", 500);
  }
});

/**
 * DELETE /api/mall/cart/:id
 * 删除单个购物车项（仅允许删除当前登录用户自己的数据）。
 */
router.delete("/cart/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    const cartId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    if (!Number.isInteger(cartId) || cartId <= 0) {
      errorResponse(res, "购物车项 ID 无效", 400);
      return;
    }

    const result = await execute(
      `DELETE FROM mall_cart_items
       WHERE id = ? AND user_id = ?`,
      [cartId, userId]
    );
    if ((result.affectedRows || 0) === 0) {
      errorResponse(res, "购物车项不存在", 404);
      return;
    }

    successResponse(res, { id: cartId }, "购物车项删除成功");
  } catch (e) {
    console.error("[mall] cart delete", e);
    errorResponse(res, "购物车项删除失败", 500);
  }
});

/**
 * DELETE /api/mall/cart
 * 清空当前登录用户购物车。
 */
router.delete("/cart", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }

    const result = await execute(
      `DELETE FROM mall_cart_items
       WHERE user_id = ?`,
      [userId]
    );

    successResponse(
      res,
      { deletedCount: Number(result.affectedRows || 0) },
      "购物车清空成功"
    );
  } catch (e) {
    console.error("[mall] cart clear", e);
    errorResponse(res, "购物车清空失败", 500);
  }
});

export default router;
