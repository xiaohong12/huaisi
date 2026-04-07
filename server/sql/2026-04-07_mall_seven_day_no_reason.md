# 商城商品表：七天无理由字段（2026-04-07）

## 变更说明

为商品增加「是否支持七天无理由退换」配置，列表在价格上方展示标签，详情页价格上方与服务文案中同步体现。

## 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `seven_day_no_reason` | `TINYINT UNSIGNED NOT NULL DEFAULT 0` | `1` 表示支持七天无理由，`0` 表示不支持 |

## 已有库执行（ALTER）

```sql
ALTER TABLE mall_products
  ADD COLUMN seven_day_no_reason TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '1支持七天无理由退换 0不支持'
  AFTER status;
```

> 若你的 `mall_products` 尚无 `status` 字段，可将 `AFTER status` 改为 `AFTER description` 或删除 `AFTER` 子句。

## 批量开启示例（可选）

约一半演示商品打上「支持」标记，便于联调 UI：

```sql
UPDATE mall_products SET seven_day_no_reason = 1 WHERE id % 2 = 0;
```

## 接口

`GET /api/mall/products`、`GET /api/mall/products/:id` 的 JSON 中增加布尔字段 **`sevenDayNoReason`**（由 `seven_day_no_reason = 1` 映射）。
