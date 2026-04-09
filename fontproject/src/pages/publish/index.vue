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
          <text class="ai-generate-text">ai帮你润色</text>
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

    <u-popup
      :show="aiSheetVisible"
      mode="bottom"
      round="20"
      @close="closeAiSheet"
      @open="onAiSheetOpen"
    >
      <view class="ai-sheet">
        <view class="ai-sheet-header">
          <text class="ai-sheet-title">AI 润色</text>
          <u-icon name="close" :size="20" color="#64748b" @click="closeAiSheet" />
        </view>

        <view class="ai-role-list">
          <view
            v-for="item in aiRoleOptions"
            :key="item.key"
            class="ai-role-item"
            :class="{ 'ai-role-item--active': aiRoleKey === item.key }"
            @click="aiRoleKey = item.key"
          >
            {{ item.label }}
          </view>
        </view>

        <view class="ai-field-label">润色结果（可编辑）</view>
        <textarea
          v-model="aiPolishedText"
          class="ai-sheet-textarea"
          :maxlength="2000"
          auto-height
          placeholder="点击“开始润色”后，这里会展示 AI 润色结果"
          placeholder-class="input-ph"
        />

        <view class="ai-field-label ai-field-label--margin">原文输入</view>
        <textarea
          v-model.trim="aiRawText"
          class="ai-sheet-textarea ai-sheet-textarea--input"
          :maxlength="2000"
          auto-height
          placeholder="请输入需要润色的内容"
          placeholder-class="input-ph"
        />

        <view class="ai-sheet-footer">
          <u-button
            text="开始润色"
            shape="circle"
            :loading="aiPolishLoading"
            :disabled="aiPolishLoading"
            :custom-style="aiActionBtnStyle"
            @click="onAiPolishSubmit"
          />
          <u-button
            text="使用润色结果"
            shape="circle"
            :disabled="!aiPolishedText.trim()"
            :custom-style="aiUseBtnStyle"
            @click="onUsePolishedText"
          />
        </view>
      </view>
    </u-popup>

    <u-toast ref="uToastRef" />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { createPostApi, type PublishSectionKey } from "@/api/post";
import { uploadImageApi } from "@/api/common";
import { streamAiChat, type ChatMessage } from "@/api/ai";
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
const aiSheetVisible = ref(false);
const aiRawText = ref("");
const aiPolishedText = ref("");
const aiPolishLoading = ref(false);
const aiRoleKey = ref<AiRoleKey>("anime_pro");

type AiRoleKey = "anime_pro" | "professional" | "brief";
interface AiRoleOption {
  key: AiRoleKey;
  label: string;
  systemPrompt: string;
}

const aiRoleOptions: AiRoleOption[] = [
  {
    key: "anime_pro",
    label: "润色文案",
    systemPrompt:
      "你是一名二次元风格的小姐姐文案助手，只负责把用户文案润色成可爱、元气、自然的二次元表达。请在不改变事实信息和核心观点的前提下，优化语句顺序与阅读流畅度，适度加入轻量语气词（如“呀”“呢”“喔”），但不要过度卖萌。不要编造信息，不要偏离原意，只输出中文最终稿。",
  },
  {
    key: "professional",
    label: "文案拓写",
    systemPrompt:
      "你是一名二次元风格的小姐姐文案编辑，擅长在保留原意的基础上进行文案拓写。请将用户文本写得更完整、更有画面感和感染力，语气保持可爱、元气、礼貌，适度加入轻量二次元语感（如“呀”“呢”“喔”），但不要过度卖萌。不要编造事实，不要偏离主题，输出中文最终稿。",
  },
  {
    key: "brief",
    label: "精简风",
    systemPrompt:
      "你是一名二次元风格的小姐姐精简写作助手。请在保留核心信息的前提下，把文案精简得更清晰、更易读，同时保持可爱、自然的二次元语气（轻量语气词即可，不要过度卖萌）。不要新增事实，不要跑题，只输出中文最终稿。",
  },
];

/** uview-plus Toast，用于校验提示与发布成功/失败 */
const uToastRef = ref<{ show: (opt: Record<string, unknown>) => void; hide: () => void } | null>(null);

const publishBtnStyle =
  "width: 100%; height: 88rpx; font-size: 32rpx; font-weight: 600; color: #ffffff; background: linear-gradient(180deg, #2a79ff 0%, #0d5aff 100%); border: none; box-shadow: 0 12rpx 28rpx rgba(13, 90, 255, 0.35);";
