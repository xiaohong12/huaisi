import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query, queryOne } from '../db';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware';
import { successResponse } from '../utils/response';

const router = Router();

interface CountRow extends RowDataPacket {
  c: number;
}

interface SumRow extends RowDataPacket {
  amount: string | number | null;
}

interface HourCountRow extends RowDataPacket {
  hour_slot: number;
  c: number;
}

interface DateCountRow extends RowDataPacket {
  date_slot: string;
  c: number;
}

interface LatestTradeRow extends RowDataPacket {
  id: number;
  order_no: string;
  user_id: number;
  username: string | null;
  total_amount: string | number;
  workflow_status: number;
  created_at: Date | string;
}

const WORKFLOW_STATUS_LABELS = ['待付款', '已付款', '已发货', '已完成', '已取消'] as const;

function workflowDbToLabel(status: number): string {
  const n = Number(status);
  if (Number.isFinite(n) && n >= 0 && n < WORKFLOW_STATUS_LABELS.length) {
    return WORKFLOW_STATUS_LABELS[n] as string;
  }
  return '未知状态';
}

/**
 * GET /api/admin/workbench/today
 * 管理后台工作台首页聚合数据：今日核心指标、按小时趋势、近 7 天趋势、今日最新 10 笔交易（已支付）。
 */
