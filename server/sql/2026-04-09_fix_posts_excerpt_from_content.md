# 2026-04-09 posts.excerpt 回填脚本说明

## 变更目的

将 `posts` 表中的 `excerpt` 字段统一改为：

- 固定取 `content` 去除首尾空白后的前 `40` 个字符。

这样首页列表摘要会展示正文预览，不再与标题重复。

## 影响范围

- 表：`posts`
- 字段：`excerpt`
- 影响记录：`content IS NOT NULL` 的所有帖子

## SQL 脚本

文件：`2026-04-09_fix_posts_excerpt_from_content.sql`

```sql
UPDATE posts
SET excerpt = LEFT(TRIM(content), 40)
WHERE content IS NOT NULL;
```

## 执行建议

1. 先在测试环境执行并抽样检查；
2. 生产执行前先备份 `posts` 表；
3. 执行后用以下 SQL 验证：

```sql
SELECT id, title, LEFT(content, 60) AS content_preview, excerpt
FROM posts
ORDER BY id DESC
LIMIT 20;
```

## 回滚建议

本脚本为数据重算，若需回滚请使用执行前备份恢复，或按业务规则重新生成 `excerpt`。
