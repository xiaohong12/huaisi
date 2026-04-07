# 首页内容相关表结构设计与变更记录（2026-03-30）

## 变更背景

根据「辰星文化」首页设计，需要支持：

- 顶部轮播运营位；
- 版块入口（电影文化 / 动漫协会 / 更多项目等）；
- 帖子信息流、多图展示；
- 点赞、收藏、评论及「回复某条评论」的楼中楼能力。

现有数据库中仅有用户体系相关表（如 `users`、`user_tokens`），缺少内容与互动相关表，需要统一设计并一次性建表。

## 与现有 `users` 表类型对齐

当前库中 `users.id` 为 MySQL `INT`（有符号）。所有引用用户的 `user_id` 字段使用 **`INT NOT NULL`**，与 `users.id` 类型一致，否则无法创建外键。帖子主键 `posts.id` 使用 **`INT UNSIGNED`**，子表中的 `post_id`、`comments.parent_id` 等与之对应。

## 本次变更新增的表

- `banners`：首页轮播图；
- `sections`：内容版块/分类；
- `posts`：帖子主表；
- `post_images`：帖子图片（多图）；
- `post_likes`：帖子点赞关系；
- `post_favorites`：帖子收藏关系；
- `comments`：帖子评论（含回复某条评论）。

## 表结构与字段说明

### 1. `banners`（首页轮播图）

用于首页顶部大图/小运营位展示。

- `id`：主键 ID；
- `title`：轮播标题或运营备注，方便后台识别；
- `image_url`：轮播展示图片地址；
- `link_url`：点击后跳转到的 H5 或小程序路径（可为空）；
- `sort_order`：排序值，越小越靠前；
- `status`：状态枚举：`0-草稿 1-上线 2-下线`；
- `created_at` / `updated_at`：创建与更新时间。

索引：

- `idx_banners_status_sort(status, sort_order)`：首页只拉取「上线」状态并按顺序展示。

### 2. `sections`（内容版块/分类）

对应首页「版块 A/B/更多项目」入口，可扩展为更多内容频道。

- `id`：主键 ID；
- `name`：版块名称；
- `subtitle`：副标题/描述文案；
- `icon_url`：版块图标地址（可为空）；
- `sort_order`：排序值，控制展示顺序；
- `is_visible`：是否在首页展示该入口：`0-不展示 1-展示`；
- `created_at` / `updated_at`：创建与更新时间。

索引：

- `idx_sections_visible_sort(is_visible, sort_order)`：首页只查展示中的版块并按顺序排列。

### 3. `posts`（帖子主表）

对应首页信息流中的每一条帖子。

- `id`：主键 ID（`INT UNSIGNED`）；
- `user_id`：发帖用户 ID（`INT`，与 `users.id` 一致），外键指向 `users.id`；
- `section_id`：所属版块 ID，可为空，外键指向 `sections.id`；
- `title`：帖子标题；
- `content`：帖子正文内容，使用 `TEXT` 存储；
- `excerpt`：列表摘要，可由服务端按正文截取；
- `status`：状态枚举：`0-草稿 1-已发布 2-已隐藏 3-已删除`；
- `like_count`：点赞数量（冗余计数）；
- `comment_count`：评论数量（冗余计数，建议包含所有层级评论）；
- `favorite_count`：收藏数量（冗余计数）；
- `share_count`：分享次数（可选统计）；
- `created_at` / `updated_at`：创建与更新时间。

索引：

- `idx_posts_status_created(status, created_at)`：按发布时间倒序拉取已发布帖子；
- `idx_posts_section_created(section_id, status, created_at)`：按版块筛选帖子；
- `idx_posts_user(user_id)`：按用户查询其发布的帖子。

### 4. `post_images`（帖子图片）

用于存储多图帖子中的每一张图。

- `id`：主键 ID；
- `post_id`：所属帖子 ID，外键指向 `posts.id`；
- `image_url`：图片地址；
- `sort_order`：同一帖子下的图片顺序，越小越靠前。

