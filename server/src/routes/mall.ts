import { Router } from "express";
import type { Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { query, queryOne } from "../db";
import { successResponse, errorResponse } from "../utils/response";

const router = Router();

/** 列表/详情共用的数据库行（价格 DECIMAL 在驱动中常为 string） */
interface MallProductRow extends RowDataPacket {
  id: number;
  title: string;
  price: string | number;
  sold_count: number;
  cover_url: string;
  cover_aspect: string | number;
  detail_images: unknown;
  description: string | null;
  status: number;
  /** 1=支持七天无理由，列表/详情展示标签用 */
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
 * 商城瀑布流分页列表：返回上架商品（含是否七天无理由等字段），供双列瀑布流展示。
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
      `SELECT id, title, price, sold_count, cover_url, cover_aspect,
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
 * 商品详情：轮播图、价格、销量、七天无理由、标题与详情文案，供淘宝式详情页展示。
 */
router.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      errorResponse(res, "无效的商品 ID", 400);
      return;
    }

    const row = await queryOne<MallProductRow>(
      `SELECT id, title, price, sold_count, cover_url, cover_aspect, detail_images, description,
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

export default router;
