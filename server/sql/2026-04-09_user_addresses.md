# 2026-04-09 新增用户收货地址表（user_addresses）

## 变更目的

- 为小程序「地址管理」提供持久化存储，登录用户可新增、编辑、删除收货地址，并设置默认地址。
- 与后端 `GET/POST/PUT/DELETE /api/user/addresses` 系列接口对应。

## 建表 SQL

见同目录文件：`2026-04-09_user_addresses.sql`。

## 字段说明

| 字段 | 说明 |
|------|------|
| `id` | 主键，自增。 |
| `user_id` | 所属用户，与登录 token 解析出的用户 ID 一致。 |
| `consignee` | 收货人姓名。 |
| `phone` | 收货人手机号。 |
| `region` | 省市区展示文案（当前为手填，后续可接微信/第三方省市区组件）。 |
| `detail` | 详细地址。 |
| `is_default` | 默认地址标记；同一用户仅一条为 1，由接口在设置默认时批量清零后更新。 |
| `created_at` / `updated_at` | 创建与更新时间。 |

## 配套接口

- `GET /api/user/addresses`：当前用户地址列表（默认地址优先）。
- `GET /api/user/addresses/:id`：单条详情（仅本人）。
- `POST /api/user/addresses`：新增。
- `PUT /api/user/addresses/:id`：更新。
- `DELETE /api/user/addresses/:id`：删除。

以上均需登录（`Authorization: Bearer <token>`）。
