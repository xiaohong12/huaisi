import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

/**
 * 创建 DeepSeek 客户端；未配置 key 时返回 null。
 */
const createDeepSeekClient = (): OpenAI | null => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
  });
};

/**
 * GET /api/ai/health
 * AI 服务健康检查接口：用于快速判断 key 是否配置、是否可用、网络是否可达。
 */
router.get('/health', async (_req: Request, res: Response) => {
  const client = createDeepSeekClient();
  if (!client) {
    res.status(500).json({
      code: 500,
      message: 'DEEPSEEK_API_KEY 未配置',
      data: {
        aiAvailable: false,
        reason: 'missing_api_key',
      },
    });
    return;
  }

  try {
    const result = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      stream: false,
    });

    const requestId = (result as unknown as { id?: string }).id || null;
    res.json({
      code: 200,
      message: 'AI 服务可用',
      data: {
        aiAvailable: true,
        provider: 'deepseek',
        model: 'deepseek-chat',
        requestId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI 服务不可用';
    res.status(502).json({
      code: 502,
      message: 'AI 服务不可用',
      data: {
        aiAvailable: false,
        reason: 'upstream_error',
        detail: message,
      },
    });
  }
});

/**
 * POST /api/ai/chat
 * AI 对话接口，使用 SSE（Server-Sent Events）流式输出回复内容到前端
 * 请求体：{ messages: Array<{role: string, content: string}> }
 * 响应：text/event-stream 格式，每次推送 data: {"content": "..."}\n\n
 *       结束时推送 data: [DONE]\n\n
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ code: 400, message: '消息列表不能为空', data: null });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const openai = createDeepSeekClient();
    if (!openai) {
      res.write(`data: ${JSON.stringify({ error: '服务端未配置 DEEPSEEK_API_KEY' })}\n\n`);
      res.end();
      return;
    }

    const stream = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个二次元风格的小甜妹助手，说话元气、可爱、礼貌，适度使用语气词（如“呀”“呢”“喔”）和轻量颜文字（如“(≧▽≦)”），但不要过度。回答要清晰有条理、信息准确，不确定时要明确说明，不要编造。始终使用中文回复。' },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        // 发送 SSE 格式数据块
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // 发送结束标志
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: unknown) {
    console.error('[AI] 流式输出错误:', error);
    const message = error instanceof Error ? error.message : 'AI 服务异常';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
