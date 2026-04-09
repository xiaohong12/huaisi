<template>
  <view class="post-card">
    <view class="post-head">
      <view class="avatar" :style="{ background: post.avatarBg }">
        <text class="avatar-letter">{{ post.avatarLetter }}</text>
      </view>
      <view class="post-user">
        <text class="username">{{ post.username }}</text>
        <view class="tag" :style="{ background: post.tagBg, color: post.tagColor }">
          <text>{{ post.tag }}</text>
        </view>
      </view>
      <view class="more-dots" @click="onMoreClick">
        <view class="dot" />
        <view class="dot" />
        <view class="dot" />
      </view>
    </view>

    <text class="post-title">{{ post.title }}</text>
    <!-- 正文最多展示 3 行；超过 3 行时在第三行末尾与 … 同一行显示「展开」 -->
    <view class="post-body-block">
      <template v-if="!bodyExpanded">
        <view :id="'body-measure-' + post.id" class="post-body-measure" aria-hidden="true">
          <text class="post-body">{{ post.content }}</text>
        </view>
        <view class="post-body-clamp-wrap">
          <view class="post-body post-body--clamp">
            <text>{{ post.content }}</text>
          </view>
          <text
            v-if="showBodyExpand"
            class="post-body-toggle post-body-toggle--inline"
            @click.stop="bodyExpanded = true"
          >展开</text>
        </view>
      </template>
      <template v-else>
        <text class="post-body post-body--full">{{ post.content }}</text>
        <text class="post-body-toggle post-body-toggle--below" @click.stop="bodyExpanded = false">收起</text>
      </template>
    </view>

    <!-- 多图：与原先一致横向等分 + 固定高度；单图：半宽 + widthFix。点击可预览，多图可滑动切换 -->
    <view class="img-grid" :class="{ 'img-grid--single': isSinglePostImage }">
      <view
        v-for="(img, idx) in post.images"
        :key="idx"
        class="img-cell"
        :class="{ 'img-cell--single': isSinglePostImage }"
      >
        <image
          v-if="isHttpImage(img)"
          class="img-fill"
          :class="{ 'img-fill--single': isSinglePostImage }"
          :src="img"
          :mode="isSinglePostImage ? 'widthFix' : 'aspectFill'"
          @tap.stop="onTapPostImage(idx)"
        />
        <view
          v-else
          class="img-fill img-fill--bg"
          :class="{ 'img-fill--single-bg': isSinglePostImage }"
          :style="{ background: img }"
        />
      </view>
    </view>

    <view class="action-bar">
      <view class="action-item" @click="openCommentComposer">
        <image class="action-ico" :src="iconMessage" mode="aspectFit" />
        <text class="action-num">{{ displayCommentCount }}</text>
      </view>
      <view class="action-item" @click.stop="onToggleLike">
        <image
          class="action-ico action-toggle-ico"
          :class="{ 'action-ico--active': post.liked }"
          :src="iconLike"
          mode="aspectFit"
        />
        <text class="action-num">{{ post.likes }}</text>
      </view>
      <view class="action-item" @click.stop="onToggleFavorite">
        <image
          class="action-ico action-toggle-ico"
          :class="{ 'action-ico--active': post.favorited }"
          :src="iconLove"
          mode="aspectFit"
        />
        <text class="action-num">{{ post.favorites }}</text>
      </view>
      <view class="action-item">
        <image class="action-ico" :src="iconShare" mode="aspectFit" />
      </view>
    </view>

    <view v-if="commentsLoaded && commentList.length" class="comment-list">
      <view
        v-for="item in commentList"
        :key="item.id"
        class="comment-item"
        @click.stop="openReplyComposer(item)"
      >
        <template v-if="item.parentId != null">
          <text class="comment-name">{{ displayName(item.userId, item.nickname) }}</text>
          <text class="comment-text-link"> 回复了 </text>
          <text class="comment-name">{{ replyTargetDisplay(item) }}</text>
          <text class="comment-text-link">：</text>
        </template>
        <template v-else>
          <text class="comment-name">{{ displayName(item.userId, item.nickname) }}</text>
          <text class="comment-text-link">：</text>
        </template>
        <text class="comment-content">{{ item.content }}</text>
      </view>
    </view>
    <view v-if="commentsLoading" class="comment-loading">
      <text class="comment-loading-text">评论加载中…</text>
    </view>

    <view v-if="showComposer" class="composer-wrap">
      <input
        class="composer-input"
        v-model.trim="commentDraft"
        :focus="inputFocus"
        confirm-type="send"
        :placeholder="composerPlaceholder"
        cursor-spacing="24"
        @confirm="sendComment"
        @blur="onComposerBlur"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from "vue";
