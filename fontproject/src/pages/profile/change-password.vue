<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
      <view class="blur-dot dot-right" />
    </view>

    <view class="content">
      <view class="form-card">
        <view class="field">
          <text class="label">当前密码</text>
          <view class="password-input-wrap">
            <input
              v-model.trim="oldPassword"
              class="input"
              :type="oldVisible ? 'text' : 'password'"
              :password="!oldVisible"
              placeholder="请输入当前登录密码"
            />
            <view class="pwd-toggle" @click.stop="oldVisible = !oldVisible">
              <image
                class="pwd-toggle-icon"
                :src="oldVisible ? '/static/image/eye.png' : '/static/image/eye-closed.png'"
                mode="aspectFit"
              />
            </view>
          </view>
        </view>

        <view class="field">
          <text class="label">新密码</text>
          <view class="password-input-wrap">
            <input
              v-model.trim="newPassword"
              class="input"
              :type="newVisible ? 'text' : 'password'"
              :password="!newVisible"
              placeholder="至少 8 位，含大写与小写字母"
            />
            <view class="pwd-toggle" @click.stop="newVisible = !newVisible">
              <image
                class="pwd-toggle-icon"
                :src="newVisible ? '/static/image/eye.png' : '/static/image/eye-closed.png'"
                mode="aspectFit"
              />
            </view>
          </view>
        </view>

        <view class="field field--last">
          <text class="label">确认新密码</text>
          <view class="password-input-wrap">
            <input
              v-model.trim="confirmPassword"
              class="input"
              :type="confirmVisible ? 'text' : 'password'"
              :password="!confirmVisible"
              placeholder="请再次输入新密码"
            />
            <view class="pwd-toggle" @click.stop="confirmVisible = !confirmVisible">
              <image
                class="pwd-toggle-icon"
                :src="confirmVisible ? '/static/image/eye.png' : '/static/image/eye-closed.png'"
                mode="aspectFit"
              />
            </view>
          </view>
        </view>

        <u-button
          type="primary"
          shape="circle"
          text="保存"
          :loading="submitting"
          :custom-style="saveBtnStyle"
          @click="handleSubmit"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { changeUserPasswordApi } from "@/api/userPassword";
import { clearLocalLoginState } from "@/utils/clearAuthStorage";

const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const oldVisible = ref(false);
const newVisible = ref(false);
const confirmVisible = ref(false);
const submitting = ref(false);

const saveBtnStyle =
  "width: 100%; height: 88rpx; margin-top: 36rpx; font-size: 30rpx; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none;";

/**
 * 新密码规则与登录页一致。
 */
const isPasswordValid = (value: string) => {
  if (!value || value.length < 8) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value);
};

/**
 * 未登录则拦截并引导登录。
 */
const ensureToken = (): boolean => {
  if (uni.getStorageSync("token")) return true;
  uni.showModal({
    title: "提示",
    content: "请先登录后再修改密码",
    confirmText: "去登录",
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: "/pages/login/index" });
      } else {
        uni.navigateBack();
      }
    },
  });
  return false;
};

onShow(() => {
  ensureToken();
});

/**
 * 校验表单并提交修改密码；成功后清理本地登录态并跳转登录页。
 */
const handleSubmit = async () => {
  if (!ensureToken()) return;

  if (!oldPassword.value) {
    uni.showToast({ title: "请输入当前密码", icon: "none" });
    return;
  }
  if (!isPasswordValid(newPassword.value)) {
    uni.showToast({
      title: "新密码至少 8 位且含大小写字母",
      icon: "none",
    });
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({ title: "两次输入的新密码不一致", icon: "none" });
    return;
  }
  if (oldPassword.value === newPassword.value) {
    uni.showToast({ title: "新密码不能与当前密码相同", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    const res = await changeUserPasswordApi({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    if (res.code !== 0 || !res.data?.ok) {
      uni.showToast({
        title: res.message || "修改失败",
        icon: "none",
      });
      return;
    }
    uni.showToast({ title: "修改成功", icon: "success" });
    clearLocalLoginState();
    setTimeout(() => {
      uni.reLaunch({ url: "/pages/login/index" });
    }, 800);
  } catch {
    uni.showToast({ title: "网络异常，请稍后重试", icon: "none" });
  } finally {
    submitting.value = false;
  }
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

.form-card {
  border-radius: 28rpx;
  padding: 32rpx 28rpx 36rpx;
  background: linear-gradient(128deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: 0 12rpx 34rpx rgba(24, 42, 84, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.88);
}

.field {
  margin-bottom: 28rpx;
}

.field--last {
  margin-bottom: 0;
}

.label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
  margin-bottom: 12rpx;
}

.password-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 20rpx;
  background: #f1f5f9;
  border: 1rpx solid #e2e8f0;
}

.input {
  flex: 1;
  height: 96rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: #0f172a;
}

.pwd-toggle {
  padding: 0 24rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwd-toggle-icon {
  width: 40rpx;
  height: 40rpx;
}
</style>
