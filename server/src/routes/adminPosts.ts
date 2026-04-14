import { Router, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { SqlParams } from '../db';
import { execute, query, queryOne } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { successResponse } from '../utils/response';
import { batchResolveStoredAvatarsForClient, resolveStoredImageToBase64DataUrl } from '../utils/imageMedia';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface AdminPostListRow extends RowDataPacket {
  id: number;
  title: string;
  excerpt: string | null;
  like_count: number;
  comment_count: number;
  status: number;
  created_at: Date | string;
  nickname: string;
  username: string;
}

interface CountRow extends RowDataPacket {
  c: number;
}

interface AdminPostDetailRow extends RowDataPacket {
  id: number;
  title: string;
  content: string;
  excerpt: string | null;
  comment_count: number;
  like_count: number;
  favorite_count: number;
  status: number;
  created_at: Date | string;
  nickname: string;
  avatar: string;
  section_name: string | null;
}

interface PostImageRow extends RowDataPacket {
  post_id: number;
  image_url: string;
}

/** 评论列表联表行（与 posts 路由中结构一致，供管理端只读展示） */
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

interface CommentItemJson {
  id: number;
  userId: number;
  nickname: string;
  content: string;
  parentId: number | null;
  replyToUserId: number | null;
  replyToNickname: string | null;
  createdAt: string;
}

/**
 * 将评论查询行转为接口对象（与 C 端 GET /api/posts/:id/comments 单条结构一致）。
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
 * 按帖子 id 列表拉取图片 URL，顺序与 sort_order 一致。
 */
async function buildImageMapForIds(postIds: number[]): Promise<Map<number, string[]>> {
  const imageMap = new Map<number, string[]>();
  if (postIds.length === 0) return imageMap;
  const placeholders = postIds.map(() => '?').join(',');
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
 * 将帖子配图批量转为 Base64 data URL（与首页信息流接口返回格式一致，便于管理端直接 img 展示）。
 */
async function resolveImageMapToBase64(imageMap: Map<number, string[]>): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  for (const [pid, urls] of imageMap) {
    const resolved = await Promise.all(urls.map((u) => resolveStoredImageToBase64DataUrl(u)));
    out.set(pid, resolved);
  }
  return out;
}

/**
 * 管理端帖子列表行映射为前端 JSON（驼峰字段）。
 */
function mapPostRow(r: AdminPostListRow) {
  const nick = typeof r.nickname === 'string' ? r.nickname.trim() : '';
  const uname = typeof r.username === 'string' ? r.username.trim() : '';
  /** 展示名：优先用户昵称，其次登录名，避免列表出现空白 */
  const authorDisplayName = nick || uname || '未命名用户';
  const created =
    r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at);
  return {
    id: Number(r.id),
    authorDisplayName,
    title: r.title ?? '',
    excerpt: r.excerpt != null && String(r.excerpt).trim() ? String(r.excerpt).trim() : '',
    likeCount: Number(r.like_count) || 0,
    commentCount: Number(r.comment_count) || 0,
    status: Number(r.status),
    createdAt: created,
  };
}

/**
 * GET /api/admin/posts
 * 管理后台：分页查询帖子主表，联表 users 取发布者昵称/用户名；支持按标题/正文摘要/正文/昵称/用户名模糊搜索。
 * 鉴权：Header `Authorization: Bearer <admin token>`。
 * 查询参数：page（默认 1）、pageSize（默认 20，最大 100）、keyword（可选）、status（可选：0/1/2/3 对应草稿/已发布/已隐藏/已删除）。
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
      typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(Number(pageSize))));
    const offset = (page - 1) * safeLimit;
    const safeOffset = Math.max(0, Math.floor(Number(offset)));

    const whereParts: string[] = [];
    const whereParams: SqlParams[] = [];
    if (keywordKw) {
      whereParts.push(
        '(p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ? OR u.nickname LIKE ? OR u.username LIKE ?)'
      );
      const kw = `%${keywordKw}%`;
      whereParams.push(kw, kw, kw, kw, kw);
    }
    if (statusRaw === '0' || statusRaw === '1' || statusRaw === '2' || statusRaw === '3') {
      whereParts.push('p.status = ?');
      whereParams.push(parseInt(statusRaw, 10));
    }
    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRow = await queryOne<CountRow>(
      `SELECT COUNT(*) AS c FROM posts p INNER JOIN users u ON u.id = p.user_id ${whereSql}`,
      whereParams.length > 0 ? whereParams : undefined
    );
    const total = Number(countRow?.c ?? 0);

    const listSql = `SELECT p.id, p.title, p.excerpt, p.like_count, p.comment_count, p.status, p.created_at,
            u.nickname, u.username
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const rows = await query<AdminPostListRow[]>(
      listSql,
      whereParams.length > 0 ? whereParams : undefined
    );

    successResponse(
      res,
      {
        list: rows.map((r) => mapPostRow(r)),
        total,
        page,
        pageSize: safeLimit,
      },
      '帖子列表查询成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `帖子列表查询失败: ${err.message}`, 500, 500);
  }
});

/**
 * GET /api/admin/posts/:postId
 * 管理后台：单帖详情 + 可见评论列表（只读）；不限制帖子 status，草稿/隐藏/已删帖仍可被运营查看。
 * 帖子主体字段与小程序首页信息流 DTO 对齐（含配图 Base64）；评论结构与 GET /api/posts/:id/comments 一致。
 * 鉴权：Header `Authorization: Bearer <admin token>`。
 */
