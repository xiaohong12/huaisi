import { Router } from "express";
import type { Request, RequestHandler, Response } from "express";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { query, queryOne, transaction } from "../db";
import { successResponse } from "../utils/response";
import { optionalAuth, requireAuth } from "../middleware/authMiddleware";
import { isPublishSectionKey, SECTION_NAME_BY_KEY, type PublishSectionKey } from "../constants/publishSection";
import {
  batchResolveStoredImagesToClientPaths,
  normalizeImageRefForStorage,
} from "../utils/imageMedia";

const router = Router();

interface SectionRow extends RowDataPacket {
  id: number;
}

interface CreatePostBody {
  title?: string;
  content?: string;
  sectionKey?: string;
  imageUrls?: unknown;
}

/** 首页信息流：帖子主表 + 用户 + 版块名 */
interface PostFeedRow extends RowDataPacket {
  id: number;
  title: string;
  content: string;
  excerpt: string | null;
  comment_count: number;
  like_count: number;
  favorite_count: number;
  nickname: string;
  avatar: string;
  section_name: string | null;
}

/** 与前端约定的单条信息流 JSON 结构（含当前用户是否点赞/收藏，未登录时为 false） */
interface PostFeedItemJson {
  id: number;
  title: string;
  /** 正文全文，供列表卡片「展开」后展示 */
  content: string;
  excerpt: string;
  commentCount: number;
  likeCount: number;
  favoriteCount: number;
  nickname: string;
  /** 作者头像：本地 test 图返回 /image/test 路径，http/https 外链原样返回。 */
  avatar: string;
  sectionName: string;
  /** 帖子配图：本地 test 图返回 /image/test 路径，http/https 外链原样返回。 */
  imageUrls: string[];
  liked: boolean;
  favorited: boolean;
}

interface PostImageRow extends RowDataPacket {
  post_id: number;
  image_url: string;
}

interface PostIdRow extends RowDataPacket {
  post_id: number;
}

/** 评论列表联表查询行（含被回复评论的作者信息） */
interface CommentListRow extends RowDataPacket {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  created_at: Date | string;
  nickname: string;
  parent_user_id: number | null;
  parent_author_nickname: string | null;
}

/** 与前端约定的单条评论 JSON */
interface CommentItemJson {
  id: number;
  userId: number;
  nickname: string;
  content: string;
  parentId: number | null;
  /** 被回复评论的作者用户 ID，顶层评论为 null */
  replyToUserId: number | null;
  replyToNickname: string | null;
  createdAt: string;
}

interface CreateCommentBody {
  content?: string;
  parentId?: unknown;
}

/**
 * 将评论查询行转为接口对象。
 */
function mapCommentRow(row: CommentListRow): CommentItemJson {
  const created =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    content: row.content,
    parentId: row.parent_id,
    replyToUserId: row.parent_user_id != null ? Number(row.parent_user_id) : null,
    replyToNickname: row.parent_author_nickname,
    createdAt: created,
  };
}

/**
 * 按评论 id 拉取一条（含联表字段），用于发表成功后返回。
 */
async function getCommentById(commentId: number): Promise<CommentItemJson | null> {
  const row = await queryOne<CommentListRow>(
    `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.created_at,
            u.nickname AS nickname,
            cp.user_id AS parent_user_id,
            pu.nickname AS parent_author_nickname
     FROM comments c
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN comments cp ON cp.id = c.parent_id AND cp.status = 1
     LEFT JOIN users pu ON pu.id = cp.user_id
     WHERE c.id = ? AND c.status = 1`,
    [commentId]
  );
  return row ? mapCommentRow(row) : null;
}

/**
 * 按帖子 id 列表拉取图片 URL，顺序与 sort_order 一致。
 */
async function buildImageMapForIds(postIds: number[]): Promise<Map<number, string[]>> {
  const imageMap = new Map<number, string[]>();
  if (postIds.length === 0) return imageMap;
  const placeholders = postIds.map(() => "?").join(",");
  const imgs = await query<PostImageRow[]>(
    `SELECT post_id, image_url FROM post_images WHERE post_id IN (${placeholders}) ORDER BY post_id, sort_order`,
    postIds
  );
  for (const im of imgs) {
    const list = imageMap.get(im.post_id) ?? [];
    list.push(im.image_url);
    imageMap.set(im.post_id, list);
  }
  return imageMap;
}

