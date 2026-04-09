-- 说明：
-- 1) 将 posts.excerpt 统一回填为 content 的前 40 个字符（并去除首尾空白）
-- 2) 与后端新逻辑保持一致：固定基于 content 生成摘要
-- 3) 建议先在测试环境执行，再在生产环境执行

START TRANSACTION;

UPDATE posts
SET excerpt = LEFT(TRIM(COALESCE(content, '')), 40);

COMMIT;
