import fs from "fs";
import path from "path";

/**
 * 业务约定：用户上传的图片统一落在项目 `image/test` 目录下。
 */
export const TEST_IMAGE_DIR = path.resolve(__dirname, "../../image/test");

/**
 * 根据文件后缀推断图片 MIME 类型（用于组装 data URL）。
 */
export function getMimeTypeByExt(ext: string): string {
  const lowerExt = ext.toLowerCase();
  if (lowerExt === ".png") return "image/png";
  if (lowerExt === ".webp") return "image/webp";
  if (lowerExt === ".gif") return "image/gif";
  return "image/jpeg";
}

function isSafeTestFilename(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && !name.includes("..");
}

/**
 * 从完整 URL 或 `test/xxx` 等字符串中解析出 test 目录下的文件名。
 */
function extractTestFilename(raw: string): string | null {
  const s = raw.trim();
  const idx = s.indexOf("/image/test/");
  if (idx >= 0) {
    const rest = s.slice(idx + "/image/test/".length).split("?")[0];
    return isSafeTestFilename(rest) ? rest : null;
  }
  if (s.startsWith("test/")) {
    const rest = s.slice("test/".length).split("?")[0];
    return isSafeTestFilename(rest) ? rest : null;
  }
  if (isSafeTestFilename(s) && /\.(jpe?g|png|gif|webp)$/i.test(s)) {
    return s;
  }
  return null;
}

/**
 * 将发帖时传入的图片引用规范为库内存储格式 `test/<文件名>`。
 * - data URL：写入 image/test 并返回 test/ 引用；
 * - 已是本服务 test 目录文件：校验存在后返回 test/ 引用；
 * - 外链 URL：原样入库，列表接口再拉取转 Base64。
 */
export async function normalizeImageRefForStorage(input: string): Promise<string> {
  const s = input.trim();
  if (!s) {
    throw new Error("空图片数据");
  }

  if (s.startsWith("data:image")) {
    const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) {
      throw new Error("无效的图片 Base64 数据");
    }
    const mime = m[1];
    const b64 = m[2];
    const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    if (!fs.existsSync(TEST_IMAGE_DIR)) {
      fs.mkdirSync(TEST_IMAGE_DIR, { recursive: true });
    }
    const filePath = path.join(TEST_IMAGE_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
    return `test/${fileName}`;
  }

  const fname = extractTestFilename(s);
  if (fname) {
    const filePath = path.join(TEST_IMAGE_DIR, fname);
    if (!fs.existsSync(filePath)) {
      throw new Error(`图片文件不存在: ${fname}`);
    }
    return `test/${fname}`;
  }

  if (/^https?:\/\//i.test(s)) {
    return s;
  }

  throw new Error("无法识别的图片引用");
}

/**
 * 将库中存储的图片引用转为 data URL（Base64），供前端直接展示。
 * 已是 data URL 则原样返回；本地 test 文件则读盘；外链则尝试 fetch。
 */
export async function resolveStoredImageToBase64DataUrl(stored: string): Promise<string> {
  const s = stored.trim();
  if (!s) {
    return "";
  }
  if (s.startsWith("data:image")) {
    return s;
  }

  const fname = extractTestFilename(s);
  if (fname) {
    const filePath = path.join(TEST_IMAGE_DIR, fname);
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const mime = getMimeTypeByExt(ext);
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
  }

  if (/^https?:\/\//i.test(s)) {
    try {
      const response = await fetch(s, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
      if (!response.ok) {
        return s;
      }
      const buf = Buffer.from(await response.arrayBuffer());
      const ct = response.headers.get("content-type") || "image/jpeg";
      return `data:${ct};base64,${buf.toString("base64")}`;
    } catch {
      return s;
    }
  }

  return s;
}

/**
 * 批量将图片引用解析为 data URL，相同字符串只解析一次，减轻列表接口读盘与 fetch 次数。
 */
export async function batchResolveStoredImagesToDataUrls(
  refs: Iterable<string | null | undefined>
): Promise<Map<string, string>> {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    const k = r == null ? "" : String(r);
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
  }
  const map = new Map<string, string>();
  await Promise.all(
    keys.map(async (k) => {
      map.set(k, await resolveStoredImageToBase64DataUrl(k));
    })
  );
  return map;
}
