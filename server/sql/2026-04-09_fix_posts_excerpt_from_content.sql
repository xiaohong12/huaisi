-- 说明：
-- 将 posts.excerpt 统一回填为 content 的前 40 个字符（先去掉首尾空白）。
-- 适用场景：历史数据中 excerpt 与 title 一致，导致列表摘要不符合“正文预览”预期。

UPDATE posts
SET excerpt = LEFT(TRIM(content), 40)
WHERE content IS NOT NULL;
