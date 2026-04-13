# 2026-04-13 新增管理后台管理员表（admin_users / admin_tokens）

## 变更目的

- **Web 管理端仅允许管理员登录**：账号体系与小程序端 `users` / `user_tokens` 分离，避免运营账号与 C 端用户混在同一套 token 校验里。
- 为后续 PC 后台接口提供统一的 `Authorization: Bearer <token>` 鉴权基础（校验 `admin_tokens`）。

## 建表 SQL

见同目录文件：`2026-04-13_admin_users.sql`。

本地可执行（需配置好 `MYSQL_*` 环境变量）：

```bash
cd server && node scripts/run-sql-file.cjs sql/2026-04-13_admin_users.sql
```

## 表与字段说明

### `admin_users`（管理员账号）

| 字段 | 说明 |
|------|------|
| `id` | 主键，自增。 |
| `username` | 登录名，唯一；仅用于管理端，不与 `users.phone` 混用。 |
| `password` | bcrypt 哈希，算法与存量 `users.password` 一致（如 `bcryptjs` 默认轮数）。 |
| `display_name` | 后台展示名，可为空字符串。 |
| `status` | `1` 正常，`0` 禁用；禁用后登录接口拒绝。 |
| `last_login_at` | 最近一次成功登录时间。 |
| `created_at` / `updated_at` | 创建与更新时间。 |

### `admin_tokens`（管理员会话）

| 字段 | 说明 |
|------|------|
| `admin_id` | 主键，对应 `admin_users.id`；**每个管理员同一时刻只保留一条会话记录**（新登录覆盖旧 token，与现有 `user_tokens` 单端策略一致）。 |
| `token` | 64 位 hex 随机串，与请求头 `Bearer` 一致。 |
| `expires_at` | 过期时间；服务端校验 `expires_at > NOW()` 且 `is_revoked = 0`。 |
| `is_revoked` | 吊销标记，便于后续「强制下线」扩展。 |
| `updated_at` | 最近更新时间。 |

## 配套接口

- `POST /api/admin/auth/login`：管理员用户名 + 密码登录，返回 `token` 与 `admin` 基本信息。
- `GET /api/admin/auth/session`：校验当前 Bearer token 是否在 `admin_tokens` 中有效。

## 初始化首个管理员

密码不能手写进 SQL（需 bcrypt）。在项目根目录执行：

```bash
cd server && node scripts/create-admin-user.cjs <用户名> <明文密码> [展示名]
```

示例：`node scripts/create-admin-user.cjs admin YourStrongPass123 超级管理员`
