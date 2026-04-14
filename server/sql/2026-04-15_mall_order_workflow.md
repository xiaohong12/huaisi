# 2026-04-15 订单后台流程状态与变更日志

## 变更目的

- 管理后台「订单中心」需要把订单置为待付款 / 已付款 / 已发货 / 已完成 / 已取消等任意流程态。
- 每次修改必须填写**理由**，并持久化，便于售后与内部审计。

## 建表 / 变更 SQL

见同目录：`2026-04-15_mall_order_workflow.sql`。

## 字段说明

### `mall_orders.workflow_status`

| 值 | 含义 |
|----|------|
| 0 | 待付款 |
| 1 | 已付款 |
| 2 | 已发货 |
| 3 | 已完成 |
| 4 | 已取消 |

- 新建订单默认为 `0`（与未支付一致）。
- 历史数据迁移：`payment_status = 1` 的订单设为 `1`，否则为 `0`。
- 用户端确认支付成功后，若当前仍为待付款（`0`），会将流程态同步为已付款（`1`），避免与支付状态脱节。

### `mall_order_status_change_logs`

| 字段 | 说明 |
|------|------|
| `order_id` | 被操作的订单。 |
| `from_status` / `to_status` | 变更前后 `workflow_status`。 |
| `reason` | 管理员填写的变更理由（接口侧强制非空）。 |
| `created_at` | 写入时间。 |

## 接口说明

- `GET /api/admin/orders`：查询参数可选 `status`（`pending` | `paid` | `shipped` | `completed` | `cancelled`），按 `mall_orders.workflow_status` 筛选；不传或 `all` 不按状态过滤。
- `PATCH /api/admin/orders/:orderId/workflow-status`（需管理员 Token）：请求体 JSON 含 `status`（上述五态之一）、`reason`（必填，文本）。
