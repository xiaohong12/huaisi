<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
      <view class="blur-dot dot-right" />
    </view>

    <view class="content">
      <view class="user-card" @click="goUserInfo">
        <u-avatar :src="displayUser.avatar" size="52" />
        <view class="user-main">
          <text class="username">{{ displayUser.username }}</text>
        </view>
        <view class="profile-tag">个人主页</view>
        <u-icon name="arrow-right" size="14" color="#94a3b8" />
      </view>

      <view class="quick-panel">
        <view class="quick-item" @click="goOrderList">
          <text class="quick-value">{{ orderCountText }}</text>
          <text class="quick-label">订单</text>
        </view>
        <view class="quick-divider" />
        <view class="quick-item" @click="goFavorites">
          <text class="quick-value">{{ favoriteCountText }}</text>
          <text class="quick-label">收藏</text>
        </view>
        <view class="quick-divider" />
        <view class="quick-item" @click="goMyPosts">
          <text class="quick-value">{{ publishCountText }}</text>
          <text class="quick-label">发布</text>
        </view>
      </view>

      <view class="section-title">我的服务</view>
      <u-cell-group :border="false" customStyle="border-radius: 24rpx; overflow: hidden;">
        <u-cell
          v-for="item in menuList"
          :key="item.key"
          :title="item.title"
          :label="item.desc"
          isLink
          size="large"
          :border="item.key !== menuList[menuList.length - 1].key"
          @click="handleMenuClick(item)"
        >
          <template #icon>
            <view class="menu-icon">{{ item.short }}</view>
          </template>
        </u-cell>
      </u-cell-group>

      <u-button
        :type="isLoggedIn ? 'error' : 'primary'"
        shape="circle"
        :text="isLoggedIn ? '退出登录' : '去登录'"
        customStyle="height: 86rpx; margin-top: 36rpx; font-size: 30rpx; font-weight: 600;"
        @click="handleAuthButton"
      />
    </view>
    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import CustomTabBar from "@/components/CustomTabBar.vue";
import { getMallOrderListApi } from "@/api/mallOrder";
import { getMyFavoritePostsApi, getMyPublishedPostsApi } from "@/api/post";
import { clearLocalLoginState } from "@/utils/clearAuthStorage";

/**
 * 本地缓存中的用户数据结构。
 */
interface LoginUser {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
}

/**
 * 我的页面功能项列表，按微信“我的”常见顺序展示。
 */
const menuList = [
  { key: "address", title: "地址管理", short: "址", desc: "" },
  { key: "security", title: "账号与安全", short: "安", desc: "" },
  { key: "version", title: "版本信息", short: "版", desc: "" },
];

/**
 * 根据本地缓存构建展示用的头像和用户名，保证未登录时也有默认值。
 */
const displayUser = computed(() => {
  const cacheUser = uni.getStorageSync("loginUser") as LoginUser | undefined;
  const username = cacheUser?.nickname || cacheUser?.username || "未登录用户";
  const avatar = cacheUser?.avatar || "";
  return { username, avatar };
});

/** 个人中心展示的订单数量；未登录或请求失败时显示占位 */
const orderTotal = ref<number | null>(null);

/** 帖子收藏总数；未登录或请求失败时显示占位 */
const favoriteTotal = ref<number | null>(null);

/** 已发布帖子总数；未登录或请求失败时显示占位 */
const publishTotal = ref<number | null>(null);

/** 是否已登录（与 token 一致；在 onShow 中刷新以适配从登录页返回） */
const isLoggedIn = ref(!!uni.getStorageSync("token"));

/**
 * 订单数量展示文案。
 */
const orderCountText = computed(() => {
  if (!uni.getStorageSync("token")) return "—";
  if (orderTotal.value === null) return "…";
  return String(orderTotal.value);
});

/**
 * 收藏数量展示文案。
 */
const favoriteCountText = computed(() => {
  if (!uni.getStorageSync("token")) return "—";
  if (favoriteTotal.value === null) return "…";
  return String(favoriteTotal.value);
});

/**
 * 已发布帖子数量展示文案。
 */
const publishCountText = computed(() => {
  if (!uni.getStorageSync("token")) return "—";
  if (publishTotal.value === null) return "…";
  return String(publishTotal.value);
});

/**
 * 进入我的订单列表页。
 */
const goOrderList = () => {
  uni.navigateTo({
    url: "/pages/profile/order-list",
  });
};

/**
 * 进入帖子收藏列表页。
 */
const goFavorites = () => {
  uni.navigateTo({
    url: "/pages/profile/favorites",
  });
};

/**
 * 进入我的发布列表页。
 */
