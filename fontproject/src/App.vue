<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

/**
 * 应用首次启动时触发，可用于初始化全局配置。
 */
onLaunch(() => {
  console.log("App Launch");
});

/**
 * 应用进入前台时触发。
 */
onShow(() => {
  console.log("App Show");
});

/**
 * 应用进入后台时触发。
 */
onHide(() => {
  console.log("App Hide");
});
</script>
<style lang="scss">
/* uview-plus 基础样式，须写在首行；勿把 index.scss 放进 uni.scss，避免包体过大 */
@import "uview-plus/index.scss";

/**
 * 小程序原生 button 默认排版易导致文字偏上；统一 flex 使 u-button 内文案水平垂直居中。
 */
button.u-button {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box;
}

.u-button .u-button__text,
.u-button .u-button__loading-text {
  text-align: center;
}
</style>
