/**
 * 读取 Vite 环境变量中的 API 根地址；未配置时默认本机开发端口（与 server 默认 PORT 一致）。
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/\/$/, '')
  }
  return 'http://127.0.0.1:7001'
}
