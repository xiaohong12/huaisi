# 发布版块 sections 种子数据（2026-04-02）

## 背景

发帖接口 `POST /api/posts` 使用 **`sectionKey` 枚举**（`film_culture` / `anime_association` / `other`）映射到 `sections.name`，再写入 `posts.section_id`。

数据库层**没有单独的 MySQL ENUM 列**表示「电影文化 / 动漫协会 / 其他」；类型由：

- 接口层：`server/src/constants/publishSection.ts` 中的 `PublishSectionKey`；
- 数据层：`sections.name` 三条记录（本脚本插入）。

## 与代码的对应关系

| sectionKey（接口入参） | sections.name（库中） |
|------------------------|----------------------|
| `film_culture`         | 电影文化             |
| `anime_association`    | 动漫/协会            |
| `other`                | 其他模块             |

若修改名称，须同时改 `SECTION_NAME_BY_KEY` 与本脚本。

## 执行 SQL

见同目录文件：`2026-04-02_seed_publish_sections.sql`

脚本使用 `INSERT ... SELECT ... WHERE NOT EXISTS`，可重复执行，不会重复插入同名版块。

## 校验（可选）

```sql
SELECT id, name, sort_order FROM sections WHERE name IN ('电影文化', '动漫/协会', '其他模块');
```
