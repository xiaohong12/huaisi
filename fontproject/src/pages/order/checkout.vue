<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y :show-scrollbar="false">
      <!-- 收货地址（可跳转地址管理） -->
      <view class="addr-card" @click="goAddressList">
        <text class="addr-pin">📍</text>
        <view class="addr-mid">
          <text class="addr-line1">{{ addressLine1 }}</text>
          <text class="addr-line2">{{ addressLine2 }}</text>
        </view>
        <text class="addr-arrow">›</text>
      </view>

      <!-- 店铺 + 商品 -->
      <view class="block">
        <text class="store-name">{{ storeName }}</text>
        <view class="goods-row">
          <image class="goods-cover" :src="resolveAssetUrl(coverUrl)" mode="aspectFill" />
          <view class="goods-mid">
            <text class="goods-title">{{ productTitle }}</text>
            <text v-if="!sevenDayNoReason" class="goods-sub">不支持7天无理由退换</text>
          </view>
          <view class="goods-right">
            <text class="goods-price">¥ {{ unitPriceText }}</text>
            <view class="qty-box">
              <view class="qty-btn" @click.stop="decQty">−</view>
              <text class="qty-num">{{ quantity }}</text>
              <view class="qty-btn" @click.stop="incQty">+</view>
            </view>
          </view>
        </view>
      </view>

      <!-- 配送 / 发票 / 备注 -->
      <view class="cell-list">
        <view class="cell">
          <text class="cell-k">配送</text>
          <text class="cell-v">快递 ¥ {{ freightText }}</text>
        </view>
        <view class="cell">
          <text class="cell-k">发票</text>
          <text class="cell-v cell-v--muted">本次不开具发票</text>
        </view>
        <view class="cell cell--remark" @click="openRemarkModal">
          <text class="cell-k">备注</text>
          <text class="cell-v cell-v--muted cell-v--ellipsis">{{ remark || "无备注" }}</text>
        </view>
      </view>

      <!-- 价格明细 -->
      <view class="block price-block">
        <text class="price-title">价格明细</text>
        <view class="price-row">
          <text class="price-k">商品总价 共{{ quantity }}件宝贝</text>
          <text class="price-v">¥ {{ goodsTotalText }}</text>
        </view>
        <view class="price-row">
          <text class="price-k">运费</text>
          <text class="price-v">¥ {{ freightText }}</text>
        </view>
      </view>

      <!-- 支付方式 -->
      <view class="pay-head">
        <text class="pay-head-t">支付方式</text>
      </view>
      <view class="pay-list">
        <view
          v-for="p in payOptions"
          :key="p.method"
          class="pay-item"
          @click="selectPay(p.method)"
        >
          <view class="pay-icon" :style="{ background: p.bg }">
            <text class="pay-icon-t">{{ p.iconText }}</text>
          </view>
          <view class="pay-mid">
            <view class="pay-title-row">
              <text class="pay-title">{{ p.label }}</text>
              <text v-if="p.sub" class="pay-sub">{{ p.sub }}</text>
            </view>
          </view>
          <view class="radio" :class="{ 'radio--on': paymentMethod === p.method }">
            <text v-if="paymentMethod === p.method" class="radio-tick">✓</text>
          </view>
        </view>
      </view>

      <view class="scroll-space" />
    </scroll-view>

    <!-- 底部提交 -->
    <view class="bottom safe-bottom">
      <view class="bottom-inner" @click="submitOrder">
        <text class="bottom-t">提交订单 ¥ {{ payTotalText }}</text>
      </view>
    </view>

    <!-- 二维码支付弹层 -->
    <view v-if="qrModalVisible" class="modal-mask" @click.self="noop">
      <view class="modal-card">
        <text class="modal-title">请扫码支付</text>
        <image v-if="qrDataUrl" class="modal-qr" :src="qrDataUrl" mode="aspectFit" />
        <view class="modal-done" @click="onPaidTap">
          <text class="modal-done-t">已经支付</text>
        </view>
      </view>
    </view>

    <!-- 备注编辑：底部弹层，避免 scroll-view 内输入框被裁切或键盘遮挡 -->
    <view v-if="remarkModalVisible" class="remark-mask" @click="cancelRemarkModal">
      <view class="remark-sheet" @click.stop>
        <view class="remark-sheet-toolbar">
          <text class="remark-sheet-btn remark-sheet-btn--muted" @click="cancelRemarkModal">取消</text>
          <text class="remark-sheet-title">订单备注</text>
          <text class="remark-sheet-btn remark-sheet-btn--primary" @click="confirmRemarkModal">完成</text>
        </view>
        <view class="remark-sheet-body">
          <textarea
            v-model="remarkDraft"
            class="remark-textarea"
            :focus="remarkTextareaFocus"
            :maxlength="200"
            placeholder="选填，对配送或商品的特殊说明（200字以内）"
            :adjust-position="true"
            :cursor-spacing="48"
            :show-confirm-bar="false"
            auto-height
            @blur="remarkTextareaFocus = false"
          />
          <text class="remark-counter">{{ remarkDraft.length }}/200</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { resolveAssetUrl } from "@/utils/request";
