import { defineStore } from "pinia";

/** 与订单/收藏/发布三个快捷数字对应的本地缓存键（按用户 id 隔离） */
export const PROFILE_QUICK_STORAGE_KEYS = [
  "profile_quick_order",
  "profile_quick_favorite",
  "profile_quick_publish",
] as const;

type QuickField = "order" | "favorite" | "publish";

const keyForField = (field: QuickField): string => {
  if (field === "order") return PROFILE_QUICK_STORAGE_KEYS[0];
  if (field === "favorite") return PROFILE_QUICK_STORAGE_KEYS[1];
  return PROFILE_QUICK_STORAGE_KEYS[2];
};

interface FieldPayload {
  userId: number;
  value: number;
}

/**
 * 个人中心快捷区：订单总数、收藏总数、发布总数。
 * 使用 Pinia 管理内存态，并写入 uni.storage 做本地缓存；切换用户时仅恢复与当前 userId 一致的条目。
 */
export const useProfileQuickStatsStore = defineStore("profileQuickStats", {
  state: () => ({
    orderTotal: null as number | null,
    favoriteTotal: null as number | null,
    publishTotal: null as number | null,
  }),

  actions: {
    /**
     * 从本地读取与指定用户 id 匹配的缓存，填充到 state（无匹配则对应项保持 null）。
     */
    restoreFromLocal(userId: number) {
      const read = (field: QuickField): number | null => {
        try {
          const raw = uni.getStorageSync(keyForField(field)) as string | undefined;
          if (!raw) return null;
          const o = JSON.parse(raw) as FieldPayload;
          if (o.userId !== userId || typeof o.value !== "number") return null;
          return o.value;
        } catch {
          return null;
        }
      };
      this.orderTotal = read("order");
      this.favoriteTotal = read("favorite");
      this.publishTotal = read("publish");
    },

    /**
     * 将单项数字写入本地（与 userId 绑定）。
     */
    persistField(userId: number, field: QuickField, value: number) {
      try {
        const payload: FieldPayload = { userId, value };
        uni.setStorageSync(keyForField(field), JSON.stringify(payload));
      } catch {
        // 存储失败时忽略
      }
    },

    setOrderTotal(v: number | null) {
      this.orderTotal = v;
    },

    setFavoriteTotal(v: number | null) {
      this.favoriteTotal = v;
    },

    setPublishTotal(v: number | null) {
      this.publishTotal = v;
    },

    /**
     * 退出登录或未登录：清空内存并删除三项本地缓存。
     */
    clearAll() {
      this.orderTotal = null;
      this.favoriteTotal = null;
      this.publishTotal = null;
      for (const k of PROFILE_QUICK_STORAGE_KEYS) {
        try {
          uni.removeStorageSync(k);
        } catch {
          // ignore
        }
      }
    },
  },
});
