<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
      <view class="blur-dot dot-right" />
    </view>

    <view class="content">
      <view v-if="needLogin" class="state-block">
        <text class="state-text">登录后可管理账号安全设置</text>
      </view>

      <template v-else>
        <view class="section-title">安全设置</view>
        <u-cell-group :border="false" customStyle="border-radius: 24rpx; overflow: hidden;">
          <u-cell
            title="修改密码"
            label="定期更换密码有助于保护账号安全"
            isLink
            size="large"
            :border="false"
            @click="goChangePassword"
          >
            <template #icon>
              <view class="menu-icon">密</view>
            </template>
          </u-cell>
        </u-cell-group>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";

/** 未登录时仅展示提示，不展示功能列表 */
const needLogin = ref(false);

/**
 * 检测登录态；未登录时弹窗引导去登录或返回。
 */
const checkLogin = () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (token) {
    needLogin.value = false;
    return;
  }
  needLogin.value = true;
  uni.showModal({
    title: "提示",
    content: "请先登录后再查看账号与安全",
    confirmText: "去登录",
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: "/pages/login/index" });
      } else {
        uni.navigateBack();
      }
    },
  });
};

onShow(() => {
  checkLogin();
});

/**
 * 进入修改密码页（已登录方可操作）。
 */
const goChangePassword = () => {
  if (!uni.getStorageSync("token")) {
    checkLogin();
    return;
  }
  uni.navigateTo({ url: "/pages/profile/change-password" });
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #dbeafe 0%, #f0f6ff 500rpx, #ffffff 900rpx);
  position: relative;
}

.hero-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 240rpx;
  overflow: hidden;
  pointer-events: none;
}

.blur-dot {
  position: absolute;
  border-radius: 50%;
  filter: blur(2rpx);
}

.dot-left {
  width: 280rpx;
  height: 280rpx;
  left: -80rpx;
  top: -120rpx;
  background: radial-gradient(circle, rgba(66, 120, 255, 0.28) 0%, rgba(66, 120, 255, 0) 72%);
}

.dot-right {
  width: 260rpx;
  height: 260rpx;
  right: -70rpx;
  top: -90rpx;
  background: radial-gradient(circle, rgba(96, 224, 196, 0.24) 0%, rgba(96, 224, 196, 0) 72%);
}

.content {
  padding: 26rpx 16rpx 48rpx;
  position: relative;
  z-index: 1;
}

.state-block {
  margin-top: 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.state-text {
  font-size: 28rpx;
  color: #64748b;
}

.section-title {
  margin: 6rpx 0 16rpx;
  padding-left: 6rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #334155;
}

.menu-icon {
  width: 46rpx;
  height: 46rpx;
  border-radius: 12rpx;
  margin-right: 14rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.u-cell-group) {
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.05);
}

:deep(.u-cell) {
  background: #ffffff !important;
}

:deep(.u-cell__title-text) {
  font-size: 30rpx !important;
  font-weight: 600;
  color: #0f172a !important;
}

:deep(.u-cell__label) {
  color: #94a3b8 !important;
  margin-top: 6rpx !important;
}
</style>
