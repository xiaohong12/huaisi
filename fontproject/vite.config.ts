import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        // 降低 dart-sass 废弃 API 等告警噪音（uview-plus 依赖 scss）
        silenceDeprecations: ["legacy-js-api", "color-functions", "import"],
      },
    },
  },
});
