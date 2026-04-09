<template>
  <!-- 商城购物车底部弹层：固定高度 40vh，底部合计+全选+结算固定；u-popup + u-number-box + u-checkbox-group -->
  <view class="cart-sheet-root">
    <u-popup
      v-model:show="sheetOpen"
      mode="bottom"
      :round="0"
      :close-on-click-overlay="true"
      :z-index="10080"
      @close="onPopupClose"
    >
      <view class="sheet-inner">
        <view class="sheet-head pad-x">
          <text v-if="manageMode" class="sheet-cancel" @click="exitManage">取消</text>
          <text v-else class="sheet-head-placeholder" />
          <text class="sheet-title">购物车 ({{ totalQuantity }})</text>
          <text class="sheet-action" @click="onHeaderActionClick">{{ manageMode ? "删除" : "管理" }}</text>
        </view>

        <view class="sheet-body">
          <view v-if="loading" class="sheet-loading pad-x">
            <text class="sheet-loading-t">加载中…</text>
          </view>
          <view v-else-if="!list.length" class="sheet-empty pad-x">
            <image class="sheet-empty-img" src="/static/image/cart-empty.png" mode="aspectFit" />
          </view>

          <scroll-view
            v-else-if="manageMode"
            scroll-y
            class="sheet-scroll"
            :show-scrollbar="false"
          >
            <u-checkbox-group
              v-model="selectedIds"
              shape="circle"
              active-color="#ff4400"
              placement="column"
            >
              <view v-for="item in list" :key="item.id" class="cart-row pad-x">
                <u-checkbox class="cart-check" :name="String(item.id)" label=" " label-disabled />
                <image class="cart-thumb" :src="coverSrc(item.coverUrl)" mode="aspectFill" />
                <view class="cart-main cart-main--text-only">
                  <text class="cart-title">{{ item.title }}</text>
                </view>
              </view>
            </u-checkbox-group>
          </scroll-view>

          <scroll-view v-else scroll-y class="sheet-scroll" :show-scrollbar="false">
            <u-checkbox-group
              v-model="selectedCheckoutIds"
              shape="circle"
              active-color="#ff4400"
              placement="column"
            >
              <view v-for="item in list" :key="item.id" class="cart-row pad-x">
                <u-checkbox class="cart-check" :name="String(item.id)" label=" " label-disabled />
                <image class="cart-thumb" :src="coverSrc(item.coverUrl)" mode="aspectFill" />
                <view class="cart-main">
                  <text class="cart-title">{{ item.title }}</text>
                  <u-number-box
                    v-model="item.quantity"
                    :min="1"
                    :max="Math.max(1, item.stock)"
                    integer
                    :disabled="updatingId === item.id"
                    :button-size="26"
                    :input-width="36"
                    bg-color="#f3f4f6"
                    color="#323233"
                    @change="onNumberBoxChange(item, $event)"
                  />
                </view>
              </view>
            </u-checkbox-group>
          </scroll-view>
        </view>

        <view v-if="list.length && !manageMode" class="sheet-foot pad-x safe-bottom">
          <!-- 整块可点；勾选框仅展示，避免与全选接口重复触发 -->
          <view class="foot-left" @tap.stop="onToggleSelectAll">
            <u-checkbox
              :checked="isAllSelected"
              shape="circle"
              active-color="#ff4400"
              label=" "
              label-disabled
            />
            <text class="foot-all-t">全选</text>
          </view>
          <view class="foot-right-group">
            <view class="foot-total-line">
              <text class="foot-total-label">合计</text>
              <text class="foot-total-price">¥{{ totalPriceText }}</text>
            </view>
            <view class="foot-checkout" @click="onCheckout">
              <text class="foot-checkout-t">结算</text>
            </view>
          </view>
        </view>
      </view>
    </u-popup>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { resolveAssetUrl } from "@/utils/request";
import {
  deleteMallCartItemApi,
  getMallCartApi,
  type MallCartItemDTO,
  selectAllMallCartApi,
  updateMallCartItemApi,
} from "@/api/mall";

/** 与 u-number-box @change 回调结构一致 */
interface NumberBoxChange {
  value: number | string;
  name?: string | number;
  type?: string;
}

const props = defineProps<{
  /** 是否展示底部购物车弹层 */
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [boolean];
}>();

