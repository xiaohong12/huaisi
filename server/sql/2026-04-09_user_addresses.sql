-- 用户收货地址表：与小程序「地址管理」页对应，支持多地址、默认地址、增删改查。
-- 执行前请确认已连接正确库：USE your_database_name;

CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收货地址主键 ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户 ID（对应 users.id）',
  `consignee` VARCHAR(64) NOT NULL COMMENT '收货人姓名',
  `phone` VARCHAR(20) NOT NULL COMMENT '收货人手机号',
  `region` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '省市区（可手填或后续接省市区选择器）',
  `detail` VARCHAR(255) NOT NULL COMMENT '详细地址（街道门牌等）',
  `is_default` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否默认：1 是 0 否',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_addresses_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收货地址表';
