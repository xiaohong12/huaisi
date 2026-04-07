import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response';

const router = Router();

/**
 * Hello 首页接口：返回服务基础信息与可用端点。
 */
router.get('/', (_req: Request, res: Response) => {
  successResponse(res, {
    message: 'Hello, Welcome to 华思后台 API!',
    version: '1.0.0',
    endpoints: {
      hello: '/api/hello',
      health: '/health',
      commonTest: '/api/common/test'
    }
  });
});

/**
 * Hello 消息接口：返回简单问候文案。
 */
router.get('/message', (_req: Request, res: Response) => {
  successResponse(res, { message: 'Hello, World!' });
});

export default router;
