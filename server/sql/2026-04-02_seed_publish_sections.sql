-- 变更说明：为发布页三种类型写入 sections 数据，供 posts.section_id 外键关联。
-- 名称须与 server/src/constants/publishSection.ts 中 SECTION_NAME_BY_KEY 完全一致。
--
-- 执行前请先确认已存在表 sections（见 2026-03-30_create_home_tables.sql）。

START TRANSACTION;

INSERT INTO sections (name, subtitle, sort_order, is_visible)
SELECT '电影文化', '发布分类-电影文化', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE name = '电影文化' LIMIT 1);

INSERT INTO sections (name, subtitle, sort_order, is_visible)
SELECT '动漫/协会', '发布分类-动漫/协会', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE name = '动漫/协会' LIMIT 1);

INSERT INTO sections (name, subtitle, sort_order, is_visible)
SELECT '其他模块', '发布分类-其他', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM sections WHERE name = '其他模块' LIMIT 1);

COMMIT;