import { getMallProductDetailApi } from "@/api/mall";
import { getUserAddressListApi, type UserAddressDTO } from "@/api/userAddress";
import {
  confirmMallOrderPaymentApi,
  createMallOrderApi,
  type MallPaymentMethod,
} from "@/api/mallOrder";

const productId = ref(0);
const quantity = ref(1);
const productTitle = ref("");
const coverUrl = ref("");
const unitPrice = ref(0);
const stock = ref(0);
const sevenDayNoReason = ref(true);
const storeName = ref("辰星文化商城");

const addressList = ref<UserAddressDTO[]>([]);
const remark = ref("");
/** 备注弹层是否展示 */
const remarkModalVisible = ref(false);
/** 弹层内编辑草稿，点「完成」再写回 remark */
const remarkDraft = ref("");
/** 控制 textarea 聚焦（打开弹层后 nextTick 置 true，避免真机不弹出键盘） */
const remarkTextareaFocus = ref(false);

const paymentMethod = ref<MallPaymentMethod>("alipay");

const FREIGHT = 8;

const qrModalVisible = ref(false);
const qrDataUrl = ref("");
const pendingOrderId = ref(0);

const payOptions = [
  {
    method: "alipay" as MallPaymentMethod,
    label: "支付宝",
    sub: "使用安全免密支付 | 修改 >",
    bg: "#1677ff",
    iconText: "支",
  },
  {
    method: "huabei" as MallPaymentMethod,
    label: "花呗",
    sub: "",
    bg: "#1677ff",
    iconText: "花",
  },
  {
    method: "friend_pay" as MallPaymentMethod,
    label: "找朋友帮忙付",
    sub: "",
    bg: "#7ac5ff",
    iconText: "友",
  },
  {
    method: "wechat" as MallPaymentMethod,
    label: "微信支付",
    sub: "",
    bg: "#07c160",
    iconText: "微",
  },
  {
    method: "qrcode" as MallPaymentMethod,
    label: "二维码支付",
    sub: "提交订单后展示收款码",
    bg: "#ff6600",
    iconText: "码",
  },
];

const selectedAddress = computed(() => {
  const list = addressList.value;
  if (!list.length) return null;
  const def = list.find((a) => a.isDefault);
  return def ?? list[0];
});

const addressLine1 = computed(() => {
  const a = selectedAddress.value;
  if (!a) return "请选择收货地址";
  const parts = [a.region, a.detail].filter(Boolean);
  return parts.join(" ") || "请选择收货地址";
});

const addressLine2 = computed(() => {
  const a = selectedAddress.value;
  if (!a) return "";
  return `${a.consignee} ${a.phone}`;
});

const unitPriceText = computed(() => unitPrice.value.toFixed(2));
const goodsTotalText = computed(() => (unitPrice.value * quantity.value).toFixed(2));
const freightText = computed(() => FREIGHT.toFixed(2));
const payTotalText = computed(() => (unitPrice.value * quantity.value + FREIGHT).toFixed(2));

const noop = () => {};

/**
 * 打开备注编辑底部弹层：脱离 scroll-view，输入区与字数统计完整可见。
 */
const openRemarkModal = () => {
  remarkDraft.value = remark.value;
  remarkModalVisible.value = true;
  remarkTextareaFocus.value = false;
  void nextTick(() => {
    remarkTextareaFocus.value = true;
  });
};

const cancelRemarkModal = () => {
  remarkTextareaFocus.value = false;
  remarkModalVisible.value = false;
};

const confirmRemarkModal = () => {
  remark.value = remarkDraft.value.trim().slice(0, 200);
  cancelRemarkModal();
};

