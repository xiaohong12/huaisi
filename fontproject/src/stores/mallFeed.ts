import { defineStore } from "pinia";
import { ref } from "vue";
import type { MallProductListItemDTO } from "@/api/mall";
import { MALL_FIRST_PAGE_CACHE_KEY } from "@/constants/storageKeys";

/** 缓存结构版本号：字段变更时递增（含 sevenDayNoReason 等列表字段） */
const CACHE_VERSION = 2;
/** 首屏缓存有效期（毫秒），过期仍先展示缓存并触发刷新 */
const FIRST_PAGE_TTL_MS = 60 * 1000;

/** 写入 Storage 的商城第一页载荷 */
interface MallFirstPageCachePayload {
  version: number;
  updatedAt: number;
  list: MallProductListItemDTO[];
  hasMore: boolean;
  total: number;
}

/**
 * 从本地读取商城第一页缓存；结构或版本不对则返回 null。
 */
const readFirstPagePayload = (): MallFirstPageCachePayload | null => {
  try {
    const raw = uni.getStorageSync(MALL_FIRST_PAGE_CACHE_KEY) as string | MallFirstPageCachePayload | undefined;
    if (raw == null || raw === "") return null;
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as MallFirstPageCachePayload) : raw;
    if (
      !parsed ||
      parsed.version !== CACHE_VERSION ||
      !Array.isArray(parsed.list) ||
      typeof parsed.updatedAt !== "number" ||
      typeof parsed.hasMore !== "boolean" ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * 商城列表：第一页写入 Pinia + uni 缓存，二次进入「商城」Tab 可秒开首屏。
 */
export const useMallFeedStore = defineStore("mallFeed", () => {
  const firstPageList = ref<MallProductListItemDTO[]>([]);
  const firstPageHasMore = ref(true);
  const firstPageTotal = ref(0);
  /** 最近一次写入第一页缓存的时间戳 */
  const firstPageUpdatedAt = ref(0);

  /**
   * 将接口返回的第一页列表持久化，供下次进入页面恢复。
   */
  const persistFirstPage = (list: MallProductListItemDTO[], hasMore: boolean, total: number) => {
    firstPageList.value = list;
    firstPageHasMore.value = hasMore;
    firstPageTotal.value = total;
    firstPageUpdatedAt.value = Date.now();
    try {
      const payload: MallFirstPageCachePayload = {
        version: CACHE_VERSION,
        updatedAt: firstPageUpdatedAt.value,
        list,
        hasMore,
        total,
      };
      uni.setStorageSync(MALL_FIRST_PAGE_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // 存储失败不影响当前会话
    }
  };

  /**
   * 仅从 Storage 恢复到 Pinia（不请求网络）。
   * @returns 是否命中有效缓存
   */
  const hydrateFromStorage = (): boolean => {
    const payload = readFirstPagePayload();
    if (!payload || payload.list.length === 0) {
      return false;
    }
    firstPageList.value = payload.list;
    firstPageHasMore.value = payload.hasMore;
    firstPageTotal.value = payload.total;
    firstPageUpdatedAt.value = payload.updatedAt;
    return true;
  };

  /**
   * 第一页缓存是否在 TTL 内（未过期可优先后台刷新）。
   */
  const isFirstPageCacheFresh = () => Date.now() - firstPageUpdatedAt.value < FIRST_PAGE_TTL_MS;

  return {
    firstPageList,
    firstPageHasMore,
    firstPageTotal,
    firstPageUpdatedAt,
    persistFirstPage,
    hydrateFromStorage,
    isFirstPageCacheFresh,
  };
});
