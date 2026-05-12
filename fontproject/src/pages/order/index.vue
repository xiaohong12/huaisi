<template>
  <view class="page" :style="keyboardCssVars">
    <!-- 聊天内容区域 -->
    <scroll-view 
      class="chat-container" 
      scroll-y 
      :scroll-into-view="scrollToView"
      scroll-with-animation
    >
      <!-- 消息列表 -->
      <view class="message-list" v-if="messageList.length > 0">
        <view 
          v-for="(msg, index) in messageList" 
          :key="index"
          :id="'msg-' + index"
          class="message-item"
          :class="msg.role === 'user' ? 'message-user' : 'message-ai'"
        >
          <!-- AI 头像 -->
          <view v-if="msg.role === 'assistant'" class="avatar ai-avatar">AI</view>
          
          <!-- 消息气泡 -->
          <view class="message-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-ai'">
            <text class="message-content" user-select>{{ msg.content }}</text>
            <!-- 正在输入的光标动画 -->
            <view v-if="msg.role === 'assistant' && isGenerating && index === messageList.length - 1" class="cursor-blink"></view>
          </view>

          <!-- 用户头像 -->
          <view v-if="msg.role === 'user'" class="avatar user-avatar">我</view>
        </view>
      </view>
      
      <!-- 底部占位，确保最后一条消息不被输入框遮挡 -->
      <view :id="bottomId" class="bottom-placeholder"></view>
    </scroll-view>

    <!-- 欢迎语和预设问题（仅在没有对话历史时固定在输入区上方） -->
    <view v-if="messageList.length === 0" class="welcome-fixed">
      <view class="welcome-section">
        <text class="welcome-title">Hi，今天需要小易为你解答问题吗？</text>
        <view class="preset-questions">
          <view
            v-for="(item, index) in presetQuestions"
            :key="index"
            class="preset-item"
            @tap="sendPresetMessage(item)"
          >
            <text class="preset-text">{{ item }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部输入区域：键盘弹起时仅抬高本区域，不顶起整页（依赖 adjust-position=false + 键盘高度变量） -->
    <view class="input-section-wrapper">
      <view class="input-section">
        <view class="input-icon">
          <image src="/static/voice-icon.png" mode="aspectFit" class="icon-img" v-if="false" /> <!-- 占位语音图标，可根据需要替换 -->
        </view>
        <input 
          class="chat-input" 
          v-model="inputText" 
          placeholder="发送消息" 
          placeholder-class="input-placeholder"
          confirm-type="send"
          @confirm="sendMessage"
          :disabled="isGenerating"
          :adjust-position="false"
          :cursor-spacing="16"
        />
        <view 
          class="send-btn" 
          :class="{ 'btn-disabled': !inputText.trim() || isGenerating }"
          @tap="sendMessage"
        >
          发送
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onBeforeUnmount } from 'vue';
import { streamAiChat, type ChatMessage } from '@/api/ai';

/** 键盘高度（px），用于只抬高输入条与滚动留白，避免系统默认把整个页面上推 */
const keyboardHeightPx = ref(0);

/** 写入根节点 CSS 变量，供 bottom / padding-bottom 与键盘联动 */
const keyboardCssVars = computed(() => ({
  '--keyboard-height': `${keyboardHeightPx.value}px`,
}));

/** 监听键盘高度变化（微信小程序等端支持） */
const onKeyboardHeightChange = (res: { height?: number }) => {
  keyboardHeightPx.value = typeof res?.height === 'number' ? res.height : 0;
};

onMounted(() => {
  uni.onKeyboardHeightChange(onKeyboardHeightChange);
});

onBeforeUnmount(() => {
  uni.offKeyboardHeightChange(onKeyboardHeightChange);
});

/**
 * 预设问题列表
 */
const presetQuestions = ref<string[]>([
  "什么是二次元文化？",
  "新番和旧番有什么区别？",
  "有哪些经典的二次元作品推荐？",
  "漫展一般要注意什么？",
  "如何区分番剧类型（如热血、日常、异世界）？"
]);

/**
 * 消息列表状态
 */
const messageList = ref<ChatMessage[]>([]);

/**
 * 输入框绑定的文本
 */
const inputText = ref<string>('');

/**
 * 是否正在生成回答中
 */
const isGenerating = ref<boolean>(false);

/**
 * 用于控制滚动条滚动到指定元素的 ID
 */
const scrollToView = ref<string>('');
const bottomId = ref<string>('scroll-bottom-0');

let scrollCount = 0;

/**
 * 滚动到页面底部
 */
const scrollToBottom = () => {
  scrollCount++;
  // 动态改变底部占位元素的 ID，强制触发 scroll-into-view 更新
  bottomId.value = 'scroll-bottom-' + scrollCount;
  nextTick(() => {
    scrollToView.value = bottomId.value;
  });
};

/**
 * 发送预设问题
 * @param text 预设问题的文本
 */
const sendPresetMessage = (text: string) => {
  if (isGenerating.value) return;
  inputText.value = text;
  sendMessage();
};

/**
 * 发送消息并调用 AI 接口
 */
