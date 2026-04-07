# 商城商品表：库存字段（2026-04-07）

## 变更说明

商品详情页需展示**真实可售库存**，列表接口同步返回便于后续扩展。在 `mall_products` 表增加 `stock` 字段，并由 `GET /api/mall/products`、`GET /api/mall/products/:id` 输出 JSON 字段 **`stock`**（件数，非负整数）。

## 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `stock` | `INT UNSIGNED NOT NULL DEFAULT 0` | 当前可售库存件数（上架展示用；下单扣减逻辑可后续再接） |

## 已有库执行（ALTER）

```sql
-- 在已售数量后增加库存列，便于对照维护
ALTER TABLE mall_products
  ADD COLUMN stock INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '可售库存件数'
  AFTER sold_count;
```

> 若你的表结构里 `sold_count` 列名不同，可将 `AFTER sold_count` 改为紧跟在价格列之后，或删除 `AFTER` 子句。

## 历史数据补库存示例（可选）

加列后旧行默认为 `0`。开发环境可为演示数据写入非零库存，例如：

```sql
-- 按 id 生成演示库存（生产环境请按实际入库修改）
UPDATE mall_products
SET stock = 50 + (id % 200) * 3
WHERE stock = 0;
```

## 接口

- `GET /api/mall/products`：列表每一项增加 **`stock`**（数字）。
- `GET /api/mall/products/:id`：详情增加 **`stock`**（数字）。

## 相关文件

- 执行脚本：`sql/alter_mall_stock.sql`
- 新库一键建表：`sql/run_mall_products.sql`（已含 `stock` 列时与本文一致）
