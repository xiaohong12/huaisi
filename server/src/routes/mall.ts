import { Router } from "express";
import type { Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { execute, query, queryOne, transaction } from "../db";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import QRCode from "qrcode";
import { requireAuth } from "../middleware/authMiddleware";
import { successResponse, errorResponse } from "../utils/response";
import { batchResolveStoredImagesToDataUrls } from "../utils/imageMedia";

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

/** 订单主表行（mall_orders） */
interface MallOrderRow extends RowDataPacket {
  id: number;
  user_id: number;
  address_id: number | null;
  order_no: string;
  store_name: string;
  consignee: string;
  phone: string;
  region: string;
  detail: string;
  freight_fee: string | number;
  goods_amount: string | number;
  total_amount: string | number;
  payment_method: string;
  payment_status: number;
  remark: string;
  created_at: string;
  updated_at: string;
}

/** 订单明细行（mall_order_items） */
interface MallOrderItemDbRow extends RowDataPacket {
  id: number;
  order_id: number;
  product_id: number;
  title: string;
  cover_url: string;
  price: string | number;
  quantity: number;
  subtotal: string | number;
}

/** 允许的支付方式（与前端下单页选项一致） */
const MALL_PAYMENT_METHODS = [
  "alipay",
  "huabei",
  "friend_pay",
  "wechat",
  "qrcode",
] as const;

type MallPaymentMethod = (typeof MALL_PAYMENT_METHODS)[number];

/** 默认运费（元），与下单页展示一致 */
const DEFAULT_FREIGHT_FEE = 8;

/** 默认店铺名（下单页店铺标题） */
const DEFAULT_STORE_NAME = "辰星文化商城";

function isMallPaymentMethod(v: string): v is MallPaymentMethod {
  return (MALL_PAYMENT_METHODS as readonly string[]).includes(v);
}

function generateOrderNo(): string {
  const tail = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `HS${Date.now()}${tail}`;
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

    const coverMap = await batchResolveStoredImagesToDataUrls(rows.map((r) => r.cover_url));
    const list = rows.map((r) => {
      const ck = r.cover_url ?? "";
      return {
        id: r.id,
        title: r.title,
        price: toPriceNumber(r.price),
        soldCount: Number(r.sold_count) || 0,
        stock: Number(r.stock) || 0,
        coverUrl: coverMap.get(ck) ?? ck,
        coverAspect: toAspectNumber(r.cover_aspect),
        sevenDayNoReason: toSevenDayNoReason(r),
      };
    });

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

    const imgRefs = [row.cover_url ?? "", ...images];
    const imgMap = await batchResolveStoredImagesToDataUrls(imgRefs);
    const ck = row.cover_url ?? "";
    const coverResolved = imgMap.get(ck) ?? ck;
    const detailResolved = images.map((u) => imgMap.get(u) ?? u);

    successResponse(
      res,
      {
        id: row.id,
        title: row.title,
        price: toPriceNumber(row.price),
        soldCount: Number(row.sold_count) || 0,
        stock: Number(row.stock) || 0,
        coverUrl: coverResolved,
        coverAspect: toAspectNumber(row.cover_aspect),
        sevenDayNoReason: toSevenDayNoReason(row),
        detailImages: detailResolved,
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

    const coverMap = await batchResolveStoredImagesToDataUrls(rows.map((r) => r.cover_url));
    const list = rows.map((r) => {
      const price = toPriceNumber(r.price);
      const quantity = Number(r.quantity) || 0;
      const subtotal = Number((price * quantity).toFixed(2));
      const ck = r.cover_url ?? "";
      return {
        id: r.id,
        productId: r.product_id,
        title: r.title,
        price,
        quantity,
        checked: Number(r.checked) === 1,
        stock: Number(r.stock) || 0,
        coverUrl: coverMap.get(ck) ?? ck,
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

/** 用户地址行：创建订单时校验归属并写入快照 */
interface UserAddrBriefRow extends RowDataPacket {
  id: number;
  user_id: number;
  consignee: string;
  phone: string;
  region: string;
  detail: string;
}

/**
 * POST /api/mall/orders
 * 创建商城订单：校验收货地址归属、商品上架与库存；写入订单主表与明细；可选返回二维码收款图（data URL）。
 * 支付方式为 qrcode 时，响应中带 qrCodeDataUrl，供小程序弹窗直接绑定 <image src>。
 */
router.post("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }

    const addressId = Number(req.body?.addressId);
    const productId = Number(req.body?.productId);
    const quantity = Number(req.body?.quantity ?? 1);
    const paymentMethodRaw =
      typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.trim() : "";
    const remark =
      typeof req.body?.remark === "string" ? req.body.remark.trim().slice(0, 255) : "";

    if (!Number.isInteger(addressId) || addressId <= 0) {
      errorResponse(res, "请选择收货地址", 400);
      return;
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      errorResponse(res, "商品 ID 无效", 400);
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errorResponse(res, "购买数量必须为正整数", 400);
      return;
    }
    if (!isMallPaymentMethod(paymentMethodRaw)) {
      errorResponse(res, "支付方式无效", 400);
      return;
    }
    const paymentMethod = paymentMethodRaw;

    const addr = await queryOne<UserAddrBriefRow>(
      `SELECT id, user_id, consignee, phone, region, detail
       FROM user_addresses
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [addressId, userId]
    );
    if (!addr) {
      errorResponse(res, "收货地址不存在", 404);
      return;
    }

    const product = await queryOne<MallProductRow>(
      `SELECT id, title, price, IFNULL(stock, 0) AS stock, cover_url, status
       FROM mall_products
       WHERE id = ?
       LIMIT 1`,
      [productId]
    );
    if (!product || Number(product.status) !== 1) {
      errorResponse(res, "商品不存在或已下架", 404);
      return;
    }
    const stock = Number(product.stock) || 0;
    if (stock < quantity) {
      errorResponse(res, "库存不足", 400);
      return;
    }

    const unitPrice = toPriceNumber(product.price);
    const goodsAmount = Number((unitPrice * quantity).toFixed(2));
    const freightFee = Number(DEFAULT_FREIGHT_FEE.toFixed(2));
    const totalAmount = Number((goodsAmount + freightFee).toFixed(2));

    let orderNo = generateOrderNo();
    let orderId = 0;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        orderId = await transaction(async (conn: PoolConnection) => {
          const [ins] = await conn.execute<ResultSetHeader>(
            `INSERT INTO mall_orders
             (user_id, address_id, order_no, store_name, consignee, phone, region, detail,
              freight_fee, goods_amount, total_amount, payment_method, payment_status, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [
              userId,
              addressId,
              orderNo,
              DEFAULT_STORE_NAME,
              addr.consignee,
              addr.phone,
              addr.region ?? "",
              addr.detail,
              freightFee,
              goodsAmount,
              totalAmount,
              paymentMethod,
              remark,
            ]
          );
          const oid = Number(ins.insertId);
          if (!Number.isFinite(oid) || oid <= 0) {
            throw new Error("ORDER_INSERT_FAIL");
          }
          const subtotal = goodsAmount;
          await conn.execute(
            `INSERT INTO mall_order_items
             (order_id, product_id, title, cover_url, price, quantity, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              oid,
              productId,
              product.title,
              product.cover_url ?? "",
              unitPrice,
              quantity,
              subtotal,
            ]
          );
          return oid;
        });
        break;
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === "ER_DUP_ENTRY" && attempt < 2) {
          orderNo = generateOrderNo();
          continue;
        }
        throw e;
      }
    }

    if (!orderId) {
      errorResponse(res, "订单创建失败", 500);
      return;
    }

    let qrCodeDataUrl: string | undefined;
    if (paymentMethod === "qrcode") {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(`HUASI_ORDER:${orderNo}`, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
        });
      } catch (qrErr) {
        console.error("[mall] order qrcode", qrErr);
        errorResponse(res, "二维码生成失败", 500);
        return;
      }
    }

    successResponse(
      res,
      {
        id: orderId,
        orderNo,
        storeName: DEFAULT_STORE_NAME,
        goodsAmount,
        freightFee,
        totalAmount,
        paymentMethod,
        paymentStatus: 0,
        qrCodeDataUrl,
      },
      "订单创建成功"
    );
  } catch (e) {
    console.error("[mall] order create", e);
    errorResponse(res, "订单创建失败", 500);
  }
});

/**
 * GET /api/mall/orders
 * 分页查询当前登录用户的商城订单列表；每条带首件商品标题/封面、明细行数、购买总件数（totalQuantity），供小程序「我的订单」列表展示。
 * 查询参数：page（默认 1）、pageSize（默认 10，最大 50）；paymentStatus 可选，0=仅待支付、1=仅已支付，不传则不分状态（个人中心订单总数等场景）。
 */
router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }

    const pageRaw = parseInt(String(req.query.page ?? "1"), 10);
    const sizeRaw = parseInt(String(req.query.pageSize ?? "10"), 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize =
      Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.min(50, sizeRaw) : 10;
    const offset = (page - 1) * pageSize;
    /** LIMIT/OFFSET 不用占位符：部分 MySQL + mysql2 预编译会报 ER_WRONG_ARGUMENTS；此处已收窄为安全整数 */
    const safeLimit = Math.floor(pageSize);
    const safeOffset = Math.max(0, Math.floor(offset));

    const psQ = req.query.paymentStatus;
    const psRaw = Array.isArray(psQ) ? psQ[0] : psQ;
    let paymentStatusFilter: 0 | 1 | null = null;
    if (psRaw !== undefined && psRaw !== "") {
      const n = parseInt(String(psRaw), 10);
      if (n === 0 || n === 1) {
        paymentStatusFilter = n as 0 | 1;
      }
    }

    interface CountRow extends RowDataPacket {
      cnt: number;
    }
    const countSql =
      paymentStatusFilter === null
        ? `SELECT COUNT(*) AS cnt FROM mall_orders WHERE user_id = ?`
        : `SELECT COUNT(*) AS cnt FROM mall_orders WHERE user_id = ? AND payment_status = ?`;
    const countParams =
      paymentStatusFilter === null ? [userId] : [userId, paymentStatusFilter];
    const countRow = await queryOne<CountRow>(countSql, countParams);
    const total = Number(countRow?.cnt) || 0;

    interface MallOrderListDbRow extends RowDataPacket {
      id: number;
      order_no: string;
      store_name: string;
      total_amount: string | number;
      payment_status: number;
      created_at: string;
      first_title: string | null;
      first_cover: string | null;
      item_count: number;
      /** 该订单所有明细购买件数之和，供列表展示「共 x 件」 */
      total_quantity: number;
    }

    const listSql =
      paymentStatusFilter === null
        ? `SELECT o.id, o.order_no, o.store_name, o.total_amount, o.payment_status, o.created_at,
              (SELECT i.title FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_title,
              (SELECT i.cover_url FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_cover,
              (SELECT COUNT(*) FROM mall_order_items i WHERE i.order_id = o.id) AS item_count,
              (SELECT COALESCE(SUM(i.quantity), 0) FROM mall_order_items i WHERE i.order_id = o.id) AS total_quantity
       FROM mall_orders o
       WHERE o.user_id = ?
       ORDER BY o.id DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`
        : `SELECT o.id, o.order_no, o.store_name, o.total_amount, o.payment_status, o.created_at,
              (SELECT i.title FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_title,
              (SELECT i.cover_url FROM mall_order_items i WHERE i.order_id = o.id ORDER BY i.id ASC LIMIT 1) AS first_cover,
              (SELECT COUNT(*) FROM mall_order_items i WHERE i.order_id = o.id) AS item_count,
              (SELECT COALESCE(SUM(i.quantity), 0) FROM mall_order_items i WHERE i.order_id = o.id) AS total_quantity
       FROM mall_orders o
       WHERE o.user_id = ? AND o.payment_status = ?
       ORDER BY o.id DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const listParams =
      paymentStatusFilter === null ? [userId] : [userId, paymentStatusFilter];

    const rows = await query<MallOrderListDbRow[]>(listSql, listParams);
    const firstCoverMap = await batchResolveStoredImagesToDataUrls(rows.map((r) => r.first_cover));

    successResponse(
      res,
      {
        list: rows.map((r) => {
          const fk = r.first_cover ?? "";
          return {
            id: r.id,
            orderNo: r.order_no,
            storeName: r.store_name,
            totalAmount: toPriceNumber(r.total_amount),
            paymentStatus: Number(r.payment_status) || 0,
            createdAt: r.created_at,
            firstTitle: r.first_title ?? "",
            firstCover: firstCoverMap.get(fk) ?? fk,
            itemCount: Number(r.item_count) || 0,
            totalQuantity: Number(r.total_quantity) || 0,
          };
        }),
        total,
        page,
        pageSize,
      },
      "Success"
    );
  } catch (e) {
    console.error("[mall] order list", e);
    errorResponse(res, "订单列表获取失败", 500);
  }
});

/**
 * GET /api/mall/orders/:id
 * 查询单笔订单详情（含明细行），仅允许订单所属用户访问。
 */
router.get("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id) || id <= 0) {
      errorResponse(res, "订单 ID 无效", 400);
      return;
    }

    const order = await queryOne<MallOrderRow>(
      `SELECT id, user_id, address_id, order_no, store_name, consignee, phone, region, detail,
              freight_fee, goods_amount, total_amount, payment_method, payment_status, remark,
              created_at, updated_at
       FROM mall_orders
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    if (!order) {
      errorResponse(res, "订单不存在", 404);
      return;
    }

    const items = await query<MallOrderItemDbRow[]>(
      `SELECT id, order_id, product_id, title, cover_url, price, quantity, subtotal
       FROM mall_order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [id]
    );

    const itemCoverMap = await batchResolveStoredImagesToDataUrls(items.map((it) => it.cover_url));

    successResponse(
      res,
      {
        id: order.id,
        orderNo: order.order_no,
        storeName: order.store_name,
        consignee: order.consignee,
        phone: order.phone,
        region: order.region,
        detail: order.detail,
        freightFee: toPriceNumber(order.freight_fee),
        goodsAmount: toPriceNumber(order.goods_amount),
        totalAmount: toPriceNumber(order.total_amount),
        paymentMethod: order.payment_method,
        paymentStatus: Number(order.payment_status) || 0,
        remark: order.remark ?? "",
        createdAt: order.created_at,
        items: items.map((it) => {
          const ck = it.cover_url ?? "";
          return {
            id: it.id,
            productId: it.product_id,
            title: it.title,
            coverUrl: itemCoverMap.get(ck) ?? ck,
            price: toPriceNumber(it.price),
            quantity: Number(it.quantity) || 0,
            subtotal: toPriceNumber(it.subtotal),
          };
        }),
      },
      "Success"
    );
  } catch (e) {
    console.error("[mall] order detail", e);
    errorResponse(res, "订单详情获取失败", 500);
  }
});

/**
 * PUT /api/mall/orders/:id/confirm-payment
 * 用户在前端点击「已经支付」后调用：将订单置为已支付，并扣减商品库存、累加销量（演示用线下扫码回款流程）。
 */
router.put("/orders/:id/confirm-payment", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.userId || 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id) || id <= 0) {
      errorResponse(res, "订单 ID 无效", 400);
      return;
    }

    await transaction(async (conn: PoolConnection) => {
      const [orderRs] = await conn.execute(
        `SELECT id, user_id, payment_status
         FROM mall_orders
         WHERE id = ? AND user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [id, userId]
      );
      const head = (orderRs as MallOrderRow[])[0];
      if (!head) {
        throw Object.assign(new Error("ORDER_NOT_FOUND"), { status: 404 });
      }
      if (Number(head.payment_status) === 1) {
        throw Object.assign(new Error("ORDER_ALREADY_PAID"), { status: 400 });
      }

      const [itemRs] = await conn.execute(
        `SELECT product_id, quantity FROM mall_order_items WHERE order_id = ?`,
        [id]
      );
      const itemRows = itemRs as Pick<MallOrderItemDbRow, "product_id" | "quantity">[];

      for (const line of itemRows) {
        const pid = Number(line.product_id);
        const qty = Number(line.quantity) || 0;
        if (!Number.isInteger(pid) || pid <= 0 || qty <= 0) continue;
        const [ur] = await conn.execute<ResultSetHeader>(
          `UPDATE mall_products
           SET stock = stock - ?, sold_count = sold_count + ?
           WHERE id = ? AND stock >= ?`,
          [qty, qty, pid, qty]
        );
        if (Number(ur.affectedRows || 0) === 0) {
          throw Object.assign(new Error("ORDER_STOCK_SHORT"), { status: 400 });
        }
      }

      await conn.execute(
        `UPDATE mall_orders SET payment_status = 1 WHERE id = ? AND user_id = ?`,
        [id, userId]
      );
    });

    successResponse(res, { id, paymentStatus: 1 }, "已确认支付");
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 404 || err?.message === "ORDER_NOT_FOUND") {
      errorResponse(res, "订单不存在", 404);
      return;
    }
    if (err?.message === "ORDER_ALREADY_PAID") {
      errorResponse(res, "订单已支付", 400);
      return;
    }
    if (err?.message === "ORDER_STOCK_SHORT") {
      errorResponse(res, "库存不足，无法完成支付确认", 400);
      return;
    }
    console.error("[mall] order confirm payment", e);
    errorResponse(res, "确认支付失败", 500);
  }
});

export default router;