const sheetOpen = computed({
  get: () => props.show,
  set: (v: boolean) => emit("update:show", v),
});

const loading = ref(false);
const list = ref<MallCartItemDTO[]>([]);
const manageMode = ref(false);
/** 管理模式下待删除的购物车行 id */
const selectedIds = ref<string[]>([]);
/** 结算勾选：与 mall_cart_items.checked 同步 */
const selectedCheckoutIds = ref<string[]>([]);
const blockCheckoutWatch = ref(false);

const updatingId = ref<number | null>(null);
const lastQty = ref<Record<number, number>>({});

const totalQuantity = computed(() =>
  list.value.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
);

/** 仅统计勾选行的金额（单价 × 数量） */
const totalPriceText = computed(() => {
  const sum = list.value
    .filter((it) => it.checked)
    .reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  return sum.toFixed(2);
});

const isAllSelected = computed(
  () => list.value.length > 0 && list.value.every((it) => it.checked)
);

const coverSrc = (url: string) => resolveAssetUrl(url || "");

watch(
  selectedCheckoutIds,
  async (ids) => {
    if (blockCheckoutWatch.value || manageMode.value) return;
    const idSet = new Set(ids);
    for (const item of list.value) {
      const should = idSet.has(String(item.id));
      if (should !== item.checked) {
        const res = await updateMallCartItemApi(item.id, { checked: should });
        if (res.code !== 0) {
          uni.showToast({ title: res.message || "更新失败", icon: "none" });
          blockCheckoutWatch.value = true;
          selectedCheckoutIds.value = list.value.filter((i) => i.checked).map((i) => String(i.id));
          await nextTick();
          blockCheckoutWatch.value = false;
          return;
        }
        item.checked = should;
      }
    }
  },
  { deep: true }
);

/**
 * 请求购物车列表并填充本地列表（数量与 u-number-box 双向绑定）。
 */
const loadCart = async () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录", icon: "none" });
    sheetOpen.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await getMallCartApi();
    if (res.code !== 0 || !res.data) {
      uni.showToast({ title: res.message || "加载失败", icon: "none" });
      list.value = [];
      return;
    }
    list.value = res.data.list.map((row) => ({
      ...row,
      quantity: Number(row.quantity) || 1,
    }));
    const map: Record<number, number> = {};
    for (const it of list.value) {
      map[it.id] = it.quantity;
    }
    lastQty.value = map;

    blockCheckoutWatch.value = true;
    selectedCheckoutIds.value = list.value.filter((i) => i.checked).map((i) => String(i.id));
    await nextTick();
    blockCheckoutWatch.value = false;
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
    list.value = [];
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.show,
  (open) => {
    if (open) {
      manageMode.value = false;
      selectedIds.value = [];
      void loadCart();
    }
  }
);

const onPopupClose = () => {
  manageMode.value = false;
  selectedIds.value = [];
};

const exitManage = () => {
  manageMode.value = false;
  selectedIds.value = [];
};

/**
 * 全选 / 取消全选：同步服务端并更新本地勾选状态与合计。
 */
const onToggleSelectAll = async () => {
  if (!list.value.length) return;
  const next = !isAllSelected.value;
  try {
    const res = await selectAllMallCartApi(next);
    if (res.code !== 0) {
      uni.showToast({ title: res.message || "更新失败", icon: "none" });
      return;
    }
    blockCheckoutWatch.value = true;
    for (const it of list.value) {
      it.checked = next;
    }
    selectedCheckoutIds.value = next ? list.value.map((i) => String(i.id)) : [];
    await nextTick();
    blockCheckoutWatch.value = false;
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
  }
};

/**
 * 顶部右侧：未管理态进入管理；管理态下执行删除所选。
 */
const onHeaderActionClick = async () => {
  if (!manageMode.value) {
    manageMode.value = true;
    selectedIds.value = [];
    return;
  }
  if (!selectedIds.value.length) {
    uni.showToast({ title: "请选择要删除的商品", icon: "none" });
    return;
  }
  uni.showLoading({ title: "删除中", mask: true });
  try {
    const ids = selectedIds.value.map((s) => Number(s));
    for (const id of ids) {
      const res = await deleteMallCartItemApi(id);
      if (res.code !== 0) {
        uni.showToast({ title: res.message || "删除失败", icon: "none" });
        await loadCart();
        return;
      }
    }
    uni.showToast({ title: "已删除", icon: "success" });
    manageMode.value = false;
    selectedIds.value = [];
    await loadCart();
  } catch {
    uni.showToast({ title: "删除失败", icon: "none" });
    await loadCart();
  } finally {
    uni.hideLoading();
  }
};