const selectPay = (m: MallPaymentMethod) => {
  paymentMethod.value = m;
};

const decQty = () => {
  if (quantity.value <= 1) return;
  quantity.value -= 1;
};

const incQty = () => {
  const max = Math.max(1, stock.value || 9999);
  if (quantity.value >= max) {
    uni.showToast({ title: "已达库存上限", icon: "none" });
    return;
  }
  quantity.value += 1;
};

const loadAddresses = async () => {
  try {
    const res = await getUserAddressListApi();
    if (res.code === 0 && res.data?.list) {
      addressList.value = res.data.list;
    }
  } catch {
    /* 忽略 */
  }
};

const loadProduct = async (id: number) => {
  try {
    const res = await getMallProductDetailApi(id);
    if (res.code !== 0 || !res.data) {
      uni.showToast({ title: res.message || "商品加载失败", icon: "none" });
      setTimeout(() => uni.navigateBack(), 400);
      return;
    }
    const d = res.data;
    productTitle.value = d.title;
    coverUrl.value = d.coverUrl || "";
    unitPrice.value = d.price;
    stock.value = Number(d.stock ?? 0) || 0;
    sevenDayNoReason.value = d.sevenDayNoReason === true;
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
    setTimeout(() => uni.navigateBack(), 400);
  }
};

const goAddressList = () => {
  uni.navigateTo({ url: "/pages/profile/address-list" });
};

const submitOrder = async () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  const aid = selectedAddress.value?.id;
  if (!aid) {
    uni.showToast({ title: "请先添加收货地址", icon: "none" });
    return;
  }
  const pid = productId.value;
  if (!pid) {
    uni.showToast({ title: "商品无效", icon: "none" });
    return;
  }
  if (stock.value <= 0) {
    uni.showToast({ title: "库存不足", icon: "none" });
    return;
  }

  try {
    const res = await createMallOrderApi({
      addressId: aid,
      productId: pid,
      quantity: quantity.value,
      paymentMethod: paymentMethod.value,
      remark: remark.value.trim(),
    });
    if (res.code !== 0 || !res.data) {
      uni.showToast({ title: res.message || "下单失败", icon: "none" });
      return;
    }
    const d = res.data;
    if (paymentMethod.value === "qrcode" && d.qrCodeDataUrl) {
      pendingOrderId.value = d.id;
      qrDataUrl.value = d.qrCodeDataUrl;
      qrModalVisible.value = true;
      return;
    }
    uni.showToast({ title: "订单已提交", icon: "success" });
    setTimeout(() => uni.navigateBack(), 600);
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
  }
};

/**
 * 用户确认已扫码付款：调用后端更新支付状态并关闭弹层。
 */
const onPaidTap = async () => {
  const oid = pendingOrderId.value;
  qrModalVisible.value = false;
  qrDataUrl.value = "";
  if (!oid) return;
  try {
    const res = await confirmMallOrderPaymentApi(oid);
    if (res.code !== 0) {
      uni.showToast({ title: res.message || "确认失败", icon: "none" });
      return;
    }
    uni.showToast({ title: "支付状态已更新", icon: "success" });
    setTimeout(() => uni.navigateBack(), 500);
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
  }
};

onLoad((query?: Record<string, string | undefined>) => {
  const id = parseInt(String(query?.id ?? ""), 10);
  const q = parseInt(String(query?.quantity ?? "1"), 10);
  if (!Number.isFinite(id) || id <= 0) {
    uni.showToast({ title: "无效商品", icon: "none" });
    setTimeout(() => uni.navigateBack(), 400);
    return;
  }
  productId.value = id;
  quantity.value = Number.isFinite(q) && q > 0 ? q : 1;
  void loadProduct(id);
});

