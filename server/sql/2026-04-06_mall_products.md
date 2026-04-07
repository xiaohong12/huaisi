# 商城商品表（2026-04-06）

## 变更背景

小程序「商城」页需要双列瀑布流展示商品，并支持进入商品详情（淘宝式二级页）。为此新增商品主表，存储封面、价格、销量及详情图等字段。

## 新增表：`mall_products`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INT UNSIGNED | 主键，自增 |
| `title` | VARCHAR(255) | 商品标题 |
| `price` | DECIMAL(10,2) | 售价（元） |
| `sold_count` | INT UNSIGNED | 已售件数（列表展示「已售 xx」） |
| `stock` | INT UNSIGNED | 可售库存件数（详情展示「库存 xx」；**2026-04-07 起**，见 `sql/2026-04-07_mall_stock.md`） |
| `cover_url` | VARCHAR(1024) | 列表封面图，可为完整 `https://` 或相对路径（前端拼 `BASE_URL`） |
| `cover_aspect` | DECIMAL(6,3) | 封面高宽比 height/width，用于瀑布流预估列高（如 1.25 表示图比宽「高」25%） |
| `detail_images` | JSON | 详情页轮播图 URL 数组，如 `["https://..."]` |
| `description` | TEXT | 商品详情文案 |
| `status` | TINYINT UNSIGNED | `1` 上架 `0` 下架 |
| `seven_day_no_reason` | TINYINT UNSIGNED | `1` 支持七天无理由退换，`0` 不支持（**2026-04-07 起**，见 `sql/2026-04-07_mall_seven_day_no_reason.md`） |
| `created_at` / `updated_at` | TIMESTAMP | 创建、更新时间 |

索引：`idx_mall_products_status (status)`，列表仅查上架商品。

## 建表 SQL

```sql
CREATE TABLE IF NOT EXISTS mall_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品 ID',
  title VARCHAR(255) NOT NULL COMMENT '商品标题',
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '售价（元）',
  sold_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已售数量（件）',
  stock INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '可售库存件数',
  cover_url VARCHAR(1024) NOT NULL COMMENT '列表封面图地址',
  cover_aspect DECIMAL(6,3) NOT NULL DEFAULT 1.000 COMMENT '封面高宽比 height/width，瀑布流排布用',
  detail_images JSON NULL COMMENT '详情轮播图 URL 的 JSON 数组',
  description TEXT NULL COMMENT '商品详情说明文案',
  status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1上架 0下架',
  seven_day_no_reason TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '1支持七天无理由退换 0不支持',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_mall_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城商品表';
```

## 示例数据（可选）

以下使用 `picsum.photos` 占位图；**微信小程序需在后台配置「downloadFile 合法域名」** 包含 `picsum.photos`，或替换为你们 CDN/本域 `/image/` 静态资源地址。

```sql
INSERT INTO mall_products
  (title, price, sold_count, stock, cover_url, cover_aspect, detail_images, description, status)
VALUES
  (
    '辰星文化限定帆布包 大容量通勤',
    89.00,
    3520,
    800,
    'https://picsum.photos/seed/hmall1/400/520',
    1.300,
    JSON_ARRAY(
      'https://picsum.photos/seed/hmall1a/750/750',
      'https://picsum.photos/seed/hmall1b/750/820'
    ),
    '加厚帆布，肩带加固，适合日常通勤与活动周边收纳。颜色以实物为准。',
    1
  ),
  (
    '电影主题手账套装 礼盒装',
    128.00,
    890,
    420,
    'https://picsum.photos/seed/hmall2/400/360',
    0.900,
    JSON_ARRAY('https://picsum.photos/seed/hmall2a/750/700'),
    '内含手账本、贴纸与书签，影迷收藏与赠礼皆宜。',
    1
  ),
  (
    '协会联名徽章组（3 枚入）',
    45.00,
    12050,
    6000,
    'https://picsum.photos/seed/hmall3/400/480',
    1.200,
    JSON_ARRAY(
      'https://picsum.photos/seed/hmall3a/750/800',
      'https://picsum.photos/seed/hmall3b/750/760'
    ),
    '合金材质，表面烤漆，背面安全扣；单套含三款不同图案。',
    1
  ),
  (
    '文化展限定海报筒装',
    36.50,
    2103,
    1500,
    'https://picsum.photos/seed/hmall4/400/540',
    1.350,
    JSON_ARRAY('https://picsum.photos/seed/hmall4a/750/900'),
    '附硬质海报筒，防止折痕；适合收藏展示。',
    1
  ),
  (
    '软胶公仔 桌面摆件',
    158.00,
    456,
    260,
    'https://picsum.photos/seed/hmall5/400/500',
    1.250,
    JSON_ARRAY(
      'https://picsum.photos/seed/hmall5a/750/780',
      'https://picsum.photos/seed/hmall5b/750/800'
    ),
    '高约 12cm，环保软胶，细节上色；适合桌面陈列。',
    1
  ),
  (
    '纯棉活动 T 恤 多尺码',
    69.00,
    6780,
    3500,
    'https://picsum.photos/seed/hmall6/400/400',
    1.000,
    JSON_ARRAY('https://picsum.photos/seed/hmall6a/750/750'),
    '200g 纯棉，透气亲肤；请参考尺码表选购。',
    1
  );
```

## 相关接口

- `GET /api/mall/products?page=&pageSize=`：分页列表（上架商品，含 `soldCount`、`stock` 等）。
- `GET /api/mall/products/:id`：商品详情（含轮播图与文案、`stock`）。

已有库若缺 `stock` 列，请执行 `sql/alter_mall_stock.sql`（说明见 `sql/2026-04-07_mall_stock.md`）。
