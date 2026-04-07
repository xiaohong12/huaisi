<template>
  <view class="page">
    <view class="content">
      <view class="card">
        <view class="row">
          <text class="label">头像</text>
          <u-avatar :src="displayUser.avatar" size="52" />
        </view>
        <u-line margin="16rpx 0" />
        <view class="row">
          <text class="label">用户名</text>
          <text class="value">{{ displayUser.username }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * 用户缓存结构，来源于登录接口返回 user。
 */
interface LoginUser {
  username?: string;
  nickname?: string;
  avatar?: string;
}

/**
 * 读取本地用户信息并提供默认展示值。
 */
const displayUser = computed(() => {
  const cacheUser = uni.getStorageSync("loginUser") as LoginUser | undefined;
  return {
    username: cacheUser?.nickname || cacheUser?.username || "未登录用户",
    avatar: cacheUser?.avatar || "",
  };
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fb;
}

.content {
  padding: 24rpx 16rpx;
}

.card {
  border-radius: 22rpx;
  background: #ffffff;
  padding: 28rpx 24rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: 28rpx;
  color: #6b7280;
}

.value {
  max-width: 60%;
  font-size: 30rpx;
  color: #111827;
  text-align: right;
}
</style>