const sendMessage = () => {
  const text = inputText.value.trim();
  if (!text || isGenerating.value) return;

  // 添加用户消息
  messageList.value.push({
    role: 'user',
    content: text
  });
  
  // 清空输入框并滚动到底部
  inputText.value = '';
  scrollToBottom();

  // 添加 AI 占位消息
  messageList.value.push({
    role: 'assistant',
    content: ''
  });
  
  isGenerating.value = true;
  scrollToBottom();

  // 准备发送给接口的历史记录（排除最后一条空的 AI 消息）
  const historyMessages = messageList.value.slice(0, -1);

  // 调用流式 AI 接口
  streamAiChat(
    historyMessages,
    // onChunk: 接收到数据片段
    (chunkText: string) => {
      const lastIndex = messageList.value.length - 1;
      if (messageList.value[lastIndex].role === 'assistant') {
        messageList.value[lastIndex].content += chunkText;
        scrollToBottom();
      }
    },
    // onDone: 接收完成
    () => {
      isGenerating.value = false;
      scrollToBottom();
    },
    // onError: 发生错误
    (err: string) => {
      isGenerating.value = false;
      const lastIndex = messageList.value.length - 1;
      if (messageList.value[lastIndex].role === 'assistant') {
        if (!messageList.value[lastIndex].content) {
          messageList.value[lastIndex].content = '抱歉，请求发生错误，请稍后再试。';
        }
      }
      uni.showToast({
        title: err || '请求失败',
        icon: 'none'
      });
      scrollToBottom();
    }
  );
};
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100vh;
  background: #f5f7fb;
  box-sizing: border-box;
  --keyboard-height: 0px;
  /* 二级聊天页无 Tab，输入条高度：上下 padding 20*2 + 输入框 80 */
  --order-input-strip-height: 120rpx;
}

/* 聊天内容区域，占据剩余空间 */
.chat-container {
  flex: 1;
  height: 0; /* 配合 flex: 1 限制高度，使 scroll-view 生效 */
  padding: 0 16rpx;
  /* 为固定输入条、安全区与键盘抬起预留底部滚动空间 */
  padding-bottom: calc(
    var(--order-input-strip-height) + env(safe-area-inset-bottom) + var(--keyboard-height)
  );
  box-sizing: border-box;
}

/* 欢迎区域 */
.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* 左对齐 */
}

.welcome-fixed {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(
    var(--order-input-strip-height) + env(safe-area-inset-bottom) + var(--keyboard-height)
  );
  padding: 0 16rpx;
  box-sizing: border-box;
}

.welcome-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #3b3b8c; /* 深蓝色 */
  margin-bottom: 40rpx;
}

/* 预设问题列表 */
.preset-questions {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* 左对齐 */
  width: 100%;
  gap: 24rpx;
}

.preset-item {
  background-color: #f0f5ff; /* 浅蓝色背景 */
  padding: 16rpx 32rpx;
  border-radius: 40rpx; /* 胶囊形状 */
  transition: all 0.2s;
  display: inline-block;
}

.preset-item:active {
  background-color: #e0e7ff;
}

.preset-text {
  font-size: 28rpx;
  color: #3b82f6; /* 蓝色文字 */
}

/* 消息列表 */
.message-list {
  padding: 30rpx 0;
}

.message-item {
  display: flex;
  margin-bottom: 40rpx;
  align-items: flex-start;
}

.message-user {
  flex-direction: row;
  justify-content: flex-end;
}

.message-ai {
  flex-direction: row;
}

/* 头像 */
.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  flex-shrink: 0;
}

.ai-avatar {
  background-color: #3b82f6;
  color: #ffffff;
  margin-right: 16rpx;
}

.user-avatar {
  background-color: #10b981;
  color: #ffffff;
  margin-left: 16rpx;
}

/* 消息气泡 */
.message-bubble {
  max-width: 70%;
  padding: 20rpx 28rpx;
  border-radius: 24rpx;
  word-break: break-all;
}

.bubble-user {
  background-color: #3b82f6;
  color: #ffffff;
  border-top-right-radius: 10rpx;
}

.bubble-ai {
  background-color: #ffffff;
  color: #1f2937;
  border-top-left-radius: 10rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.message-content {
  font-size: 28rpx;
  line-height: 1.6;
}

/* 光标闪烁动画 */
.cursor-blink {
  display: inline-block;
  width: 4rpx;
  height: 28rpx;
  background-color: #3b82f6;
  margin-left: 4rpx;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 底部占位 */
.bottom-placeholder {
  height: 40rpx;
}

/* 底部输入区域：固定在视口底部，随键盘变量上移 */
.input-section-wrapper {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 100;
  background-color: #ffffff;
  box-shadow: 0 -4rpx 24rpx rgba(28, 34, 46, 0.06);
  padding-bottom: 20rpx;
  bottom: calc(var(--keyboard-height));
}

.input-section {
  display: flex;
  align-items: center;
  padding: 20rpx 16rpx;
  background-color: #ffffff;
}

.input-icon {
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-text {
  font-size: 40rpx;
  color: #9ca3af;
}

.chat-input {
  flex: 1;
  height: 80rpx;
  background-color: #f3f4f6; /* 浅灰色背景 */
  border-radius: 40rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  margin-right: 20rpx;
}

.input-placeholder {
  color: #9ca3af;
  font-size: 28rpx;
}

.send-btn {
  width: 120rpx;
  height: 72rpx;
  background-color: #e0e7ff; /* 浅蓝色背景 */
  color: #3b82f6; /* 蓝色文字 */
  border-radius: 36rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.2;
  transition: all 0.2s;
}

.send-btn:active {
  background-color: #c7d2fe;
}

.btn-disabled {
  background-color: #f3f4f6;
  color: #9ca3af;
  pointer-events: none;
}
</style>
