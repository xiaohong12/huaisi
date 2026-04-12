<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y :show-scrollbar="false">
      <!-- 顶部轮播：对标淘宝商详主图区域 -->
      <swiper
        v-if="detailImages.length"
        class="gallery"
        circular
        indicator-dots
        indicator-color="rgba(0,0,0,0.25)"
        indicator-active-color="#ff4400"
      >
        <swiper-item v-for="(src, idx) in detailImages" :key="idx">
          <view class="gallery-slide">
            <view
              v-show="!isGallerySlideLoaded(idx)"
              class="gallery-slide-skel skel-shimmer"
            />
            <image
              class="gallery-img"
              :class="{ 'gallery-img--pending': !isGallerySlideLoaded(idx) }"
              :src="resolveAssetUrl(src)"
              mode="aspectFill"
              @load="onGallerySlideLoad(idx)"
              @error="onGallerySlideError(idx)"
            />
          </view>
        </swiper-item>
      </swiper>
      <view v-else class="gallery gallery--empty">
        <text class="empty-t">暂无图片</text>
      </view>

      <!-- 商品名称紧跟主图下方，与价格同卡、纵向留白 -->
      <view class="block title-block">
        <text class="title">{{ title }}</text>
        <!-- 价格与库存同一行：左价右库存；已收展示在价格右侧 -->
        <view class="price-sold-row">
          <view class="price-row">
            <text class="yen">¥</text>
            <text class="p-int">{{ priceParts.priceInt }}</text>
            <text class="p-dec">.{{ priceParts.priceDec }}</text>
            <text class="receive-line">已售 {{ formatSold(soldCount) }}</text>
          </view>
          <text class="sold-line">库存 {{ stockCount }}</text>
        </view>
      </view>

      <!-- 服务：有七天无理由则与极速发货一并展示，否则仅极速发货 -->
      <view class="block service-row">
        <text class="svc-label">服务</text>
        <view class="svc-val">
          <text v-if="sevenDayNoReason" class="txt-seven-day">七天无理由</text>
          <text v-if="sevenDayNoReason" class="svc-dot"> · </text>
          <text class="svc-fast">极速发货</text>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">宝贝详情</text>
      </view>
      <view class="block detail-text-block">
        <text class="detail-text">{{ description || "暂无详细说明" }}</text>
      </view>

      <!-- 详情长图：首张已在轮播展示，其余图纵向铺开（贴近淘宝详情页） -->
      <view
        v-for="(src, idx) in detailImages.slice(1)"
        :key="'d' + idx"
        class="detail-img-wrap"
      >
        <image class="detail-long-img" :src="resolveAssetUrl(src)" mode="widthFix" lazy-load />
      </view>

      <view class="scroll-bottom-space" />
    </scroll-view>

    <!-- 底部操作栏：客服 / 店铺 / 购物车 + 加购 / 购买 -->
    <view class="bottom-bar safe-bottom">
      <view class="bar-icon" @click="openCartSheet">
        <view class="bar-icon-stack">
          <image class="bar-icon-img" src="/static/image/shopping.png" mode="aspectFit" />
          <text
            v-show="plusOneVisible"
            class="cart-plus-one"
            :class="{ 'cart-plus-one--play': plusOneAnimating }"
          >
            +1
          </text>
        </view>
        <text class="bar-icon-t bar-icon-t--cart">购物车</text>
      </view>
      <view class="bar-btns">
        <view class="bar-cap">
          <view class="bar-cap-left" @click="onAddToCart">
            <text class="bar-cap-left-t">加入购物车</text>
          </view>
          <view class="bar-cap-right" @click="onBuyNow">
            <view class="bar-cap-price-line">
              <text class="bar-cap-hand-t">到手价 </text>
              <text class="bar-cap-yen-t">¥</text>
              <text class="bar-cap-num-t">{{ handPriceText }}</text>
            </view>
            <text class="bar-cap-buy-t">立即购买</text>
          </view>
        </view>
      </view>
    </view>

    <MallCartSheet v-model:show="cartSheetVisible" ref="cartSheetRef" />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { resolveAssetUrl } from "@/utils/request";
import { addMallCartApi, getMallProductDetailApi } from "@/api/mall";
import MallCartSheet from "@/components/MallCartSheet.vue";

const title = ref("");
const price = ref(0);
const soldCount = ref(0);
const stockCount = ref(0);
const description = ref("");
const detailImages = ref<string[]>([]);
/** 是否支持七天无理由（与列表接口字段一致） */
const sevenDayNoReason = ref(false);

/** 当前商品 id（加购、打开购物车用） */
const productId = ref(0);

/** 底部购物车弹层是否展示 */
const cartSheetVisible = ref(false);

/** 购物车弹层实例，加购成功后若弹层已开则刷新列表 */
const cartSheetRef = ref<InstanceType<typeof MallCartSheet> | null>(null);

/** +1 提示：显示节点 + 是否播放 1.5s 淡入淡出 */
const plusOneVisible = ref(false);
const plusOneAnimating = ref(false);
let plusOneTimer: ReturnType<typeof setTimeout> | null = null;

