-- 创建商城购物车表：同一用户同一商品只保留一条记录，重复加入时数量累加
CREATE TABLE IF NOT EXISTS mall_cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车项主键 ID',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户 ID（对应 users.id）',
  product_id INT UNSIGNED NOT NULL COMMENT '商品 ID（对应 mall_products.id）',
  quantity INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '购物车商品数量，重复加入时累加',
  checked TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '是否勾选结算：1是 0否',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_product (user_id, product_id),
  KEY idx_mall_cart_user (user_id),
  KEY idx_mall_cart_product (product_id),
  CONSTRAINT fk_mall_cart_product
    FOREIGN KEY (product_id) REFERENCES mall_products (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城购物车表';
