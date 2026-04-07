import mysql from 'mysql2/promise';
import config from '../config';

/**
 * 创建并缓存全局 MySQL 连接池，供全项目复用，避免频繁建连。
 * 使用连接池可控制并发连接数，并在高并发下复用 TCP 连接。
 */
let poolInstance: mysql.Pool | null = null;

/**
 * 获取单例连接池；若尚未创建则按配置初始化。
 */
export function getPool(): mysql.Pool {
  if (!poolInstance) {
    poolInstance = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: config.mysql.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return poolInstance;
}

/**
 * 优雅关闭连接池（例如进程退出前），释放所有连接。
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
