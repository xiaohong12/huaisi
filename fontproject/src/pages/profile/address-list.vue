<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
      <view class="blur-dot dot-right" />
    </view>

    <view class="content">
      <view class="head-block">
        <text class="head-title">收货地址</text>
        <text class="head-desc">左滑可编辑或删除</text>
      </view>

      <view v-if="loading" class="state-block">
        <u-loading-icon mode="circle" size="28" />
        <text class="state-text">加载中…</text>
      </view>

      <view v-else-if="needLogin" class="state-block">
        <text class="state-text">登录后即可管理收货地址</text>
      </view>

      <view v-else-if="list.length === 0" class="empty-card">
        <view class="empty-icon">址</view>
        <text class="empty-title">暂无收货地址</text>
        <text class="empty-desc">添加常用地址，下单更快捷</text>
      </view>

      <u-swipe-action v-else>
        <view v-for="item in list" :key="item.id" class="swipe-wrap">
          <u-swipe-action-item :name="item.id" :options="swipeOptions" @click="onSwipeClick">
            <view class="addr-card" @click="goEdit(item.id)">
              <view class="addr-top">
                <text class="addr-name">{{ item.consignee }}</text>
                <text class="addr-phone">{{ item.phone }}</text>
                <view v-if="item.isDefault" class="default-tag">默认</view>
              </view>
              <text class="addr-line">{{ formatFullAddress(item) }}</text>
            </view>
          </u-swipe-action-item>
        </view>
      </u-swipe-action>
    </view>

    <view class="footer-safe">
      <u-button
        type="primary"
        shape="circle"
        text="新增收货地址"
        :custom-style="addBtnStyle"
        @click="goCreate"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
  deleteUserAddressApi,
  getUserAddressListApi,
  type UserAddressDTO,
} from "@/api/userAddress";

/** 左滑露出的操作按钮：编辑（蓝）、删除（红），与 u-swipe-action-item 的 options 约定一致 */
const swipeOptions = [
  { text: "编辑", style: { backgroundColor: "#2563eb" } },
  { text: "删除", style: { backgroundColor: "#ef4444" } },
];

const addBtnStyle =
  "width: 100%; height: 88rpx; font-size: 30rpx; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none;";

const list = ref<UserAddressDTO[]>([]);
const loading = ref(true);
/** 未登录时不展示「空列表」卡片，避免与登录提示冲突 */
const needLogin = ref(false);

/**
 * 拼接展示用的一行地址文案。
 */
const formatFullAddress = (item: UserAddressDTO) => {
  const r = (item.region || "").trim();
  const d = (item.detail || "").trim();
  if (r && d) return `${r} ${d}`;
  return d || r || "—";
};

/**
 * 未登录时提示并返回上一页或去登录。
 */
const ensureToken = (): boolean => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (token) return true;
  uni.showModal({
    title: "提示",
    content: "请先登录后再管理地址",
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

/**
 * 请求地址列表并写入 list。
 */
const loadList = async () => {
  if (!uni.getStorageSync("token")) {
    needLogin.value = true;
    loading.value = false;
    list.value = [];
    ensureToken();
    return;
  }
  needLogin.value = false;
  loading.value = true;
  try {
    const res = await getUserAddressListApi();
    if (res.code !== 0 || !res.data) {
      uni.showToast({ title: res.message || "加载失败", icon: "none" });
      list.value = [];
      return;
    }
    list.value = res.data.list || [];
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
    list.value = [];
  } finally {
    loading.value = false;
  }
};

/**
 * 左滑按钮点击：index 0 编辑，1 删除。
 */
const onSwipeClick = (e: { index: number; name: string | number }) => {
  const id = Number(e.name);
  const row = list.value.find((a) => a.id === id);
  if (!row) return;
  if (e.index === 0) {
    uni.navigateTo({ url: `/pages/profile/address-edit?id=${id}` });
    return;
  }
  if (e.index === 1) {
    uni.showModal({
      title: "删除地址",
      content: "确定删除该收货地址吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const del = await deleteUserAddressApi(id);
          if (del.code !== 0) {
            uni.showToast({ title: del.message || "删除失败", icon: "none" });
            return;
          }
          uni.showToast({ title: "已删除", icon: "success" });
          await loadList();
        } catch {
          uni.showToast({ title: "网络异常", icon: "none" });
        }
      },
    });
  }
};