import iconMessage from "@/static/image/message.png";
import iconLike from "@/static/image/like.png";
import iconLove from "@/static/image/love.png";
import iconShare from "@/static/image/share.png";
import {
  createPostCommentApi,
  getPostCommentsApi,
  togglePostFavoriteApi,
  togglePostLikeApi,
  type PostCommentDTO,
  type PostFeedItemDTO,
} from "@/api/post";
import { openImagePreview } from "@/utils/imagePreview";

interface PostItem {
  id: number;
  username: string;
  avatarLetter: string;
  avatarBg: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  title: string;
  /** 正文，与列表接口 content 一致 */
  content: string;
  images: string[];
  comments: number;
  likes: number;
  favorites: number;
  liked: boolean;
  favorited: boolean;
}

const props = defineProps<{
  post: PostItem;
}>();

/** 正文是否已展开（仅当前卡片） */
const bodyExpanded = ref(false);
/** 折叠态正文超过 3 行时为 true，用于显示行尾「展开」 */
const showBodyExpand = ref(false);

const instance = getCurrentInstance();

/**
 * 根据隐藏测量节点高度估算行数，超过 3 行则显示「展开」。
 */
const measureBodyExpand = () => {
  const raw = props.post.content ?? "";
  if (!raw.trim()) {
    showBodyExpand.value = false;
    return;
  }
  nextTick(() => {
    const q = uni.createSelectorQuery();
    const proxy = instance?.proxy;
    if (proxy) {
      // 组件内查询节点，需挂载到当前页面实例
      q.in(proxy as any);
    }
    q.select(`#body-measure-${props.post.id}`)
      .boundingClientRect((rect) => {
        const r = Array.isArray(rect) ? rect[0] : rect;
        if (!r || typeof r.height !== "number" || r.height <= 0) {
          showBodyExpand.value = false;
          return;
        }
        const lineH = uni.upx2px(26) * 1.55;
        const lines = Math.ceil(r.height / lineH - 0.001);
        showBodyExpand.value = lines > 3;
      })
      .exec();
  });
};

watch(
  () => [props.post.id, props.post.content] as const,
  () => {
    bodyExpanded.value = false;
    measureBodyExpand();
  }
);

onMounted(() => {
  measureBodyExpand();
});

const emit = defineEmits<{
  (e: "more", id: number): void;
  (e: "updatePost", dto: PostFeedItemDTO): void;
  (e: "updateCommentCount", payload: { postId: number; commentCount: number }): void;
}>();

/** 防止点赞连点重复请求 */
const likeBusy = ref(false);
/** 防止收藏连点重复请求 */
const favoriteBusy = ref(false);

/**
 * 是否可用 `<image :src>` 直接展示（http(s) 或 data URL；否则按 CSS 渐变背景展示）。
 */
const isHttpImage = (src: string) => /^https?:\/\//i.test(src) || /^data:image\//i.test(src);

/** 仅一张图时半宽 + widthFix；多图时保持原宫格尺寸与 aspectFill */
const isSinglePostImage = computed(() => props.post.images.length === 1);

/**
 * 点击帖子图：uni.previewImage 全屏预览，多图可滑动；Base64 在小程序会先写入临时文件。
 */
const onTapPostImage = (displayIndex: number) => {
  const all = props.post.images;
  const previewable = all.filter((src) => isHttpImage(src));
  if (previewable.length === 0) {
    return;
  }
  let currentIndex = 0;
  let seen = -1;
  for (let i = 0; i < all.length; i += 1) {
    if (isHttpImage(all[i])) {
      seen += 1;
      if (i === displayIndex) {
        currentIndex = seen;
        break;
      }
    }
  }
  void openImagePreview(previewable, currentIndex);
};

/** 已从服务端拉取过的评论列表（时间正序）。 */
const commentList = ref<PostCommentDTO[]>([]);
/** 是否已请求过评论列表（用于区分未加载与加载后为空）。 */
const commentsLoaded = ref(false);
/** 正在拉取评论。 */
const commentsLoading = ref(false);
/** 正在发送评论，防止连点。 */
const commentSubmitting = ref(false);
/** 评论输入草稿。 */
const commentDraft = ref("");
/** 是否展示键盘上方输入框。 */
const showComposer = ref(false);
/** 控制 input 主动聚焦，点击评论图标后唤起键盘。 */
const inputFocus = ref(false);
/**
 * 回复模式：回复针对被点击的那条评论（parentId 为对方评论 id，placeholder 为对方展示名）。
 */
const replyContext = ref<{ parentId: number; placeholder: string } | null>(null);

