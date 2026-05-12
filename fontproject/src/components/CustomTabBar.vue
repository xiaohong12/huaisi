<template>
  <view class="tabbar-wrap">
    <view class="tabbar">
      <view class="tab-item" :class="{ active: isActive('/pages/index/index') }" @click="go('/pages/index/index')">
        <image class="icon-img" :src="isActive('/pages/index/index') ? homeAcIcon : homeIcon" mode="aspectFit" />
        <text class="label">首页</text>
      </view>

      <view
        class="tab-item"
        :class="{ active: isActive('/pages/discover/index') }"
        @click="go('/pages/discover/index')"
      >
        <image class="icon-img" :src="isActive('/pages/discover/index') ? shopAcIcon : shopIcon" mode="aspectFit" />
        <text class="label">商城</text>
      </view>

      <view class="publish-wrap" @click="publish">
        <view class="publish-btn">
          <text class="publish-plus">+</text>
        </view>
      </view>

      <view class="tab-item" :class="{ active: isActive('/pages/order/index') }" @click="go('/pages/order/index')">
        <image class="icon-img" :src="isActive('/pages/order/index') ? orderAcIcon : orderIcon" mode="aspectFit" />
        <text class="label">聊天</text>
      </view>

      <view class="tab-item" :class="{ active: isActive('/pages/profile/index') }" @click="go('/pages/profile/index')">
        <image class="icon-img" :src="isActive('/pages/profile/index') ? meAcIcon : meIcon" mode="aspectFit" />
        <text class="label">我的</text>
      </view>
    </view>
  </view>

  <!-- 置于 tabbar 外层，保证遮罩盖住整页；圆角由 round 控制 -->
  <u-action-sheet
    v-model:show="showPublishSheet"
    :actions="publishActions"
    cancel-text="取消"
    :round="20"
    @select="onPublishActionSelect"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import homeIcon from "@/static/tabbar/home.png";
import homeAcIcon from "@/static/tabbar/homeac.png";
import shopIcon from "@/static/tabbar/shop.png";
import shopAcIcon from "@/static/tabbar/shopac.png";
import orderIcon from "@/static/tabbar/chat.png";
import orderAcIcon from "@/static/tabbar/chatac.png";
import meIcon from "@/static/tabbar/me.png";
import meAcIcon from "@/static/tabbar/meac.png";

/** 发布上拉菜单是否展示 */
const showPublishSheet = ref(false);

/**
 * 发布入口上拉菜单选项：
 * - name：展示文案；
 * - sectionKey：与后端 PublishSectionKey / sections.name 对应。
 */
const publishActions = [
  { name: "电影文化", sectionKey: "film_culture" },
  { name: "动漫/协会", sectionKey: "anime_association" },
  { name: "其他模块", sectionKey: "other" },
] as const;

/**
 * 计算当前页面路径，用于底部导航高亮判断。
 */
const currentPath = computed(() => {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return current ? `/${current.route}` : "";
});

/** 聊天页路径：作为二级页 navigateTo 打开，不在各 Tab 根页内嵌显示 */
const CHAT_PAGE_PATH = "/pages/order/index";

/**
 * 判断指定路径是否为当前激活页。
 */
const isActive = (path: string) => currentPath.value === path;

/**
 * 底部导航跳转：首页/商城/我的用 redirectTo 切换根页；聊天用 navigateTo 进入二级页（带返回）。
 */
const go = (path: string) => {
  if (path === currentPath.value) return;
  if (path === CHAT_PAGE_PATH) {
    uni.navigateTo({ url: path });
    return;
  }
  uni.redirectTo({ url: path });
};

/**
 * 打开中间发布按钮对应的上拉菜单，供用户选择发布类型。
 */
const publish = () => {
  showPublishSheet.value = true;
};

/**
 * 用户在上拉菜单中选择发布类型后，携带展示名与 sectionKey 进入发布页。
 */
const onPublishActionSelect = (item: { name?: string; sectionKey?: string }) => {
  const label = item?.name || "";
  const sectionKey = item?.sectionKey || "";
  if (!label || !sectionKey) return;
  showPublishSheet.value = false;
  uni.navigateTo({
    url: `/pages/publish/index?category=${encodeURIComponent(label)}&sectionKey=${encodeURIComponent(sectionKey)}`,
  });
};
</script>

<style scoped>
.tabbar-wrap {
  position: fixed;
  width: 100%;
  z-index: 999;
  bottom: 0rpx;
 
}

.tabbar {
  height: 122rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  box-shadow: 0 8rpx 30rpx rgba(28, 34, 46, 0.12);
  padding: 0rpx 20px 40rpx;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  color: #4b5563;
  gap: 10rpx;
}

.icon-img {
  width: 44rpx;
  height: 44rpx;
}

.label {
  line-height: 1;
  font-size:22rpx;
}

.active {
  color: #0d5aff;
  font-weight: 600;
}

.publish-wrap {
  width: 96rpx;
  display: flex;
  justify-content: center;
}

.publish-btn {
  width: 76rpx;
  height: 76rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #2a79ff 0%, #0d5aff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 24rpx rgba(13, 90, 255, 0.35);
}

.publish-plus {
  color: #ffffff;
  font-size: 52rpx;
  font-weight: 500;
  line-height: 1;
  transform: translateY(-2rpx);
}
</style>
