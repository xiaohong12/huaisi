<template>
  <view class="page">
    <view class="hero-bg">
      <view class="blur-dot dot-left" />
      <view class="blur-dot dot-right" />
    </view>

    <view class="content">
      <view class="settings-card">
        <view class="cell cell--tap" @click="onAvatarClick">
          <text class="cell-label">头像</text>
          <view class="cell-right">
            <u-avatar :src="displayUser.avatar" size="48" />
            <u-icon name="arrow-right" size="14" color="#94a3b8" />
          </view>
        </view>
        <u-line margin="0" color="#f1f5f9" />
        <view class="cell">
          <text class="cell-label">用户名</text>
          <text class="cell-value-text">{{ displayUser.username }}</text>
        </view>
      </view>
    </view>

    <u-popup
      :show="sheetVisible"
      mode="bottom"
      round="20"
      :close-on-click-overlay="true"
      @close="closeSheet"
    >
      <view class="sheet">
        <view class="sheet-header">
          <text class="sheet-title">{{ previewVisible ? "预览头像" : "更换头像" }}</text>
          <u-icon name="close" :size="20" color="#64748b" @click="closeSheet" />
        </view>

        <view v-if="previewVisible" class="sheet-preview">
          <text class="preview-tip">确认效果后保存，或重新选择</text>
          <view class="preview-frame">
            <image class="preview-img" :src="previewImageSrc" mode="aspectFill" />
          </view>
          <view class="preview-btns">
            <view class="preview-btn-col">
              <u-button
                text="重新选择"
                shape="circle"
                :custom-style="secondaryBtnStyle"
                @click="clearPreview"
              />
            </view>
            <view class="preview-btn-col">
              <u-button
                type="primary"
                text="确定保存"
                shape="circle"
                :loading="saveLoading"
                :custom-style="primaryBtnStyleNarrow"
                @click="onConfirmSaveAvatar"
              />
            </view>
          </view>
        </view>

        <template v-else>
          <view class="tab-bar">
            <view
              class="tab-item"
              :class="{ 'tab-item--on': sheetTab === 'upload' }"
              @click="sheetTab = 'upload'"
            >
              本地上传
            </view>
            <view
              class="tab-item"
              :class="{ 'tab-item--on': sheetTab === 'ai' }"
              @click="sheetTab = 'ai'"
            >
              AI 生成
            </view>
          </view>

          <view v-if="sheetTab === 'upload'" class="sheet-panel">
            <text class="sheet-desc">从相册选择或拍照，上传后可预览，满意后再点确定保存。</text>
            <u-button
              type="primary"
              text="选择图片"
              shape="circle"
              :loading="uploadLoading"
              :custom-style="primaryBtnStyle"
              @click="onPickAndUpload"
            />
          </view>

          <view v-else class="sheet-panel">
            <view class="sheet-field-head">
              <text class="sheet-label">描述画面</text>
              <text class="sheet-counter">{{ aiPrompt.length }}/500</text>
            </view>
            <textarea
              v-model.trim="aiPrompt"
              class="sheet-textarea"
              :maxlength="500"
              auto-height
              placeholder="例如：卡通小猫，浅色背景，微笑"
              placeholder-class="input-ph"
            />
            <u-button
              type="primary"
              text="确定生成"
              shape="circle"
              :loading="aiLoading"
              :custom-style="primaryBtnStyle"
              @click="onAiGenerateConfirm"
            />
          </view>
        </template>

        <view class="sheet-safe" />
      </view>
    </u-popup>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { generateAvatarByAiApi } from "@/api/ai";
import { uploadImageApi } from "@/api/common";
import { updateUserProfileApi } from "@/api/userProfile";
import { resolveAssetUrl } from "@/utils/request";

/**
 * 用户缓存结构，来源于登录接口返回 user。
 */
interface LoginUser {
  id?: number;
  username?: string;
  nickname?: string;
  avatar?: string;
}

const primaryBtnStyle =
  "width: 100%; height: 88rpx; font-size: 30rpx; font-weight: 600; color: #ffffff; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none;";

