-- =============================================================================
-- PC 管理后台：管理员账号与登录 token（与小程序 users / user_tokens 完全隔离）
-- 执行前请确认已选择正确库：USE huasi;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) admin_users：管理员账号，仅用于 web 管理端登录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username` VARCHAR(64) NOT NULL COMMENT '登录用户名，全局唯一',
  `password` VARCHAR(255) NOT NULL COMMENT '登录密码的 bcrypt 哈希（与 users.password 存法一致）',
  `display_name` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '后台展示名称',
  `status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=正常 0=禁用，禁用后不可登录',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最近一次成功登录时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理后台管理员账号表';

-- -----------------------------------------------------------------------------
-- 2) admin_tokens：管理员会话 token，鉴权仅查本表，避免与普通用户 token 混用
--    主键为 admin_id：同一管理员同时仅保留一个有效会话（新登录覆盖旧 token）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_tokens` (
  `admin_id` INT UNSIGNED NOT NULL COMMENT '管理员 ID，关联 admin_users.id',
  `token` CHAR(64) NOT NULL COMMENT '随机 hex，与请求头 Bearer 一致',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `is_revoked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=已吊销',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近更新时间',
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `uk_admin_tokens_token` (`token`),
  KEY `idx_admin_tokens_valid` (`expires_at`, `is_revoked`),
  CONSTRAINT `fk_admin_tokens_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员登录会话表';