/** 评论数与帖子同步，由接口返回后通过父组件更新。 */
const displayCommentCount = computed(() => props.post.comments);
/** 输入框占位：发新评论或回复某人。 */
const composerPlaceholder = computed(() =>
  replyContext.value ? `回复${replyContext.value.placeholder}` : "说点什么..."
);

watch(
  () => props.post.id,
  () => {
    commentsLoaded.value = false;
    commentList.value = [];
    replyContext.value = null;
    commentDraft.value = "";
    showComposer.value = false;
    inputFocus.value = false;
  }
);

/**
 * 当前登录用户 ID（与 loginUser 缓存一致，用于展示「我」）。
 */
function getMyUserId(): number | null {
  const u = uni.getStorageSync("loginUser") as { id?: number } | undefined;
  return typeof u?.id === "number" ? u.id : null;
}

/**
 * 评论里用户昵称展示：本人显示「我」。
 */
function displayName(userId: number, nickname: string): string {
  const me = getMyUserId();
  if (me != null && userId === me) {
    return "我";
  }
  return nickname?.trim() || "用户";
}

/**
 * 「回复了」后面的被回复者展示名。
 */
function replyTargetDisplay(item: PostCommentDTO): string {
  if (item.replyToUserId != null) {
    return displayName(item.replyToUserId, item.replyToNickname || "用户");
  }
  return item.replyToNickname?.trim() || "用户";
}

/**
 * 首次打开评论区时拉取服务端评论。
 */
async function loadComments(): Promise<void> {
  if (commentsLoading.value) return;
  commentsLoading.value = true;
  try {
    const res = await getPostCommentsApi(props.post.id);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data?.list) {
      commentList.value = res.data.list;
      commentsLoaded.value = true;
    } else {
      uni.showToast({ title: res.message || "加载评论失败", icon: "none" });
    }
  } catch {
    uni.showToast({ title: "网络异常，评论加载失败", icon: "none" });
  } finally {
    commentsLoading.value = false;
  }
}

/**
 * 点击帖子右上角更多按钮，向父组件派发事件。
 */
const onMoreClick = () => {
  emit("more", props.post.id);
};

/**
 * 切换点赞：成功或失败均轻提示；成功时用接口返回的整帖数据交给父组件替换该条。
 */
const onToggleLike = async () => {
  if (likeBusy.value) return;
  likeBusy.value = true;
  try {
    const res = await togglePostLikeApi(props.post.id);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data) {
      uni.showToast({ title: res.message || "操作成功", icon: "none", duration: 1500 });
      emit("updatePost", res.data);
    } else {
      uni.showToast({ title: res.message || "操作失败", icon: "none", duration: 1800 });
    }
  } catch {
    uni.showToast({ title: "网络异常，请稍后重试", icon: "none" });
  } finally {
    likeBusy.value = false;
  }
};

/**
 * 切换收藏：逻辑同点赞。
 */
const onToggleFavorite = async () => {
  if (favoriteBusy.value) return;
  favoriteBusy.value = true;
  try {
    const res = await togglePostFavoriteApi(props.post.id);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data) {
      uni.showToast({ title: res.message || "操作成功", icon: "none", duration: 1500 });
      emit("updatePost", res.data);
    } else {
      uni.showToast({ title: res.message || "操作失败", icon: "none", duration: 1800 });
    }
  } catch {
    uni.showToast({ title: "网络异常，请稍后重试", icon: "none" });
  } finally {
    favoriteBusy.value = false;
  }
};

/**
 * 打开评论输入框：先拉取评论列表，再唤起键盘发新评论（非回复）。
 */
const openCommentComposer = async () => {
  replyContext.value = null;
  if (!commentsLoaded.value) {
    await loadComments();
  }
  showComposer.value = true;
  inputFocus.value = true;
};

/**
 * 点击某条评论：回复该条（楼中楼 parentId 指向被点的评论 id）。
 */
const openReplyComposer = async (item: PostCommentDTO) => {
  if (!commentsLoaded.value) {
    await loadComments();
  }
  replyContext.value = {
    parentId: item.id,
    placeholder: displayName(item.userId, item.nickname),
  };
  showComposer.value = true;
  inputFocus.value = true;
};

/**
 * 发送评论或回复：需登录；成功后追加列表并通知父组件更新评论数。
 */
