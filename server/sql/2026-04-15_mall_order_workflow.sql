-- 商城订单后台流程状态 + 状态变更理由审计日志
-- 执行前：USE your_database_name;

-- 订单主表增加流程态（与 payment_status 配合：支付成功时可同步为已付款，后台可再改为发货/完成/取消等）
ALTER TABLE `mall_orders`
  ADD COLUMN `workflow_status` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '订单流程态：0待付款 1已付款 2已发货 3已完成 4已取消' AFTER `payment_status`;

-- 历史数据：已支付订单流程态至少为「已付款」
UPDATE `mall_orders`
SET `workflow_status` = CASE WHEN `payment_status` = 1 THEN 1 ELSE 0 END;

-- 每次后台修改状态且填写理由时追加一条日志（理由必填，由接口校验）
CREATE TABLE IF NOT EXISTS `mall_order_status_change_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT '订单 ID（mall_orders.id）',
  `from_status` TINYINT UNSIGNED NOT NULL COMMENT '变更前 workflow_status',
  `to_status` TINYINT UNSIGNED NOT NULL COMMENT '变更后 workflow_status',
  `reason` TEXT NOT NULL COMMENT '管理员填写的变更理由（必填）',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  PRIMARY KEY (`id`),
  KEY `idx_mall_order_status_log_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城订单后台状态变更日志';
