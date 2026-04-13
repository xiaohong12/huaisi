<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y :show-scrollbar="false">
      <view class="pad-x feed">
        <template v-if="loading">
          <view class="skeleton-card">
            <view class="sk-row">
              <view class="sk-avatar" />
              <view class="sk-lines">
                <view class="sk-line sk-line-short" />
                <view class="sk-line sk-line-long" />
              </view>
            </view>
            <view class="sk-line sk-line-title" />
            <view class="sk-line sk-line-long" />
            <view class="sk-grid">
              <view v-for="n in 3" :key="n" class="sk-thumb" />
            </view>
          </view>
        </template>
        <template v-else-if="needLogin">
          <view class="feed-empty">
            <text class="feed-empty-text">登录后即可查看收藏的帖子</text>
          </view>
        </template>
        <template v-else>
          <PostCard
            v-for="post in postList"
            :key="post.id"
            :post="post"
            hide-interactions
            :show-comments="false"
          />
          <view v-if="!postList.length" class="feed-empty">
            <text class="feed-empty-text">暂无收藏，在首页帖子卡片上点心形即可收藏</text>
          </view>
        </template>
      </view>
      <view class="scroll-bottom-space" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import PostCard from "@/components/PostCard.vue";
import { getMyFavoritePostsApi } from "@/api/post";
import { mapPostFeedItemToCard, type HomePostCard } from "@/utils/postFeedMap";

const postList = ref<HomePostCard[]>([]);
const loading = ref(true);
const needLogin = ref(false);

/**
 * 拉取当前用户收藏帖子列表；未登录时标记 needLogin，不发起请求。
 */
const loadFavorites = async () => {
  if (!uni.getStorageSync("token")) {
    needLogin.value = true;
    loading.value = false;
    postList.value = [];
    return;
  }
  needLogin.value = false;
  loading.value = true;
  try {
    const res = await getMyFavoritePostsApi(1, 50);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data?.list) {
      postList.value = res.data.list.map(mapPostFeedItemToCard);
    } else if (res.code === 401) {
      needLogin.value = true;
      postList.value = [];
    } else {
      postList.value = [];
      uni.showToast({ title: res.message || "加载失败", icon: "none" });
    }
  } catch {
    postList.value = [];
    uni.showToast({ title: "网络异常", icon: "none" });
  } finally {
    loading.value = false;
  }
};

onShow(() => {
  void loadFavorites();
});

onPullDownRefresh(() => {
  void loadFavorites().finally(() => {
    uni.stopPullDownRefresh();
  });
});
</script>

<style scoped>
.page {
  height: 100vh;
  background: #f5f5f5;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.scroll {
  flex: 1;
  height: 0;
  box-sizing: border-box;
}

.pad-x {
  padding-left: 16rpx;
  padding-right: 16rpx;
}

.feed {
  padding-top: 16rpx;
  padding-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.feed-empty {
  padding: 120rpx 24rpx;
  align-items: center;
  justify-content: center;
}

.feed-empty-text {
  font-size: 28rpx;
  color: #94a3b8;
  text-align: center;
  line-height: 1.5;
}

.scroll-bottom-space {
  height: 48rpx;
}

/* 与首页一致的骨架占位 */
.skeleton-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(15, 23, 42, 0.06);
}

.sk-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.sk-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
  background-size: 200% 100%;
  animation: sk-shine 1.2s ease-in-out infinite;
}

.sk-lines {
  flex: 1;
  margin-left: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sk-line {
  height: 24rpx;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
  background-size: 200% 100%;
  animation: sk-shine 1.2s ease-in-out infinite;
}

.sk-line-short {
  width: 40%;
}

.sk-line-long {
  width: 72%;
}

.sk-line-title {
  margin-top: 20rpx;
  height: 36rpx;
  width: 85%;
}

.sk-grid {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  gap: 12rpx;
}

.sk-thumb {
  flex: 1;
  height: 200rpx;
  border-radius: 16rpx;
  background: linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%);
  background-size: 200% 100%;
  animation: sk-shine 1.2s ease-in-out infinite;
}

@keyframes sk-shine {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
