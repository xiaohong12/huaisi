<template>
  <view class="page">
    <view class="logo-wrap">
      <view class="logo-mark">辰</view>
      <text class="logo-text">Chen Xing </text>
    </view>

    <view class="form-wrap">
      <view class="field">
        <input
          v-model.trim="phone"
          class="input"
          :class="{
            'input-focus': phoneFocused && !phoneError,
            'input-error': !!phoneError,
          }"
          type="number"
          maxlength="11"
          placeholder="请输入手机号码"
          @focus="phoneFocused = true"
          @blur="phoneFocused = false"
          @input="onPhoneInput"
        />
        <text v-if="phoneError" class="field-error">{{ phoneError }}</text>
      </view>

      <view class="field">
        <view class="password-input-wrap">
          <input
            v-model.trim="password"
            class="input input--password"
            :class="{
              'input-focus': passwordFocused && !passwordError,
              'input-error': !!passwordError,
            }"
            :type="passwordVisible ? 'text' : 'password'"
            :password="!passwordVisible"
            placeholder="请输入登录密码"
            @focus="passwordFocused = true"
            @blur="passwordFocused = false"
            @input="onPasswordInput"
          />
          <view class="pwd-toggle" @click.stop="togglePasswordVisible">
            <image
              class="pwd-toggle-icon"
              :src="passwordVisible ? '/static/image/eye.png' : '/static/image/eye-closed.png'"
              mode="aspectFit"
            />
          </view>
        </view>
        <text v-if="passwordError" class="field-error">{{ passwordError }}</text>
      </view>
    </view>

    <view class="agree-wrap" @click="agreed = !agreed">
      <view class="checkbox" :class="{ checked: agreed }">
        <image v-if="agreed" class="agree-check-icon" src="/static/image/check.png" mode="aspectFit" />
      </view>
      <view class="agree-text-wrap">
        <text class="agree-text">我已阅读并同意</text>
        <text class="link-text">《辰星文化用户协议》</text>
        <text class="agree-text">、</text>
        <text class="link-text">《辰星文化隐私权政策》</text>
      </view>
    </view>

    <button class="submit-btn" @click="handlePhonePasswordLogin">确定</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { loginApi } from "@/api/common";

const phone = ref("");
const password = ref("");
const agreed = ref(false);
const phoneFocused = ref(false);
const passwordFocused = ref(false);
const phoneError = ref("");
const passwordError = ref("");
/** 密码是否明文显示（false 为密文，右侧显示闭眼图标） */
const passwordVisible = ref(false);

/**
 * 切换密码明文 / 密文显示。
 */
const togglePasswordVisible = () => {
  passwordVisible.value = !passwordVisible.value;
};

/**
 * 校验是否为 11 位手机号（1 开头共 11 位数字）。
 */
const isPhoneValid = (value: string) => /^1\d{10}$/.test(value);

/**
 * 校验密码：至少 8 位，且同时包含大写字母与小写字母。
 */
const isPasswordValid = (value: string) => {
  if (!value || value.length < 8) return false;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  return hasLower && hasUpper;
};

/**
 * 手机号输入时：若当前已满足规则则清除错误提示。
 */
const onPhoneInput = () => {
  if (phoneError.value && isPhoneValid(phone.value)) {
    phoneError.value = "";
  }
};

/**
 * 密码输入时：若当前已满足规则则清除错误提示。
 */
const onPasswordInput = () => {
  if (passwordError.value && isPasswordValid(password.value)) {
    passwordError.value = "";
  }
};

/**
 * 提交前校验：不通过则标红边框并在输入框下展示文案，通过才允许请求登录接口。
 */
const validateFormForSubmit = () => {
  let ok = true;

  if (!isPhoneValid(phone.value)) {
    phoneError.value = "请输入 11 位有效手机号码（1 开头）";
    ok = false;
  } else {
    phoneError.value = "";
  }

  if (!isPasswordValid(password.value)) {
    passwordError.value = "密码至少 8 位，且需同时包含大写字母和小写字母";
    ok = false;
  } else {
    passwordError.value = "";
  }

  if (!agreed.value) {
    uni.showToast({ title: "请先同意用户协议", icon: "none" });
    ok = false;
  }

  return ok;
};

/**
 * 手机号密码登录：提交手机号与密码，由后端按 users.phone 匹配；
 * 登录成功后进入首页并清空登录页栈。
 */
const handlePhonePasswordLogin = async () => {
  if (!validateFormForSubmit()) {
    return;
  }

  try {
    uni.showLoading({ title: "登录中...", mask: true });

    const apiRes = await loginApi({
      phone: phone.value,
      password: password.value,
    });

    const isSuccess = apiRes.code === 0 || apiRes.code === 200;
    if (!isSuccess || !apiRes.data?.token) {
      throw new Error(apiRes.message || "登录失败，请检查账号密码");
    }

    uni.setStorageSync("token", apiRes.data.token);
    uni.setStorageSync("loginUser", apiRes.data.user || {});
    uni.showToast({ title: "登录成功", icon: "success" });
    uni.reLaunch({ url: "/pages/index/index" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败，请稍后重试";
    uni.showToast({ title: message, icon: "none" });
  } finally {
    setTimeout(() => {
    uni.hideLoading();
    }, 3000);
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 36rpx 16rpx 60rpx;
  box-sizing: border-box;
}

.logo-wrap {
  padding-top: 90rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-mark {
  width: 124rpx;
  height: 124rpx;
  border-radius: 50%;
  background: #1246d3;
  color: #ffffff;
  font-size: 62rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  margin-top: 18rpx;
  color: #1f2937;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.form-wrap {
  margin-top: 92rpx;
}

.field {
  margin-bottom: 26rpx;
}

.password-input-wrap {
  position: relative;
  width: 100%;
}

.pwd-toggle {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.pwd-toggle-icon {
  width: 40rpx;
  height: 40rpx;
}

.input {
  width: 100%;
  height: 82rpx;
  margin-bottom: 6rpx;
  border-radius: 41rpx;
  background: white;
  box-sizing: border-box;
  padding: 0 34rpx;
  font-size: 30rpx;
  color: #222222;
  border: 2rpx solid white;
  box-shadow: 0 6rpx 20rpx rgba(15, 23, 42, 0.04);
}

.input.input--password {
  padding-right: 88rpx;
}

.input.input-focus {
  border-color: #0833b8;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(8, 51, 184, 0.12);
}

.input.input-error {
  border-color: #ef4444;
  /* background: #fff5f5; */
}

.field-error {
  display: block;
  padding: 0 12rpx 18rpx;
  font-size: 18rpx;
  color: #ef4444;
  line-height: 1.4;
}

.agree-wrap {
  margin-top: 16rpx;
  display: flex;
  align-items: flex-start;
}

.checkbox {
  margin-top: 6rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  border: 2rpx solid #b8bcc5;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox.checked {
  border-color: #0c3bc8;
  background: #0c3bc8;
}

.agree-check-icon {
  width: 16rpx;
  height: 16rpx;
}

.agree-text-wrap {
  margin-left: 12rpx;
  flex: 1;
  flex-wrap: wrap;
}

.agree-text {
  font-size: 25rpx;
  color: #6b7280;
}

.link-text {
  font-size: 25rpx;
  color: #0834bc;
}

.submit-btn {
  margin-top: 44rpx;
  width: 100%;
  height: 82rpx;
  border-radius: 41rpx;
  border: none;
  background: #0833b8;
  color: #ffffff;
  font-size: 30rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
}

.submit-btn::after {
  border: none;
}
</style>
