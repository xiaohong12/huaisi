# users 表状态字段变更记录（2026-04-14）

## 变更背景

管理后台用户中心需要支持“拉黑/激活”操作，并要求被拉黑用户无法继续在微信小程序登录。  
为此，在 `users` 表增加统一状态字段，前后端围绕该字段完成登录拦截与后台编辑能力。

## 字段设计

- `status`：`TINYINT UNSIGNED NOT NULL DEFAULT 1`
  - `1`：激活（允许登录）
  - `0`：拉黑（禁止登录）

## SQL 变更内容

1. 给 `users` 表新增 `status` 字段（默认激活）；
2. 给 `status` 新增索引 `idx_users_status`，提升按状态过滤与鉴权关联查询性能。

对应 SQL 文件：`server/sql/2026-04-14_users_status_blacklist.sql`

## 执行 SQL

```sql
START TRANSACTION;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '用户状态：1=激活 0=拉黑' AFTER `gender`;

ALTER TABLE `users`
  ADD INDEX IF NOT EXISTS `idx_users_status` (`status`);

COMMIT;
```

## 验证建议

```sql
SHOW COLUMNS FROM `users` LIKE 'status';
SHOW INDEX FROM `users` WHERE Key_name = 'idx_users_status';
```

## 回滚建议

```sql
ALTER TABLE `users` DROP INDEX `idx_users_status`;
ALTER TABLE `users` DROP COLUMN `status`;
```
