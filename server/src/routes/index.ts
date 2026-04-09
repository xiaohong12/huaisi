import { Router } from 'express';
import helloRouter from './hello';
import commonRouter from './common';
import authRouter from './auth';
import postsRouter from './posts';
import mallRouter from './mall';
import aiRouter from './ai';

const router = Router();

/**
 * 聚合子路由，统一挂载到 /api 下。
 */
router.use('/hello', helloRouter);
router.use('/common', commonRouter);
router.use('/auth', authRouter);
router.use('/posts', postsRouter);
router.use('/mall', mallRouter);
router.use('/ai', aiRouter);

export default router;
