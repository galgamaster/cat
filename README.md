# AI 聊天平台 · 部署说明

这是一个纯前端的单文件聊天应用（`index.html`），默认接入 DeepSeek，语音走 MiniMax。打开即用，无需构建。

## 一、本地体验

直接双击 `index.html` 用浏览器打开即可。MiniMax 语音 Key 已内置，打开后语音就能直接合成；DeepSeek 对话需要先按第三节配好网关（或临时填一个 DeepSeek Key）。

## 二、部署成在线网站

`index.html` 是静态文件，可以拖到任意静态托管平台：

- Cloudflare Pages / Workers：直接上传或关联仓库
- Vercel / Netlify：把仓库根目录作为发布目录
- GitHub Pages：把 `index.html` 放到仓库根目录

## 三、把 DeepSeek Key 放入 Cloudflare AI Gateway（防窃取，推荐）

真实 DeepSeek Key 不放进前端，而是存到 Cloudflare 的 AI Gateway，前端只用一个可随时撤销的「网关 Token」。

1. 登录 Cloudflare 控制台，进入 AI → AI Gateway，创建一个网关（记住网关名，例如 `liya`）。
2. 在网关页找到 Provider Keys 区域，点 Add API Key：
   - Provider 下拉选 DeepSeek
   - 粘贴你的 DeepSeek Key（就是你之前给我的那把 sk- 开头的 DeepSeek Key）
   - 保存。
3. 进入该网关的 Settings，点 Create authentication token，生成网关 Token（只显示一次，先复制保存）；然后返回 Settings，打开 Authenticated Gateway 开关。
4. 记下网关地址，格式：
   `https://gateway.ai.cloudflare.com/v1/{你的账户ID}/{网关名}/deepseek`
   账户 ID 可在 Cloudflare 控制台首页右侧的账户信息里看到。
5. 回到网页「设置 → 更多设置」：
   - 接口地址（Base URL）= 第 4 步的网关地址
   - API Key / 网关令牌 = 第 3 步生成的网关 Token
   - MiniMax 语音 Key 保持内置值即可（语音仍直连 MiniMax）。

这样访客只能看到网关 Token，看不到你的 DeepSeek Key；Token 泄露后去 Cloudflare 删掉重发即可。建议再给网关开 Rate Limiting 限流。

备选：本目录的 `gateway.js` 是一个自定义 Worker，可同时代理 DeepSeek 对话和 MiniMax 语音，Key 用 Workers Secret 保存。想走这条路线时告诉我，我帮你把前端切到对应代理模式。

## 四、其他说明

- 聊天记录保存在访客自己的浏览器里，换设备/清缓存会丢失。
- 如需多用户、历史同步、计费等，可以在这个基础上加后端和数据库。
- 前端没有引入任何第三方 CDN 依赖，完全离线可用。

## 五、语音输出

每条猫娘回复下方有「🔊 播放」按钮。有两种模式：

- **本地语音（默认）**：没填语音服务地址时，用浏览器/系统的中文语音朗读。Windows 11 自带「晓晓·在线自然」等神经语音，效果较自然；其它设备可能退回机械音。
- **自然人声（推荐上线用）**：在「设置 → 语音服务地址」填入网关的 `/tts` 地址，由服务端合成 MiniMax 少女音返回。音色可在「当前对话专属设置」或「更多设置」里切换。
