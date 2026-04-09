# 2026-04-10 新增商城订单表（mall_orders / mall_order_items）

## 变更目的

- 支撑小程序「确认下单」页：收货地址快照、店铺名、商品行、价格明细、运费与应付总额。
- 记录用户选择的支付方式（支付宝、花呗、找朋友付、微信、**二维码支付**）及支付状态（待支付 / 已支付）。
- 与后端 `POST /api/mall/orders`、`GET /api/mall/orders/:id`、`PUT /api/mall/orders/:id/confirm-payment` 配套。

## 建表 SQL

见同目录文件：`2026-04-10_mall_orders.sql`。

## 字段说明（mall_orders）

| 字段 | 说明 |
|------|------|
| `id` | 主键，自增。 |
| `user_id` | 下单用户。 |
| `address_id` | 用户选用的地址表主键，便于关联；收货信息仍以快照字段为准。 |
| `order_no` | 业务订单号，用于展示与二维码内容，唯一。 |
| `store_name` | 下单页展示的店铺名称。 |
| `consignee` / `phone` / `region` / `detail` | 下单瞬间的收货信息快照。 |
| `freight_fee` | 运费。 |
| `goods_amount` | 商品总价。 |
| `total_amount` | 应付总额（商品 + 运费）。 |
| `payment_method` | 支付方式枚举字符串（见下）。 |
| `payment_status` | `0` 待支付，`1` 已支付（用户在前端点击「已经支付」并调用确认接口后更新）。 |
| `remark` | 买家备注。 |

### payment_method 取值

| 值 | 含义 |
|----|------|
| `alipay` | 支付宝 |
| `huabei` | 花呗 |
| `friend_pay` | 找朋友帮忙付 |
| `wechat` | 微信支付 |
| `qrcode` | 二维码支付（创建订单时返回 base64 二维码图供弹窗展示） |

## 字段说明（mall_order_items）

| 字段 | 说明 |
|------|------|
| `order_id` | 外键逻辑关联 `mall_orders.id`。 |
| `product_id` | 商品 ID。 |
| `title` / `cover_url` / `price` | 下单时商品信息快照。 |
| `quantity` | 件数。 |
| `subtotal` | 行小计。 |

## 配套接口

- `POST /api/mall/orders`：创建订单（需登录）；校验地址归属、商品上架与库存；写入主表与子表；若 `paymentMethod` 为 `qrcode`，响应中带 `qrCodeDataUrl`（`data:image/png;base64,...`）供小程序 `<image>` 直接使用。
- `GET /api/mall/orders/:id`：订单详情（仅本人）。
- `PUT /api/mall/orders/:id/confirm-payment`：用户确认已支付（演示流）；将 `payment_status` 置为已支付，并扣减对应商品库存、增加销量。

以上均需登录（`Authorization: Bearer <token>`）。
