const ADMIN_TOKEN_KEY = 'admin_token'

/**
 * 读取当前保存的管理员 token（优先 localStorage，再 sessionStorage，与登录时写入位置一致）。
 */
export function getAdminToken(): string | null {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || window.sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

/**
 * 清除两处存储中的管理员 token（退出登录）。
 */
export function clearAdminToken(): void {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY)
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}
