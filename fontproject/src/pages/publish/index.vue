<template>
  <view class="page">
    <view class="body">
      <view class="publish-card">

        <!-- 图片选择：最多 8 张，右上角删除由 u-upload 的 deletable + autoDelete 提供 -->
        <view class="upload-block">
          <u-upload
            v-model:file-list="fileList"
            accept="image"
            :max-count="8"
            multiple
            :deletable="true"
            :auto-delete="true"
            upload-icon="plus"
            upload-icon-color="#94a3b8"
            width="140rpx"
            height="140rpx"
            image-mode="aspectFill"
            @after-read="afterRead"
          />
        </view>

        <input
          v-model.trim="title"
          class="title-input"
          type="text"
          placeholder="添加标题"
          placeholder-class="input-ph"
        />

        <view class="content-row">
          <textarea
            v-model.trim="content"
            class="content-area"
            :maxlength="2000"
            auto-height
            placeholder="分享新鲜事..."
            placeholder-class="input-ph"
          />
        </view>
        <!-- AI 入口：左图标 + 横向蓝→紫粉渐变文案 + 右箭头 -->
        <view class="ai-generate-row" @click="onAiGenerateTap">
          <image class="ai-gen-img" src="/static/image/ai-technology.png" mode="aspectFit" />
          <text class="ai-generate-text">ai帮你写</text>
          <u-icon class="ai-gen-arrow" name="arrow-right" :size="18" color="#c026d3" />
        </view>
      </view>
    </view>

    <view class="footer">
      <u-button
        text="发布"
        shape="circle"
        :custom-style="publishBtnStyle"
        @click="onPublish"
      />
    </view>

    <u-toast ref="uToastRef" />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { createPostApi, type PublishSectionKey } from "@/api/post";
import { uploadImageApi } from "@/api/common";
import { HOME_FEED_REFRESH_FLAG } from "@/constants/storageKeys";

/** 上传列表项（与 u-upload fileList 结构兼容） */
interface UploadFileItem {
  url?: string;
  thumb?: string;
  type?: string;
  name?: string;
  size?: number;
  status?: string;
}

const categoryLabel = ref("");
/** 与后端 sectionKey 一致，来自路由或根据分类名回退解析 */
const sectionKey = ref<PublishSectionKey | "">("");
const title = ref("");
const content = ref("");
const fileList = ref<UploadFileItem[]>([]);

/** uview-plus Toast，用于校验提示与发布成功/失败 */
const uToastRef = ref<{ show: (opt: Record<string, unknown>) => void; hide: () => void } | null>(null);

const publishBtnStyle =
  "width: 100%; height: 88rpx; font-size: 32rpx; font-weight: 600; color: #ffffff; background: linear-gradient(180deg, #2a79ff 0%, #0d5aff 100%); border: none; box-shadow: 0 12rpx 28rpx rgba(13, 90, 255, 0.35);";

/** 展示名 → 接口 sectionKey（兼容仅带 category 的旧链接） */
const LABEL_TO_KEY: Record<string, PublishSectionKey> = {
  电影文化: "film_culture",
  "动漫/协会": "anime_association",
  其他模块: "other",
};

function isPublishSectionKey(value: string): value is PublishSectionKey {
  return value === "film_culture" || value === "anime_association" || value === "other";
}

/**
 * 页面加载：读取 category（展示）、sectionKey（入库枚举），并同步导航栏标题。
 */
onLoad((query) => {
  const raw = query?.category ? decodeURIComponent(String(query.category)) : "";
  categoryLabel.value = raw;
  const sk = query?.sectionKey ? decodeURIComponent(String(query.sectionKey)) : "";
  if (isPublishSectionKey(sk)) {
    sectionKey.value = sk;
  } else if (raw && LABEL_TO_KEY[raw]) {
    sectionKey.value = LABEL_TO_KEY[raw];
  }
  uni.setNavigationBarTitle({
    title: raw || "发布",
  });
});

/**
 * 将本地临时路径逐张上传到服务端 test 目录；已是 http(s) 的则原样作为引用提交。
 * 返回给发帖接口的每项为 `test/<fileName>`，与后端 normalize 约定一致。
 */
const resolveImageUrls = async (items: UploadFileItem[]): Promise<string[]> => {
  const urls: string[] = [];
  for (const item of items) {
    const path = item.url || item.thumb;
    if (!path) continue;
    if (/^https?:\/\//i.test(path)) {
      urls.push(path);
      continue;
    }
    const res = await uploadImageApi(path);
    const ok = res.code === 0 || res.code === 200;
    if (!ok || !res.data?.fileName) {
      throw new Error(res.message || "图片上传失败");
    }
    urls.push(`test/${res.data.fileName}`);
  }
  return urls;
};

/**
 * 选择图片后的回调：将本地文件写入 fileList，并保证总数不超过 8 张。
 */
