<template>
  <view class="page">
    <view class="form-card">
      <!-- 头像：选图后仅本地预览；与资料页一致用 chooseImage 临时路径，点注册时再 uploadImageApi + registerApi -->
      <view class="cell cell--tap" @click="onPickAvatar">
        <text class="cell-label">头像</text>
        <view class="cell-right cell-right--avatar">
          <view class="avatar-wrap">
            <image
              v-if="avatarLocalPath"
              class="avatar-img"
              :src="avatarLocalPath"
              mode="aspectFill"
            />
            <view v-else class="avatar-placeholder">
              <text class="avatar-placeholder-icon">👤</text>
            </view>
            <view class="avatar-camera">
              <text class="avatar-camera-icon">📷</text>
            </view>
          </view>
          <text class="chevron">›</text>
        </view>
      </view>
      <view class="divider" />

      <!-- 手机号：后端注册必填，与参考图同列表样式 -->
      <view class="cell">
        <text class="cell-label">手机号</text>
        <input
          v-model.trim="phone"
          class="cell-input"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="input-ph"
        />
      </view>
      <view class="divider" />

      <view class="cell">
        <text class="cell-label">姓名</text>
        <input
          v-model.trim="nickname"
          class="cell-input"
          maxlength="32"
          placeholder="请输入姓名"
          placeholder-class="input-ph"
        />
      </view>
      <view class="divider" />

      <view class="cell">
        <text class="cell-label">性别</text>
        <view class="gender-row">
          <view class="gender-item" @click="gender = 'male'">
            <view class="radio-outer" :class="{ 'radio-outer--on': gender === 'male' }">
              <view v-if="gender === 'male'" class="radio-inner" />
            </view>
            <text class="gender-text">男</text>
          </view>
          <view class="gender-item gender-item--second" @click="gender = 'female'">
            <view class="radio-outer" :class="{ 'radio-outer--on': gender === 'female' }">
              <view v-if="gender === 'female'" class="radio-inner" />
            </view>
            <text class="gender-text">女</text>
          </view>
        </view>
      </view>
      <view class="divider" />

      <view class="cell cell--password">
        <text class="cell-label">密码</text>
        <view class="pwd-wrap">
          <input
            v-model.trim="password"
            class="cell-input cell-input--pwd"
            :type="pwd1Visible ? 'text' : 'password'"
            :password="!pwd1Visible"
            placeholder="请输入密码"
            placeholder-class="input-ph"
          />
          <view class="pwd-toggle" @click.stop="pwd1Visible = !pwd1Visible">
            <image
              class="pwd-toggle-icon"
              :src="pwd1Visible ? '/static/image/eye.png' : '/static/image/eye-closed.png'"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>
      <view class="divider" />

      <view class="cell cell--password">
        <text class="cell-label">确认密码</text>
        <view class="pwd-wrap">
          <input
            v-model.trim="confirmPassword"
            class="cell-input cell-input--pwd"
            :type="pwd2Visible ? 'text' : 'password'"
            :password="!pwd2Visible"
            placeholder="请再次输入密码"
            placeholder-class="input-ph"
          />
          <view class="pwd-toggle" @click.stop="pwd2Visible = !pwd2Visible">
            <image
              class="pwd-toggle-icon"
              :src="pwd2Visible ? '/static/image/eye.png' : '/static/image/eye-closed.png'"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>
    </view>

    <button class="submit-btn" :loading="submitting" @click="handleRegister">注册</button>

    <view class="footer-line">
      <text class="footer-muted">已有账号?</text>
      <text class="footer-link" @click="goLogin">去登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { registerApi, uploadImageApi } from "@/api/common";

/** 选图后的本地临时路径（wxfile:// / 临时路径），仅用于头像预览；提交注册时再上传 */
const avatarLocalPath = ref("");
const phone = ref("");
const nickname = ref("");
const gender = ref<"male" | "female">("male");
const password = ref("");
const confirmPassword = ref("");
const pwd1Visible = ref(false);
const pwd2Visible = ref(false);
const submitting = ref(false);

/**
 * 页面加载：支持从其他页带 query.phone 预填手机号。
 */
onLoad((options) => {
  const p = options?.phone;
  if (typeof p === "string" && p) {
    phone.value = decodeURIComponent(p);
  }
});

/**
 * 将网络层或 uni 返回的失败对象转成可读文案（含 uploadFile:fail 等 errMsg）。
 */
const formatRequestError = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.errMsg === "string") return o.errMsg;
    if (typeof o.message === "string") return o.message;
  }
  return "网络异常，请稍后重试";
};

/**
 * 校验 11 位手机号（1 开头）。
 */
const isPhoneValid = (value: string) => /^1\d{10}$/.test(value);

/**
 * 校验密码：至少 8 位且同时包含大写与小写字母（与后端 /api/auth/register 一致）。
 */
const isPasswordValid = (value: string) => {
  if (!value || value.length < 8) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value);
};

/**
 * 选择相册/相机图片：只写入本地临时路径用于圆形头像预览，不在此处请求接口（与 user-info 选图流程一致，上传延后到提交）。
 */
const onPickAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: (res) => {
      const path = res.tempFilePaths[0];
      if (path) {
        avatarLocalPath.value = path;
      }
    },
  });
};

/**
 * 提交前本地校验：手机号、姓名、已选头像文件、密码规则及两次密码一致。
 */
