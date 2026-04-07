<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y :show-scrollbar="false">
      <!-- 顶部轮播：辰星文化 -->
      <view class="pad-x">
        <swiper
          class="banner-swiper"
          circular
          autoplay
          interval="4500"
          duration="500"
          indicator-dots
          indicator-color="rgba(255,255,255,0.45)"
          indicator-active-color="#ffffff"
        >
          <swiper-item v-for="item in bannerList" :key="item.id">
            <view class="banner-card">
              <view class="banner-inner">
                <view class="banner-text-wrap">
                  <text class="banner-title">{{ item.title }}</text>
                  <text class="banner-sub">文化 · 社区 · 创作</text>
                </view>
                <view class="banner-art" aria-hidden="true">
                  <view class="art-reel" />
                  <view class="art-clap" />
                  <view class="art-note note-1" />
                  <view class="art-note note-2" />
                </view>
              </view>
            </view>
          </swiper-item>
        </swiper>
      </view>

      <!-- 版块入口 -->
      <view class="pad-x section-row">
        <view
          v-for="s in sectionList"
          :key="s.id"
          class="section-card"
          :class="'theme-' + s.theme"
        >
          <view class="section-icon">{{ s.emoji }}</view>
          <text class="section-name">{{ s.name }}</text>
          <text v-if="s.sub" class="section-sub">{{ s.sub }}</text>
        </view>
      </view>

      <!-- 帖子流：GET /api/posts 拉取；加载中骨架 / 空状态 -->
      <view class="pad-x feed">
        <template v-if="feedLoading">
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
        <template v-else>
          <PostCard
            v-for="post in postList"
            :key="post.id"
            :post="post"
            @more="onMore"
            @update-post="onUpdatePost"
            @update-comment-count="onUpdateCommentCount"
          />
          <view v-if="!postList.length" class="feed-empty">
            <text class="feed-empty-text">暂无动态，发布一条试试吧</text>
          </view>
        </template>
      </view>

      <view class="scroll-bottom-space" />
    </scroll-view>

    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { storeToRefs } from "pinia";
import { HOME_FEED_REFRESH_FLAG } from "@/constants/storageKeys";
import CustomTabBar from "@/components/CustomTabBar.vue";
import PostCard from "@/components/PostCard.vue";
import type { PostFeedItemDTO } from "@/api/post";
import { useHomeFeedStore } from "@/stores/homeFeed";

/** 首页帖子流状态与缓存由 Pinia 管理 */
const homeFeed = useHomeFeedStore();
const { postList, feedLoading } = storeToRefs(homeFeed);

/** 轮播项（静态占位，后续可接 banners 接口） */
const bannerList = [
  { id: 1, title: "辰星文化" },
  { id: 2, title: "辰星文化" },
];

/** 首页版块入口静态数据 */
const sectionList = [
  { id: "a", name: "版块A", sub: "电影文化", theme: "blue", emoji: "🎬" },
  { id: "b", name: "版块B", sub: "动漫/协会", theme: "orange", emoji: "🎮" },
  { id: "more", name: "更多项目", sub: "", theme: "purple", emoji: "🎵" },
];

/**
 * 首次进入：先尝试本地缓存再请求（逻辑在 store）；发布成功回跳则强制拉最新。
 */
onLoad(() => {
  void homeFeed.loadFeed({ force: false });
});

onShow(() => {
  if (uni.getStorageSync(HOME_FEED_REFRESH_FLAG)) {
    uni.removeStorageSync(HOME_FEED_REFRESH_FLAG);
    void homeFeed.loadFeed({ force: true });
  }
});

/**
 * 帖子右上角更多菜单（仅占位，不接接口）
 */
const onMore = (_id: number) => {
  uni.showToast({ title: "更多操作待接入", icon: "none" });
};

/**
 * 点赞/收藏接口返回整帖 DTO 后，替换列表中对应项以重渲染该卡。
 */
const onUpdatePost = (dto: PostFeedItemDTO) => {
  homeFeed.updatePost(dto);
};

/**
 * 发表评论后同步该帖在列表上的评论数。
 */
