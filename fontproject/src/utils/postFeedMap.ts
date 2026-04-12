import type { PostFeedItemDTO } from "@/api/post";

/**
 * 与 PostCard 约定一致的帖子卡片数据（接口 DTO 映射后用于展示）。
 */
export interface HomePostCard {
  id: number;
  username: string;
  avatarLetter: string;
  avatarBg: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  title: string;
  /** 正文全文 */
  content: string;
  excerpt: string;
  images: string[];
  comments: number;
  likes: number;
  favorites: number;
  liked: boolean;
  favorited: boolean;
}

const AVATAR_GRADS = [
  "linear-gradient(135deg,#c7d2fe 0%,#6366f1 100%)",
  "linear-gradient(135deg,#fde68a 0%,#f59e0b 100%)",
  "linear-gradient(135deg,#bbf7d0 0%,#22c55e 100%)",
  "linear-gradient(135deg,#fbcfe8 0%,#ec4899 100%)",
];

const PLACEHOLDER_IMG = "linear-gradient(135deg,#e5e7eb 0%,#d1d5db 100%)";

const avatarGradient = (nickname: string): string => {
  let h = 0;
  for (let i = 0; i < nickname.length; i += 1) {
    h = (h + nickname.charCodeAt(i) * (i + 1)) % AVATAR_GRADS.length;
  }
  return AVATAR_GRADS[h];
};

const sectionTagStyle = (sectionName: string): { tagBg: string; tagColor: string } => {
  if (sectionName.includes("电影")) {
    return { tagBg: "rgba(59,130,246,0.12)", tagColor: "#2563eb" };
  }
  if (sectionName.includes("动漫") || sectionName.includes("协会")) {
    return { tagBg: "rgba(249,115,22,0.12)", tagColor: "#ea580c" };
  }
  return { tagBg: "rgba(139,92,246,0.12)", tagColor: "#7c3aed" };
};

/**
 * 将接口帖子 DTO 转为 PostCard 所需结构（首页流、收藏、我的发布等复用）。
 */
export function mapPostFeedItemToCard(item: PostFeedItemDTO): HomePostCard {
  const nick = item.nickname?.trim() || "用户";
  const letter = nick.slice(0, 1);
  const tag = item.sectionName?.trim() || "帖子";
  const { tagBg, tagColor } = sectionTagStyle(tag);
  const images = item.imageUrls?.length ? item.imageUrls : [PLACEHOLDER_IMG];
  return {
    id: item.id,
    username: nick,
    avatarLetter: letter,
    avatarBg: avatarGradient(nick),
    tag,
    tagBg,
    tagColor,
    title: item.title,
    content: item.content ?? "",
    excerpt: item.excerpt || "",
    images,
    comments: item.commentCount,
    likes: item.likeCount,
    favorites: item.favoriteCount ?? 0,
    liked: item.liked ?? false,
    favorited: item.favorited ?? false,
  };
}
