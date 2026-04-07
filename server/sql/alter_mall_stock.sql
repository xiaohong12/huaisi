-- 为 mall_products 增加「可售库存」；执行前请确认表已存在。
-- 详见 sql/2026-04-07_mall_stock.md

ALTER TABLE mall_products
  ADD COLUMN stock INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '可售库存件数'
  AFTER sold_count;
