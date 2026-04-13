/**
 * 在 admin_users 中插入一条管理员（密码经 bcrypt 哈希）。
 * 用法: node scripts/create-admin-user.cjs <用户名> <明文密码> [展示名]
 * 依赖环境变量: MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE
 */
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function main() {
  const username = process.argv[2];
  const plainPassword = process.argv[3];
  const displayName = process.argv[4] || username;

  if (!username || !plainPassword) {
    console.error('用法: node scripts/create-admin-user.cjs <用户名> <明文密码> [展示名]');
    process.exit(1);
  }

  if (username.length > 64 || displayName.length > 64) {
    console.error('用户名或展示名长度不能超过 64');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: false
  });

  try {
    await conn.execute(
      `INSERT INTO admin_users (username, password, display_name, status)
       VALUES (?, ?, ?, 1)`,
      [username, passwordHash, displayName]
    );
    console.log('管理员已创建:', username);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
