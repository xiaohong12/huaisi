# Cloudflared 使用说明（换电脑可直接照做）

这份文档用于你当前项目（`server` + `fontproject`）的内网穿透配置。

目标：
- 后端仍在本机 `7001` 端口运行；
- 对外提供一个 `https://*.trycloudflare.com` 地址；
- 前端通过环境变量读取后端地址和图片地址，避免写死。

---

## 1. 新电脑是否要重新安装？

要的。**换一台电脑需要重新安装 `cloudflared`**，因为这是本机命令行工具，不会跟项目代码自动迁移。

---

## 2. 新电脑从零操作步骤

### 步骤 A：安装 cloudflared（Mac）

```bash
brew install cloudflared
```

安装完成后可验证：

```bash
cloudflared --version
```

### 步骤 A-1：安装 cloudflared（Windows）

推荐用 `winget`（Windows 10/11）：

```powershell
winget install --id Cloudflare.cloudflared -e
```

如果你装了 `choco`，也可以：

```powershell
choco install cloudflared -y
```

安装完成后验证：

```powershell
cloudflared --version
```

### 步骤 B：启动你的后端服务（本地 7001）

```bash
cd /Users/jianghenghong/Desktop/huasi/server
npm run dev
```

确认后端可访问（本机）：
- `http://localhost:7001`

### 步骤 C：启动 cloudflared 隧道

新开一个终端执行：

```bash
cloudflared tunnel --url http://localhost:7001
```

日志里会出现类似：

```txt
https://xxxx-xxxx-xxxx.trycloudflare.com
```

这个就是本次可用的公网 HTTPS 地址（**每次重启可能变化**）。

---

## 3. 项目里要改哪两个地方？

拿到新的 `https://xxxx.trycloudflare.com` 后，改这两处：

### 3.1 前端 `fontproject/.env`

```env
VITE_BASE_URL=http://192.168.31.57:7001
VITE_ASSET_BASE_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
```

说明：
- `VITE_BASE_URL`：前端请求 API 的地址（当前你是内网直连后端）；
- `VITE_ASSET_BASE_URL`：图片资源走的外网地址（给真机小程序使用）。

> 如果将来你希望 API 也走穿透地址，可以把 `VITE_BASE_URL` 也改成同一个 `https://xxxx.trycloudflare.com`。

### 3.2 后端 `server/.env`

```env
BASE_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
```

说明：
- 后端会用它拼接并返回对外可访问的图片绝对地址（如 `avatarUrl`）。

---

## 4. 修改后要重启哪些服务？

环境变量改完后，建议都重启：

1. 重启 `server`（让 `server/.env` 生效）
2. 重启 `fontproject`（让 `fontproject/.env` 生效）
3. 确保 `cloudflared` 进程一直运行（关掉后外网地址立刻失效）

---

## 5. 常见问题排查

### 问题 1：浏览器能开，真机小程序不显示图

优先检查：
- 图片地址是不是 `https://*.trycloudflare.com/image/...`
- `cloudflared` 进程是否还在运行
- 前端是否已重启并读取最新 `.env`

### 问题 2：突然又不通了

可能是隧道地址变了。重新执行：

```bash
cloudflared tunnel --url http://localhost:7001
```

拿到新域名后，重新更新：
- `fontproject/.env` 的 `VITE_ASSET_BASE_URL`
- `server/.env` 的 `BASE_URL`

### 问题 3：7001 端口被占用（EADDRINUSE）

查占用：

```bash
lsof -nP -iTCP:7001 -sTCP:LISTEN
```

结束旧进程后再启动：

```bash
kill <PID>
```

---

## 6. 每次开工最短清单（30 秒版）

1. 启后端：`server` 里 `npm run dev`
2. 启隧道：`cloudflared tunnel --url http://localhost:7001`
3. 复制新的 `https://*.trycloudflare.com`
4. 改两个环境变量：`fontproject/.env` + `server/.env`
5. 重启前后端

---

## 7. 当前项目与 cloudflared 的对应关系

- 前端读取：
  - `fontproject/src/utils/request.ts`
  - 变量：`VITE_BASE_URL`、`VITE_ASSET_BASE_URL`
- 后端读取：
  - `server/src/routes/ai.ts`
  - 变量：`BASE_URL`

这样做的好处是：以后你只需要改 `.env`，不需要改代码。