const goMyPosts = () => {
  uni.navigateTo({ 
    url: "/pages/profile/my-posts",
  });
};

/**
 * 已登录时拉取订单总数，用于快捷区数字展示。
 */
const refreshOrderCount = async () => {
  if (!uni.getStorageSync("token")) {
    orderTotal.value = null;
    return;
  }
  try {
    const res = await getMallOrderListApi({ page: 1, pageSize: 1 });
    if (res.code === 0 && res.data) {
      orderTotal.value = res.data.total;
    } else {
      orderTotal.value = 0;
    }
  } catch {
    orderTotal.value = 0;
  }
};

/**
 * 拉取帖子收藏总数，用于快捷区数字展示。
 */
const refreshFavoriteCount = async () => {
  if (!uni.getStorageSync("token")) {
    favoriteTotal.value = null;
    return;
  }
  try {
    const res = await getMyFavoritePostsApi(1, 1);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data && typeof res.data.total === "number") {
      favoriteTotal.value = res.data.total;
    } else {
      favoriteTotal.value = 0;
    }
  } catch {
    favoriteTotal.value = 0;
  }
};

/**
 * 拉取已发布帖子总数，用于快捷区数字展示。
 */
const refreshPublishCount = async () => {
  if (!uni.getStorageSync("token")) {
    publishTotal.value = null;
    return;
  }
  try {
    const res = await getMyPublishedPostsApi(1, 1);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data && typeof res.data.total === "number") {
      publishTotal.value = res.data.total;
    } else {
      publishTotal.value = 0;
    }
  } catch {
    publishTotal.value = 0;
  }
};

onShow(() => {
  isLoggedIn.value = !!uni.getStorageSync("token");
  refreshOrderCount();
  void refreshFavoriteCount();
  void refreshPublishCount();
});

/**
 * 点击用户卡片：已登录进入个人信息页；未登录跳转登录页。
 */
const goUserInfo = () => {
  if (!uni.getStorageSync("token")) {
    uni.navigateTo({ url: "/pages/login/index" });
    return;
  }
  uni.navigateTo({
    url: "/pages/profile/user-info",
  });
};

/**
 * 点击功能项时进行路由占位提示，便于后续逐项接入真实页面。
 */
const handleMenuClick = (item: { key: string; title: string; short: string; desc: string }) => {
  if (item.key === "version") {
    uni.showModal({
      title: "版本信息",
      content: "当前版本：v1.0.0",
      showCancel: false,
    });
    return;
  }
  if (item.key === "address") {
    uni.navigateTo({
      url: "/pages/profile/address-list",
    });
    return;
  }
  if (item.key === "security") {
    uni.navigateTo({
      url: "/pages/profile/security",
    });
    return;
  }
  uni.showToast({
    title: `${item.title}功能开发中`,
    icon: "none",
  });
};

/**
 * 底部主按钮：未登录时跳转登录页；已登录时走退出流程。
 */
const handleAuthButton = () => {
  if (!isLoggedIn.value) {
    uni.navigateTo({ url: "/pages/login/index" });
    return;
  }
  handleLogout();
};

/**
 * 退出登录：清理 token 与用户缓存，并跳转到登录页重新登录。
 */
const handleLogout = () => {
  uni.showModal({
    title: "退出登录",
    content: "确认退出当前账号吗？",
    success: (res) => {
      if (!res.confirm) return;
      clearLocalLoginState();
      isLoggedIn.value = false;
      uni.reLaunch({
        url: "/pages/login/index",
      });
    },
  });
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
  padding: 26rpx 16rpx 220rpx;
  position: relative;
  z-index: 1;
}

.user-card {
  margin-bottom: 18rpx;
  padding: 22rpx 20rpx;
  border-radius: 24rpx;
  background: linear-gradient(128deg, #ffffff 0%, #f7fbff 100%);
  display: flex;
  align-items: center;
  box-shadow: 0 10rpx 28rpx rgba(24, 42, 84, 0.07);
  border: 1rpx solid rgba(255, 255, 255, 0.88);
}

.user-main {
  flex: 1;
  min-width: 0;
  margin-left: 16rpx;
}

.username {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.sub-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #64748b;
}

.profile-tag {
  margin-right: 8rpx;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  color: #2356d7;
  background: rgba(45, 97, 233, 0.1);
}

.quick-panel {
  margin-bottom: 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 20rpx;
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.05);
}

.quick-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quick-value {
  font-size: 34rpx;
  font-weight: 700;
  color: #1e3a8a;
  line-height: 1.1;
}

.quick-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
}

.quick-divider {
  width: 1rpx;
  height: 48rpx;
  background: #e2e8f0;
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
