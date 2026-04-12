<template>
  <view class="page">
    <view class="login-card">
      <view class="hero-wrap">
        <image class="hero-image" src="/static/image/wecolme.jpg" mode="aspectFill" />
        <view class="hero-mask" />
        <view class="spark spark-1" />
        <view class="spark spark-2" />
        <view class="spark spark-3" />
        <view class="sakura-layer">
          <view class="petal petal-1" />
          <view class="petal petal-2" />
          <view class="petal petal-3" />
          <view class="petal petal-4" />
          <view class="petal petal-5" />
          <view class="petal petal-6" />
          <view class="petal petal-7" />
        </view>
      </view>

      <view class="action-wrap">
        <button class="btn btn-phone" @click="goPhoneLogin">手机号码登录</button>
        <button class="btn btn-quick" @click="handleQuickLogin">一键登录</button>
      </view>
    </view>

    <view class="bottom-agreement" @click="toggleAgreement">
      <view class="agree-check" :class="{ checked: agreed }">
        <image v-if="agreed" class="agree-check-icon" src="/static/image/check.png" mode="aspectFit" />
      </view>
      <view class="agree-line">
        <text class="agree-muted">我已阅读并同意</text>
        <text class="agree-link">《辰星文化用户协议》</text>
        <text class="agree-muted">、</text>
        <text class="agree-link">《辰星文化隐私权政策》</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { wechatMiniLoginApi } from "@/api/common";

const agreed = ref(false);

/**
 * 跳转到手机号密码登录页面。
 */
const goPhoneLogin = () => {
  uni.navigateTo({
    url: "/pages/login/phone-password",
  });
};

/**
 * 处理一键登录：
 * 1. 未勾选协议时仅轻提示，不继续后续流程
 * 2. 已勾选时弹出授权确认弹窗（说明未注册手机号将自动建号）
 * 3. 用户同意后调用 uni.login 获取 code，再走后端微信登录接口
 * 4. 登录成功后 reLaunch 到首页，避免返回登录栈
 */
const handleQuickLogin = () => {
  if (!agreed.value) {
    uni.showToast({
      title: "请先阅读并勾选隐私政策",
      icon: "none",
    });
    return;
  }

  uni.showModal({
    title: "微信快捷登录",
    content:
      "将使用微信授权信息完成登录。\n若手机号尚未在本平台注册，将自动创建账号并登录",
    confirmText: "同意",
    cancelText: "取消",
    success: async (modalRes) => {
      if (!modalRes.confirm) {
        return;
      }

      try {
        uni.showLoading({ title: "登录中...", mask: true });
        const loginRes = await uni.login({ provider: "weixin" });
        if (!loginRes.code) {
          throw new Error("未获取到微信登录凭证");
        }

        const apiRes = await wechatMiniLoginApi({ code: loginRes.code });
        const isSuccess = apiRes.code === 0 || apiRes.code === 200;
        if (!isSuccess || !apiRes.data?.token) {
          throw new Error(apiRes.message || "微信登录失败");
        }

        uni.setStorageSync("token", apiRes.data.token);
        uni.setStorageSync("loginUser", apiRes.data.user || {});
        uni.showToast({ title: "登录成功", icon: "success" });
        uni.reLaunch({ url: "/pages/index/index" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "登录失败，请重试";
        uni.showToast({ title: message, icon: "none" });
      } finally {
        uni.hideLoading();
      }
    },
  });
};

/**
 * 切换协议勾选状态。
 */
const toggleAgreement = () => {
  agreed.value = !agreed.value;
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 16% 12%, rgba(255, 185, 236, 0.35) 0%, rgba(255, 185, 236, 0) 42%),
    radial-gradient(circle at 82% 18%, rgba(162, 200, 255, 0.4) 0%, rgba(162, 200, 255, 0) 44%),
    linear-gradient(180deg, #f7f3ff 0%, #eef4ff 100%);
  padding: 24rpx 16rpx 130rpx;
  box-sizing: border-box;
  position: relative;
}

.login-card {
  width: 100%;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  box-shadow: 0 22rpx 54rpx rgba(87, 90, 175, 0.18);
  border: 2rpx solid rgba(255, 255, 255, 0.95);
}

.bottom-panel {
  margin-top: 24rpx;
  border-radius: 24rpx;
  padding: 24rpx 22rpx 30rpx;
  background: rgba(255, 255, 255, 0.65);
  border: 2rpx solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 10rpx 28rpx rgba(98, 105, 194, 0.12);
}

.feature-row {
  display: flex;
  gap: 12rpx;
}

.feature-chip {
  flex: 1;
  min-width: 0;
  height: 74rpx;
  border-radius: 37rpx;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.88) 0%, rgba(246, 250, 255, 0.74) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255, 255, 255, 0.95);
}

.chip-icon {
  font-size: 24rpx;
  margin-right: 8rpx;
}

.chip-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #4d5aca;
}

.bottom-tip {
  display: block;
  margin-top: 20rpx;
  text-align: center;
  font-size: 24rpx;
  color: #6f78ae;
}

.policy-line {
  margin-top: 12rpx;
  text-align: center;
}

.policy-muted {
  font-size: 22rpx;
  color: #8c92b8;
}

.policy-link {
  font-size: 22rpx;
  color: #4861de;
}

.hero-wrap {
  position: relative;
  width: 100%;
  height: 620rpx;
  background: #f5f7ff;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  transform: scale(1.02);
}

