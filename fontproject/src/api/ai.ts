import { BASE_URL, request } from '@/utils/request';
declare const wx: any;

/**
 * 消息类型定义
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 流式 AI 对话接口 - 使用微信小程序 enableChunked 实现流式接收
 * POST /api/ai/chat
 * @param messages 对话历史消息列表
 * @param onChunk  每接收到一个文字片段时的回调
 * @param onDone   全部接收完成时的回调
 * @param onError  发生错误时的回调
 * @returns requestTask（可调用 .abort() 中止请求）
 */
export const streamAiChat = (
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): any => {
  const token = uni.getStorageSync('token') as string | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 用于拼接不完整的 SSE 数据块
  let buffer = '';
  // 防止 [DONE] 与 success 回调重复触发结束逻辑
  let finished = false;

  /**
   * 解析 SSE 数据行，提取 data 字段内容并触发回调
   */
  const processBuffer = () => {
    const lines = buffer.split('\n');
    // 最后一行可能不完整，保留在 buffer 中
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const raw = trimmed.slice(5).trim();
      if (raw === '[DONE]') {
        if (!finished) {
          finished = true;
          onDone();
        }
        return;
      }

      try {
        const parsed = JSON.parse(raw) as { content?: string; error?: string };
        if (parsed.error) {
          if (!finished) {
            finished = true;
            onError(parsed.error);
          }
        } else if (parsed.content) {
          onChunk(parsed.content);
        }
      } catch {
        // 跳过解析失败的碎片
      }
    }
  };

  const requestTask = wx.request({
    url: `${BASE_URL}/api/ai/chat`,
    method: 'POST',
    data: JSON.stringify({ messages }),
    header: headers,
    // 启用分块接收（微信小程序 SSE 流式关键配置）
    enableChunked: true,
    success: () => {
      // 处理最后可能残留在 buffer 中的数据
      if (buffer.trim()) {
        processBuffer();
      }
      if (!finished) {
        finished = true;
        onDone();
      }
    },
    fail: (err: { errMsg?: string }) => {
      if (!finished) {
        finished = true;
        onError(err.errMsg || '请求失败');
      }
    },
  });

  // 监听分块数据到来
  requestTask.onChunkReceived((res: { data: ArrayBuffer }) => {
    let text = '';
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8');
      text = decoder.decode(new Uint8Array(res.data));
    } else {
      // 兼容真机可能没有 TextDecoder 的情况
      const uint8Array = new Uint8Array(res.data);
      let i = 0;
      while (i < uint8Array.length) {
        let c = uint8Array[i++];
        if (c < 0x80) {
          text += String.fromCharCode(c);
        } else if (c > 0xbf && c < 0xe0) {
          let c2 = uint8Array[i++];
          text += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
        } else if (c > 0xdf && c < 0xf0) {
          let c2 = uint8Array[i++];
          let c3 = uint8Array[i++];
          text += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
        } else {
          let c2 = uint8Array[i++];
          let c3 = uint8Array[i++];
          let c4 = uint8Array[i++];
          let codePoint = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
          codePoint -= 0x10000;
          text += String.fromCharCode((codePoint >> 10) | 0xd800, (codePoint & 0x3ff) | 0xdc00);
        }
      }
    }
    
    buffer += text;
    // 兼容 CRLF，统一换行再解析
    buffer = buffer.replace(/\r\n/g, '\n');
    processBuffer();
  });

  return requestTask;
};

/**
 * POST /api/ai/generate-avatar
 * 根据文字描述生成头像：返回 avatar 图片地址（支持 /image 相对路径或 http/https）。
 */
export const generateAvatarByAiApi = (data: { prompt: string }) => {
  return request<{ avatar: string }>({
    url: '/api/ai/generate-avatar',
    method: 'POST',
    data: data as Record<string, unknown>,
  });
};
