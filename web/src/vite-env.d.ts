/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 根地址，如 http://127.0.0.1:7001，勿带末尾斜杠 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
