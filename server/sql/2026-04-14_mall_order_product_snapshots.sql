-- 订单商品快照表：在用户下单时固化商品关键信息，避免后续商品改价/改图/改文案引发纠纷。
-- 执行前请确认已连接正确库：USE your_database_name;

CREATE TABLE IF NOT EXISTS `mall_order_product_snapshots` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '快照主键 ID',
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT '订单 ID（mall_orders.id）',
  `order_item_id` BIGINT UNSIGNED NOT NULL COMMENT '订单明细 ID（mall_order_items.id）',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '下单用户 ID（users.id）',
  `product_id` INT UNSIGNED NOT NULL COMMENT '原商品 ID（mall_products.id）',
  `product_title` VARCHAR(512) NOT NULL COMMENT '商品标题快照',
  `product_cover_url` VARCHAR(512) NOT NULL DEFAULT '' COMMENT '商品封面图快照',
  `product_price` DECIMAL(10,2) NOT NULL COMMENT '下单时商品单价快照',
  `purchase_quantity` INT UNSIGNED NOT NULL COMMENT '下单时购买数量快照',
  `line_subtotal` DECIMAL(10,2) NOT NULL COMMENT '该商品行小计快照',
  `detail_images_json` JSON NULL COMMENT '商品详情图快照（JSON 数组）',
  `description_snapshot` TEXT NULL COMMENT '商品详情文案快照',
  `snapshot_reason` VARCHAR(64) NOT NULL DEFAULT 'create_order' COMMENT '快照触发原因：create_order=下单时创建',
  `snapshot_version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '快照版本号，便于后续扩展',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '快照创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mall_order_product_snapshot_item` (`order_item_id`),
  KEY `idx_mall_order_product_snapshot_order` (`order_id`),
  KEY `idx_mall_order_product_snapshot_user` (`user_id`),
  KEY `idx_mall_order_product_snapshot_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单商品快照表';
