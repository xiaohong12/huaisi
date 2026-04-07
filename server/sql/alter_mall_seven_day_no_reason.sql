-- 为 mall_products 增加「七天无理由」开关；执行前请确认表已存在。
-- 详见 sql/2026-04-07_mall_seven_day_no_reason.md

ALTER TABLE mall_products
  ADD COLUMN seven_day_no_reason TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '1支持七天无理由退换 0不支持'
  AFTER status;
