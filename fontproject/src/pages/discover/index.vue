<template>
  <view class="page">
    <scroll-view
      class="scroll"
      scroll-y
      :show-scrollbar="false"
      lower-threshold="160"
      refresher-enabled
      :refresher-triggered="refresherTriggered"
      refresher-default-style="black"
      @refresherrefresh="onRefresherRefresh"
      @scrolltolower="onScrollToLower"
    >
      <!-- 首屏骨架：双列错落高度，模拟瀑布流 -->
      <view v-if="showInitialSkeleton" class="wf pad-x">
        <view class="wf-col">
          <view v-for="s in skeletonLeft" :key="s.id" class="card skel-card">
            <view class="skel-img skel-shimmer" :style="{ height: s.imgH + 'rpx' }" />
            <view class="skel-body">
              <view class="skel-line skel-shimmer skel-line--title" />
              <view class="skel-line skel-shimmer skel-line--short" />
              <view class="skel-line skel-shimmer skel-line--price" />
            </view>
          </view>
        </view>
        <view class="wf-col">
          <view v-for="s in skeletonRight" :key="s.id" class="card skel-card">
            <view class="skel-img skel-shimmer" :style="{ height: s.imgH + 'rpx' }" />
            <view class="skel-body">
              <view class="skel-line skel-shimmer skel-line--title" />
              <view class="skel-line skel-shimmer skel-line--short" />
              <view class="skel-line skel-shimmer skel-line--price" />
            </view>
          </view>
        </view>
      </view>

      <!-- 真实列表：图片区按 coverAspect 预留固定高度 + aspectFill，避免加载后抖动 -->
      <view v-else class="wf pad-x">
        <view class="wf-col">
          <view
            v-for="item in leftColumn"
            :key="item.id"
            class="card"
            @click="goDetail(item.id)"
          >
            <view
              class="card-img-wrap"
              :style="{ height: imgBoxHeightRpx(item) + 'rpx' }"
            >
              <image
                class="card-img-fill"
                :src="coverDisplaySrc(item)"
                mode="aspectFill"
                @load="onCoverLoad(item.id)"
                @error="onCoverError(item.id)"
              />
              <view
                v-show="!isCoverLoaded(item.id)"
                class="img-cover-skel skel-shimmer"
              />
            </view>
            <view class="card-body">
              <text class="card-title">{{ item.title }}</text>
              <!-- 支持七天无理由：第一行左「七天无理由」右「已售」；第二行仅价格 -->
              <template v-if="item.sevenDayNoReason">
                <view class="seven-sold-row">
                  <text class="txt-seven-day">七天无理由</text>
                  <text class="sold">已售 {{ formatSold(item.soldCount) }}</text>
                </view>
                <view class="price-row price-row--solo">
                  <view class="price-line">
                    <text class="yen">¥</text>
                    <text class="price-int">{{ priceParts(item.price).int }}</text>
                    <text class="price-dec">.{{ priceParts(item.price).dec }}</text>
                  </view>
                </view>
              </template>
              <view v-else class="price-row">
                <view class="price-line">
                  <text class="yen">¥</text>
                  <text class="price-int">{{ priceParts(item.price).int }}</text>
                  <text class="price-dec">.{{ priceParts(item.price).dec }}</text>
                </view>
                <text class="sold">已售 {{ formatSold(item.soldCount) }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="wf-col">
          <view
            v-for="item in rightColumn"
            :key="item.id"
            class="card"
            @click="goDetail(item.id)"
          >
            <view
              class="card-img-wrap"
              :style="{ height: imgBoxHeightRpx(item) + 'rpx' }"
            >
              <image
                class="card-img-fill"
                :src="coverDisplaySrc(item)"
                mode="aspectFill"
                @load="onCoverLoad(item.id)"
                @error="onCoverError(item.id)"
              />
              <view
                v-show="!isCoverLoaded(item.id)"
                class="img-cover-skel skel-shimmer"
              />
            </view>
            <view class="card-body">
              <text class="card-title">{{ item.title }}</text>
              <template v-if="item.sevenDayNoReason">
                <view class="seven-sold-row">
                  <text class="txt-seven-day">七天无理由</text>
                  <text class="sold">已售 {{ formatSold(item.soldCount) }}</text>
                </view>
                <view class="price-row price-row--solo">
                  <view class="price-line">
                    <text class="yen">¥</text>
                    <text class="price-int">{{ priceParts(item.price).int }}</text>
                    <text class="price-dec">.{{ priceParts(item.price).dec }}</text>
                  </view>
                </view>
              </template>
              <view v-else class="price-row">
                <view class="price-line">
                  <text class="yen">¥</text>
                  <text class="price-int">{{ priceParts(item.price).int }}</text>
                  <text class="price-dec">.{{ priceParts(item.price).dec }}</text>
                </view>
                <text class="sold">已售 {{ formatSold(item.soldCount) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 分页加载更多：底部双列小块骨架 -->
      <view v-if="showLoadMoreSkeleton" class="wf wf--more pad-x">
        <view class="wf-col">
          <view class="card skel-card">
            <view class="skel-img skel-shimmer" :style="{ height: skelMoreLeftH + 'rpx' }" />
            <view class="skel-body">
              <view class="skel-line skel-shimmer skel-line--title" />
              <view class="skel-line skel-shimmer skel-line--price" />
            </view>
          </view>
        </view>
        <view class="wf-col">
          <view class="card skel-card">
            <view class="skel-img skel-shimmer" :style="{ height: skelMoreRightH + 'rpx' }" />
            <view class="skel-body">
              <view class="skel-line skel-shimmer skel-line--title" />
              <view class="skel-line skel-shimmer skel-line--price" />
            </view>
          </view>
        </view>
      </view>

      <view class="footer-hint pad-x">
        <text v-if="loading && totalLoaded > 0" class="hint-text">加载中…</text>
        <text v-else-if="finished && totalLoaded > 0" class="hint-text">没有更多了</text>
        <text v-else-if="finished && totalLoaded === 0 && !showInitialSkeleton" class="hint-text">暂无商品</text>
      </view>
      <view class="scroll-bottom-space" />
    </scroll-view>
    <CustomTabBar />
  </view>
</template>

<script setup lang="ts">
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app";
import { computed, nextTick, ref } from "vue";
import CustomTabBar from "@/components/CustomTabBar.vue";
import { getMallProductListApi, MALL_PAGE_SIZE, type MallProductListItemDTO } from "@/api/mall";
import { resolveAssetUrl } from "@/utils/request";
import { useMallFeedStore } from "@/stores/mallFeed";

/** 单列卡片内容区预估高度（rpx，不含「七天无理由」行） */
const TEXT_BLOCK_RPX = 148;
/** 开启七天无理由时，标题与价格之间多出一行标签的预估高度 */
const SEVEN_DAY_TAG_RPX = 36;
/** 卡片宽度（rpx）：屏宽 750 - 左右 padding 32 - 列间距 16，再除以 2 */
const CARD_WIDTH_RPX = (750 - 32 - 16) / 2;

/** 骨架屏占位块（与真实卡片同一套高度估算逻辑，形成错落瀑布） */
interface SkeletonBlock {
  id: string;
  imgH: number;
}

/**
 * 按预估总高把骨架块分到左右列（与 rebuildWaterfall 策略一致）。
 */
function distributeSkeletons(aspects: number[]): { left: SkeletonBlock[]; right: SkeletonBlock[] } {
  const left: SkeletonBlock[] = [];
  const right: SkeletonBlock[] = [];
  let lh = 0;
  let rh = 0;
  aspects.forEach((a, i) => {
    const aspect = a > 0 ? a : 1;
    const imgH = Math.round(CARD_WIDTH_RPX * aspect);
    const totalH = imgH + TEXT_BLOCK_RPX; /* 骨架无服务标签 */
    const block: SkeletonBlock = { id: `sk-${i}`, imgH };
    if (lh <= rh) {
      left.push(block);
      lh += totalH;
    } else {
      right.push(block);
      rh += totalH;
    }
  });
  return { left, right };
}

/** 首屏骨架用一组错落高宽比，避免「两列一样高」 */
const { left: skeletonLeft, right: skeletonRight } = distributeSkeletons([
  1.32, 0.9, 1.25, 1.05, 1.38, 0.95, 1.18, 1.12,
]);

/** 加载更多时底部两列骨架高度略不同 */
const skelMoreLeftH = Math.round(CARD_WIDTH_RPX * 1.15);
const skelMoreRightH = Math.round(CARD_WIDTH_RPX * 0.98);

const mallStore = useMallFeedStore();

const allItems = ref<MallProductListItemDTO[]>([]);
const leftColumn = ref<MallProductListItemDTO[]>([]);
const rightColumn = ref<MallProductListItemDTO[]>([]);
const maxLoadedPage = ref(0);
const page = ref(0);
const serverTotal = ref(0);
const loading = ref(false);
const inFlight = ref(false);
const finished = ref(false);
const totalLoaded = ref(0);
/** scroll-view 下拉刷新状态（小程序内页面级下拉与 scroll-view 并存时常不触发，故用内置 refresher） */
const refresherTriggered = ref(false);
/**
 * 下拉刷新后递增，用于给封面 URL 加 `_r=` 避免微信缓存导致不触发 @load。
 */
const coverImageEpoch = ref(0);

/**
 * 列表封面地址：刷新后 epoch>0 时追加查询参数，强制重新拉图（小程序对同址 + lazy-load 极易不再回调 load）。
 */
const coverDisplaySrc = (item: MallProductListItemDTO) => {
  const base = resolveAssetUrl(item.coverUrl);
  if (!base) return "";
  if (coverImageEpoch.value === 0) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}_r=${coverImageEpoch.value}`;
};

/** 商品封面是否已加载完成（id → 是否展示骨架下层图片） */
const coverLoadedMap = ref<Record<number, boolean>>({});

const isCoverLoaded = (id: number) => coverLoadedMap.value[id] === true;

/**
 * 封面图加载成功：去掉骨架、淡入图片。
 */
const onCoverLoad = (id: number) => {
  if (coverLoadedMap.value[id]) return;
  coverLoadedMap.value = { ...coverLoadedMap.value, [id]: true };
};

/**
 * 封面图加载失败：仍收起骨架，避免一直闪烁。
 */
const onCoverError = (id: number) => {
  onCoverLoad(id);
};

/** 无数据且正在拉首屏时展示骨架（有缓存 hydrate 时不会同时为 true） */
const showInitialSkeleton = computed(() => loading.value && allItems.value.length === 0);

/** 已有列表、正在拉下一页时底部追加骨架 */
const showLoadMoreSkeleton = computed(() => loading.value && allItems.value.length > 0);

/**
 * 封面区域高度（rpx）= 列宽 × 接口高宽比，与排布算法一致，图片用 aspectFill 填满，避免加载后高度变化。
 */
const imgBoxHeightRpx = (it: MallProductListItemDTO) => {
  const aspect = it.coverAspect > 0 ? it.coverAspect : 1;
  return Math.round(CARD_WIDTH_RPX * aspect);
};

const formatSold = (n: number) => {
  if (n >= 10000) {
    const w = n / 10000;
    const s = w >= 10 ? `${Math.floor(w)}` : `${w.toFixed(1)}`.replace(/\.0$/, "");
    return `${s}万`;
  }
  return `${n}`;
};

const priceParts = (price: number) => {
  const [int, dec] = Number(price).toFixed(2).split(".");
  return { int, dec: dec ?? "00" };
};

/** 卡片文字区预估高度（含可选「七天无理由」行），与瀑布流占位一致 */
const textBlockRpxForItem = (it: MallProductListItemDTO) =>
  TEXT_BLOCK_RPX + (it.sevenDayNoReason ? SEVEN_DAY_TAG_RPX : 0);

const columnHeightScore = (col: MallProductListItemDTO[]) => {
  return col.reduce((sum, it) => {
    const aspect = it.coverAspect > 0 ? it.coverAspect : 1;
    return sum + CARD_WIDTH_RPX * aspect + textBlockRpxForItem(it);
  }, 0);
};

const rebuildWaterfall = () => {
  const left: MallProductListItemDTO[] = [];
  const right: MallProductListItemDTO[] = [];
  for (const item of allItems.value) {
    if (columnHeightScore(left) <= columnHeightScore(right)) {
      left.push(item);
    } else {
      right.push(item);
    }
  }
  leftColumn.value = left;
  rightColumn.value = right;
};

const updateFinished = (total: number, hasMore: boolean) => {
  const n = allItems.value.length;
  finished.value = !hasMore || (total > 0 && n >= total);
};

const fetchPage = async (p: number, opts?: { silent?: boolean }) => {
  const silent = opts?.silent === true;
  if (inFlight.value) return;
  inFlight.value = true;
  if (!silent) {
    loading.value = true;
  }
  try {
    const res = await getMallProductListApi(p, MALL_PAGE_SIZE);
    if (res.code !== 0 || !res.data) {
      if (!silent) {
        uni.showToast({ title: res.message || "加载失败", icon: "none" });
      }
      if (allItems.value.length === 0) {
        finished.value = true;
      }
      return;
    }
    const { list, hasMore, total } = res.data;

    if (p === 1) {
      mallStore.persistFirstPage(list, hasMore, total);
      if (maxLoadedPage.value <= 1) {
        allItems.value = list;
      } else {
        allItems.value = [...list, ...allItems.value.slice(MALL_PAGE_SIZE)];
      }
    } else {
      allItems.value = [...allItems.value, ...list];
    }

    maxLoadedPage.value = Math.max(maxLoadedPage.value, p);
    page.value = p;
    serverTotal.value = total;
    totalLoaded.value = allItems.value.length;
    rebuildWaterfall();
    updateFinished(total, hasMore);
  } catch {
    if (!silent) {
      uni.showToast({ title: "网络异常", icon: "none" });
    }
    if (allItems.value.length === 0) {
      finished.value = true;
    }
  } finally {
    inFlight.value = false;
    if (!silent) {
      loading.value = false;
    }
  }
};

const onScrollToLower = () => {
  if (loading.value || inFlight.value || finished.value) return;
  void fetchPage(page.value + 1, { silent: false });
};

/**
 * 下拉刷新核心：清空分页与封面缓存，只拉第一页并同步 Pinia 首屏缓存。
 */
const runPullRefreshReload = async () => {
  maxLoadedPage.value = 0;
  page.value = 0;
  coverLoadedMap.value = {};
  /** 先改 epoch 再拉数，保证首帧封面就带 `_r=`，避免同 URL 先渲染导致微信不回调 @load */
  coverImageEpoch.value += 1;
  await nextTick();
  await fetchPage(1, { silent: true });
  await nextTick();
};

/** scroll-view 内置下拉刷新（微信小程序主路径，避免与页面滚动冲突） */
const onRefresherRefresh = async () => {
  if (inFlight.value) {
    refresherTriggered.value = false;
    return;
  }
  refresherTriggered.value = true;
  try {
    await runPullRefreshReload();
  } finally {
    refresherTriggered.value = false;
  }
};

/** 页面级下拉刷新：H5 / App 等场景备用，与 scroll-view refresher 共用同一套拉数逻辑 */
onPullDownRefresh(() => {
  void (async () => {
    try {
      if (!inFlight.value) {
        await runPullRefreshReload();
      }
    } finally {
      uni.stopPullDownRefresh();
    }
  })();
});

const goDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/discover/detail?id=${id}` });
};

