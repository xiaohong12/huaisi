/**
 * 发布页版块枚举（与前端 ActionSheet、数据库 sections.name 一一对应）。
 * 接口入参使用 sectionKey，避免直接信任任意字符串写入 section_id。
 */
export const PUBLISH_SECTION_KEYS = ["film_culture", "anime_association", "other"] as const;

export type PublishSectionKey = (typeof PUBLISH_SECTION_KEYS)[number];

/** sectionKey → sections 表中的 name（须与种子数据一致） */
export const SECTION_NAME_BY_KEY: Record<PublishSectionKey, string> = {
  film_culture: "电影文化",
  anime_association: "动漫/协会",
  other: "其他模块",
};

/**
 * 校验字符串是否为合法发布版块 key。
 */
export function isPublishSectionKey(value: unknown): value is PublishSectionKey {
  return typeof value === "string" && (PUBLISH_SECTION_KEYS as readonly string[]).includes(value);
}
