import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { RowDataPacket } from 'mysql2/promise';
import { successResponse } from '../utils/response';
import { query } from '../db';
import { batchResolveStoredAvatarsForClient, TEST_IMAGE_DIR } from '../utils/imageMedia';

const router = Router();
const uploadDir = TEST_IMAGE_DIR;
interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  avatar: string;
  gender: 'male' | 'female' | 'unknown';
  created_at: string;
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  /**
   * 配置上传目录，所有上传图片统一落到 test 目录。
   */
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  /**
   * 生成上传文件名，使用时间戳+随机数避免重名。
   */
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({ storage });
const REMOTE_IMAGE_URL = 'https://img1.baidu.com/it/u=2456334644,3378803144&fm=253&app=120&f=JPEG?w=800&h=1422';

/**
 * 测试接口：返回服务名称与当前时间。
 */
router.get('/test', (_req: Request, res: Response) => {
  successResponse(
    res,
    {
      name: 'huasi-api',
      now: new Date().toISOString()
    },
    '接口调用成功'
  );
});

/**
 * 查询用户表全部数据并返回给前端展示；avatar 规则：本地 image/test 返回 /image/test 路径，http/https 外链原样返回。
 */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const rows = await query<UserRow[]>(
      'SELECT id, username, nickname, phone, avatar, gender, created_at FROM users ORDER BY id ASC'
    );
    const avatarMap = await batchResolveStoredAvatarsForClient(rows.map((r) => r.avatar));
    const payload = rows.map((r) => {
      const k = r.avatar ?? '';
      return {
        id: r.id,
        username: r.username,
        nickname: r.nickname,
        phone: r.phone,
        avatar: avatarMap.get(k) ?? k,
        gender: r.gender,
        created_at: r.created_at,
      };
    });
    successResponse(res, payload, '用户列表获取成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `用户列表获取失败: ${err.message}`, 500, 500);
  }
});

const imageFilePath = path.resolve(__dirname, '../../image/test/image-display.jpg');

/**
 * 获取后台预置图片地址：若本地示例图存在则返回 /image/test/image-display.jpg。
 */
router.get('/image-url', (_req: Request, res: Response) => {
  const imageUrl = fs.existsSync(imageFilePath) ? '/image/test/image-display.jpg' : '';
  successResponse(
    res,
    {
      imageUrl
    },
    '图片地址获取成功'
  );
});

/**
 * 远程下载图片接口：直接返回可访问的 http(s) 图片地址，不再转 Base64。
 */
router.get('/remote-image-base64', async (_req: Request, res: Response) => {
  try {
    successResponse(res, { imageUrl: REMOTE_IMAGE_URL }, '远程图片地址获取成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `远程图片处理失败: ${err.message}`, 500, 500);
  }
});

/**
 * 远程示例图接口：返回可访问的 http(s) 图片地址。
 */
router.get('/remote-image-url', async (_req: Request, res: Response) => {
  try {
    successResponse(res, { imageUrl: REMOTE_IMAGE_URL }, '远程图片地址获取成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `远程图片处理失败: ${err.message}`, 500, 500);
  }
});

/**
 * 上传图片接口：文件保存到 image/test，返回文件名与可访问路径，前端可统一拼接服务地址后展示。
 */
router.post('/upload-image', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;

  if (!file) {
    successResponse(res, null, '未接收到图片文件', 400, 400);
    return;
  }

  successResponse(
    res,
    {
      fileName: file.filename,
      imageUrl: `/image/test/${file.filename}`,
    },
    '上传成功'
  );
});

export default router;
