/**
 * 清除本地登录凭证与缓存的用户信息（token、loginUser）。
 * 供登录态失效、退出登录、全局 401 处理等场景复用，避免与 request 层循环依赖。
 */
export function clearLocalLoginState(): void {
  try {
    uni.removeStorageSync("token");
    uni.removeStorageSync("loginUser");
  } catch {
    // 存储异常时忽略，避免阻断业务流程
  }
}