const onUpdateCommentCount = (p: { postId: number; commentCount: number }) => {
  homeFeed.updateCommentCount(p);
};
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

/* 水平方向与屏幕边界保持 16rpx（项目规范） */
.pad-x {
  padding-left: 16rpx;
  padding-right: 16rpx;
}

/* —— 轮播 —— */
.banner-swiper {
  width: 100%;
  height: 300rpx;
  margin-top: 16rpx;
}

.banner-card {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
  overflow: hidden;
  background: linear-gradient(125deg, #1d4ed8 0%, #2563eb 38%, #38bdf8 100%);
  box-shadow: 0 12rpx 32rpx rgba(37, 99, 235, 0.28);
}

.banner-inner {
  height: 100%;
  padding: 28rpx 28rpx 36rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.banner-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.banner-title {
  font-size: 48rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.banner-sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* 右侧装饰：胶片 / 场记板 / 音符（示意） */
.banner-art {
  position: relative;
  width: 200rpx;
  height: 180rpx;
}

.art-reel {
  position: absolute;
  right: 8rpx;
  top: 16rpx;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: 6rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 0 0 6rpx rgba(255, 255, 255, 0.2);
}

.art-reel::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28rpx;
  height: 28rpx;
  margin: -14rpx 0 0 -14rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
}

.art-clap {
  position: absolute;
  right: 96rpx;
  bottom: 28rpx;
  width: 72rpx;
  height: 56rpx;
  border-radius: 8rpx;
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  border: 4rpx solid rgba(255, 255, 255, 0.85);
}

.art-clap::before {
  content: "";
  position: absolute;
  left: 6rpx;
  right: 6rpx;
  top: 8rpx;
  height: 8rpx;
  background: repeating-linear-gradient(
    90deg,
    #fbbf24 0,
    #fbbf24 8rpx,
    #1e293b 8rpx,
    #1e293b 14rpx
  );
  border-radius: 2rpx;
}

.art-note {
  position: absolute;
  width: 16rpx;
  height: 22rpx;
  background: #ffffff;
  border-radius: 2rpx;
}

.art-note::after {
  content: "";
  position: absolute;
  left: 4rpx;
  top: -10rpx;
  width: 2rpx;
  height: 12rpx;
  background: #ffffff;
}

.note-1 {
  right: 0;
  bottom: 72rpx;
  transform: rotate(-12deg);
}

.note-2 {
  right: 28rpx;
  bottom: 96rpx;
  transform: rotate(18deg);
}

/* —— 版块三卡 —— */
.section-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 24rpx;
}

.section-card {
  flex: 1;
  min-width: 0;
  border-radius: 20rpx;
  padding: 20rpx 12rpx 22rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.theme-blue {
  background: linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%);
}

.theme-orange {
  background: linear-gradient(160deg, #fffbeb 0%, #fef3c7 100%);
}

.theme-purple {
  background: linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%);
}

.section-icon {
  font-size: 40rpx;
  line-height: 1;
  margin-bottom: 10rpx;
}

.section-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.section-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #6b7280;
  text-align: center;
}

/* —— 帖子 —— */
.feed {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.feed-empty {
  display: flex;
  padding: 48rpx 24rpx 80rpx;
  align-items: center;
  justify-content: center;
}

.feed-empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}

/* —— 骨架 —— */
.skeleton-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 8rpx;
  box-shadow: 0 8rpx 28rpx rgba(15, 23, 42, 0.04);
}

.sk-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
}

.sk-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
}

.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sk-line {
  height: 22rpx;
  border-radius: 8rpx;
  background: #e5e7eb;
}

.sk-line-short {
  width: 40%;
}

.sk-line-long {
  width: 85%;
}

.sk-line-title {
  margin-top: 20rpx;
  width: 55%;
  height: 28rpx;
}

.sk-grid {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  gap: 12rpx;
}

.sk-thumb {
  flex: 1;
  width: 0;
  height: 200rpx;
  border-radius: 16rpx;
  background: #e5e7eb;
}

.scroll-bottom-space {
  height: calc(180rpx + env(safe-area-inset-bottom));
}
</style>