const sendComment = async () => {
  const text = commentDraft.value.trim();
  if (!text || commentSubmitting.value) return;
  const token = uni.getStorageSync("token") as string | undefined;
  if (!token) {
    uni.showToast({ title: "请先登录后再评论", icon: "none" });
    return;
  }
  commentSubmitting.value = true;
  try {
    const body: { content: string; parentId?: number } = { content: text };
    if (replyContext.value != null) {
      body.parentId = replyContext.value.parentId;
    }
    const res = await createPostCommentApi(props.post.id, body);
    const ok = res.code === 0 || res.code === 200;
    if (ok && res.data) {
      commentList.value = [...commentList.value, res.data.comment];
      commentsLoaded.value = true;
      emit("updateCommentCount", {
        postId: props.post.id,
        commentCount: res.data.commentCount,
      });
      uni.showToast({ title: res.message || "发送成功", icon: "none", duration: 1500 });
      commentDraft.value = "";
      replyContext.value = null;
      inputFocus.value = false;
      showComposer.value = false;
    } else {
      uni.showToast({ title: res.message || "发送失败", icon: "none" });
    }
  } catch {
    uni.showToast({ title: "网络异常，发送失败", icon: "none" });
  } finally {
    commentSubmitting.value = false;
  }
};

/**
 * 输入框失焦时收起输入框（无草稿时），避免空态占位。
 */
const onComposerBlur = () => {
  inputFocus.value = false;
  if (!commentDraft.value) {
    replyContext.value = null;
    showComposer.value = false;
  }
};
</script>

<style scoped>
.post-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(15, 23, 42, 0.06);
}

.post-head {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-letter {
  font-size: 30rpx;
  font-weight: 700;
  color: #ffffff;
}

.post-user {
  flex: 1;
  margin-left: 16rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.username {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.tag {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  line-height: 1.2;
}

.more-dots {
  padding: 8rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6rpx;
}

.dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: #9ca3af;
}

.post-title {
  display: block;
  margin-top: 18rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  line-height: 1.35;
}

.post-body-block {
  position: relative;
  margin-top: 12rpx;
}

/* 与正文同宽、不可见，用于估算是否超过 3 行 */
.post-body-measure {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  opacity: 0;
  z-index: -1;
  pointer-events: none;
  overflow: visible;
}

.post-body-measure .post-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.post-body-clamp-wrap {
  position: relative;
  width: 100%;
}

.post-body {
  font-size: 26rpx;
  color: #6b7280;
  line-height: 1.55;
}

/* 折叠态最多 3 行，末尾由系统 … 截断 */
.post-body--clamp {
  display: -webkit-box;
  overflow: hidden;
  word-break: break-word;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.post-body--full {
  display: block;
  margin-top: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 贴在第三行末尾，与 … 同一行（渐变盖住重叠正文） */
.post-body-toggle--inline {
  position: absolute;
  right: 0;
  bottom: 0;
  padding-left: 72rpx;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.55;
  color: #0d5aff;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, #ffffff 35%, #ffffff 100%);
}

.post-body-toggle--below {
  display: inline-block;
  margin-top: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #0d5aff;
}

.img-grid {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  gap: 12rpx;
}

.img-grid--single {
  flex-direction: column;
  align-items: flex-start;
}

.img-cell {
  flex: 1;
  width: 0;
  height: 200rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.img-cell--single {
  flex: none;
  width: 50%;
  height: auto;
  min-height: 0;
}

.img-fill {
  width: 100%;
  height: 100%;
  display: block;
}

.img-fill--single {
  height: auto;
}

.img-fill--bg {
  background-size: cover;
  background-position: center;
}

.img-fill--single-bg {
  min-height: 100rpx;
  height: 100rpx;
  background-size: cover;
  background-position: center;
}

.action-bar {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f3f4f6;
  padding-left: 40rpx;
  padding-right: 40rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.action-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
}

.action-num {
  font-size: 24rpx;
  color: #6b7280;
}

.action-ico {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
  display: block;
}

.action-toggle-ico {
  opacity: 0.55;
}

.action-toggle-ico.action-ico--active {
  opacity: 1;
}

.comment-list {
  margin-top: 16rpx;
  padding: 18rpx 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.comment-item {
  font-size: 24rpx;
  line-height: 1.45;
  padding: 12rpx 0;
  border-bottom: 1px solid #e5e7eb;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-loading {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
}

.comment-loading-text {
  font-size: 24rpx;
  color: #94a3b8;
}

.comment-name {
  color: #2563eb;
  font-weight: 600;
}

.comment-text-link {
  color: #64748b;
}

.comment-content {
  color: #333;
}

.composer-wrap {
  margin-top: 16rpx;
  border-top: 1rpx solid #eef2f7;
  padding-top: 14rpx;
}

.composer-input {
  height: 72rpx;
  border-radius: 14rpx;
  background: #f3f4f6;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #111827;
}
</style>