onLoad(async () => {
  const hydrated = mallStore.hydrateFromStorage();
  if (hydrated) {
    allItems.value = [...mallStore.firstPageList];
    maxLoadedPage.value = 1;
    page.value = 1;
    serverTotal.value = mallStore.firstPageTotal;
    totalLoaded.value = allItems.value.length;
    rebuildWaterfall();
    updateFinished(mallStore.firstPageTotal, mallStore.firstPageHasMore);
    loading.value = false;
  }

  if (!hydrated) {
    await fetchPage(1, { silent: false });
    return;
  }

  if (!mallStore.isFirstPageCacheFresh()) {
    await fetchPage(1, { silent: true });
  }
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

.wf {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16rpx;
  padding-top: 16rpx;
  box-sizing: border-box;
}

.wf--more {
  padding-top: 0;
}

.wf-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

/* 固定高度容器 + 铺满裁剪，避免网络图加载前后高度不一致导致页面抖动 */
.card-img-wrap {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #f0f0f0;
}

/* 骨架盖在图片上方，图片始终参与解码；避免用 opacity:0 + 同 URL 导致微信不触发 @load */
.img-cover-skel {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  pointer-events: none;
}

.card-img-fill {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
}

.card-body {
  padding: 16rpx 12rpx 20rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.card-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 24rpx;
  font-weight: 600;
  color: #333333;
  line-height: 1.4;
  margin-bottom: 12rpx;
}

/* 与淘宝类似：纯文字、偏黄褐色、常规字重 */
.seven-sold-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.txt-seven-day {
  font-size: 22rpx;
  font-weight: 400;
  color: #ff5000;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}

.price-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8rpx 12rpx;
  margin-bottom: 4rpx;
}

.price-row--solo {
  justify-content: flex-start;
}

.price-line {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-shrink: 0;
}

.yen {
  font-size: 24rpx;
  font-weight: 700;
  color: #ff4400;
  margin-right: 2rpx;
}

.price-int {
  font-size: 36rpx;
  font-weight: 700;
  color: #ff4400;
  line-height: 1;
}

.price-dec {
  font-size: 24rpx;
  font-weight: 600;
  color: #ff4400;
  line-height: 1;
}

.sold {
  font-size: 22rpx;
  color: #999999;
  line-height: 1.3;
  flex-shrink: 0;
}

/* —— 骨架屏 —— */
.skel-card {
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.skel-img {
  width: 100%;
  border-radius: 0;
}

.skel-body {
  padding: 16rpx 12rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.skel-line {
  height: 24rpx;
  border-radius: 8rpx;
}

.skel-line--title {
  width: 100%;
}

.skel-line--short {
  width: 72%;
}

.skel-line--price {
  width: 46%;
  height: 28rpx;
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

.footer-hint {
  padding-top: 24rpx;
  padding-bottom: 16rpx;
  text-align: center;
}

.hint-text {
  font-size: 24rpx;
  color: #9ca3af;
}

.scroll-bottom-space {
  height: calc(180rpx + env(safe-area-inset-bottom));
}
</style>
