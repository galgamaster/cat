// Cloudflare Worker：把 DeepSeek API Key 藏在服务端，前端只调用这个代理。
// 部署步骤见 README.md。

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response("服务端未配置 DEEPSEEK_API_KEY", { status: 500, headers: corsHeaders });
    }

    // 只代理对话补全接口
    const upstream = "https://api.deepseek.com/chat/completions";
    const body = await request.text();

    const upstreamResp = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body
    });

    const headers = new Headers(upstreamResp.headers);
    headers.set("Access-Control-Allow-Origin", "*");

    // 原样透传响应体，保持 SSE 流式输出
    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers
    });
  }
};