router.get('/today', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    /**
     * 今日活跃人数：按行为去重用户（下单、发帖、评论、点赞、收藏）。
     * 说明：当前无专门埋点表，活跃定义基于业务行为表聚合，适合运营看日活趋势。
     */
    const activeUsersRow = await queryOne<CountRow>(
      `SELECT COUNT(DISTINCT t.user_id) AS c
       FROM (
         SELECT user_id FROM mall_orders
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT user_id FROM posts
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT user_id FROM comments
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT user_id FROM post_likes
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT user_id FROM post_favorites
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ) t`
    );

    /** 今日订单成交量：按已支付订单统计。 */
    const paidOrderCountRow = await queryOne<CountRow>(
      `SELECT COUNT(*) AS c
       FROM mall_orders
       WHERE payment_status = 1
         AND created_at >= CURDATE()
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );

    /** 今日发帖量：按帖子创建时间统计。 */
    const postCountRow = await queryOne<CountRow>(
      `SELECT COUNT(*) AS c
       FROM posts
       WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );

    /** 今日成交额：已支付订单 total_amount 求和。 */
    const tradeAmountRow = await queryOne<SumRow>(
      `SELECT COALESCE(SUM(total_amount), 0) AS amount
       FROM mall_orders
       WHERE payment_status = 1
         AND created_at >= CURDATE()
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );

    /** 扩展指标：今日新增用户。 */
    const newUsersRow = await queryOne<CountRow>(
      `SELECT COUNT(*) AS c
       FROM users
       WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );

    /** 按小时订单成交趋势（仅统计已支付）。 */
    const orderTrendRows = await query<HourCountRow[]>(
      `SELECT HOUR(created_at) AS hour_slot, COUNT(*) AS c
       FROM mall_orders
       WHERE payment_status = 1
         AND created_at >= CURDATE()
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       GROUP BY HOUR(created_at)`
    );

    /** 按小时发帖趋势。 */
    const postTrendRows = await query<HourCountRow[]>(
      `SELECT HOUR(created_at) AS hour_slot, COUNT(*) AS c
       FROM posts
       WHERE created_at >= CURDATE()
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       GROUP BY HOUR(created_at)`
    );

    /** 按小时活跃用户趋势（同“活跃人数”定义，小时粒度去重）。 */
    const activeTrendRows = await query<HourCountRow[]>(
      `SELECT t.hour_slot, COUNT(DISTINCT t.user_id) AS c
       FROM (
         SELECT HOUR(created_at) AS hour_slot, user_id
         FROM mall_orders
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT HOUR(created_at) AS hour_slot, user_id
         FROM posts
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT HOUR(created_at) AS hour_slot, user_id
         FROM comments
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT HOUR(created_at) AS hour_slot, user_id
         FROM post_likes
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT HOUR(created_at) AS hour_slot, user_id
         FROM post_favorites
         WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ) t
       GROUP BY t.hour_slot`
    );

    /** 近 7 天订单成交趋势（按天统计，仅统计已支付）。 */
    const orderDailyRows = await query<DateCountRow[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, COUNT(*) AS c
       FROM mall_orders
       WHERE payment_status = 1
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`
    );

    /** 近 7 天发帖趋势（按天统计）。 */
    const postDailyRows = await query<DateCountRow[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, COUNT(*) AS c
       FROM posts
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`
    );

    /** 近 7 天活跃用户趋势（同“活跃人数”定义，按天去重）。 */
    const activeDailyRows = await query<DateCountRow[]>(
      `SELECT t.date_slot, COUNT(DISTINCT t.user_id) AS c
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, user_id
         FROM mall_orders
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, user_id
         FROM posts
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, user_id
         FROM comments
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, user_id
         FROM post_likes
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date_slot, user_id
         FROM post_favorites
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
           AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ) t
       GROUP BY t.date_slot`
    );

    /** 今日最新 10 笔交易（按下单时间倒序，已支付）。 */
    const latestTrades = await query<LatestTradeRow[]>(
      `SELECT
         o.id,
         o.order_no,
         o.user_id,
         u.username,
         o.total_amount,
         o.workflow_status,
         o.created_at
       FROM mall_orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.payment_status = 1
         AND o.created_at >= CURDATE()
         AND o.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    const orderTrendMap = new Map(orderTrendRows.map((r) => [Number(r.hour_slot), Number(r.c) || 0]));
    const postTrendMap = new Map(postTrendRows.map((r) => [Number(r.hour_slot), Number(r.c) || 0]));
    const activeTrendMap = new Map(activeTrendRows.map((r) => [Number(r.hour_slot), Number(r.c) || 0]));
    const orderDailyMap = new Map(orderDailyRows.map((r) => [String(r.date_slot), Number(r.c) || 0]));
    const postDailyMap = new Map(postDailyRows.map((r) => [String(r.date_slot), Number(r.c) || 0]));
    const activeDailyMap = new Map(activeDailyRows.map((r) => [String(r.date_slot), Number(r.c) || 0]));

    const hourlyTrend = Array.from({ length: 24 }, (_unused, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      orderCount: orderTrendMap.get(hour) ?? 0,
      postCount: postTrendMap.get(hour) ?? 0,
      activeUsers: activeTrendMap.get(hour) ?? 0,
    }));

    /**
     * 近 7 天趋势：包含今天在内的连续 7 天；无数据日期补 0，保证前端图表连续。
     */
    const dailyTrend = Array.from({ length: 7 }, (_unused, index) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - index));
      const isoDate = d.toISOString().slice(0, 10);
      return {
        date: isoDate,
        label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        orderCount: orderDailyMap.get(isoDate) ?? 0,
        postCount: postDailyMap.get(isoDate) ?? 0,
        activeUsers: activeDailyMap.get(isoDate) ?? 0,
      };
    });

    const tradeAmountToday = Number(tradeAmountRow?.amount ?? 0) || 0;
    const orderCountToday = Number(paidOrderCountRow?.c ?? 0) || 0;

    successResponse(
      res,
      {
        metrics: {
          activeUsersToday: Number(activeUsersRow?.c ?? 0) || 0,
          orderCountToday,
          postCountToday: Number(postCountRow?.c ?? 0) || 0,
          tradeAmountToday,
          newUsersToday: Number(newUsersRow?.c ?? 0) || 0,
          averageOrderAmountToday:
            orderCountToday > 0 ? Number((tradeAmountToday / orderCountToday).toFixed(2)) : 0,
        },
        hourlyTrend,
        dailyTrend,
        latestTrades: latestTrades.map((row) => ({
          id: Number(row.id) || 0,
          orderNo: row.order_no,
          userId: Number(row.user_id) || 0,
          username: (row.username || '').trim() || `user_${Number(row.user_id) || 0}`,
          totalAmount: Number(row.total_amount) || 0,
          workflowStatus: workflowDbToLabel(Number(row.workflow_status)),
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
      },
      '工作台今日数据查询成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `工作台今日数据查询失败: ${err.message}`, 500, 500);
  }
});

export default router;