索引与约束：

- `idx_post_images_post_sort(post_id, sort_order)`：按顺序查询某帖图片；
- 外键 `fk_post_images_post`：`post_id` → `posts.id`，删除帖子时级联删除图片。

### 5. `post_likes`（帖子点赞关系）

记录「哪个用户给哪条帖子点了赞」。

- `id`：主键 ID；
- `user_id`：用户 ID，外键指向 `users.id`；
- `post_id`：帖子 ID，外键指向 `posts.id`；
- `created_at`：点赞时间。

索引与约束：

- `uk_post_likes_user_post(user_id, post_id)`：联合唯一，防止同一用户对同一帖子重复点赞；
- `idx_post_likes_post(post_id)`：按帖子聚合点赞；
- 外键 `fk_post_likes_user` / `fk_post_likes_post`：用户或帖子删除时，级联删除点赞记录。

### 6. `post_favorites`（帖子收藏关系）

记录用户收藏/星标的帖子。

- 字段同 `post_likes`：`id`、`user_id`、`post_id`、`created_at`；
- 索引与约束也类似：`uk_post_favorites_user_post`、`idx_post_favorites_post` 以及相应外键。

### 7. `comments`（帖子评论，支持回复某条评论）

支持楼中楼评论：可以针对帖子本身发评论，也可以回复某条已有评论。

- `id`：主键 ID；
- `post_id`：所属帖子 ID，外键指向 `posts.id`；
- `user_id`：评论用户 ID，外键指向 `users.id`；
- `parent_id`：父评论 ID，可为空：
  - `NULL`：对帖子的顶层评论；
  - 非空：回复 `parent_id` 对应的那条评论（同一帖内自关联）；
- `content`：评论内容；
- `status`：状态枚举：`1-可见 2-已隐藏 3-已删除`；
- `created_at` / `updated_at`：创建与更新时间。

索引与约束：

- `idx_comments_post_created(post_id, created_at)`：按时间拉取某帖下所有评论；
- `idx_comments_parent(parent_id)`：拉取某条评论下的子回复；
- `idx_comments_user(user_id)`：按用户查询其评论记录；
- 外键：
  - `fk_comments_post`：`post_id` → `posts.id`，删除帖子时级联删除评论；
  - `fk_comments_user`：`user_id` → `users.id`，用户被删除时级联删除其评论；
  - `fk_comments_parent`：`parent_id` → `comments.id`，父评论删除时级联删除其子评论。

> 接口层在创建回复时，应校验：被回复评论的 `post_id` 与当前帖子 ID 一致，避免跨帖引用。

## 执行 SQL

```sql
START TRANSACTION;

-- 具体 SQL 见：
-- server/sql/2026-03-30_create_home_tables.sql

COMMIT;
```

## 执行后验证

可按需执行以下语句检查表是否创建成功：

```sql
SHOW TABLES LIKE 'banners';
SHOW TABLES LIKE 'sections';
SHOW TABLES LIKE 'posts';
SHOW TABLES LIKE 'post_images';
SHOW TABLES LIKE 'post_likes';
SHOW TABLES LIKE 'post_favorites';
SHOW TABLES LIKE 'comments';
```

## 回滚思路（如需）

当前变更仅新增表，无对现有表结构的修改。若需要回滚，可按以下顺序依次删除表（注意外键依赖顺序）：

```sql
START TRANSACTION;

DROP TABLE IF EXISTS `comments`;
DROP TABLE IF EXISTS `post_favorites`;
DROP TABLE IF EXISTS `post_likes`;
DROP TABLE IF EXISTS `post_images`;
DROP TABLE IF EXISTS `posts`;
DROP TABLE IF EXISTS `sections`;
DROP TABLE IF EXISTS `banners`;

COMMIT;
```

> 建议在生产环境操作前先在测试库验证建表与回滚过程，确保无外键依赖错误。

