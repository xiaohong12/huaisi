import { defineStore } from "pinia";
import { ref } from "vue";
import { getPostFeedApi, type PostFeedItemDTO } from "@/api/post";
import { HOME_FEED_CACHE_KEY } from "@/constants/storageKeys";
import { mapPostFeedItemToCard, type HomePostCard } from "@/utils/postFeedMap";

/** 供外部与 PostCard 列表类型一致（实现位于纯工具模块，避免小程序页顺带加载 Pinia store） */
export type { HomePostCard };
export { mapPostFeedItemToCard };

/** 缓存结构版本号：字段变更时递增，旧缓存自动丢弃 */
const CACHE_VERSION = 2;
/** 缓存有效期（毫秒），过期仍可先展示旧数据并后台刷新 */
const CACHE_TTL_MS = 60 * 1000;

/** 写入 Storage 的首页缓存载荷 */
interface HomeFeedCachePayload {
  version: number;
  updatedAt: number;
  list: HomePostCard[];
}

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
      const next = ok && res.data?.list ? res.data.list.map(mapPostFeedItemToCard) : [];
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
      postList.value[idx] = mapPostFeedItemToCard(dto);
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
