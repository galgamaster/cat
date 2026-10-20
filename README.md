# AI 聊天平台 · 部署说明

这是一个纯前端的单文件聊天应用（`index.html`），默认接入 DeepSeek。打开即用，无需构建。

## 一、本地体验

直接双击 `index.html` 用浏览器打开即可。未配置 Key 时是演示模式；点击右上角「⚙ 设置」，填入：

- 接口地址：`https://api.deepseek.com`
- API Key：`sk-...`（你的 DeepSeek Key）
- 模型：`deepseek-chat`（普通对话）或 `deepseek-reasoner`（深度推理）

Key 只保存在你自己的浏览器本地（localStorage），不会上传到别处。

## 二、部署成在线网站

`index.html` 是静态文件，可以拖到任意静态托管平台：

- Cloudflare Pages / Workers：直接上传或关联仓库
- Vercel / Netlify：把仓库根目录作为发布目录
- GitHub Pages：把 `index.html` 放到仓库根目录

## 三、上线前务必处理 API Key 安全（重要）

如果你把 DeepSeek API Key 直接填进前端「设置」里再公开部署，任何访客都能从浏览器抓到这个 Key，然后盗刷你的额度。**正式上线请使用服务端代理**，把 Key 藏在服务端。本目录已提供 `worker.js`。

### 用 Cloudflare Worker 代理（推荐）

1. 登录 Cloudflare 控制台，进入 Workers & Pages，创建一个 Worker。
2. 把 `worker.js` 的内容粘贴进去并部署。
3. 在 Worker 的「设置 → Variables and Secrets」里添加 Secret：`DEEPSEEK_API_KEY`，值为你的 Key。
4. 拿到 Worker 的地址，形如 `https://your-worker.workers.dev`。
5. 回到网页「设置」，把「代理地址」填成这个地址，API Key 留空，模型照常填 `deepseek-chat`。

这样前端不再接触 Key，Key 只在 Cloudflare 服务端使用。

## 四、其他说明

- 聊天记录保存在访客自己的浏览器里，换设备/清缓存会丢失。
- 如需多用户、历史同步、计费等，可以在这个基础上加一个后端或数据库。
- 前端没有引入任何第三方 CDN 依赖，完全离线可用。
