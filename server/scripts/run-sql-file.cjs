/**
 * 使用项目依赖的 mysql2 执行指定 SQL 文件（支持多语句）。
 * 用法：node scripts/run-sql-file.cjs <相对 server 目录的 sql 路径>
 * 示例：node scripts/run-sql-file.cjs sql/2026-03-30_create_home_tables.sql
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error('用法: node scripts/run-sql-file.cjs <sql 文件路径>');
    process.exit(1);
  }
  const sqlPath = path.resolve(__dirname, '..', rel);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true
  });

  await conn.query(sql);
  await conn.end();
  console.log('SQL 执行成功:', rel);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
