-- 变更说明：
-- 1) 新增首页轮播、版块、帖子流相关表；
-- 2) 支持帖子多图展示、点赞、收藏与评论回复。
--
-- 执行前请先确认当前数据库：
-- USE your_database_name;

START TRANSACTION;

-- 1. 轮播图表：用于首页顶部「辰星文化」横幅与后续运营位。
CREATE TABLE IF NOT EXISTS `banners` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  `title` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '轮播标题/运营备注',
  `image_url` VARCHAR(255) NOT NULL COMMENT '轮播展示图片地址',
  `link_url` VARCHAR(255) NULL DEFAULT NULL COMMENT '点击跳转链接（H5 或小程序路径）',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-草稿 1-上线 2-下线',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_banners_status_sort` (`status`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页轮播图';


-- 2. 版块表：如「电影文化」「动漫/协会」「更多项目」等。
CREATE TABLE IF NOT EXISTS `sections` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  `name` VARCHAR(50) NOT NULL COMMENT '版块名称',
  `subtitle` VARCHAR(100) NULL DEFAULT NULL COMMENT '副标题/说明',
  `icon_url` VARCHAR(255) NULL DEFAULT NULL COMMENT '版块图标地址',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '显示顺序，越小越靠前',
  `is_visible` TINYINT NOT NULL DEFAULT 1 COMMENT '是否在首页展示：0-不展示 1-展示',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_sections_visible_sort` (`is_visible`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容版块/分类';


-- 3. 帖子主表：对应首页信息流中的每一条帖子。
CREATE TABLE IF NOT EXISTS `posts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  -- user_id 使用 INT（有符号）与现有 users.id 类型一致，便于外键约束
  `user_id` INT NOT NULL COMMENT '发帖用户 ID，关联 users.id',
  `section_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '所属版块 ID，可为空',
  `title` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '帖子标题',
  `content` TEXT NOT NULL COMMENT '帖子正文内容',
  `excerpt` VARCHAR(255) NULL DEFAULT NULL COMMENT '列表摘要，可由后台自动截取',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-草稿 1-已发布 2-已隐藏 3-已删除',
  `like_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数量（冗余）',
  `comment_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '评论数量（冗余，含回复）',
  `favorite_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '收藏数量（冗余）',
  `share_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分享次数（冗余，可选）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_posts_status_created` (`status`, `created_at`),
  KEY `idx_posts_section_created` (`section_id`, `status`, `created_at`),
  KEY `idx_posts_user` (`user_id`),
  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_posts_section` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户帖子';


-- 4. 帖子图片表：支持帖子多图，按 sort_order 排序展示。
CREATE TABLE IF NOT EXISTS `post_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  `post_id` INT UNSIGNED NOT NULL COMMENT '所属帖子 ID',
  `image_url` VARCHAR(255) NOT NULL COMMENT '图片地址',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '同一帖子内图片排序，越小越靠前',
  PRIMARY KEY (`id`),
  KEY `idx_post_images_post_sort` (`post_id`, `sort_order`),
  CONSTRAINT `fk_post_images_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子图片';


-- 5. 帖子点赞表：记录用户对帖子的点赞关系。
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  `user_id` INT NOT NULL COMMENT '用户 ID，关联 users.id',
  `post_id` INT UNSIGNED NOT NULL COMMENT '帖子 ID，关联 posts.id',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_likes_user_post` (`user_id`, `post_id`),
  KEY `idx_post_likes_post` (`post_id`),
  CONSTRAINT `fk_post_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_post_likes_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子点赞记录';


-- 6. 帖子收藏表：记录用户对帖子的收藏/星标。
CREATE TABLE IF NOT EXISTS `post_favorites` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  `user_id` INT NOT NULL COMMENT '用户 ID，关联 users.id',
  `post_id` INT UNSIGNED NOT NULL COMMENT '帖子 ID，关联 posts.id',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_favorites_user_post` (`user_id`, `post_id`),
  KEY `idx_post_favorites_post` (`post_id`),
  CONSTRAINT `fk_post_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_post_favorites_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子收藏记录';


-- 7. 评论表：支持楼中楼回复（parent_id 自关联）。
CREATE TABLE IF NOT EXISTS `comments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
  `post_id` INT UNSIGNED NOT NULL COMMENT '所属帖子 ID，关联 posts.id',
  `user_id` INT NOT NULL COMMENT '评论用户 ID，关联 users.id',
  `parent_id` INT UNSIGNED NULL DEFAULT NULL COMMENT '父评论 ID，NULL 表示顶层评论',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-可见 2-已隐藏 3-已删除',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_comments_post_created` (`post_id`, `created_at`),
  KEY `idx_comments_parent` (`parent_id`),
  KEY `idx_comments_user` (`user_id`),
  CONSTRAINT `fk_comments_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_comments_parent` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子评论（支持回复某条评论）';


COMMIT;

-- 校验语句（可按需执行部分）：
-- SHOW TABLES LIKE 'banners';
-- SHOW TABLES LIKE 'sections';
-- SHOW TABLES LIKE 'posts';
-- SHOW TABLES LIKE 'post_images';
-- SHOW TABLES LIKE 'post_likes';
-- SHOW TABLES LIKE 'post_favorites';
-- SHOW TABLES LIKE 'comments';

