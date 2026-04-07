-- 商城表一次性执行脚本（由本地命令行导入，勿提交敏感信息）
CREATE TABLE IF NOT EXISTS mall_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品 ID',
  title VARCHAR(255) NOT NULL COMMENT '商品标题',
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '售价（元）',
  sold_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已售数量（件）',
  cover_url VARCHAR(1024) NOT NULL COMMENT '列表封面图地址',
  cover_aspect DECIMAL(6,3) NOT NULL DEFAULT 1.000 COMMENT '封面高宽比 height/width，瀑布流排布用',
  detail_images JSON NULL COMMENT '详情轮播图 URL 的 JSON 数组',
  description TEXT NULL COMMENT '商品详情说明文案',
  status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1上架 0下架',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_mall_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城商品表';

INSERT INTO mall_products
  (title, price, sold_count, cover_url, cover_aspect, detail_images, description, status)
VALUES
  (
    '辰星文化限定帆布包 大容量通勤',
    89.00,
    3520,
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
    'https://picsum.photos/seed/hmall6/400/400',
    1.000,
    JSON_ARRAY('https://picsum.photos/seed/hmall6a/750/750'),
    '200g 纯棉，透气亲肤；请参考尺码表选购。',
    1
  );