/** 轮播图每一张是否已加载（用于骨架层） */
const gallerySlideLoaded = ref<Record<number, boolean>>({});

const isGallerySlideLoaded = (idx: number) => gallerySlideLoaded.value[idx] === true;

const onGallerySlideLoad = (idx: number) => {
  if (gallerySlideLoaded.value[idx]) return;
  gallerySlideLoaded.value = { ...gallerySlideLoaded.value, [idx]: true };
};

const onGallerySlideError = (idx: number) => {
  onGallerySlideLoad(idx);
};

const priceParts = computed(() => {
  const [int, dec] = Number(price.value).toFixed(2).split(".");
  return { priceInt: int, priceDec: dec ?? "00" };
});

/** 底部「到手价」展示：与商详主价一致，保留两位小数 */
const handPriceText = computed(() => {
  const n = Number(price.value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
});

/**
 * 已售数量展示规则与列表页一致。
 */
const formatSold = (n: number) => {
  if (n >= 10000) {
    const w = n / 10000;
    const s = w >= 10 ? `${Math.floor(w)}` : `${w.toFixed(1)}`.replace(/\.0$/, "");
    return `${s}万`;
  }
  return `${n}`;
};

/**
 * 打开购物车底部弹层；未登录时提示先登录。
 */
const openCartSheet = () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  cartSheetVisible.value = true;
};

/**
 * 加购成功后，在购物车图标右上角播放与「购物车」文案同色（#ff4400）的 +1，约 1.5s 内淡入并淡出。
 */
const playCartPlusOne = () => {
  if (plusOneTimer) {
    clearTimeout(plusOneTimer);
    plusOneTimer = null;
  }
  plusOneAnimating.value = false;
  plusOneVisible.value = true;
  void nextTick(() => {
    plusOneAnimating.value = true;
  });
  plusOneTimer = setTimeout(() => {
    plusOneAnimating.value = false;
    plusOneVisible.value = false;
    plusOneTimer = null;
  }, 1500);
};

/**
 * 加入购物车：调用后端累加数量；成功则提示并播放 +1 动画，若购物车弹层已打开则刷新列表。
 */
const onAddToCart = async () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  const id = productId.value;
  if (!id) {
    uni.showToast({ title: "商品无效", icon: "none" });
    return;
  }
  const stock = Number(stockCount.value) || 0;
  if (stock <= 0) {
    uni.showToast({ title: "库存不足", icon: "none" });
    return;
  }
  try {
    const res = await addMallCartApi(id, 1);
    if (res.code !== 0) {
      uni.showToast({ title: res.message || "加购失败", icon: "none" });
      return;
    }
    uni.showToast({ title: "已加入购物车", icon: "success" });
    playCartPlusOne();
    if (cartSheetVisible.value) {
      cartSheetRef.value?.refresh?.();
    }
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
  }
};

/**
 * 立即购买：已登录且库存充足时进入确认下单页。
 */
const onBuyNow = () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  const id = productId.value;
  if (!id) {
    uni.showToast({ title: "商品无效", icon: "none" });
    return;
  }
  const s = Number(stockCount.value) || 0;
  if (s <= 0) {
    uni.showToast({ title: "库存不足", icon: "none" });
    return;
  }
  uni.navigateTo({
    url: `/pages/order/checkout?id=${id}&quantity=1`,
  });
};

/**
 * 根据商品 id 拉取详情并填充轮播与文案。
 */
const loadDetail = async (id: number) => {
  try {
    const res = await getMallProductDetailApi(id);
    if (res.code !== 0 || !res.data) {
      uni.showToast({ title: res.message || "加载失败", icon: "none" });
      setTimeout(() => uni.navigateBack(), 400);
      return;
    }
    const d = res.data;
    title.value = d.title;
    price.value = d.price;
    soldCount.value = d.soldCount;
    stockCount.value = Number(d.stock ?? 0) || 0;
    description.value = d.description;
    detailImages.value = d.detailImages?.length ? d.detailImages : d.coverUrl ? [d.coverUrl] : [];
    sevenDayNoReason.value = d.sevenDayNoReason === true;
    gallerySlideLoaded.value = {};
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
    setTimeout(() => uni.navigateBack(), 400);
  }
};

