import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { RowDataPacket } from 'mysql2/promise';
import { successResponse } from '../utils/response';
import { query } from '../db';
import { batchResolveStoredImagesToDataUrls, getMimeTypeByExt, TEST_IMAGE_DIR } from '../utils/imageMedia';

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
 * 拉取预置远程示例图并转为 data URL，供多个测试接口复用。
 */
const loadRemoteSampleImageBase64 = async (): Promise<string> => {
  const response = await fetch(REMOTE_IMAGE_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Referer: 'https://www.baidu.com/',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`远程图片下载失败: ${response.status}`);
  }
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${imageBuffer.toString('base64')}`;
};

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
 * 查询用户表全部数据并返回给前端展示；avatar 为本地图时转为 Base64 data URL。
 */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const rows = await query<UserRow[]>(
      'SELECT id, username, nickname, phone, avatar, gender, created_at FROM users ORDER BY id ASC'
    );
    const avatarMap = await batchResolveStoredImagesToDataUrls(rows.map((r) => r.avatar));
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
let cachedImageBase64 = '';

/**
 * 读取并缓存展示图片的 Base64，避免重复磁盘读取。
 */
const getImageBase64 = (): string => {
  if (cachedImageBase64) {
    return cachedImageBase64;
  }

  const buffer = fs.readFileSync(imageFilePath);
  cachedImageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  return cachedImageBase64;
};

/**
 * 获取后台预置图片的 Base64 数据。
 */
router.get('/image-url', (_req: Request, res: Response) => {
  successResponse(
    res,
    {
      imageBase64: getImageBase64()
    },
    '图片Base64获取成功'
  );
});

/**
 * 远程下载图片接口：从指定 URL 拉取图片并转为 Base64 返回前端展示。
 */
router.get('/remote-image-base64', async (_req: Request, res: Response) => {
  try {
    const imageBase64 = await loadRemoteSampleImageBase64();
    successResponse(res, { imageBase64 }, '远程图片Base64获取成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `远程图片处理失败: ${err.message}`, 500, 500);
  }
});

/**
 * 远程示例图接口：与 remote-image-base64 一致，统一返回 Base64 数据供前端展示（不再返回外链 URL）。
 */
router.get('/remote-image-url', async (_req: Request, res: Response) => {
  try {
    const imageBase64 = await loadRemoteSampleImageBase64();
    successResponse(res, { imageBase64 }, '远程图片Base64获取成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `远程图片处理失败: ${err.message}`, 500, 500);
  }
});

/**
 * 上传图片接口：文件保存到 image/test，仅返回文件名与 Base64（不再返回可直链的 URL）。
 */
router.post('/upload-image', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;

  if (!file) {
    successResponse(res, null, '未接收到图片文件', 400, 400);
    return;
  }

  const fileBuffer = fs.readFileSync(file.path);
  const ext = path.extname(file.filename);
  const imageBase64 = `data:${getMimeTypeByExt(ext)};base64,${fileBuffer.toString('base64')}`;

  successResponse(
    res,
    {
      fileName: file.filename,
      imageBase64,
    },
    '上传成功'
  );
});

export default router;
