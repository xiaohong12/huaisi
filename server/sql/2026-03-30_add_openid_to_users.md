# users 表新增 openid 字段变更记录（2026-03-30）

## 变更背景

后端微信登录接口会通过 `openid` 查询或创建用户。当前 `users` 表缺少 `openid` 字段，会导致微信登录相关 SQL 执行失败。

## 本次变更内容

- 在 `users` 表新增字段：`openid VARCHAR(64) NULL`
- 新增唯一索引：`uk_users_openid(openid)`

## 字段说明

- `openid`：微信小程序用户唯一标识（同一小程序内唯一），用于微信登录绑定与查找用户。

## 执行 SQL

```sql
START TRANSACTION;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `openid` VARCHAR(64) NULL COMMENT '微信小程序用户唯一标识' AFTER `username`;

ALTER TABLE `users`
  ADD UNIQUE INDEX IF NOT EXISTS `uk_users_openid` (`openid`);

COMMIT;
```

完整 SQL 文件：`server/sql/2026-03-30_add_openid_to_users.sql`

## 执行后验证

```sql
SHOW COLUMNS FROM `users` LIKE 'openid';
SHOW INDEX FROM `users` WHERE Key_name = 'uk_users_openid';
```

## 回滚 SQL（如需）

```sql
START TRANSACTION;
ALTER TABLE `users` DROP INDEX `uk_users_openid`;
ALTER TABLE `users` DROP COLUMN `openid`;
COMMIT;
```
