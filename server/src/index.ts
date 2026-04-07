import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'os';
import config from './config';
import apiRouter from './routes';
import { successResponse, errorResponse } from './utils/response';
import { closePool } from './db';

/**
 * 获取当前机器可访问的本地 IPv4 地址，便于局域网调试访问。
 */
function getLocalIP(): string[] {
  const ips: string[] = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          if (alias.address.startsWith('192.168.') || alias.address.startsWith('10.') || alias.address.startsWith('172.')) {
            ips.push(alias.address);
          }
        }
      }
    }
  } catch {
    // ignore
  }
  if (ips.length === 0) {
    return ['localhost'];
  }
  return ips;
}

const app: Application = express();

app.use(helmet());
app.use(cors(config.cors));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/**
 * 图片静态目录跨域配置，确保前端可直接访问上传后的图片地址。
 */
app.use('/image', (_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  next();
}, express.static(path.resolve(__dirname, '../image')));

/**
 * 健康检查接口：用于确认服务在线状态。
 */
app.get('/health', (_req: Request, res: Response) => {
  successResponse(
    res,
    {
      status: 'ok'
    },
    '服务健康'
  );
});

app.use('/api', apiRouter);

/**
 * 未命中路由统一返回 404。
 */
app.use((_req: Request, res: Response) => {
  errorResponse(res, 'Not Found', 404);
});

/**
 * 全局异常处理中间件，兜底返回 500。
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err.message);
  errorResponse(res, 'Internal Server Error', 500);
});

const PORT = config.port;
const localIPs = getLocalIP();

/** 显式监听 IPv4 全地址，避免部分环境下仅绑定 :: 时真机/开发者工具用 192.168.x.x 访问出现连接被拒绝 */
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const ip of localIPs) {
    console.log(`  Network: http://${ip}:${PORT}`);
  }
  console.log(`Environment: ${config.env}`);
  console.log(
    `[MySQL] ${config.mysql.user}@${config.mysql.host}:${config.mysql.port}/${config.mysql.database}（发帖等数据写入此库，请与客户端工具连接一致）`
  );
});

/**
 * 进程退出时关闭 HTTP 与 MySQL 连接池，避免连接泄漏。
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

export default app;