const onNumberBoxChange = (
  item: MallCartItemDTO,
  e: { value: string | number; name?: string | number; type?: string }
) => {
  void onQuantityChange(item, e as NumberBoxChange);
};

const onQuantityChange = async (item: MallCartItemDTO, e: NumberBoxChange) => {
  const next = Number(e.value);
  if (!Number.isInteger(next) || next < 1) return;
  const lastCommitted = lastQty.value[item.id];
  if (lastCommitted !== undefined && next === lastCommitted) return;
  const prev = lastCommitted ?? item.quantity;
  updatingId.value = item.id;
  try {
    const res = await updateMallCartItemApi(item.id, { quantity: next });
    if (res.code !== 0) {
      uni.showToast({ title: res.message || "更新失败", icon: "none" });
      item.quantity = prev;
      await loadCart();
      return;
    }
    item.quantity = next;
    lastQty.value = { ...lastQty.value, [item.id]: next };
  } catch {
    uni.showToast({ title: "网络异常", icon: "none" });
    item.quantity = prev;
    await loadCart();
  } finally {
    updatingId.value = null;
  }
};

const onCheckout = () => {
  uni.showToast({ title: "结算功能开发中", icon: "none" });
};

defineExpose({
  refresh: loadCart,
});
</script>

<style scoped>
.cart-sheet-root {
  width: 0;
  height: 0;
  overflow: visible;
}

.pad-x {
  padding-left: 16rpx;
  padding-right: 16rpx;
  box-sizing: border-box;
}

.sheet-inner {
  height: 65vh;
  max-height: 65vh;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sheet-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: 40rpx;
  padding-bottom: 28rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.sheet-head-placeholder {
  min-width: 96rpx;
}

.sheet-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.sheet-cancel {
  min-width: 96rpx;
  font-size: 30rpx;
  color: #6b7280;
}

.sheet-action {
  min-width: 96rpx;
  text-align: right;
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.sheet-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 标题区与列表区之间再留一点空隙 */
  padding-top: 16rpx;
}

.sheet-loading,
.sheet-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 32rpx;
  padding-bottom: 32rpx;
  gap: 24rpx;
}

.sheet-empty-img {
  width: 480rpx;
  height: 480rpx;
  flex-shrink: 0;
}

.sheet-loading-t,
.sheet-empty-t {
  font-size: 26rpx;
  color: #9ca3af;
}

.sheet-scroll {
  flex: 1;
  height: 0;
}

.cart-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-top: 24rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f3f4f6;
  gap: 20rpx;
}

.cart-check {
  flex-shrink: 0;
}

.cart-thumb {
  width: 144rpx;
  height: 144rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #f3f4f6;
  margin-right: 8rpx;
}

.cart-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20rpx;
  padding-left: 8rpx;
}

.cart-main--text-only {
  gap: 0;
  padding-left: 8rpx;
  justify-content: center;
}

.cart-title {
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.sheet-foot {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  padding-top: 20rpx;
  padding-bottom: 16rpx;
  background: #ffffff;
}

.safe-bottom {
  /* padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); */
}

.foot-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
}

.foot-left :deep(.u-checkbox) {
  pointer-events: none;
}

.foot-all-t {
  font-size: 26rpx;
  color: #374151;
  margin-left: 4rpx;
}

.foot-right-group {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
  min-width: 0;
}

.foot-total-line {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 8rpx;
  flex-shrink: 0;
}

.foot-total-label {
  font-size: 26rpx;
  color: #6b7280;
}

.foot-total-price {
  font-size: 30rpx;
  font-weight: 800;
  color: #ff4400;
}

.foot-checkout {
  flex-shrink: 0;
  height: 72rpx;
  padding: 0 56rpx;
  min-width: 168rpx;
  border-radius: 18rpx;
  background: linear-gradient(90deg, #ff8800 0%, #ff4400 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.foot-checkout-t {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>
