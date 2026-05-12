import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, queryOne } from '../db';
import { requireAuth } from '../middleware/authMiddleware';
import { successResponse } from '../utils/response';
import config from '../config';
import { resolveStoredAvatarForClient, TEST_IMAGE_DIR } from '../utils/imageMedia';

const router = Router();
const TOKEN_EXPIRE_DAYS = 7;

interface LoginBody {
  /** 11 位手机号，与 users.phone 匹配 */
  phone?: string;
  password?: string;
}

/** 手机号注册请求体：手机号、密码及资料（头像、昵称、性别） */
interface RegisterBody {
  phone?: string;
  password?: string;
  /** 展示姓名，写入 users.nickname */
  nickname?: string;
  /** male / female / unknown */
  gender?: string;
  /** 已上传的头像访问路径，如 /image/test/xxx.png */
  avatar?: string;
}

/**
 * 校验注册时头像路径：必须为 /image/test/ 下已存在的文件，防止任意路径写入。
 */
function sanitizeRegisterAvatar(avatarRaw: unknown): string | null {
  if (typeof avatarRaw !== 'string') {
    return null;
  }
  const s = avatarRaw.trim();
  const m = /^\/image\/test\/([a-zA-Z0-9._-]+)$/.exec(s);
  if (!m) {
    return null;
  }
  const fname = m[1];
  const fullPath = path.join(TEST_IMAGE_DIR, fname);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return `/image/test/${fname}`;
}

interface UserLoginRow extends RowDataPacket {
  id: number;
  username: string;
  openid: string | null;
  nickname: string;
  avatar: string;
  gender: 'male' | 'female' | 'unknown';
  password: string;
  status: number;
}

interface WechatMiniLoginBody {
  code?: string;
  nickname?: string;
  avatar?: string;
  gender?: number;
}