/** 预览页「重新选择」按钮（外层 flex 占宽，此处 width 100%） */
const secondaryBtnStyle =
  "width: 100%; height: 88rpx; font-size: 28rpx; font-weight: 600; background: #f1f5f9; color: #475569; border: none;";

/** 预览页「确定保存」按钮 */
const primaryBtnStyleNarrow =
  "width: 100%; height: 88rpx; font-size: 28rpx; font-weight: 600; color: #ffffff; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none;";

const loginUserRef = ref<LoginUser | null>(null);
const sheetVisible = ref(false);
const sheetTab = ref<"upload" | "ai">("upload");
const aiPrompt = ref("");
const uploadLoading = ref(false);
const aiLoading = ref(false);

/** 是否展示预览（上传或 AI 生成成功后为 true，点确定保存或关闭弹层后清除） */
const previewVisible = ref(false);
/** 待写入资料库的头像路径，如 /image/test/xxx.png */
const pendingAvatarPath = ref("");
/** 预览图地址：本地上传可用接口返回的 Base64，AI 用完整资源 URL */
const previewImageSrc = ref("");
const saveLoading = ref(false);

/**
 * 从本地缓存刷新用户信息，供展示与保存后同步。
 */
const refreshLoginUser = () => {
  loginUserRef.value = (uni.getStorageSync("loginUser") as LoginUser | undefined) || null;
};

onShow(() => {
  refreshLoginUser();
});

/**
 * 读取本地用户信息并提供默认展示值；头像相对路径会拼成可访问完整地址。
 */
const displayUser = computed(() => {
  const cacheUser = loginUserRef.value;
  return {
    username: cacheUser?.nickname || cacheUser?.username || "未登录用户",
    avatar: resolveAssetUrl(cacheUser?.avatar || ""),
  };
});

/**
 * 关闭底部弹层并恢复默认 Tab，避免下次打开仍停在 AI 页。
 */
const closeSheet = () => {
  sheetVisible.value = false;
  sheetTab.value = "upload";
  aiPrompt.value = "";
  previewVisible.value = false;
  pendingAvatarPath.value = "";
  previewImageSrc.value = "";
};

/**
 * 退出预览回到 Tab 操作区，不关闭弹层。
 */
const clearPreview = () => {
  previewVisible.value = false;
  pendingAvatarPath.value = "";
  previewImageSrc.value = "";
};

/**
 * 将新头像写入数据库并合并进本地 loginUser 缓存。
 */
const applyAvatarPath = async (avatarPath: string, successMsg: string): Promise<boolean> => {
  const save = await updateUserProfileApi({ avatar: avatarPath });
  const ok = save.code === 0 || save.code === 200;
  if (!ok || !save.data?.user) {
    uni.showToast({ title: save.message || "保存失败", icon: "none" });
    return false;
  }
  const prev = (uni.getStorageSync("loginUser") as Record<string, unknown>) || {};
  uni.setStorageSync("loginUser", { ...prev, ...save.data.user });
  refreshLoginUser();
  uni.showToast({ title: successMsg, icon: "success" });
  closeSheet();
  return true;
};

/**
 * 点击头像：未登录提示去登录；已登录则弹出更换头像面板。
 */
const onAvatarClick = () => {
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  clearPreview();
  sheetVisible.value = true;
};

/**
 * 选择相册/相机图片并上传，成功后写入用户头像字段。
 */
const onPickAndUpload = () => {
  if (uploadLoading.value) return;
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: async (res) => {
      const path = res.tempFilePaths[0];
      uploadLoading.value = true;
      try {
        const apiRes = await uploadImageApi(path);
        const ok = apiRes.code === 0 || apiRes.code === 200;
        if (!ok || !apiRes.data?.fileName) {
          uni.showToast({ title: apiRes.message || "上传失败", icon: "none" });
          return;
        }
        const avatarPath = `/image/test/${apiRes.data.fileName}`;
        pendingAvatarPath.value = avatarPath;
        previewImageSrc.value =
          apiRes.data.imageBase64 && apiRes.data.imageBase64.length > 0
            ? apiRes.data.imageBase64
            : resolveAssetUrl(avatarPath);
        previewVisible.value = true;
      } catch {
        uni.showToast({ title: "上传失败", icon: "none" });
      } finally {
        uploadLoading.value = false;
      }
    },
  });
};