const goCreate = () => {
  if (!ensureToken()) return;
  uni.navigateTo({ url: "/pages/profile/address-edit" });
};

const goEdit = (id: number) => {
  uni.navigateTo({ url: `/pages/profile/address-edit?id=${id}` });
};

onShow(() => {
  void loadList();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #dbeafe 0%, #f0f6ff 420rpx, #f8fafc 100%);
  position: relative;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.hero-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 200rpx;
  overflow: hidden;
  pointer-events: none;
}

.blur-dot {
  position: absolute;
  border-radius: 50%;
  filter: blur(2rpx);
}

.dot-left {
  width: 240rpx;
  height: 240rpx;
  left: -60rpx;
  top: -100rpx;
  background: radial-gradient(circle, rgba(66, 120, 255, 0.26) 0%, rgba(66, 120, 255, 0) 72%);
}

.dot-right {
  width: 220rpx;
  height: 220rpx;
  right: -50rpx;
  top: -70rpx;
  background: radial-gradient(circle, rgba(96, 224, 196, 0.22) 0%, rgba(96, 224, 196, 0) 72%);
}

.content {
  padding: 24rpx 16rpx 32rpx;
  position: relative;
  z-index: 1;
}

.head-block {
  margin-bottom: 20rpx;
  padding: 8rpx 4rpx 4rpx;
}

.head-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.head-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #64748b;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
  gap: 16rpx;
}

.state-text {
  font-size: 26rpx;
  color: #64748b;
}

.empty-card {
  margin-top: 24rpx;
  padding: 56rpx 32rpx;
  border-radius: 28rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f8fbff 100%);
  align-items: center;
  text-align: center;
  box-shadow: 0 12rpx 36rpx rgba(24, 42, 84, 0.07);
  border: 1rpx solid rgba(255, 255, 255, 0.9);
}

.empty-icon {
  width: 88rpx;
  height: 88rpx;
  margin: 0 auto 20rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%);
  color: #fff;
  font-size: 36rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1e293b;
}

.empty-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #94a3b8;
}

.swipe-wrap {
  margin-bottom: 16rpx;
  border-radius: 16rpx;
  overflow: hidden;
  /* 底层先铺白，避免滑动层高度计算误差时露出页面背景 */
  background-color: #ffffff;
}

.swipe-wrap:last-child {
  margin-bottom: 0;
}

.addr-card {
  padding: 18rpx 20rpx;
  background: #ffffff;
  border: none;
}

.addr-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx 14rpx;
}

.addr-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.addr-phone {
  font-size: 24rpx;
  color: #64748b;
}

.default-tag {
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  font-weight: 600;
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.12);
}

.addr-line {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.45;
  color: #64748b;
}

/* 滑动单元格：整体与内容区纯白 */
:deep(.u-swipe-action-item) {
  background-color: #ffffff !important;
}

:deep(.u-swipe-action-item__content) {
  background-color: #ffffff !important;
  border: none !important;
  box-shadow: none !important;
}

/* 右侧操作条：白底垫底 + 按钮纵向拉满，消除上下露出的页面背景 */
:deep(.u-swipe-action-item__right) {
  background-color: #ffffff !important;
  align-items: stretch !important;
}

:deep(.u-swipe-action-item__right__button) {
  align-self: stretch !important;
  display: flex !important;
}

:deep(.u-swipe-action-item__right__button__wrapper) {
  flex: 1 !important;
  width: 100% !important;
  min-height: 100% !important;
  box-sizing: border-box !important;
}

.footer-safe {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 16rpx calc(16rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, #f8fafc 28%);
  z-index: 20;
}
</style>