interface WechatCode2SessionResp {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatPhoneBody {
  code?: string;
}

interface WechatAccessTokenResp {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatPhoneResp {
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
  };
  errcode?: number;
  errmsg?: string;
}

/**
 * 生成登录 token（随机字符串），用于后续接口鉴权。
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 计算 token 过期时间，默认 7 天。
 */
function getTokenExpireAt(): string {
  const expire = new Date(Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
  return expire.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * 为指定用户签发 token 并写入 user_tokens，单端登录会覆盖旧 token。
 * 返回的 user.avatar 规则：本地 image/test 返回 /image/test 路径；http/https 外链保持原值。
 */
async function issueLoginToken(user: Pick<UserLoginRow, 'id' | 'username' | 'nickname' | 'avatar' | 'gender'>) {
  const token = generateToken();
  const expiresAt = getTokenExpireAt();
  await execute(
    `INSERT INTO user_tokens (user_id, token, expires_at, is_revoked)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       token = VALUES(token),
       expires_at = VALUES(expires_at),
       is_revoked = 0`,
    [user.id, token, expiresAt]
  );
  const avatarDisplay = await resolveStoredAvatarForClient(user.avatar ?? '');
  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: avatarDisplay,
      gender: user.gender
    }
  };
}

/**
 * 微信性别枚举映射：0未知 1男 2女。
 */
function mapWechatGender(gender?: number): 'male' | 'female' | 'unknown' {
  if (gender === 1) return 'male';
  if (gender === 2) return 'female';
  return 'unknown';
}

/**
 * 获取微信小程序全局 access_token（用于手机号接口）。
 */
async function getWechatAccessToken(): Promise<string> {
  const tokenResp = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.wechatMini.appId)}&secret=${encodeURIComponent(config.wechatMini.appSecret)}`
  );
  const tokenData = (await tokenResp.json()) as WechatAccessTokenResp;
  if (!tokenData.access_token) {
    throw new Error(tokenData.errmsg || '获取 access_token 失败');
  }
  return tokenData.access_token;
}

/**
 * 登录接口：按手机号与密码校验，通过后签发并返回 token（单端登录会覆盖旧 token）。
 */
router.post('/login', async (req: Request<unknown, unknown, LoginBody>, res: Response) => {
  try {
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const password = req.body.password;
    if (!phone || !password) {
      successResponse(res, null, '手机号和密码不能为空', 400, 400);
      return;
    }

    const user = await queryOne<UserLoginRow>(
      'SELECT id, username, openid, nickname, avatar, gender, password, status FROM users WHERE phone = ? LIMIT 1',
      [phone]
    );
    if (!user) {
      successResponse(res, null, '手机号或密码错误', 401, 401);
      return;
    }
    if (Number(user.status) !== 1) {
      successResponse(res, null, '账号已被拉黑，请联系管理员', 403, 403);
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      successResponse(res, null, '手机号或密码错误', 401, 401);
      return;
    }

    const loginData = await issueLoginToken(user);
    successResponse(res, loginData, '登录成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `登录失败: ${err.message}`, 500, 500);
  }
});

/**
 * 手机号注册接口：校验手机号与密码规则，若手机号未被占用则创建用户并签发 token（返回结构与登录一致）。
 */
router.post('/register', async (req: Request<unknown, unknown, RegisterBody>, res: Response) => {
  try {
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const password = req.body.password;
    const nicknameRaw = typeof req.body.nickname === 'string' ? req.body.nickname.trim() : '';
    const genderRaw = typeof req.body.gender === 'string' ? req.body.gender.trim() : '';
    if (!phone || !password) {
      successResponse(res, null, '手机号和密码不能为空', 400, 400);
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      successResponse(res, null, '请输入有效的 11 位手机号', 400, 400);
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
      successResponse(res, null, '密码至少 8 位且需同时包含大写与小写字母', 400, 400);
      return;
    }
    if (!nicknameRaw || nicknameRaw.length > 32) {
      successResponse(res, null, '姓名不能为空且不超过 32 个字', 400, 400);
      return;
    }
    let gender: 'male' | 'female' | 'unknown';
    if (genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'unknown') {
      gender = genderRaw;
    } else {
      successResponse(res, null, '请选择有效性别', 400, 400);
      return;
    }
    const avatarStored = sanitizeRegisterAvatar(req.body.avatar);
    if (!avatarStored) {
      successResponse(res, null, '请先上传头像（相册或拍照）', 400, 400);
      return;
    }

    const existed = await queryOne<RowDataPacket>('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
    if (existed) {
      successResponse(res, null, '该手机号已注册，请直接登录', 400, 400);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const nickname = nicknameRaw;
    let username = `u_${phone}`;
    const usernameTaken = await queryOne<RowDataPacket>('SELECT id FROM users WHERE username = ? LIMIT 1', [
      username
    ]);
    if (usernameTaken) {
      username = `u_${phone}_${crypto.randomBytes(3).toString('hex')}`;
    }

    await execute(
      'INSERT INTO users (username, phone, nickname, avatar, gender, password) VALUES (?, ?, ?, ?, ?, ?)',
      [username, phone, nickname, avatarStored, gender, passwordHash]
    );

    const user = await queryOne<UserLoginRow>(
      'SELECT id, username, openid, nickname, avatar, gender, password, status FROM users WHERE phone = ? LIMIT 1',
      [phone]
    );
    if (!user) {
      successResponse(res, null, '注册失败：未找到新建用户', 500, 500);
      return;
    }
    if (Number(user.status) !== 1) {
      successResponse(res, null, '账号状态异常，请联系管理员', 403, 403);
      return;
    }

    const loginData = await issueLoginToken(user);
    successResponse(res, loginData, '注册成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `注册失败: ${err.message}`, 500, 500);
  }
});

/**
 * 微信小程序登录接口：前端传 code，服务端换取 openid 并自动登录/注册。
 */
router.post('/wechat-mini-login', async (req: Request<unknown, unknown, WechatMiniLoginBody>, res: Response) => {
  try {
    const { code, nickname, avatar, gender } = req.body;
    if (!code) {
      successResponse(res, null, 'code 不能为空', 400, 400);
      return;
    }
    if (!config.wechatMini.appId || !config.wechatMini.appSecret) {
      successResponse(res, null, '未配置微信小程序 appId/appSecret', 500, 500);
      return;
    }

    const wxResp = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(config.wechatMini.appId)}&secret=${encodeURIComponent(config.wechatMini.appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
    );
    const wxData = (await wxResp.json()) as WechatCode2SessionResp;
    if (!wxData.openid) {
      successResponse(res, null, `微信登录失败: ${wxData.errmsg || '未获取到 openid'}`, 401, 401);
      return;
    }

    let user = await queryOne<UserLoginRow>(
      'SELECT id, username, openid, nickname, avatar, gender, password, status FROM users WHERE openid = ? LIMIT 1',
      [wxData.openid]
    );

    if (!user) {
      const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const safeNickname = (nickname && nickname.trim()) || `微信用户${wxData.openid.slice(-6)}`;
      const safeAvatar = avatar || '';
      const safeGender = mapWechatGender(gender);
      const username = `wx_${wxData.openid.slice(-18)}`;

      await execute(
        'INSERT INTO users (username, openid, nickname, avatar, gender, password) VALUES (?, ?, ?, ?, ?, ?)',
        [username, wxData.openid, safeNickname, safeAvatar, safeGender, randomPasswordHash]
      );

      user = await queryOne<UserLoginRow>(
        'SELECT id, username, openid, nickname, avatar, gender, password, status FROM users WHERE openid = ? LIMIT 1',
        [wxData.openid]
      );
    } else {
      const nextNickname = nickname && nickname.trim() ? nickname.trim() : user.nickname;
      const nextAvatar = avatar || user.avatar;
      const nextGender = typeof gender === 'number' ? mapWechatGender(gender) : user.gender;
      await execute(
        'UPDATE users SET nickname = ?, avatar = ?, gender = ? WHERE id = ?',
        [nextNickname, nextAvatar, nextGender, user.id]
      );
      user.nickname = nextNickname;
      user.avatar = nextAvatar;
      user.gender = nextGender;
    }

    if (!user) {
      successResponse(res, null, '微信用户创建失败', 500, 500);
      return;
    }
    if (Number(user.status) !== 1) {
      successResponse(res, null, '账号已被拉黑，请联系管理员', 403, 403);
      return;
    }

    const loginData = await issueLoginToken(user);
    successResponse(res, loginData, '微信登录成功');
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `微信登录失败: ${err.message}`, 500, 500);
  }
});

/**
 * 微信手机号接口：前端传 getPhoneNumber 返回的 code，服务端换取手机号。
 */
router.post('/wechat-mini-phone', async (req: Request<unknown, unknown, WechatPhoneBody>, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      successResponse(res, null, '手机号 code 不能为空', 400, 400);
      return;
    }
    if (!config.wechatMini.appId || !config.wechatMini.appSecret) {
      successResponse(res, null, '未配置微信小程序 appId/appSecret', 500, 500);
      return;
    }

    const accessToken = await getWechatAccessToken();
    const phoneResp = await fetch(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      }
    );
    const phoneData = (await phoneResp.json()) as WechatPhoneResp;
    if (!phoneData.phone_info?.phoneNumber) {
      successResponse(res, null, `获取手机号失败: ${phoneData.errmsg || '未获取到手机号'}`, 401, 401);
      return;
    }

    successResponse(
      res,
      {
        phoneNumber: phoneData.phone_info.phoneNumber,
        purePhoneNumber: phoneData.phone_info.purePhoneNumber || phoneData.phone_info.phoneNumber,
        countryCode: phoneData.phone_info.countryCode || '86'
      },
      '微信手机号获取成功'
    );
  } catch (error) {
    const err = error as Error;
    successResponse(res, null, `获取手机号失败: ${err.message}`, 500, 500);
  }
});

/**
 * 校验当前登录态是否有效：依赖 Authorization Bearer token，在 user_tokens 中校验未过期且未吊销。
 * 供小程序冷启动/切前台时拉一次，过期则前端清理本地 token。
 */
router.get('/session', requireAuth, (req: Request, res: Response) => {
  successResponse(res, { userId: req.userId as number }, '登录态有效');
});

export default router;