const afterRead = (event: { file: UploadFileItem | UploadFileItem[] }) => {
  const files = ([] as UploadFileItem[]).concat(event.file as UploadFileItem[]);
  const room = 8 - fileList.value.length;
  if (room <= 0) {
    uni.showToast({ title: "最多上传 8 张图片", icon: "none" });
    return;
  }
  const slice = files.slice(0, room);
  if (files.length > slice.length) {
    uni.showToast({ title: `仅可再选 ${room} 张`, icon: "none" });
  }
  slice.forEach((item) => {
    fileList.value.push({ ...item });
  });
};

/**
 * AI 智能生成入口：后续可跳转 AI 成片 / 文案生成等能力。
 */
const onAiGenerateTap = () => {
  uni.showToast({ title: "AI 智能生成开发中", icon: "none" });
};

/**
 * 发布提交：校验标题与正文必填，图片可选；上传图片后调用发帖接口，成功用 u-toast 提示并返回。
 */
const onPublish = async () => {
  const t = title.value.trim();
  const c = content.value.trim();

  if (!t) {
    uToastRef.value?.show({ type: "warning", message: "请填写标题" });
    return;
  }
  if (!c) {
    uToastRef.value?.show({ type: "warning", message: "请填写正文" });
    return;
  }
  if (!sectionKey.value) {
    uToastRef.value?.show({ type: "warning", message: "缺少发布类型，请返回重新选择" });
    return;
  }
  if (!uni.getStorageSync("token")) {
    uToastRef.value?.show({ type: "error", message: "请先登录" });
    return;
  }

  try {
    uToastRef.value?.show({ type: "loading", message: "发布中...", duration: -1 });
    const imageUrls = await resolveImageUrls(fileList.value);
    const apiRes = await createPostApi({
      title: t,
      content: c,
      sectionKey: sectionKey.value,
      imageUrls,
    });
    uToastRef.value?.hide();

    const ok = apiRes.code === 0 || apiRes.code === 200;
    if (!ok || !apiRes.data) {
      uToastRef.value?.show({
        type: "error",
        message: apiRes.message || "发布失败",
      });
      return;
    }

    uToastRef.value?.show({
      type: "success",
      message: apiRes.message || "发布成功",
      duration: 1600,
      complete: () => {
        uni.setStorageSync(HOME_FEED_REFRESH_FLAG, true);
        uni.navigateBack();
      },
    });
  } catch (e) {
    uToastRef.value?.hide();
    const msg = e instanceof Error ? e.message : "网络异常，请重试";
    uToastRef.value?.show({ type: "error", message: msg });
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 与首页 pages/index/index.vue 一致 */
  background: #f5f5f5;
  box-sizing: border-box;
}

.body {
  flex: 1;
  padding: 24rpx 16rpx 200rpx;
  box-sizing: border-box;
}

/* 与首页信息流卡片（如 skeleton-card）风格统一 */
.publish-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(15, 23, 42, 0.04);
}

.category-bar {
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.25);
}

.category-text {
  font-size: 26rpx;
  color: #475569;
  font-weight: 600;
}

.upload-block {
  margin-bottom: 28rpx;
}

/* 一行约 4 张缩略图 + 12rpx 圆角（预览图与加号格一致） */
.upload-block :deep(.u-upload__wrap__preview) {
  border-radius: 12rpx;
}

.upload-block :deep(.u-upload__wrap__preview__image) {
  border-radius: 12rpx;
}

.upload-block :deep(.u-upload__button) {
  border-radius: 12rpx;
}

.title-input {
  width: 100%;
  font-size: 34rpx;
  font-weight: 500;
  color: #0f172a;
  padding: 8rpx 0 20rpx;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.25);
}

.input-ph {
  color: #94a3b8;
}

.content-row {
  position: relative;
  margin-top: 20rpx;
  padding-right: 56rpx;
}

.content-area {
  width: 100%;
  min-height: 400rpx;
  font-size: 30rpx;
  color: #1e293b;
  line-height: 1.55;
}

.ai-generate-row {
  margin-top: 24rpx;
  padding: 20rpx 8rpx 8rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.25);
  padding-top: 30rpx;
}

.ai-gen-img {
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  display: block;
}

/* 横向渐变字：左蓝 → 右紫粉（与参考图一致，依赖 background-clip） */
.ai-generate-text {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.35;
  background-image: linear-gradient(90deg, #2563eb 0%, #4f46e5 38%, #a855f7 72%, #d946ef 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.ai-gen-arrow {
  flex-shrink: 0;
}

.mic-btn {
  position: absolute;
  right: 0;
  top: 4rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 底部固定发布区：保留主题按钮，避免被滚动内容遮挡 */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 998;
  padding: 20rpx 16rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #f5f5f5;
  box-shadow: 0 -8rpx 32rpx rgba(15, 23, 42, 0.06);
}
</style>
