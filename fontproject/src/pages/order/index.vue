<template>
  <view class="page">
    <view class="content">
      <text class="title">AI</text>
      <text class="desc">智能对话能力待接入，此处为占位页。</text>
    </view>
    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import CustomTabBar from "@/components/CustomTabBar.vue";
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fb;
}

.content {
  padding: 40rpx 16rpx 200rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 16rpx;
}

.desc {
  font-size: 28rpx;
  color: #6b7280;
}
</style>
