-- 开发用：插入默认管理员（用户名 admin，明文密码 Aa123456，展示名 admin）
-- bcrypt 由 bcryptjs 生成（cost=10）。若已存在同名用户会报错，可忽略或先删除再执行。
-- 生产环境切勿保留弱密码；导入后请尽快修改密码。

INSERT INTO `admin_users` (`username`, `password`, `display_name`, `status`)
VALUES (
  'admin',
  '$2b$10$JI/eq0V9.UxNt/NTIqMtQeQi5or47BO6ySZMuqp13AzPe50upBj/W',
  'admin',
  1
);
