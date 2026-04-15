import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import sharp from 'sharp';
import { requireAuth } from '../middleware/authMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { TEST_IMAGE_DIR } from '../utils/imageMedia';

const router = Router();
const AVATAR_MAX_SIZE_BYTES = 500 * 1024;

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
 * 从 DashScope 多模态生成返回体中提取图片 URL。
 */
function extractDashscopeImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const data = payload as {
    output?: {
      choices?: Array<{
        message?: {
          content?: Array<{
            image?: string;
            image_url?: string;
            url?: string;
          }>;
        };
      }>;
    };
  };
  const content = data.output?.choices?.[0]?.message?.content;
  if (!Array.isArray(content)) {
    return null;
  }
  for (const item of content) {
    const candidate = item?.image || item?.image_url || item?.url;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

/**
 * 将原图强制转为 webp，并尽量压缩到指定大小（默认 500KB）以内。
 */
async function convertToWebpUnderLimit(input: Buffer, maxBytes = AVATAR_MAX_SIZE_BYTES): Promise<Buffer> {
  const baseMeta = await sharp(input).metadata();
  let width = Math.max(320, baseMeta.width || 1024);
  let quality = 86;
  let output = await sharp(input).webp({ quality }).toBuffer();
  let attempts = 0;

  while (output.length > maxBytes && attempts < 12) {
    attempts += 1;
    if (quality > 40) {
      quality -= 8;
    } else {
      width = Math.max(320, Math.floor(width * 0.85));
    }
    output = await sharp(input)
      .resize({ width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  // 兜底：如果还超限，使用更激进参数再试一次
  if (output.length > maxBytes) {
    output = await sharp(input)
      .resize({ width: 320, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 28 })
      .toBuffer();
  }
  if (output.length > maxBytes) {
    throw new Error(`图片压缩失败，当前大小 ${(output.length / 1024).toFixed(2)}KB，仍超过 500KB`);
  }
  return output;
}

/**
 * 使用 DashScope 同步接口生成图片。
 * 使用独立的 DASHSCOPE_API_KEY，不影响旧的 OpenAI key 配置。
 */
async function tryDashscopeAvatarImage(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'z-image-turbo',
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        prompt_extend: false,
        size: '1120*1440',
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`DashScope 请求失败 HTTP ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const imageUrl = extractDashscopeImageUrl(payload);
  console.log(imageUrl)
  if (!imageUrl) {
    throw new Error('DashScope 未返回图片地址');
  }

  const imageResp = await fetch(imageUrl, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'HuasiServer/1.0',
    },
    redirect: 'follow',
  });
  if (!imageResp.ok) {
    throw new Error(`DashScope 图片下载失败 HTTP ${imageResp.status}`);
  }
  const contentType = imageResp.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('DashScope 图片下载结果不是图片');
  }
  return Buffer.from(await imageResp.arrayBuffer());
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
 * AI 根据文字描述生成用户头像：优先 DashScope（同步调用），其次 Pollinations；图片写入 image/test。
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

  /**
   * 给绘图模型追加默认约束提示词：
   * - 输出尽量贴近 webp 质感
   * - 控制文件体积在 500KB 内
   * 说明：这是提示词约束，模型侧不保证 100% 严格满足。
   */
  const promptForModel = `${raw}
请遵循以下输出约束：
1) 图片格式偏向 webp 输出；
2) 图片文件大小控制在 500KB 以内；
3) 保持画面清晰、主体完整，不要因压缩导致严重失真。`;

  let imageBuffer: Buffer;
  let channelLabel = '主通道-DashScope';
  try {
    const fromDashscope = await tryDashscopeAvatarImage(promptForModel.slice(0, 1000));
    if (fromDashscope) {
      imageBuffer = fromDashscope;
    } else {
      channelLabel = '备用通道-Pollinations';
      imageBuffer = await fetchPollinationsAvatarImage(promptForModel);
    }
  } catch (primaryErr) {
    console.warn('[AI] 主通道头像生成失败，尝试兜底:', primaryErr);
    try {
      channelLabel = '备用通道-Pollinations';
      imageBuffer = await fetchPollinationsAvatarImage(promptForModel);
    } catch (fallbackErr) {
      console.error('[AI] 头像生成失败:', fallbackErr);
      errorResponse(res, 'AI 头像生成失败，请稍后重试', 502);
      return;
    }
  }

  try {
    imageBuffer = await convertToWebpUnderLimit(imageBuffer, AVATAR_MAX_SIZE_BYTES);
  } catch (processErr) {
    console.error('[AI] 图片转 webp 或压缩失败:', processErr);
    errorResponse(res, '图片处理失败，请稍后重试', 500);
    return;
  }

  if (!fs.existsSync(TEST_IMAGE_DIR)) {
    fs.mkdirSync(TEST_IMAGE_DIR, { recursive: true });
  }
  const fileName = `avatar-ai-${userId}-${Date.now()}.webp`;
  const filePath = path.join(TEST_IMAGE_DIR, fileName);
  try {
    fs.writeFileSync(filePath, imageBuffer);
  } catch (e) {
    console.error('[AI] 头像写入磁盘失败:', e);
    errorResponse(res, '头像保存失败', 500);
    return;
  }

  const avatar = `/image/test/${fileName}`;
  console.log(`[AI][${channelLabel}] 最终图片地址:`, avatar);
  console.log(`[AI][${channelLabel}] 最终图片大小: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
  successResponse(res, { avatar }, '生成成功');
});

export default router;
