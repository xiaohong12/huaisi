import { defineStore } from "pinia";
import { ref } from "vue";
import { getPostFeedApi, type PostFeedItemDTO } from "@/api/post";
import { HOME_FEED_CACHE_KEY } from "@/constants/storageKeys";

/** 缓存结构版本号：字段变更时递增，旧缓存自动丢弃 */
const CACHE_VERSION = 1;
/** 缓存有效期（毫秒），过期仍可先展示旧数据并后台刷新 */
const CACHE_TTL_MS = 60 * 1000;

/**
 * 与 PostCard 约定一致的首页帖子卡片数据（与接口 DTO 映射后用于展示）。
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
  excerpt: string;
  images: string[];
  comments: number;
  likes: number;
  favorites: number;
  liked: boolean;
  favorited: boolean;
}

/** 写入 Storage 的首页缓存载荷 */
interface HomeFeedCachePayload {
  version: number;
  updatedAt: number;
  list: HomePostCard[];
}

const AVATAR_GRADS = [
  "linear-gradient(135deg,#c7d2fe 0%,#6366f1 100%)",
  "linear-gradient(135deg,#fde68a 0%,#f59e0b 100%)",
  "linear-gradient(135deg,#bbf7d0 0%,#22c55e 100%)",
  "linear-gradient(135deg,#fbcfe8 0%,#ec4899 100%)",
];

const PLACEHOLDER_IMG = "linear-gradient(135deg,#e5e7eb 0%,#d1d5db 100%)";

/**
 * 根据昵称生成稳定头像渐变背景。
 */
const avatarGradient = (nickname: string): string => {
  let h = 0;
  for (let i = 0; i < nickname.length; i += 1) {
    h = (h + nickname.charCodeAt(i) * (i + 1)) % AVATAR_GRADS.length;
  }
  return AVATAR_GRADS[h];
};

/**
 * 版块名称 → 标签配色（与静态示例风格一致）。
 */
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
 * 将接口帖子 DTO 转为 PostCard 所需结构。
 */
const mapFeedItem = (item: PostFeedItemDTO): HomePostCard => {
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
    excerpt: item.excerpt || "",
    images,
    comments: item.commentCount,
    likes: item.likeCount,
    favorites: item.favoriteCount ?? 0,
    liked: item.liked ?? false,
    favorited: item.favorited ?? false,
  };
};

/**
 * 从本地读取并解析首页缓存；结构或版本不对则返回 null。
 */
const readCachePayload = (): HomeFeedCachePayload | null => {
  try {
    const raw = uni.getStorageSync(HOME_FEED_CACHE_KEY) as string | HomeFeedCachePayload | undefined;
    if (raw == null || raw === "") return null;
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as HomeFeedCachePayload) : raw;
    if (
      !parsed ||
      parsed.version !== CACHE_VERSION ||
      !Array.isArray(parsed.list) ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * 首页帖子流：接口拉取 + uni 本地缓存（SWR：先缓存后静默刷新）。
 */
export const useHomeFeedStore = defineStore("homeFeed", () => {
  const postList = ref<HomePostCard[]>([]);
  const feedLoading = ref(true);
  /** 最近一次成功拉取时间戳（用于 TTL 判断） */
  const lastFetchedAt = ref(0);

  /**
   * 将当前列表写入本地缓存。
   */
  const persistCache = () => {
    try {
      const payload: HomeFeedCachePayload = {
        version: CACHE_VERSION,
        updatedAt: Date.now(),
        list: postList.value,
      };
      uni.setStorageSync(HOME_FEED_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // 存储上限或序列化失败时忽略，不影响页面使用
    }
  };

  /**
   * 仅内存与缓存同步：从 Storage 恢复列表（不发起网络请求）。
   * @returns 是否命中有效缓存
   */
  const hydrateFromCache = (): boolean => {
    const payload = readCachePayload();
    if (!payload || payload.list.length === 0) {
      return false;
    }
    postList.value = payload.list;
    lastFetchedAt.value = payload.updatedAt;
    return true;
  };

  /**
   * 请求接口并更新列表与缓存；失败时若已有列表则保留（断网可看缓存）。
   * @param silent 为 true 时不改 feedLoading（用于后台刷新）
   */
  const fetchFromNetwork = async (silent: boolean): Promise<void> => {
    if (!silent) {
      feedLoading.value = true;
    }
    try {
      const res = await getPostFeedApi(1, 20);
      const ok = res.code === 0 || res.code === 200;
      const next = ok && res.data?.list ? res.data.list.map(mapFeedItem) : [];
      if (ok && res.data?.list) {
        postList.value = next;
        lastFetchedAt.value = Date.now();
        persistCache();
      } else if (!silent && postList.value.length === 0) {
        postList.value = [];
      }
    } catch {
      if (!silent && postList.value.length === 0) {
        postList.value = [];
      }
    } finally {
      if (!silent) {
        feedLoading.value = false;
      }
    }
  };

  /**
   * 加载首页信息流：支持强制刷新（发布回跳）；否则先读缓存再后台刷新。
   * @param options.force 为 true 时始终全屏加载并拉取最新数据
   */
  const loadFeed = async (options?: { force?: boolean }): Promise<void> => {
    const force = options?.force === true;
    if (force) {
      await fetchFromNetwork(false);
      return;
    }

    const hadCache = hydrateFromCache();
    if (hadCache) {
      feedLoading.value = false;
      const payload = readCachePayload();
      const expired = !payload || Date.now() - payload.updatedAt > CACHE_TTL_MS;
      /** 未过期：后台刷新；已过期：仍展示旧列表但等待一次静默请求完成（尽快对齐服务端） */
      if (expired) {
        await fetchFromNetwork(true);
      } else {
        void fetchFromNetwork(true);
      }
      return;
    }

    await fetchFromNetwork(false);
  };

  /**
   * 点赞/收藏后由子组件回传整帖 DTO，替换列表项并写回缓存。
   */
  const updatePost = (dto: PostFeedItemDTO) => {
    const idx = postList.value.findIndex((p) => p.id === dto.id);
    if (idx >= 0) {
      postList.value[idx] = mapFeedItem(dto);
      persistCache();
    }
  };

  /**
   * 发表评论后同步列表上的评论数并写回缓存。
   */
  const updateCommentCount = (p: { postId: number; commentCount: number }) => {
    const idx = postList.value.findIndex((x) => x.id === p.postId);
    if (idx >= 0) {
      const cur = postList.value[idx];
      postList.value[idx] = { ...cur, comments: p.commentCount };
      persistCache();
    }
  };

  return {
    postList,
    feedLoading,
    lastFetchedAt,
    loadFeed,
    hydrateFromCache,
    updatePost,
    updateCommentCount,
  };
});