onLoad((query?: Record<string, string | undefined>) => {
  const id = parseInt(String(query?.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) {
    uni.showToast({ title: "无效商品", icon: "none" });
    setTimeout(() => uni.navigateBack(), 400);
    return;
  }
  productId.value = id;
  void loadDetail(id);
});
</script>

<style scoped>
.page {
  height: 100vh;
  background: #f3f4f6;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.scroll {
  flex: 1;
  height: 0;
  box-sizing: border-box;
}

.gallery {
  width: 100%;
  height: 750rpx;
  background: #ffffff;
}

.gallery--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-t {
  font-size: 28rpx;
  color: #9ca3af;
}

.gallery-slide {
  position: relative;
  width: 100%;
  height: 100%;
}

.gallery-slide-skel {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}

.gallery-img {
  width: 100%;
  height: 100%;
  display: block;
  position: relative;
  z-index: 0;
  transition: opacity 0.28s ease;
}

.gallery-img--pending {
  opacity: 0;
}

.skel-shimmer {
  background: linear-gradient(90deg, #ececec 0%, #f5f5f5 45%, #e8e8e8 100%);
  background-size: 200% 100%;
  animation: skel-flow 1.15s ease-in-out infinite;
}

@keyframes skel-flow {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.block {
  background: #ffffff;
  margin-bottom: 16rpx;
  padding-left: 16rpx;
  padding-right: 16rpx;
  box-sizing: border-box;
}

.price-sold-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.price-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-shrink: 0;
  gap: 8rpx;
}

.yen {
  font-size: 28rpx;
  font-weight: 700;
  color: #ff4400;
}

.p-int {
  font-size: 48rpx;
  font-weight: 800;
  color: #ff4400;
  line-height: 1;
}

.p-dec {
  font-size: 28rpx;
  font-weight: 700;
  color: #ff4400;
}

.receive-line {
  font-size: 24rpx;
  color: #999999;
  margin-left: 8rpx;
  flex-shrink: 0;
}

.sold-line {
  font-size: 24rpx;
  color: #999999;
  flex-shrink: 0;
}

.title-block {
  padding-top: 28rpx;
  padding-bottom: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 24rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.55;
}

.service-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 20rpx;
  padding-top: 20rpx;
  padding-bottom: 20rpx;
  font-size: 26rpx;
}

.svc-label {
  color: #9ca3af;
  flex-shrink: 0;
}

.svc-val {
  flex: 1;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  font-size: 26rpx;
  line-height: 1.45;
}

/* 与 discover 列表商品卡「七天无理由」同色同字号 */
.txt-seven-day {
  font-size: 22rpx;
  font-weight: 400;
  color: #ff5000;
  line-height: 1.3;
}

.svc-dot {
  color: #9ca3af;
}

.svc-fast {
  color: #4b5563;
  font-size: 22rpx;
}

.section-head {
  padding: 20rpx 16rpx 12rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.detail-text-block {
  padding-top: 8rpx;
  padding-bottom: 28rpx;
}

.detail-text {
  font-size: 28rpx;
  color: #4b5563;
  line-height: 1.6;
}

.detail-img-wrap {
  display: block;
  margin-bottom: 0;
  background: #ffffff;
}

.detail-long-img {
  display: block;
  width: 100%;
  vertical-align: top;
}

.scroll-bottom-space {
  height: calc(128rpx + env(safe-area-inset-bottom));
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #ffffff;
  border-top: 1rpx solid #e8e8e8;
  padding: 12rpx 12rpx 12rpx 8rpx;
  box-sizing: border-box;
}

.safe-bottom {
  padding-bottom: calc(12rpx + env(safe-area-inset-bottom));
}

.bar-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  gap: 4rpx;
}

.bar-icon-stack {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.cart-plus-one {
  position: absolute;
  right: -10rpx;
  top: -14rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #ff4400;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
}

.cart-plus-one--play {
  animation: cart-plus-one-fade 1.5s ease forwards;
}

@keyframes cart-plus-one-fade {
  0% {
    opacity: 0;
    transform: translateY(10rpx) scale(0.85);
  }
  18% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  72% {
    opacity: 1;
    transform: translateY(-4rpx) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-14rpx) scale(0.92);
  }
}

.bar-icon-dot {
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  font-size: 22rpx;
  font-weight: 600;
  color: #374151;
  background: #f3f4f6;
  border-radius: 999rpx;
}

.bar-icon-img {
  width: 44rpx;
  height: 44rpx;
  display: block;
}

.bar-icon-t {
  font-size: 20rpx;
  color: #6b7280;
}

.bar-icon-t--cart {
  color: #ff4400;
}

.bar-btns {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  margin-left: 8rpx;
  min-width: 0;
}

/* 胶囊一体按钮：宽度收窄，不占满右侧剩余区域 */
.bar-cap {
  flex: 0 1 auto;
  width: 400rpx;
  max-width: 100%;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 72rpx;
  border-radius: 999rpx;
  overflow: hidden;
  box-sizing: border-box;
}

.bar-cap-left {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff0f2;
  min-width: 0;
}

.bar-cap-left-t {
  font-size: 24rpx;
  font-weight: 600;
  color: #ff3355;
  text-align: center;
  line-height: 1.2;
}

.bar-cap-right {
  flex: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  padding: 6rpx 10rpx;
  box-sizing: border-box;
  background: #ff3355;
  min-width: 0;
}

.bar-cap-price-line {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  flex-wrap: nowrap;
}

.bar-cap-hand-t,
.bar-cap-yen-t {
  font-size: 20rpx;
  font-weight: 400;
  color: #ffffff;
  line-height: 1.2;
  text-align: center;
}

.bar-cap-num-t {
  font-size: 24rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.2;
  text-align: center;
}

/* 副文案：小于「到手价 + 金额」一行 */
.bar-cap-buy-t {
  font-size: 18rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.2;
  text-align: center;
}
</style>
