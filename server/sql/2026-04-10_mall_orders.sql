-- 商城订单主表与子表：与小程序「确认下单」、支付方式（含二维码支付）及支付状态对应。
-- 执行前请确认已连接正确库：USE your_database_name;

CREATE TABLE IF NOT EXISTS `mall_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单主键 ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '下单用户 ID（对应 users.id）',
  `address_id` BIGINT UNSIGNED NULL COMMENT '下单时选用的收货地址 ID（user_addresses.id，可为空便于追溯）',
  `order_no` VARCHAR(32) NOT NULL COMMENT '业务订单号，展示与二维码内容用，全局唯一',
  `store_name` VARCHAR(128) NOT NULL DEFAULT '辰星文化商城' COMMENT '店铺/卖场展示名（下单页店铺标题）',
  `consignee` VARCHAR(64) NOT NULL COMMENT '收货人（下单时快照）',
  `phone` VARCHAR(20) NOT NULL COMMENT '收货手机（下单时快照）',
  `region` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '省市区（下单时快照）',
  `detail` VARCHAR(255) NOT NULL COMMENT '详细地址（下单时快照）',
  `freight_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '运费',
  `goods_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '商品总价（不含运费）',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '应付总额（商品+运费）',
  `payment_method` VARCHAR(32) NOT NULL COMMENT '支付方式：alipay|huabei|friend_pay|wechat|qrcode',
  `payment_status` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '支付状态：0待支付 1已支付',
  `remark` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '买家备注',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_order_no` (`order_no`),
  KEY `idx_mall_orders_user` (`user_id`),
  KEY `idx_mall_orders_payment` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城订单主表';

CREATE TABLE IF NOT EXISTS `mall_order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单明细主键 ID',
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT '所属订单 mall_orders.id',
  `product_id` INT UNSIGNED NOT NULL COMMENT '商品 ID（mall_products.id）',
  `title` VARCHAR(512) NOT NULL COMMENT '商品标题快照',
  `cover_url` VARCHAR(512) NOT NULL DEFAULT '' COMMENT '封面图路径快照',
  `price` DECIMAL(10,2) NOT NULL COMMENT '成交单价快照',
  `quantity` INT UNSIGNED NOT NULL COMMENT '购买件数',
  `subtotal` DECIMAL(10,2) NOT NULL COMMENT '该行小计（单价*数量）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_mall_order_items_order` (`order_id`),
  KEY `idx_mall_order_items_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城订单明细表';
