-- 变更说明：
-- 1) 给 users 表新增 status 字段，支持用户激活/拉黑状态管理；
-- 2) 默认值为 1（激活），历史用户不受影响；
-- 3) 新增状态索引，便于登录鉴权与后台筛选。
--
-- 执行前请先确认当前数据库：
-- USE your_database_name;

START TRANSACTION;

ALTER TABLE `users`
  ADD COLUMN `status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '用户状态：1=激活 0=拉黑' AFTER `gender`;

ALTER TABLE `users`
  ADD INDEX `idx_users_status` (`status`);

COMMIT;

-- 校验语句（可按需执行）：
-- SHOW COLUMNS FROM `users` LIKE 'status';
-- SHOW INDEX FROM `users` WHERE Key_name = 'idx_users_status';