router.get('/:postId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (!Number.isFinite(postId) || postId <= 0) {
      successResponse(res, null, '无效的帖子 ID', 400, 400);
      return;
    }

    const row = await queryOne<AdminPostDetailRow>(
      `SELECT p.id, p.title, p.content, p.excerpt, p.comment_count, p.like_count, p.favorite_count,
              p.status, p.created_at,
              u.nickname, u.avatar, sec.name AS section_name
       FROM posts p
       INNER JOIN users u ON u.id = p.user_id
       LEFT JOIN sections sec ON sec.id = p.section_id
       WHERE p.id = ?
       LIMIT 1`,
      [postId]
    );
    if (!row) {
      successResponse(res, null, '帖子不存在', 404, 404);
      return;
    }

    const imageMap = await buildImageMapForIds([postId]);
    const base64Map = await resolveImageMapToBase64(imageMap);
    const imageUrls = base64Map.get(postId) ?? [];
    const avKey = row.avatar ?? '';
    const avatarMap = await batchResolveStoredAvatarsForClient([avKey]);
    const avatarDisplay = avatarMap.get(avKey) ?? avKey;

    const limitRaw = parseInt(String(req.query.commentLimit ?? '80'), 10) || 80;
    const limitN = Math.min(100, Math.max(1, Math.floor(limitRaw)));
    const commentRows = await query<CommentListRow[]>(
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
    const comments = commentRows.map(mapCommentRow);

    const created =
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
    const nick = typeof row.nickname === 'string' ? row.nickname.trim() : '';

    successResponse(
      res,
      {
        post: {
          id: Number(row.id),
          title: row.title ?? '',
          content: row.content ?? '',
          excerpt: row.excerpt != null ? String(row.excerpt) : '',
          commentCount: Number(row.comment_count) || 0,
          likeCount: Number(row.like_count) || 0,
          favoriteCount: Number(row.favorite_count) || 0,
          nickname: nick || '用户',
          avatar: avatarDisplay,
          sectionName: row.section_name?.trim() || '帖子',
          imageUrls,
          status: Number(row.status),
          createdAt: created,
        },
        comments,
      },
      '帖子详情查询成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `帖子详情查询失败: ${err.message}`, 500, 500);
  }
});

/**
 * DELETE /api/admin/posts/:postId
 * 管理后台：将帖子标记为已删除（posts.status=3，软删除），C 端已发布流不再展示；重复删除视为成功。
 * 鉴权：Header `Authorization: Bearer <admin token>`。
 */
router.delete('/:postId', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (!Number.isFinite(postId) || postId <= 0) {
      successResponse(res, null, '无效的帖子 ID', 400, 400);
      return;
    }
    const exists = await queryOne<RowDataPacket>(
      'SELECT id FROM posts WHERE id = ? LIMIT 1',
      [postId]
    );
    if (!exists) {
      successResponse(res, null, '帖子不存在', 404, 404);
      return;
    }
    await execute(
      'UPDATE posts SET status = 3, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [postId]
    );
    successResponse(res, { id: postId }, '帖子已删除');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `帖子删除失败: ${err.message}`, 500, 500);
  }
});

/**
 * PUT /api/admin/posts/:postId/restore
 * 管理后台：恢复已删除帖子（posts.status 从 3 改回 1），恢复后 C 端已发布流可再次展示。
 * 鉴权：Header `Authorization: Bearer <admin token>`。
 */
router.put('/:postId/restore', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (!Number.isFinite(postId) || postId <= 0) {
      successResponse(res, null, '无效的帖子 ID', 400, 400);
      return;
    }
    const exists = await queryOne<RowDataPacket>(
      'SELECT id FROM posts WHERE id = ? LIMIT 1',
      [postId]
    );
    if (!exists) {
      successResponse(res, null, '帖子不存在', 404, 404);
      return;
    }
    await execute(
      'UPDATE posts SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [postId]
    );
    successResponse(res, { id: postId }, '帖子已恢复');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `帖子恢复失败: ${err.message}`, 500, 500);
  }
});

export default router;