.hero-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background:
    linear-gradient(180deg, rgba(80, 96, 212, 0.08) 0%, rgba(255, 255, 255, 0.08) 45%, rgba(58, 74, 191, 0.16) 100%);
}

.sakura-layer {
  position: absolute;
  left: -20rpx;
  top: -10rpx;
  width: calc(100% + 40rpx);
  height: calc(100% + 20rpx);
  pointer-events: none;
}

.petal {
  position: absolute;
  top: -60rpx;
  width: 20rpx;
  height: 14rpx;
  border-radius: 14rpx 14rpx 14rpx 0;
  transform: rotate(-22deg);
  background: linear-gradient(135deg, rgba(255, 215, 234, 0.96) 0%, rgba(255, 170, 214, 0.9) 100%);
  box-shadow: 0 4rpx 10rpx rgba(246, 126, 189, 0.3);
  animation: sakuraFall 8s linear infinite;
}

.petal-1 {
  left: 10%;
  animation-duration: 9s;
}

.petal-2 {
  left: 25%;
  width: 16rpx;
  height: 12rpx;
  animation-duration: 7.4s;
  animation-delay: -2.2s;
}

.petal-3 {
  left: 40%;
  animation-duration: 8.4s;
  animation-delay: -1s;
}

.petal-4 {
  left: 56%;
  width: 18rpx;
  height: 12rpx;
  animation-duration: 6.9s;
  animation-delay: -3.6s;
}

.petal-5 {
  left: 69%;
  animation-duration: 9.3s;
  animation-delay: -1.8s;
}

.petal-6 {
  left: 82%;
  width: 16rpx;
  height: 11rpx;
  animation-duration: 7.8s;
  animation-delay: -4.4s;
}

.petal-7 {
  left: 92%;
  animation-duration: 8.8s;
  animation-delay: -2.9s;
}

.spark {
  position: absolute;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 18rpx rgba(188, 228, 255, 0.95);
  animation: twinkle 2.4s ease-in-out infinite;
}

.spark-1 {
  left: 48rpx;
  top: 72rpx;
}

.spark-2 {
  right: 76rpx;
  top: 128rpx;
  animation-delay: 0.6s;
}

.spark-3 {
  right: 186rpx;
  bottom: 100rpx;
  animation-delay: 1.1s;
}

.hero-bubble {
  position: absolute;
  left: 34rpx;
  top: 104rpx;
  width: 248rpx;
  height: 146rpx;
  border-radius: 94rpx;
  background: linear-gradient(135deg, #6b7cff 0%, #5f85ff 48%, #59b4ff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 38rpx rgba(67, 94, 226, 0.35);
  border: 2rpx solid rgba(255, 255, 255, 0.95);
}

.bubble-title {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 2rpx 6rpx rgba(34, 52, 160, 0.25);
}

.bubble-sub {
  margin-top: 10rpx;
  color: #f4f8ff;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.1;
  text-shadow: 0 2rpx 4rpx rgba(32, 48, 144, 0.2);
}

.action-wrap {
  padding: 154rpx 36rpx 54rpx;
}

.btn {
  width: 100%;
  height: 82rpx;
  border-radius: 41rpx;
  border: none;
  font-size: 30rpx;
  margin: 0;
  font-weight: 700;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
}

.btn::after {
  border: none;
}

.btn-phone {
  background: linear-gradient(90deg, #3158ff 0%, #4f72ff 100%);
  color: #ffffff;
  box-shadow: 0 12rpx 24rpx rgba(49, 88, 255, 0.34);
}

.btn-quick {
  margin-top: 38rpx;
  background: linear-gradient(90deg, #22aa66 0%, #46c978 100%);
  color: #ffffff;
  box-shadow: 0 12rpx 24rpx rgba(39, 176, 110, 0.3);
}

.guest-text {
  display: block;
  margin-top: 42rpx;
  text-align: center;
  font-size: 34rpx;
  font-weight: 500;
  color: #3551cf;
  letter-spacing: 2rpx;
}

.bottom-agreement {
  position: fixed;
  left: 16rpx;
  right: 16rpx;
  bottom: calc(18rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
}

.agree-check {
  margin-top: 4rpx;
  width: 26rpx;
  height: 26rpx;
  border-radius: 50%;
  border: 2rpx solid #c2c6d9;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
}

.agree-check.checked {
  border-color: #3556d6;
  background: #3556d6;
}

.agree-tick {
  color: #ffffff;
  font-size: 18rpx;
  line-height: 1;
}

.agree-check-icon {
  width: 16rpx;
  height: 16rpx;
}

.agree-line {
  margin-left: 10rpx;
}

.agree-muted {
  font-size: 24rpx;
  color: #9aa0bb;
}

.agree-link {
  font-size: 24rpx;
  color: #4f63c7;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes sakuraFall {
  0% {
    transform: translate3d(0, -60rpx, 0) rotate(-28deg);
    opacity: 0;
  }
  12% {
    opacity: 0.95;
  }
  45% {
    transform: translate3d(30rpx, 250rpx, 0) rotate(48deg);
  }
  75% {
    transform: translate3d(-22rpx, 420rpx, 0) rotate(110deg);
    opacity: 0.8;
  }
  100% {
    transform: translate3d(20rpx, 640rpx, 0) rotate(170deg);
    opacity: 0;
  }
}
</style>
