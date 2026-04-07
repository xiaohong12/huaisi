/**
 * 将帖子中的图片用系统全屏预览打开；多张时可左右滑动切换。
 * 微信小程序中 wx.previewImage 不支持 data URL，会先把 Base64 写入本地临时路径再预览。
 */
export async function openImagePreview(urls: string[], currentIndex: number): Promise<void> {
  if (!urls.length) {
    return;
  }
  const list = await Promise.all(urls.map((u, i) => ensurePreviewableUrl(u, i)));
  const idx = Math.min(Math.max(0, currentIndex), list.length - 1);
  uni.previewImage({
    urls: list,
    current: list[idx],
    fail: () => {
      uni.showToast({ title: "预览失败", icon: "none" });
    },
  });
}

function ensurePreviewableUrl(src: string, index: number): Promise<string> {
  if (/^https?:\/\//i.test(src)) {
    return Promise.resolve(src);
  }
  if (!/^data:image\//i.test(src)) {
    return Promise.resolve(src);
  }

  // #ifdef MP-WEIXIN
  try {
    const fs = uni.getFileSystemManager();
    const comma = src.indexOf("base64,");
    const raw = comma >= 0 ? src.slice(comma + "base64,".length) : "";
    const extMatch = src.match(/^data:image\/(png|jpeg|jpg|gif|webp)/i);
    let ext = "jpg";
    if (extMatch) {
      const e = extMatch[1].toLowerCase();
      ext = e === "jpeg" ? "jpg" : e;
    }
    // 微信小程序用户目录，用于临时文件（见 wx.env.USER_DATA_PATH）
    const mp = globalThis as unknown as { wx?: { env?: { USER_DATA_PATH?: string } } };
    const root = mp.wx?.env?.USER_DATA_PATH;
    if (!root || !raw) {
      return Promise.resolve(src);
    }
    const filePath = `${root}/uview_preview_${Date.now()}_${index}.${ext}`;
    fs.writeFileSync(filePath, raw, "base64");
    return Promise.resolve(filePath);
  } catch {
    return Promise.resolve(src);
  }
  // #endif

  // #ifndef MP-WEIXIN
  return Promise.resolve(src);
  // #endif
}
