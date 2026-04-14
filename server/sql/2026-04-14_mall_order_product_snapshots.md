# 2026-04-14 新增订单商品快照表（mall_order_product_snapshots）

## 变更目的

- 用户下单后，商品标题、价格、封面、详情图和文案可能会被运营修改。
- 为避免后续售后或客服纠纷，新增独立快照表，固化下单时的商品关键信息。
- 与订单主表、订单明细表解耦，后续可按快照做仲裁回溯与审计。

## 建表 SQL

见同目录文件：`2026-04-14_mall_order_product_snapshots.sql`。

## 字段说明

| 字段 | 说明 |
|------|------|
| `id` | 快照主键 ID。 |
| `order_id` | 对应订单 ID（`mall_orders.id`）。 |
| `order_item_id` | 对应订单明细 ID（`mall_order_items.id`），唯一约束保证一条明细仅一条快照。 |
| `user_id` | 下单用户 ID，便于按用户维度追溯纠纷记录。 |
| `product_id` | 原始商品 ID，便于关联原商品。 |
| `product_title` / `product_cover_url` | 商品标题与封面图快照。 |
| `product_price` | 下单时单价快照。 |
| `purchase_quantity` | 下单时购买数量快照。 |
| `line_subtotal` | 该行小计快照。 |
| `detail_images_json` | 详情图快照（JSON 数组）。 |
| `description_snapshot` | 详情文案快照。 |
| `snapshot_reason` | 快照触发原因，默认 `create_order`。 |
| `snapshot_version` | 快照版本，默认 `1`，便于后续扩展字段结构。 |
| `created_at` | 快照创建时间。 |

## 使用建议

- 在创建订单并写入 `mall_order_items` 成功后，同事务内插入该快照表。
- 客服处理争议时，优先以该表数据作为“成交时事实”依据。
- 若后续支持规格、优惠分摊等能力，可继续扩展 `snapshot_version` 与 JSON 字段。