const validateBeforeSubmit = (): boolean => {
  if (!isPhoneValid(phone.value)) {
    uni.showToast({ title: "请输入 11 位有效手机号", icon: "none" });
    return false;
  }
  if (!nickname.value.trim()) {
    uni.showToast({ title: "请输入姓名", icon: "none" });
    return false;
  }
  if (!avatarLocalPath.value) {
    uni.showToast({ title: "请先选择头像", icon: "none" });
    return false;
  }
  if (!isPasswordValid(password.value)) {
    uni.showToast({
      title: "密码至少 8 位且需同时包含大写与小写字母",
      icon: "none",
    });
    return false;
  }
  if (password.value !== confirmPassword.value) {
    uni.showToast({ title: "两次输入的密码不一致", icon: "none" });
    return false;
  }
  return true;
};

/**
 * 注册提交：先按与资料页相同方式调用 uploadImageApi 上传临时头像，再调用 registerApi 创建账号并签发 token。
 */
const handleRegister = async () => {
  if (submitting.value || !validateBeforeSubmit()) return;
  submitting.value = true;
  try {
    uni.showLoading({ title: "提交中...", mask: true });
    const uploadRes = await uploadImageApi(avatarLocalPath.value, { omitAuth: true });
    const uploadOk = uploadRes.code === 0 || uploadRes.code === 200;
    if (!uploadOk || !uploadRes.data?.fileName) {
      throw new Error(uploadRes.message || "头像上传失败");
    }
    const avatarStored = `/image/test/${uploadRes.data.fileName}`;

    const apiRes = await registerApi({
      phone: phone.value,
      password: password.value,
      nickname: nickname.value.trim(),
      gender: gender.value,
      avatar: avatarStored,
    });
    const ok = apiRes.code === 0 || apiRes.code === 200;
    if (!ok || !apiRes.data?.token) {
      throw new Error(apiRes.message || "注册失败");
    }
    uni.setStorageSync("token", apiRes.data.token);
    uni.setStorageSync("loginUser", apiRes.data.user || {});
    uni.showToast({ title: "注册成功", icon: "success" });
    setTimeout(() => {
      uni.reLaunch({ url: "/pages/index/index" });
    }, 400);
  } catch (e) {
    const msg = formatRequestError(e);
    uni.showToast({ title: msg.length > 36 ? `${msg.slice(0, 36)}…` : msg, icon: "none", duration: 3200 });
  } finally {
    submitting.value = false;
    uni.hideLoading();
  }
};

/**
 * 跳转手机号密码登录页。
 */
const goLogin = () => {
  uni.navigateTo({ url: "/pages/login/phone-password" });
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #ffffff;
  padding: 24rpx 16rpx calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.form-card {
  background: #ffffff;
  border-radius: 0;
}

.cell {
  display: flex;
  align-items: center;
  min-height: 100rpx;
  padding: 16rpx 0;
  box-sizing: border-box;
}

.cell--tap:active {
  opacity: 0.85;
}

.cell--password {
  align-items: center;
}

.cell-label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 30rpx;
  color: #1f2937;
  font-weight: 500;
}

.cell-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.cell-right--avatar {
  gap: 12rpx;
}

.avatar-wrap {
  position: relative;
  width: 112rpx;
  height: 112rpx;
}

.avatar-img {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: #e8eeff;
}

.avatar-placeholder {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: linear-gradient(180deg, #c7d7ff 0%, #a8c4ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-placeholder-icon {
  font-size: 48rpx;
  opacity: 0.9;
}

.avatar-camera {
  position: absolute;
  right: -4rpx;
  bottom: -4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #4a74ff;
  border: 3rpx solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(74, 116, 255, 0.35);
}

.avatar-camera-icon {
  font-size: 20rpx;
  line-height: 1;
}

.chevron {
  font-size: 40rpx;
  color: #c4c8d4;
  font-weight: 300;
  margin-left: 4rpx;
}

.divider {
  height: 1rpx;
  background: #eef0f4;
  margin-left: 0;
}

.cell-input {
  flex: 1;
  text-align: right;
  font-size: 30rpx;
  color: #111827;
  min-width: 0;
  height: 72rpx;
  line-height: 72rpx;
}

.input-ph {
  color: #9ca3af;
  font-size: 30rpx;
}

.gender-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.gender-item {
  display: flex;
  align-items: center;
}

.gender-item--second {
  margin-left: 40rpx;
}

.radio-outer {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid #c5c9d4;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-outer--on {
  border-color: #4a74ff;
}

.radio-inner {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #4a74ff;
}

.gender-text {
  margin-left: 12rpx;
  font-size: 30rpx;
  color: #374151;
}

.pwd-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.cell-input--pwd {
  padding-right: 72rpx;
}

.pwd-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwd-toggle-icon {
  width: 40rpx;
  height: 40rpx;
}

.submit-btn {
  margin-top: 48rpx;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  border: none;
  background: linear-gradient(90deg, #4a74ff 0%, #5b86ff 100%);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  box-shadow: 0 12rpx 28rpx rgba(74, 116, 255, 0.28);
}

.submit-btn::after {
  border: none;
}

.footer-line {
  margin-top: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.footer-muted {
  font-size: 28rpx;
  color: #6b7280;
}

.footer-link {
  font-size: 28rpx;
  font-weight: 600;
  color: #4a74ff;
}
</style>
