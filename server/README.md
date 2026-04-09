# 华思后台服务

## 简介

这是一个基于 Express + TypeScript 的后台服务项目。

## 快速开始

### 安装依赖

```bash
cd server
npm install
```

### 开发模式

```bash
npm run dev
```

服务将在 http://localhost:3000 启动。

### 构建生产版本

```bash
npm run build
npm start
```

## API 文档

- 健康检查: `GET /health`
- Hello API: `GET /api/hello`
- Hello 消息: `GET /api/hello/message`
- 前端测试接口: `GET /api/common/test`

### 首页帖子流

- **`GET /api/posts?page=1&pageSize=20`**：分页拉取已发布帖子（`status=1`），含作者昵称、版块名、图片 URL 列表；**无需登录**。

### 商城购物车

- **`POST /api/mall/cart/add`**：加入购物车（需登录）。
- **`GET /api/mall/cart`**：获取当前用户购物车列表（需登录）。
- **`PUT /api/mall/cart/:id`**：修改购物车项数量（需登录）。
- **`DELETE /api/mall/cart/:id`**：删除单个购物车项（需登录）。
- **`DELETE /api/mall/cart`**：清空当前用户购物车（需登录）。
- **鉴权**：请求头 `Authorization: Bearer <登录返回的 token>`。
- **JSON Body**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `productId` | number | 是 | 商品 ID |
| `quantity` | number | 否 | 加入数量，默认 `1`，必须为正整数 |

- **业务规则**：同一用户重复加入同一商品时，数量自动累加（不是新增多条记录）。

### 帖子发布（与小程序发布页 `createPostApi` 对应）

- **`POST /api/posts`** 或 **`POST /api/posts/publish`**（两者等价）
- **鉴权**：请求头 `Authorization: Bearer <登录返回的 token>`
- **JSON Body**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 标题 |
| `content` | string | 是 | 正文 |
| `sectionKey` | string | 是 | 版块：`film_culture`（电影文化）、`anime_association`（动漫/协会）、`other`（其他模块） |
| `imageUrls` | string[] | 否 | 图片完整 URL 列表，最多 8 张（可先调 `POST /api/common/upload-image` 换 URL） |

- **成功 data**：`{ id: 帖子ID, sectionId: 版块ID }`，`message` 为「发布成功」。

**前置条件**：数据库需已建 `posts`、`post_images`、`sections` 等表，并执行种子脚本写入三个版块，见 `sql/2026-04-02_seed_publish_sections.sql` 与同目录 `.md` 说明。

## 项目结构

```
server/
├── src/
│   ├── config/       # 配置文件
│   ├── constants/    # 业务常量（如发布版块 sectionKey）
│   ├── middleware/   # 中间件（如登录鉴权）
│   ├── routes/       # 路由（含 posts 发帖）
│   ├── types/        # TS 类型扩展
│   ├── utils/        # 工具函数
│   └── index.ts      # 入口文件
├── package.json
└── tsconfig.json
```
