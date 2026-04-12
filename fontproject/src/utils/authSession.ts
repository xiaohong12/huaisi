import { validateAuthSessionApi } from "@/api/common";
import { clearLocalLoginState } from "@/utils/clearAuthStorage";

/**
 * 携带 token 时请求后端校验登录态；若已过期或无效则清除本地 token 与用户信息。
 * 网络异常时不清理，避免弱网误登出。
 */
export async function syncAuthSessionWithServer(): Promise<void> {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) return;
  try {
    const res = await validateAuthSessionApi();
    const ok = res.code === 0 || res.code === 200;
    if (ok) return;
    if (res.code === 401) {
      clearLocalLoginState();
      uni.showToast({ title: res.message || "登录已失效，请重新登录", icon: "none" });
    }
  } catch {
    // 网络失败不清理
  }
}
