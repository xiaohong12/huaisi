import { Router } from 'express';
import helloRouter from './hello';
import commonRouter from './common';
import authRouter from './auth';
import postsRouter from './posts';
import mallRouter from './mall';
import aiRouter from './ai';
import userRouter from './user';
import adminAuthRouter from './adminAuth';
import adminUsersRouter from './adminUsers';
import adminOrdersRouter from './adminOrders';
import adminPostsRouter from './adminPosts';
import adminProductsRouter from './adminProducts';
import adminWorkbenchRouter from './adminWorkbench';

const router = Router();

/**
 * 聚合子路由，统一挂载到 /api 下。
 */
router.use('/hello', helloRouter);
router.use('/common', commonRouter);
router.use('/auth', authRouter);
router.use('/posts', postsRouter);
router.use('/mall', mallRouter);
router.use('/user', userRouter);
router.use('/ai', aiRouter);
/**
 * 管理后台鉴权相关：与 /api/auth（C 端用户）隔离，token 仅存 admin_tokens。
 */
router.use('/admin/auth', adminAuthRouter);
/**
 * 管理后台业务：C 端用户列表等（均需 admin token）。
 */
router.use('/admin/users', adminUsersRouter);
/**
 * 管理后台业务：商城订单列表（含商品首图与商品名，均需 admin token）。
 */
router.use('/admin/orders', adminOrdersRouter);
/**
 * 管理后台业务：帖子列表（均需 admin token）。
 */
router.use('/admin/posts', adminPostsRouter);
/**
 * 管理后台业务：商品中心列表与新增（均需 admin token）。
 */
router.use('/admin/products', adminProductsRouter);
/**
 * 管理后台业务：工作台今日指标与趋势（均需 admin token）。
 */
router.use('/admin/workbench', adminWorkbenchRouter);

export default router;
