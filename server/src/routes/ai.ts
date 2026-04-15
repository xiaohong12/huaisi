import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/authMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { TEST_IMAGE_DIR } from '../utils/imageMedia';

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

/**
 * 使用 OpenAI 官方接口生成方形头像图（需配置 OPENAI_API_KEY）；失败时返回 null 以便走备用渠道。
 */
async function tryOpenAiAvatarImage(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({
    model: 'dall-e-2',
    prompt,
    n: 1,
    size: '256x256',
    response_format: 'b64_json',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI 未返回图片数据');
  }
  return Buffer.from(b64, 'base64');
}

/**
 * 通过 Pollinations 公开图床按提示词生成图片（无需 key），作为未配置 OpenAI 绘图时的兜底方案。
 */
async function fetchPollinationsAvatarImage(prompt: string): Promise<Buffer> {
  const safe = prompt.slice(0, 400);
  const encoded = encodeURIComponent(safe);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true&model=flux`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'HuasiServer/1.0',
      Accept: 'image/*',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`绘图服务 HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('绘图服务未返回图片');
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * POST /api/ai/generate-avatar
 * AI 根据文字描述生成用户头像：优先 OpenAI DALL·E，其次 Pollinations；图片写入 image/test。
 * 返回 avatar（相对路径，供写入用户表与前端直接展示）。
 */
router.post('/generate-avatar', requireAuth, async (req: Request, res: Response) => {
  const userId = Number(req.userId || 0);
  if (!Number.isFinite(userId) || userId <= 0) {
    errorResponse(res, '请先登录', 401);
    return;
  }

  const body = req.body as { prompt?: string };
  const raw = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (raw.length < 2) {
    errorResponse(res, '请至少输入 2 个字的画面描述', 400);
    return;
  }
  if (raw.length > 500) {
    errorResponse(res, '描述请不要超过 500 字', 400);
    return;
  }

  // const promptForModel = `Square avatar icon, centered face or subject, clean background, friendly, suitable as user profile photo: ${raw}`;

  const promptForModel = raw;

  let imageBuffer: Buffer;
  try {
    const fromOpenAi = await tryOpenAiAvatarImage(promptForModel.slice(0, 1000));
    if (fromOpenAi) {
      imageBuffer = fromOpenAi;
    } else {
      imageBuffer = await fetchPollinationsAvatarImage(promptForModel);
    }
  } catch (primaryErr) {
    console.warn('[AI] 主通道头像生成失败，尝试兜底:', primaryErr);
    try {
      imageBuffer = await fetchPollinationsAvatarImage(promptForModel);
    } catch (fallbackErr) {
      console.error('[AI] 头像生成失败:', fallbackErr);
      errorResponse(res, 'AI 头像生成失败，请稍后重试', 502);
      return;
    }
  }

  if (!fs.existsSync(TEST_IMAGE_DIR)) {
    fs.mkdirSync(TEST_IMAGE_DIR, { recursive: true });
  }
  const fileName = `avatar-ai-${userId}-${Date.now()}.png`;
  const filePath = path.join(TEST_IMAGE_DIR, fileName);
  try {
    fs.writeFileSync(filePath, imageBuffer);
  } catch (e) {
    console.error('[AI] 头像写入磁盘失败:', e);
    errorResponse(res, '头像保存失败', 500);
    return;
  }

  const avatar = `/image/test/${fileName}`;
  successResponse(res, { avatar }, '生成成功');
});

export default router;