onShow(() => {
  void loadAddresses();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f3f4f6;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.scroll {
  flex: 1;
  height: 0;
  box-sizing: border-box;
}

.addr-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #ffffff;
  padding: 24rpx 16rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}

.addr-pin {
  font-size: 32rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.addr-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.addr-line1 {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

.addr-line2 {
  font-size: 26rpx;
  color: #6b7280;
}

.addr-arrow {
  font-size: 40rpx;
  color: #d1d5db;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.block {
  background: #ffffff;
  padding: 20rpx 16rpx 24rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}

.store-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  margin-bottom: 20rpx;
  display: block;
}

.goods-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16rpx;
}

.goods-cover {
  width: 160rpx;
  height: 160rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background: #f3f4f6;
}

.goods-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.goods-title {
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.45;
}

.goods-sub {
  font-size: 22rpx;
  color: #9ca3af;
}

.goods-right {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16rpx;
}

.goods-price {
  font-size: 28rpx;
  font-weight: 700;
  color: #ff5000;
}

.qty-box {
  display: flex;
  flex-direction: row;
  align-items: center;
  border: 1rpx solid #e5e7eb;
  border-radius: 8rpx;
  overflow: hidden;
}

.qty-btn {
  width: 56rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #6b7280;
  background: #f9fafb;
}

.qty-num {
  min-width: 56rpx;
  text-align: center;
  font-size: 26rpx;
  color: #111827;
}

.cell-list {
  background: #ffffff;
  margin-bottom: 16rpx;
  padding: 0 16rpx;
  box-sizing: border-box;
}

.cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}

.cell:last-child {
  border-bottom: none;
}

.cell-k {
  font-size: 28rpx;
  color: #111827;
}

.cell-v {
  font-size: 26rpx;
  color: #374151;
}

.cell-v--muted {
  color: #9ca3af;
}

.cell-v--ellipsis {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.remark-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 260;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
}

.remark-sheet {
  width: 100%;
  max-height: 75vh;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.remark-sheet-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 16rpx;
  border-bottom: 1rpx solid #f3f4f6;
  flex-shrink: 0;
}

.remark-sheet-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.remark-sheet-btn {
  font-size: 28rpx;
  padding: 8rpx 12rpx;
}

.remark-sheet-btn--muted {
  color: #6b7280;
}

.remark-sheet-btn--primary {
  color: #ff5000;
  font-weight: 600;
}

.remark-sheet-body {
  padding: 20rpx 16rpx 8rpx;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.remark-textarea {
  width: 100%;
  min-height: 220rpx;
  max-height: 360rpx;
  padding: 20rpx 16rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  line-height: 1.5;
  color: #111827;
  background: #f9fafb;
  border-radius: 12rpx;
  border: 1rpx solid #e5e7eb;
}

.remark-counter {
  align-self: flex-end;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.price-block {
  padding-top: 24rpx;
  padding-bottom: 24rpx;
}

.price-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 20rpx;
  display: block;
}

.price-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.price-row:last-child {
  margin-bottom: 0;
}

.price-k {
  font-size: 26rpx;
  color: #6b7280;
}

.price-v {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
}

.pay-head {
  padding: 16rpx 16rpx 8rpx;
}

.pay-head-t {
  font-size: 26rpx;
  color: #6b7280;
}

.pay-list {
  background: #ffffff;
  padding: 0 16rpx 16rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}

.pay-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}

.pay-item:last-child {
  border-bottom: none;
}

.pay-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pay-icon-t {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
}

.pay-mid {
  flex: 1;
  min-width: 0;
  margin-left: 16rpx;
}

.pay-title-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8rpx;
}

.pay-title {
  font-size: 28rpx;
  color: #111827;
  font-weight: 500;
}

.pay-sub {
  font-size: 22rpx;
  color: #9ca3af;
}

.radio {
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  border: 2rpx solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.radio--on {
  border-color: #ff5000;
  background: #ff5000;
}

.radio-tick {
  font-size: 24rpx;
  color: #ffffff;
  font-weight: 700;
}

.scroll-space {
  height: calc(140rpx + env(safe-area-inset-bottom));
}

.bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  background: #ffffff;
  border-top: 1rpx solid #e5e7eb;
  padding: 16rpx 16rpx;
  box-sizing: border-box;
}

.safe-bottom {
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.bottom-inner {
  height: 88rpx;
  border-radius: 44rpx;
  background: linear-gradient(90deg, #ff8800, #ff5000);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-t {
  font-size: 30rpx;
  font-weight: 700;
  color: #ffffff;
}

.modal-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}

.modal-card {
  width: 100%;
  max-width: 600rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.modal-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24rpx;
}

.modal-qr {
  width: 400rpx;
  height: 400rpx;
  background: #f9fafb;
}

.modal-done {
  margin-top: 28rpx;
  padding: 16rpx 48rpx;
}

.modal-done-t {
  font-size: 28rpx;
  color: #ff5000;
  font-weight: 600;
}
</style>