/**
 * 将帖子 id → 原始图片引用 的映射，批量转为前端可直接访问的地址。
 * - 本地 test 图片：/image/test/<文件名>
 * - http/https 外链：原样返回
 */
async function resolveImageMapToClientPaths(imageMap: Map<number, string[]>): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const allRefs: string[] = [];
  for (const urls of imageMap.values()) {
    allRefs.push(...urls);
  }
  const refMap = await batchResolveStoredImagesToClientPaths(allRefs);
  for (const [pid, urls] of imageMap) {
    out.set(
      pid,
      urls.map((u) => refMap.get(u) ?? u)
    );
  }
  return out;
}

/**
 * 批量查询当前用户对一批帖子是否点赞、是否收藏。
 */
async function loadLikedAndFavoritedSets(
  userId: number,
  postIds: number[]
): Promise<{ liked: Set<number>; favorited: Set<number> }> {
  if (postIds.length === 0) {
    return { liked: new Set(), favorited: new Set() };
  }
  const placeholders = postIds.map(() => "?").join(",");
  const likeRows = await query<PostIdRow[]>(
    `SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
    [userId, ...postIds]
  );
  const favRows = await query<PostIdRow[]>(
    `SELECT post_id FROM post_favorites WHERE user_id = ? AND post_id IN (${placeholders})`,
    [userId, ...postIds]
  );
  return {
    liked: new Set(likeRows.map((r) => Number(r.post_id))),
    favorited: new Set(favRows.map((r) => Number(r.post_id))),
  };
}

/**
 * 将一行帖子 + 图片与互动状态组装为接口 JSON。
 */
function toFeedItemJson(
  r: PostFeedRow,
  imageUrls: string[],
  liked: boolean,
  favorited: boolean,
  avatarDisplay: string
): PostFeedItemJson {
  return {
    id: r.id,
    title: r.title,
    content: r.content ?? "",
    excerpt: r.excerpt ?? "",
    commentCount: r.comment_count,
    likeCount: r.like_count,
    favoriteCount: r.favorite_count,
    nickname: r.nickname,
    avatar: avatarDisplay,
    sectionName: r.section_name ?? "帖子",
    imageUrls,
    liked,
    favorited,
  };
}

/**
 * 按主键查询单条已发布帖子，并组装为与列表项一致的结构（供点赞/收藏后整卡刷新）。
 */
async function getPostFeedItemById(
  postId: number,
  viewerUserId: number | undefined
): Promise<PostFeedItemJson | null> {
  const row = await queryOne<PostFeedRow>(
    `SELECT p.id, p.title, p.content, p.excerpt, p.comment_count, p.like_count, p.favorite_count,
            u.nickname, u.avatar, sec.name AS section_name
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     LEFT JOIN sections sec ON sec.id = p.section_id
     WHERE p.id = ? AND p.status = 1`,
    [postId]
  );
  if (!row) return null;
  const imageMap = await buildImageMapForIds([postId]);
  const clientPathMap = await resolveImageMapToClientPaths(imageMap);
  const imageUrls = clientPathMap.get(postId) ?? [];
  const avKey = row.avatar ?? "";
  const avatarMap = await batchResolveStoredImagesToClientPaths([avKey]);
  const avatarDisplay = avatarMap.get(avKey) ?? avKey;
  let liked = false;
  let favorited = false;
  if (viewerUserId != null) {
    const sets = await loadLikedAndFavoritedSets(viewerUserId, [postId]);
    liked = sets.liked.has(postId);
    favorited = sets.favorited.has(postId);
  }
  return toFeedItemJson(row, imageUrls, liked, favorited, avatarDisplay);
}

/**
 * 截取列表摘要：固定使用正文前 40 个字符（去掉首尾空白）。
 */
function buildExcerpt(content: string): string {
  const base = content.trim();
  if (!base) return "";
  if (base.length <= 40) return base;
  return base.slice(0, 40);
}

/**
 * 首页帖子流：分页查询已发布帖子，附带作者昵称、版块名与图片地址列表（无需登录）。
 */
async function listFeedHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSizeRaw = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? "10"), 10) || 10));
    const offsetRaw = (page - 1) * pageSizeRaw;
    /** LIMIT/OFFSET 不用占位符：部分 MySQL/驱动组合下预处理语句绑定 LIMIT 会报 ER_WRONG_ARGUMENTS */
    const limitN = Math.floor(pageSizeRaw);
    const offsetN = Math.floor(offsetRaw);

    const rows = await query<PostFeedRow[]>(
      `SELECT p.id, p.title, p.content, p.excerpt, p.comment_count, p.like_count, p.favorite_count,
              u.nickname, u.avatar, sec.name AS section_name
       FROM posts p
       INNER JOIN users u ON u.id = p.user_id
       LEFT JOIN sections sec ON sec.id = p.section_id
       WHERE p.status = 1
       ORDER BY p.created_at DESC
       LIMIT ${limitN} OFFSET ${offsetN}`
    );

    const ids = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
    const imageMap = await buildImageMapForIds(ids);
    const clientPathMap = await resolveImageMapToClientPaths(imageMap);
    const avatarMap = await batchResolveStoredImagesToClientPaths(rows.map((r) => r.avatar));

    const viewerId = req.userId;
    let likedSet = new Set<number>();
    let favoritedSet = new Set<number>();
    if (viewerId != null && ids.length > 0) {
      const sets = await loadLikedAndFavoritedSets(viewerId, ids);
      likedSet = sets.liked;
      favoritedSet = sets.favorited;
    }

    const list: PostFeedItemJson[] = rows.map((r) => {
      const pid = Number(r.id);
      const avKey = r.avatar ?? "";
      const avatarDisplay = avatarMap.get(avKey) ?? avKey;
      return toFeedItemJson(
        r,
        clientPathMap.get(pid) ?? [],
        likedSet.has(pid),
        favoritedSet.has(pid),
        avatarDisplay
      );
    });

    successResponse(res, { list, page, pageSize: limitN }, "获取帖子列表成功");
  } catch (error) {
    const err = error as Error;
    console.error("[posts] GET /api/posts 失败:", err.message, error);
    successResponse(res, null, `获取帖子列表失败: ${err.message}`, 500, 500);
  }
}

/**
 * GET /api/posts/favorites
 * 当前登录用户收藏的已发布帖子列表（按收藏时间倒序），单条结构与首页信息流一致，供「我的收藏」页展示。
 */
async function listMyFavoritePostsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (userId == null) {
    successResponse(res, null, "请先登录", 401, 401);
    return;
  }
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSizeRaw = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
    const offsetRaw = (page - 1) * pageSizeRaw;
    const limitN = Math.floor(pageSizeRaw);
    const offsetN = Math.floor(offsetRaw);

    const countRow = await queryOne<RowDataPacket & { c: number }>(
      `SELECT COUNT(*) AS c
       FROM post_favorites f
       INNER JOIN posts p ON p.id = f.post_id AND p.status = 1
       WHERE f.user_id = ?`,
      [userId]
    );
    const total = countRow && typeof countRow.c === "number" ? countRow.c : 0;

    const rows = await query<PostFeedRow[]>(
      `SELECT p.id, p.title, p.content, p.excerpt, p.comment_count, p.like_count, p.favorite_count,
              u.nickname, u.avatar, sec.name AS section_name
       FROM post_favorites f
       INNER JOIN posts p ON p.id = f.post_id AND p.status = 1
       INNER JOIN users u ON u.id = p.user_id
       LEFT JOIN sections sec ON sec.id = p.section_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT ${limitN} OFFSET ${offsetN}`,
      [userId]
    );

    const ids = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
    const imageMap = await buildImageMapForIds(ids);
    const clientPathMap = await resolveImageMapToClientPaths(imageMap);
    const avatarMap = await batchResolveStoredImagesToClientPaths(rows.map((r) => r.avatar));

    let likedSet = new Set<number>();
    let favoritedSet = new Set<number>();
    if (ids.length > 0) {
      const sets = await loadLikedAndFavoritedSets(userId, ids);
      likedSet = sets.liked;
      favoritedSet = sets.favorited;
    }

    const list: PostFeedItemJson[] = rows.map((r) => {
      const pid = Number(r.id);
      const avKey = r.avatar ?? "";
      const avatarDisplay = avatarMap.get(avKey) ?? avKey;
      return toFeedItemJson(
        r,
        clientPathMap.get(pid) ?? [],
        likedSet.has(pid),
        favoritedSet.has(pid),
        avatarDisplay
      );
    });

    successResponse(res, { list, page, pageSize: limitN, total }, "获取收藏列表成功");
  } catch (error) {
    const err = error as Error;
    console.error("[posts] GET /api/posts/favorites 失败:", err.message, error);
    successResponse(res, null, `获取收藏列表失败: ${err.message}`, 500, 500);
  }
}

/**
 * GET /api/posts/mine
 * 当前登录用户自己发布的已上架帖子（按发帖时间倒序），单条结构与首页信息流一致，供「我的发布」页展示与互动。
 */
async function listMyPublishedPostsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (userId == null) {
    successResponse(res, null, "请先登录", 401, 401);
    return;
  }
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSizeRaw = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
    const offsetRaw = (page - 1) * pageSizeRaw;
    const limitN = Math.floor(pageSizeRaw);
    const offsetN = Math.floor(offsetRaw);

    const countRow = await queryOne<RowDataPacket & { c: number }>(
      `SELECT COUNT(*) AS c FROM posts WHERE user_id = ? AND status = 1`,
      [userId]
    );
    const total = countRow && typeof countRow.c === "number" ? countRow.c : 0;

    const rows = await query<PostFeedRow[]>(
      `SELECT p.id, p.title, p.content, p.excerpt, p.comment_count, p.like_count, p.favorite_count,
              u.nickname, u.avatar, sec.name AS section_name
       FROM posts p
       INNER JOIN users u ON u.id = p.user_id
       LEFT JOIN sections sec ON sec.id = p.section_id
       WHERE p.user_id = ? AND p.status = 1
       ORDER BY p.created_at DESC
       LIMIT ${limitN} OFFSET ${offsetN}`,
      [userId]
    );

    const ids = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
    const imageMap = await buildImageMapForIds(ids);
    const clientPathMap = await resolveImageMapToClientPaths(imageMap);
    const avatarMap = await batchResolveStoredImagesToClientPaths(rows.map((r) => r.avatar));

    let likedSet = new Set<number>();
    let favoritedSet = new Set<number>();
    if (ids.length > 0) {
      const sets = await loadLikedAndFavoritedSets(userId, ids);
      likedSet = sets.liked;
      favoritedSet = sets.favorited;
    }

    const list: PostFeedItemJson[] = rows.map((r) => {
      const pid = Number(r.id);
      const avKey = r.avatar ?? "";
      const avatarDisplay = avatarMap.get(avKey) ?? avKey;
      return toFeedItemJson(
        r,
        clientPathMap.get(pid) ?? [],
        likedSet.has(pid),
        favoritedSet.has(pid),
        avatarDisplay
      );
    });

    successResponse(res, { list, page, pageSize: limitN, total }, "获取我的发布列表成功");
  } catch (error) {
    const err = error as Error;
    console.error("[posts] GET /api/posts/mine 失败:", err.message, error);
    successResponse(res, null, `获取我的发布列表失败: ${err.message}`, 500, 500);
  }
}

/**
 * 创建帖子（发布）核心逻辑：写入 posts 与 post_images，版块由 sectionKey 映射 sections.id。
 * 挂载路径：
 * - POST /api/posts
 * - POST /api/posts/publish（与「发布」语义一致，入参与响应相同）
 *
 * 鉴权：Header `Authorization: Bearer <token>`；标题、正文必填；imageUrls 可选，最多 8 条。
 * 单条可为：上传接口返回的 test/文件名、完整可访问 URL、或 data:image 的 Base64 串；入库统一为 test/ 或外链串。
 */
const createPostHandler: RequestHandler<unknown, unknown, CreatePostBody> = async (req, res) => {
  try {
    const userId = req.userId;
    if (userId == null) {
      successResponse(res, null, "未授权", 401, 401);
      return;
    }

    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    const sectionKeyRaw = req.body.sectionKey;

    if (!title) {
      successResponse(res, null, "标题不能为空", 400, 400);
      return;
    }
    if (!content) {
      successResponse(res, null, "正文不能为空", 400, 400);
      return;
    }
    if (!isPublishSectionKey(sectionKeyRaw)) {
      successResponse(res, null, "无效的发布版块类型", 400, 400);
      return;
    }

    const sectionKey = sectionKeyRaw as PublishSectionKey;
    const sectionName = SECTION_NAME_BY_KEY[sectionKey];
    const section = await queryOne<SectionRow>(
      "SELECT id FROM sections WHERE name = ? LIMIT 1",
      [sectionName]
    );
    if (!section) {
      successResponse(
        res,
        null,
        "版块数据未初始化，请在数据库执行 seed_publish_sections 脚本",
        500,
        500
      );
      return;
    }

    let imageUrls: string[] = [];
    if (Array.isArray(req.body.imageUrls)) {
      imageUrls = req.body.imageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    }
    if (imageUrls.length > 8) {
      successResponse(res, null, "图片最多 8 张", 400, 400);
      return;
    }

    let normalizedImageRefs: string[] = [];
    try {
      normalizedImageRefs = await Promise.all(imageUrls.map((u) => normalizeImageRefForStorage(u)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "图片处理失败";
      successResponse(res, null, msg, 400, 400);
      return;
    }

    const excerpt = buildExcerpt(content);

    const postId = await transaction(async (conn: PoolConnection) => {
      const [insertResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO posts (user_id, section_id, title, content, excerpt, status)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [userId, section.id, title, content, excerpt]
      );
      const rawId = insertResult.insertId;
      const newId = typeof rawId === "bigint" ? Number(rawId) : Number(rawId);
      if (!Number.isFinite(newId) || newId <= 0) {
        throw new Error("插入帖子失败：未获得有效 insertId");
      }
      for (let i = 0; i < normalizedImageRefs.length; i += 1) {
        await conn.execute(
          `INSERT INTO post_images (post_id, image_url, sort_order) VALUES (?, ?, ?)`,
          [newId, normalizedImageRefs[i], i]
        );
      }
      return newId;
    });

    console.log("[posts] 发布成功 postId=%s userId=%s sectionId=%s", postId, userId, section.id);
    successResponse(res, { id: postId, sectionId: section.id }, "发布成功");
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `发布失败: ${err.message}`, 500, 500);
  }
};

/**
 * POST /api/posts/:postId/like
 * 切换点赞（已赞则取消）；需登录。返回当前帖完整信息流字段，供前端替换列表中该条数据。
 */
const togglePostLikeHandler: RequestHandler<{ postId: string }> = async (req, res) => {
  const userId = req.userId;
  if (userId == null) {
    successResponse(res, null, "请先登录", 401, 401);
    return;
  }
  const postId = parseInt(String(req.params.postId), 10);
  if (!Number.isFinite(postId) || postId <= 0) {
    successResponse(res, null, "无效的帖子 ID", 400, 400);
    return;
  }
  let nowLiked = false;
  try {
    await transaction(async (conn: PoolConnection) => {
      const [prows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM posts WHERE id = ? AND status = 1 FOR UPDATE`,
        [postId]
      );
      const locked = Array.isArray(prows) ? prows : [];
      if (locked.length === 0) {
        throw new Error("POST_NOT_FOUND");
      }
      const [lrows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM post_likes WHERE user_id = ? AND post_id = ? LIMIT 1`,
        [userId, postId]
      );
      const hasLike = Array.isArray(lrows) && lrows.length > 0;
      if (hasLike) {
        await conn.execute(`DELETE FROM post_likes WHERE user_id = ? AND post_id = ?`, [userId, postId]);
        await conn.execute(
          `UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = ?`,
          [postId]
        );
        nowLiked = false;
      } else {
        await conn.execute(`INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)`, [userId, postId]);
        await conn.execute(`UPDATE posts SET like_count = like_count + 1 WHERE id = ?`, [postId]);
        nowLiked = true;
      }
    });
    const item = await getPostFeedItemById(postId, userId);
    if (!item) {
      successResponse(res, null, "帖子不存在", 404, 404);
      return;
    }
    successResponse(res, item, nowLiked ? "已点赞" : "已取消点赞");
  } catch (error) {
    const err = error as Error;
    if (err.message === "POST_NOT_FOUND") {
      successResponse(res, null, "帖子不存在或已下架", 404, 404);
      return;
    }
    console.error("[posts] POST .../like 失败:", err.message, error);
    successResponse(res, null, `点赞操作失败: ${err.message}`, 500, 500);
  }
};

/**
 * POST /api/posts/:postId/favorite
 * 切换收藏；需登录。返回当前帖完整信息流字段。
 */
const togglePostFavoriteHandler: RequestHandler<{ postId: string }> = async (req, res) => {
  const userId = req.userId;
  if (userId == null) {
    successResponse(res, null, "请先登录", 401, 401);
    return;
  }
  const postId = parseInt(String(req.params.postId), 10);
  if (!Number.isFinite(postId) || postId <= 0) {
    successResponse(res, null, "无效的帖子 ID", 400, 400);
    return;
  }
  let nowFavorited = false;
  try {
    await transaction(async (conn: PoolConnection) => {
      const [prows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM posts WHERE id = ? AND status = 1 FOR UPDATE`,
        [postId]
      );
      const locked = Array.isArray(prows) ? prows : [];
      if (locked.length === 0) {
        throw new Error("POST_NOT_FOUND");
      }
      const [frows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM post_favorites WHERE user_id = ? AND post_id = ? LIMIT 1`,
        [userId, postId]
      );
      const hasFav = Array.isArray(frows) && frows.length > 0;
      if (hasFav) {
        await conn.execute(`DELETE FROM post_favorites WHERE user_id = ? AND post_id = ?`, [userId, postId]);
        await conn.execute(
          `UPDATE posts SET favorite_count = GREATEST(0, favorite_count - 1) WHERE id = ?`,
          [postId]
        );
        nowFavorited = false;
      } else {
        await conn.execute(`INSERT INTO post_favorites (user_id, post_id) VALUES (?, ?)`, [userId, postId]);
        await conn.execute(`UPDATE posts SET favorite_count = favorite_count + 1 WHERE id = ?`, [postId]);
        nowFavorited = true;
      }
    });
    const item = await getPostFeedItemById(postId, userId);
    if (!item) {
      successResponse(res, null, "帖子不存在", 404, 404);
      return;
    }
    successResponse(res, item, nowFavorited ? "已收藏" : "已取消收藏");
  } catch (error) {
    const err = error as Error;
    if (err.message === "POST_NOT_FOUND") {
      successResponse(res, null, "帖子不存在或已下架", 404, 404);
      return;
    }
    console.error("[posts] POST .../favorite 失败:", err.message, error);
    successResponse(res, null, `收藏操作失败: ${err.message}`, 500, 500);
  }
};

/**
 * GET /api/posts/:postId/comments
 * 拉取指定帖子下的可见评论（按创建时间正序），含楼中楼所需的被回复者昵称与用户 ID。
 */
async function listPostCommentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (!Number.isFinite(postId) || postId <= 0) {
      successResponse(res, null, "无效的帖子 ID", 400, 400);
      return;
    }
    const postOk = await queryOne<RowDataPacket>(
      "SELECT id FROM posts WHERE id = ? AND status = 1 LIMIT 1",
      [postId]
    );
    if (!postOk) {
      successResponse(res, null, "帖子不存在或已下架", 404, 404);
      return;
    }
    const limitRaw = parseInt(String(req.query.limit ?? "80"), 10) || 80;
    const limitN = Math.min(100, Math.max(1, Math.floor(limitRaw)));
    const rows = await query<CommentListRow[]>(
      `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.created_at,
              u.nickname AS nickname,
              cp.user_id AS parent_user_id,
              pu.nickname AS parent_author_nickname
       FROM comments c
       INNER JOIN users u ON u.id = c.user_id
       LEFT JOIN comments cp ON cp.id = c.parent_id AND cp.status = 1
       LEFT JOIN users pu ON pu.id = cp.user_id
       WHERE c.post_id = ? AND c.status = 1
       ORDER BY c.created_at ASC
       LIMIT ${limitN}`,
      [postId]
    );
    const list = rows.map(mapCommentRow);
    successResponse(res, { list }, "获取评论成功");
  } catch (error) {
    const err = error as Error;
    console.error("[posts] GET .../comments 失败:", err.message, error);
    successResponse(res, null, `获取评论失败: ${err.message}`, 500, 500);
  }
}

/**
 * POST /api/posts/:postId/comments
 * 发表评论或回复某条评论（body.parentId 为父评论 id）；需登录。返回新评论对象与更新后的帖子评论总数。
 */
const createPostCommentHandler: RequestHandler<{ postId: string }, unknown, CreateCommentBody> = async (
  req,
  res
) => {
  const userId = req.userId;
  if (userId == null) {
    successResponse(res, null, "请先登录", 401, 401);
    return;
  }
  const postId = parseInt(String(req.params.postId), 10);
  if (!Number.isFinite(postId) || postId <= 0) {
    successResponse(res, null, "无效的帖子 ID", 400, 400);
    return;
  }
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    successResponse(res, null, "评论内容不能为空", 400, 400);
    return;
  }
  if (content.length > 2000) {
    successResponse(res, null, "评论内容不能超过 2000 字", 400, 400);
    return;
  }
  let parentId: number | null = null;
  const rawParent = req.body.parentId;
  if (rawParent !== undefined && rawParent !== null && rawParent !== "") {
    const p = typeof rawParent === "number" ? rawParent : parseInt(String(rawParent), 10);
    if (!Number.isFinite(p) || p <= 0) {
      successResponse(res, null, "无效的父评论", 400, 400);
      return;
    }
    parentId = p;
  }

  try {
    let newCommentId = 0;
    let commentCount = 0;
    await transaction(async (conn: PoolConnection) => {
      const [prows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM posts WHERE id = ? AND status = 1 FOR UPDATE`,
        [postId]
      );
      if (!Array.isArray(prows) || prows.length === 0) {
        throw new Error("POST_NOT_FOUND");
      }
      if (parentId != null) {
        const [parents] = await conn.execute<RowDataPacket[]>(
          `SELECT id FROM comments WHERE id = ? AND post_id = ? AND status = 1 LIMIT 1`,
          [parentId, postId]
        );
        if (!Array.isArray(parents) || parents.length === 0) {
          throw new Error("PARENT_NOT_FOUND");
        }
      }
      const [ins] = await conn.execute<ResultSetHeader>(
        `INSERT INTO comments (post_id, user_id, parent_id, content, status) VALUES (?, ?, ?, ?, 1)`,
        [postId, userId, parentId, content]
      );
      const rawIns = ins.insertId;
      newCommentId = typeof rawIns === "bigint" ? Number(rawIns) : Number(rawIns);
      if (!Number.isFinite(newCommentId) || newCommentId <= 0) {
        throw new Error("INSERT_COMMENT_FAILED");
      }
      await conn.execute(`UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?`, [postId]);
      const [cntRows] = await conn.execute<RowDataPacket[]>(
        `SELECT comment_count AS c FROM posts WHERE id = ? LIMIT 1`,
        [postId]
      );
      const crow = Array.isArray(cntRows) ? cntRows[0] : undefined;
      commentCount = crow && typeof (crow as { c: number }).c === "number" ? (crow as { c: number }).c : 0;
    });

    const comment = await getCommentById(newCommentId);
    if (!comment) {
      successResponse(res, null, "评论已创建但读取失败", 500, 500);
      return;
    }
    successResponse(res, { comment, commentCount }, "发送成功");
  } catch (error) {
    const err = error as Error;
    if (err.message === "POST_NOT_FOUND") {
      successResponse(res, null, "帖子不存在或已下架", 404, 404);
      return;
    }
    if (err.message === "PARENT_NOT_FOUND") {
      successResponse(res, null, "回复的评论不存在或已删除", 400, 400);
      return;
    }
    console.error("[posts] POST .../comments 失败:", err.message, error);
    successResponse(res, null, `发送失败: ${err.message}`, 500, 500);
  }
};

router.get("/", optionalAuth, listFeedHandler);
router.post("/", requireAuth, createPostHandler);
router.post("/publish", requireAuth, createPostHandler);
router.get("/favorites", requireAuth, listMyFavoritePostsHandler);
router.get("/mine", requireAuth, listMyPublishedPostsHandler);
router.get("/:postId/comments", listPostCommentsHandler);
router.post("/:postId/comments", requireAuth, createPostCommentHandler);
router.post("/:postId/like", requireAuth, togglePostLikeHandler);
router.post("/:postId/favorite", requireAuth, togglePostFavoriteHandler);

export default router;
