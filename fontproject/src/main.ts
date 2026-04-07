import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import uviewPlus from "uview-plus";

/**
 * 创建 uni-app 应用实例并返回给运行时挂载。
 * 注册 Pinia（全局状态）与 uview-plus（Vue3 版 uView），全局可用组件与工具方法。
 */
export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  app.use(uviewPlus);
  return {
    app,
  };
}
