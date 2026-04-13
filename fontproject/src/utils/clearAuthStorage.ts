import { PROFILE_QUICK_STORAGE_KEYS } from "@/stores/profileQuickStats";

/**
 * 清除本地登录凭证与缓存的用户信息（token、loginUser）。
 * 同步清除个人中心快捷数字的本地缓存键，避免与 Pinia 展示不一致。
 * 供登录态失效、退出登录、全局 401 处理等场景复用，避免与 request 层循环依赖。
 */
export function clearLocalLoginState(): void {
  try {
    uni.removeStorageSync("token");
    uni.removeStorageSync("loginUser");
    for (const k of PROFILE_QUICK_STORAGE_KEYS) {
      try {
        uni.removeStorageSync(k);
      } catch {
        // ignore
      }
    }
  } catch {
    // 存储异常时忽略，避免阻断业务流程
  }
}
