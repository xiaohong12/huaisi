<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
      <view class="blur-dot dot-right" />
    </view>

    <view class="content">
      <view class="head-block">
        <text class="head-title">我的订单</text>
      </view>

      <!-- 全部 / 待支付 / 已支付 胶囊切换（全部在最左侧） -->
      <view v-if="!needLogin" class="capsule-wrap">
        <view class="capsule">
          <view
            class="capsule-item"
            :class="{ 'capsule-item--active': filterPaymentStatus === 'all' }"
            @click="setFilterPaymentStatus('all')"
          >
            <text class="capsule-item-t">全部</text>
          </view>
          <view
            class="capsule-item"
            :class="{ 'capsule-item--active': filterPaymentStatus === 0 }"
            @click="setFilterPaymentStatus(0)"
          >
            <text class="capsule-item-t">待支付</text>
          </view>
          <view
            class="capsule-item"
            :class="{ 'capsule-item--active': filterPaymentStatus === 1 }"
            @click="setFilterPaymentStatus(1)"
          >
            <text class="capsule-item-t">已支付</text>
          </view>
        </view>
      </view>

      <view v-if="loading" class="state-block">
        <u-loading-icon mode="circle" size="28" />
        <text class="state-text">加载中…</text>
      </view>

      <view v-else-if="needLogin" class="state-block">
        <text class="state-text">登录后即可查看订单</text>
      </view>

      <view v-else-if="list.length === 0" class="empty-card">
        <view class="empty-icon">订</view>
        <text class="empty-title">{{ emptyTitle }}</text>
        <text class="empty-desc">{{ emptyDesc }}</text>
      </view>

      <view v-else class="order-stack">
        <view v-for="item in list" :key="item.id" class="order-card">
          <view class="order-top">
            <text class="order-no">订单号 {{ item.orderNo }}</text>
            <view class="status-pill" :class="item.paymentStatus === 1 ? 'status-pill--paid' : ''">
              <text class="status-pill-t">{{ paymentStatusText(item.paymentStatus) }}</text>
            </view>
          </view>
          <!-- <text class="store-line">{{ item.storeName }}</text> -->
          <view class="goods-row">
            <image
              class="goods-cover"
              :src="resolveAssetUrl(item.firstCover)"
              mode="aspectFill"
            />
            <view class="goods-mid">
              <text class="goods-title">{{ displayGoodsTitle(item) }}</text>
              <text class="goods-qty">共 {{ item.totalQuantity ?? 0 }} 件</text>
              <text class="goods-time">{{ formatTime(item.createdAt) }}</text>
            </view>
            <view class="goods-right">
              <text class="goods-price">¥ {{ formatMoney(item.totalAmount) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { resolveAssetUrl } from "@/utils/request";
import { getMallOrderListApi, type MallOrderListItem } from "@/api/mallOrder";

const list = ref<MallOrderListItem[]>([]);
const loading = ref(true);
/** 未登录时不展示空列表卡片，与地址页一致 */
const needLogin = ref(false);
/** 胶囊筛选：all 全部 / 0 待支付 / 1 已支付 */
const filterPaymentStatus = ref<"all" | 0 | 1>("all");

/**
 * 切换支付状态筛选并重新拉取列表。
 */
const setFilterPaymentStatus = (v: "all" | 0 | 1) => {
  if (filterPaymentStatus.value === v) return;
  filterPaymentStatus.value = v;
  loadList();
};

/**
 * 空列表时的标题与说明（随胶囊变化）。
 */
const emptyTitle = computed(() => {
  if (filterPaymentStatus.value === "all") return "暂无订单";
  if (filterPaymentStatus.value === 0) return "暂无待支付订单";
  return "暂无已支付订单";
});
const emptyDesc = computed(() => {
  if (filterPaymentStatus.value === "all") return "去商城逛逛，下单后会出现在这里";
  if (filterPaymentStatus.value === 0) return "下单后未完成支付的订单会显示在这里";
  return "支付完成的订单会显示在这里";
});

/**
 * 将支付状态码转为列表角标文案。
 */
const paymentStatusText = (status: number) => (status === 1 ? "已支付" : "待支付");

/**
 * 首行商品标题：多件时追加「等 N 件」。
 */
const displayGoodsTitle = (item: MallOrderListItem) => {
  const t = (item.firstTitle || "").trim() || "商品";
  const n = item.itemCount || 0;
  if (n > 1) return `${t} 等${n}件`;
  return t;
};

/**
 * 金额展示为两位小数。
 */
const formatMoney = (n: number) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  return v.toFixed(2);
};

/**
 * 将后端时间格式化为可读短文案。
 */
const formatTime = (raw: string) => {
  if (!raw) return "";
  const s = raw.replace("T", " ").slice(0, 19);
  return s;
};

/**
 * 未登录时提示并可跳转登录页。
 */
const ensureToken = (): boolean => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (token) return true;
  uni.showModal({
    title: "提示",
    content: "请先登录后再查看订单",
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
 * 拉取当前用户订单列表（第一页，每页 50 条足够个人中心使用）。
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
    const listParams: { page: number; pageSize: number; paymentStatus?: 0 | 1 } = {
      page: 1,
      pageSize: 50,
    };
    if (filterPaymentStatus.value === 0 || filterPaymentStatus.value === 1) {
      listParams.paymentStatus = filterPaymentStatus.value;
    }
    const res = await getMallOrderListApi(listParams);
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
    uni.stopPullDownRefresh();
  }
};

onShow(() => {
  loadList();
});

onPullDownRefresh(() => {
  loadList();
});
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

.head-block {
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.head-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
}

.head-desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.capsule-wrap {
  margin-bottom: 18rpx;
  display: flex;
}

.capsule {
  display: flex;
  align-items: center;
  padding: 4rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 4rpx 14rpx rgba(15, 23, 42, 0.05);
  border: 1rpx solid rgba(226, 232, 240, 0.9);
}

.capsule-item {
  min-width: 112rpx;
  height: 56rpx;
  min-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.capsule-item--active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 4rpx 12rpx rgba(37, 99, 235, 0.22);
}

.capsule-item-t {
  font-size: 24rpx;
  font-weight: 600;
  color: #64748b;
  line-height: 1.2;
  text-align: center;
}

.capsule-item--active .capsule-item-t {
  color: #ffffff;
}

.state-block {
  padding: 80rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.state-text {
  font-size: 28rpx;
  color: #64748b;
}

.empty-card {
  margin-top: 40rpx;
  padding: 56rpx 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
  align-items: center;
  text-align: center;
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.05);
}

.empty-icon {
  width: 88rpx;
  height: 88rpx;
  margin: 0 auto 20rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #0f172a;
}

.empty-desc {
  margin-top: 12rpx;
  display: block;
  font-size: 26rpx;
  color: #94a3b8;
}

.order-stack {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.order-card {
  padding: 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.05);
}

.order-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.order-no {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #64748b;
}

.status-pill {
  flex-shrink: 0;
  padding: 0 16rpx;
  min-height: 44rpx;
  border-radius: 999rpx;
  background: rgba(245, 158, 11, 0.12);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.status-pill--paid {
  background: rgba(34, 197, 94, 0.12);
}

.status-pill-t {
  font-size: 22rpx;
  font-weight: 600;
  color: #d97706;
  line-height: 1;
  text-align: center;
}

.status-pill--paid .status-pill-t {
  color: #16a34a;
}

.store-line {
  margin-top: 10rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
}

.goods-row {
  margin-top: 18rpx;
  display: flex;
  align-items: flex-start;
}

.goods-cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background: #f1f5f9;
  flex-shrink: 0;
}

.goods-mid {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.goods-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
}

.goods-qty {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.goods-time {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #94a3b8;
}

.goods-right {
  margin-left: 12rpx;
  flex-shrink: 0;
}

.goods-price {
  font-size: 30rpx;
  font-weight: 700;
  color: #ff5000;
}
</style>