const aiActionBtnStyle =
  "flex: 1; height: 84rpx; font-size: 30rpx; font-weight: 600; color: #ffffff; background: linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%); border: none;";
const aiUseBtnStyle =
  "flex: 1; height: 84rpx; font-size: 30rpx; font-weight: 600; color: #4f46e5; background: #ede9fe; border: 1rpx solid #c4b5fd;";

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

const getAiRoleOption = (roleKey: AiRoleKey): AiRoleOption =>
  aiRoleOptions.find((item) => item.key === roleKey) || aiRoleOptions[0];

/**
 * 调用 AI 对话接口完成文案润色，按流式返回拼接完整文本。
 */
const runAiPolish = (raw: string, roleKey: AiRoleKey): Promise<string> =>
  new Promise((resolve, reject) => {
    const role = getAiRoleOption(roleKey);
    let finalText = "";
    let settled = false;
    const messages: ChatMessage[] = [
      { role: "system", content: role.systemPrompt },
      {
        role: "user",
        content:
          `请润色下面这段文案，保持原意与事实，不要编造信息。\n` +
          `润色后直接输出最终文案，不要加“润色后如下”等说明。\n\n` +
          `原文：\n${raw}`,
      },
    ];

    const task = streamAiChat(
      messages,
      (chunk) => {
        finalText += chunk;
        aiPolishedText.value = finalText;
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(finalText.trim());
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(err || "AI 润色失败"));
      }
    );

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      task?.abort?.();
      reject(new Error("AI 响应超时，请稍后重试"));
    }, 45000);
  });

/**
 * 点击 AI 入口：弹出底部润色面板。
 */
const onAiGenerateTap = () => {
  aiRawText.value = content.value.trim();
  aiPolishedText.value = "";
  aiSheetVisible.value = true;
};

/** 关闭 AI 底部弹窗。 */
const closeAiSheet = () => {
  aiSheetVisible.value = false;
};

/** AI 面板打开后的兜底处理。 */
const onAiSheetOpen = () => {
  if (!aiRawText.value && content.value.trim()) {
    aiRawText.value = content.value.trim();
  }
};

/**
 * 提交润色：将下方原文按当前角色发送给 AI，结果实时写入上方文本框。
 */
const onAiPolishSubmit = async () => {
  const raw = aiRawText.value.trim();
  if (!raw) {
    uToastRef.value?.show({ type: "warning", message: "请先输入需要润色的内容" });
    return;
  }
  aiPolishLoading.value = true;
  aiPolishedText.value = "";
  try {
    const polished = await runAiPolish(raw, aiRoleKey.value);
    if (!polished) {
      uToastRef.value?.show({ type: "warning", message: "未获取到润色结果，请重试" });
      return;
    }
    aiPolishedText.value = polished;
    uToastRef.value?.show({ type: "success", message: "润色完成" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 润色失败，请稍后重试";
    uToastRef.value?.show({ type: "error", message: msg });
  } finally {
    aiPolishLoading.value = false;
  }
};

/**
 * 使用润色结果：将上方文本应用到正文并关闭弹窗。
 */
const onUsePolishedText = () => {
  const polished = aiPolishedText.value.trim();
  if (!polished) {
    uToastRef.value?.show({ type: "warning", message: "暂无可用的润色结果" });
    return;
  }
  content.value = polished;
  aiSheetVisible.value = false;
  uToastRef.value?.show({ type: "success", message: "已应用到正文" });
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

.ai-sheet {
  padding: 24rpx 16rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}

.ai-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ai-sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
}

.ai-role-list {
  margin-top: 20rpx;
  display: flex;
  gap: 16rpx;
}

.ai-role-item {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #475569;
  background: #f1f5f9;
  border: 1rpx solid #e2e8f0;
}

.ai-role-item--active {
  color: #6d28d9;
  background: #f3e8ff;
  border-color: #c4b5fd;
}

.ai-field-label {
  margin-top: 24rpx;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #334155;
}

.ai-field-label--margin {
  margin-top: 20rpx;
}

.ai-sheet-textarea {
  width: 100%;
  min-height: 180rpx;
  max-height: 340rpx;
  box-sizing: border-box;
  padding: 20rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 1.55;
  color: #1e293b;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
}

.ai-sheet-textarea--input {
  background: #ffffff;
}

.ai-sheet-footer {
  margin-top: 24rpx;
  display: flex;
  gap: 16rpx;
}
</style>
