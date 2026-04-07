import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool, closePool } from './pool';

export { getPool, closePool };

/**
 * SQL 预处理占位符参数类型，与 mysql2 `execute` 第二参数一致（避免依赖包内路径）。
 */
export type SqlParams =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | Buffer
  | Uint8Array
  | SqlParams[]
  | { [key: string]: SqlParams };

/**
 * 执行查询类 SQL（SELECT），返回多行结果。
 * 使用预处理占位符 `?` 传参，避免 SQL 注入。
 *
 * @param sql 带占位符的 SQL 语句
 * @param params 与占位符顺序对应的参数数组
 */
export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params?: SqlParams
): Promise<T> {
  const pool = getPool();
  const [rows] = await pool.execute<T>(sql, params ?? []);
  return rows;
}

/**
 * 执行查询并只取第一行，无结果时返回 null。
 * 常用于按主键或唯一条件查单条记录。
 */
export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: SqlParams
): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows[0] ?? null;
}

/**
 * 执行写操作类 SQL（INSERT / UPDATE / DELETE），返回受影响行数、插入 ID 等元信息。
 */
export async function execute(sql: string, params?: SqlParams): Promise<ResultSetHeader> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(sql, params ?? []);
  return result;
}

/**
 * 在事务中执行多步读写：全部成功则提交，任一步失败则回滚。
 *
 * @param handler 接收当前连接，在其中使用 `conn.execute` 等保证同一事务
 */
export async function transaction<T>(handler: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await handler(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
