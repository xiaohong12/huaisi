-- 变更说明：
-- 1) 给 users 表补充 openid 字段，用于微信小程序用户唯一标识。
-- 2) 为 openid 增加唯一索引，避免同一个 openid 创建多个用户。
--
-- 执行前请先确认当前数据库：
-- USE your_database_name;

START TRANSACTION;

-- 如果 users 表不存在会报错，请先确认表已存在。
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `openid` VARCHAR(64) NULL COMMENT '微信小程序用户唯一标识' AFTER `username`;

-- 增加唯一索引（允许 NULL，多条 NULL 在 MySQL 中是允许的）。
ALTER TABLE `users`
  ADD UNIQUE INDEX IF NOT EXISTS `uk_users_openid` (`openid`);

COMMIT;

-- 校验语句（可单独执行）：
-- SHOW COLUMNS FROM `users` LIKE 'openid';
-- SHOW INDEX FROM `users` WHERE Key_name = 'uk_users_openid';
