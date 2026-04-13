import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { execute, query, queryOne } from "../db";
import { requireAuth } from "../middleware/authMiddleware";
import { successResponse, errorResponse } from "../utils/response";

const router = Router();

/** 用户密码行（仅用于修改密码时校验与更新） */
interface UserPasswordRow extends RowDataPacket {
  id: number;
  password: string;
}

/** 地址表行（与 user_addresses 一致） */
interface UserAddressRow extends RowDataPacket {
  id: number;
  user_id: number;
  consignee: string;
  phone: string;
  region: string;
  detail: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function normalizeUserId(req: Request): number {
  const userId = Number(req.userId || 0);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
}

function rowToDto(r: UserAddressRow) {
  return {
    id: r.id,
    consignee: r.consignee,
    phone: r.phone,
    region: r.region ?? "",
    detail: r.detail,
    isDefault: Number(r.is_default) === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function validatePayload(body: Record<string, unknown>): {
  consignee: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
} | null {
  const consignee = typeof body.consignee === "string" ? body.consignee.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const region = typeof body.region === "string" ? body.region.trim() : "";
  const detail = typeof body.detail === "string" ? body.detail.trim() : "";
  const isDefault = body.isDefault === true;

  if (!consignee || consignee.length > 64) {
    return null;
  }
  if (!phone || phone.length > 20) {
    return null;
  }
  if (region.length > 128) {
    return null;
  }
  if (!detail || detail.length > 255) {
    return null;
  }
  return { consignee, phone, region, detail, isDefault };
}

/**
 * 将当前用户其他地址的默认标记清零，便于设置新的默认地址。
 */
async function clearDefaultForUser(userId: number): Promise<void> {
  await execute(`UPDATE user_addresses SET is_default = 0 WHERE user_id = ?`, [userId]);
}

/**
 * GET /api/user/addresses
 * 获取当前登录用户的收货地址列表；默认地址排在最前，其余按 id 倒序。
 */
router.get("/addresses", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req);
    if (!userId) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const rows = await query<UserAddressRow[]>(
      `SELECT id, user_id, consignee, phone, region, detail, is_default, created_at, updated_at
       FROM user_addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, id DESC`,
      [userId]
    );
    successResponse(
      res,
      { list: rows.map(rowToDto) },
      "Success"
    );
  } catch (e) {
    console.error("[user] addresses list", e);
    errorResponse(res, "地址列表获取失败", 500);
  }
});

/**
 * GET /api/user/addresses/:id
 * 获取单条收货地址（仅本人），供编辑页回填表单。
 */
router.get("/addresses/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req);
    if (!userId) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      errorResponse(res, "地址 ID 无效", 400);
      return;
    }
    const row = await queryOne<UserAddressRow>(
      `SELECT id, user_id, consignee, phone, region, detail, is_default, created_at, updated_at
       FROM user_addresses
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    if (!row) {
      errorResponse(res, "地址不存在", 404);
      return;
    }
    successResponse(res, rowToDto(row), "Success");
  } catch (e) {
    console.error("[user] address get", e);
    errorResponse(res, "地址获取失败", 500);
  }
});

/**
 * POST /api/user/addresses
 * 新增收货地址；若 isDefault 为 true，会取消该用户其他地址的默认状态。
 */
router.post("/addresses", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req);
    if (!userId) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const body = req.body as Record<string, unknown>;
    const v = validatePayload(body);
    if (!v) {
      errorResponse(res, "请填写完整的收货人、手机、详细地址（省市区与详细地址长度需符合要求）", 400);
      return;
    }
    if (v.isDefault) {
      await clearDefaultForUser(userId);
    }
    const result: ResultSetHeader = await execute(
      `INSERT INTO user_addresses (user_id, consignee, phone, region, detail, is_default)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, v.consignee, v.phone, v.region, v.detail, v.isDefault ? 1 : 0]
    );
    const insertId = Number(result.insertId ?? 0);
    successResponse(
      res,
      { id: insertId },
      "保存成功"
    );
  } catch (e) {
    console.error("[user] address create", e);
    errorResponse(res, "地址保存失败", 500);
  }
});

/**
 * PUT /api/user/addresses/:id
 * 更新收货地址（仅本人）；若 isDefault 为 true，同步取消其他地址默认。
 */
router.put("/addresses/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req);
    if (!userId) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      errorResponse(res, "地址 ID 无效", 400);
      return;
    }
    const body = req.body as Record<string, unknown>;
    const v = validatePayload(body);
    if (!v) {
      errorResponse(res, "请填写完整的收货人、手机、详细地址（省市区与详细地址长度需符合要求）", 400);
      return;
    }
    const existing = await queryOne<UserAddressRow>(
      `SELECT id FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    if (!existing) {
      errorResponse(res, "地址不存在", 404);
      return;
    }
    if (v.isDefault) {
      await clearDefaultForUser(userId);
    }
    await execute(
      `UPDATE user_addresses
       SET consignee = ?, phone = ?, region = ?, detail = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [v.consignee, v.phone, v.region, v.detail, v.isDefault ? 1 : 0, id, userId]
    );
    successResponse(res, { id }, "更新成功");
  } catch (e) {
    console.error("[user] address update", e);
    errorResponse(res, "地址更新失败", 500);
  }
});

/**
 * DELETE /api/user/addresses/:id
 * 删除收货地址（仅本人）。
 */
router.delete("/addresses/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req);
    if (!userId) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      errorResponse(res, "地址 ID 无效", 400);
      return;
    }
    const r: ResultSetHeader = await execute(`DELETE FROM user_addresses WHERE id = ? AND user_id = ?`, [
      id,
      userId,
    ]);
    const affected = r.affectedRows ?? 0;
    if (affected === 0) {
      errorResponse(res, "地址不存在", 404);
      return;
    }
    successResponse(res, { id }, "已删除");
  } catch (e) {
    console.error("[user] address delete", e);
    errorResponse(res, "删除失败", 500);
  }
});

/**
 * 新密码强度校验：与手机号登录页一致，至少 8 位且同时含大写、小写字母。
 */
function isStrongPassword(value: string): boolean {
  if (!value || value.length < 8) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value);
}

/**
 * PUT /api/user/password
 * 已登录用户修改登录密码：校验原密码后更新哈希，并吊销该用户全部 token，需重新登录。
 */
router.put("/password", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req);
    if (!userId) {
      errorResponse(res, "请先登录", 401);
      return;
    }
    const body = req.body as Record<string, unknown>;
    const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!oldPassword || !newPassword) {
      errorResponse(res, "请填写原密码和新密码", 400);
      return;
    }
    if (!isStrongPassword(newPassword)) {
      errorResponse(res, "新密码至少 8 位，且需同时包含大写字母和小写字母", 400);
      return;
    }
    if (oldPassword === newPassword) {
      errorResponse(res, "新密码不能与当前密码相同", 400);
      return;
    }

    const row = await queryOne<UserPasswordRow>(
      "SELECT id, password FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!row) {
      errorResponse(res, "用户不存在", 404);
      return;
    }

    const match = await bcrypt.compare(oldPassword, row.password);
    if (!match) {
      errorResponse(res, "原密码错误", 400);
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await execute("UPDATE users SET password = ? WHERE id = ?", [hash, userId]);
    await execute("UPDATE user_tokens SET is_revoked = 1 WHERE user_id = ?", [userId]);

    successResponse(res, { ok: true }, "密码已修改，请重新登录");
  } catch (e) {
    console.error("[user] password change", e);
    errorResponse(res, "修改密码失败", 500);
  }
});

export default router;