/**
 * 根据描述调用服务端 AI 生成头像，生成成功后写入用户头像字段。
 */
const onAiGenerateConfirm = async () => {
  if (aiLoading.value) return;
  const text = aiPrompt.value.trim();
  if (!text) {
    uni.showToast({ title: "请先输入描述", icon: "none" });
    return;
  }
  aiLoading.value = true;
  try {
    const gen = await generateAvatarByAiApi({ prompt: text });
    const ok = gen.code === 0 || gen.code === 200;
    if (!ok || !gen.data?.avatar) {
      uni.showToast({ title: gen.message || "生成失败", icon: "none" });
      return;
    }

    pendingAvatarPath.value = gen.data.avatar;
    const b64 = gen.data.imageBase64?.trim();
    previewImageSrc.value =
      b64 && b64.startsWith("data:") ? b64 : resolveAssetUrl(gen.data.avatar);
    previewVisible.value = true;
  } catch {
    uni.showToast({ title: "生成失败", icon: "none" });
  } finally {
    aiLoading.value = false;
  }
};

/**
 * 用户确认预览后，将待保存路径写入用户资料并关闭弹层。
 */
const onConfirmSaveAvatar = async () => {
  if (saveLoading.value || !pendingAvatarPath.value) return;
  saveLoading.value = true;
  try {
    await applyAvatarPath(pendingAvatarPath.value, "头像已更新");
  } finally {
    saveLoading.value = false;
  }
};
</script>

<style scoped>
/* 与「我的」页 profile/index 同一套背景与气质，避免风格割裂 */
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
  position: relative;
  z-index: 1;
  padding: 20rpx 16rpx 32rpx;
}

.settings-card {
  border-radius: 20rpx;
  background: linear-gradient(128deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: 0 8rpx 22rpx rgba(24, 42, 84, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.88);
  overflow: hidden;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 20rpx;
  box-sizing: border-box;
}

.cell--tap:active {
  opacity: 0.92;
}

.cell-label {
  font-size: 28rpx;
  color: #64748b;
}

.cell-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.cell-hint {
  font-size: 22rpx;
  color: #94a3b8;
}

.cell-value-text {
  max-width: 62%;
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet {
  padding-bottom: 8rpx;
  background: #ffffff;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 16rpx 20rpx;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.tab-bar {
  display: flex;
  margin: 0 16rpx;
  border-bottom: 1rpx solid #e2e8f0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 12rpx 18rpx;
  font-size: 28rpx;
  color: #94a3b8;
  border-bottom: 4rpx solid transparent;
  margin-bottom: -1rpx;
}

.tab-item--on {
  color: #2563eb;
  font-weight: 600;
  border-bottom-color: #2563eb;
}

.sheet-panel {
  padding: 28rpx 16rpx 16rpx;
}

.sheet-desc {
  display: block;
  margin-bottom: 24rpx;
  font-size: 26rpx;
  color: #64748b;
  line-height: 1.5;
}

.sheet-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.sheet-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #334155;
}

.sheet-counter {
  font-size: 22rpx;
  color: #94a3b8;
}

.sheet-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 20rpx 22rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  color: #0f172a;
  background: #f8fafc;
  border-radius: 16rpx;
  border: 1rpx solid #e2e8f0;
}

.input-ph {
  color: #94a3b8;
}

.sheet-safe {
  height: calc(16rpx + env(safe-area-inset-bottom));
}

.sheet-preview {
  padding: 8rpx 16rpx 16rpx;
}

.preview-tip {
  display: block;
  text-align: center;
  font-size: 26rpx;
  color: #64748b;
  margin-bottom: 24rpx;
  line-height: 1.45;
}

.preview-frame {
  width: 280rpx;
  height: 280rpx;
  margin: 0 auto 32rpx;
  border-radius: 50%;
  overflow: hidden;
  background: #f1f5f9;
  border: 4rpx solid #e2e8f0;
  box-sizing: border-box;
}

.preview-img {
  width: 100%;
  height: 100%;
  display: block;
}

.preview-btns {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  align-items: stretch;
}

.preview-btn-col {
  flex: 1;
  min-width: 0;
}
</style>
