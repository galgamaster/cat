// Cloudflare Worker：API 网关
// 一个 Worker 同时代理 DeepSeek 对话 与 MiniMax 语音，前端不再持有任何真实 Key。
//
// 路由：
//   POST /chat/completions  -> DeepSeek 对话（流式透传）
//   POST /tts               -> MiniMax 语音合成（返回 MP3）
//
// 在 Cloudflare 的 Variables and Secrets 里添加：
//   DEEPSEEK_API_KEY  = 你的 DeepSeek Key
//   MINIMAX_API_KEY   = 你的 MiniMax Key
// 可选：
//   ALLOWED_ORIGIN    = 你的站点地址，例如 https://chat.example.com
//                       （不设置则允许任意来源；建议上线后设置，防止别的网站借用你的网关）
//
// 部署后，网页「设置」里填写：
//   代理地址（可选）      = https://<你的worker>.workers.dev/chat/completions
//   语音服务地址（TTS）   = https://<你的worker>.workers.dev/tts
//   API Key / MiniMax 语音 Key 留空

export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    const path = new URL(request.url).pathname;
    if (path === "/chat/completions" || path === "/v1/chat/completions") {
      return handleChat(request, env, cors);
    }
    if (path === "/tts") {
      return handleTts(request, env, cors);
    }
    return new Response("Not Found", { status: 404, headers: cors });
  }
};

async function handleChat(request, env, cors) {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) {
    return new Response("服务端未配置 DEEPSEEK_API_KEY", { status: 500, headers: cors });
  }
  const body = await request.text();
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key
    },
    body
  });
  const headers = new Headers(upstream.headers);
  headers.set("Access-Control-Allow-Origin", cors["Access-Control-Allow-Origin"]);
  // 原样透传响应体，保持 SSE 流式输出
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handleTts(request, env, cors) {
  const key = env.MINIMAX_API_KEY;
  if (!key) {
    return new Response("服务端未配置 MINIMAX_API_KEY", { status: 500, headers: cors });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return new Response("Invalid JSON", { status: 400, headers: cors });
  }

  const text = String(payload.text || "").slice(0, 1500);
  if (!text) {
    return new Response("Missing text", { status: 400, headers: cors });
  }

  const rawVoice = String(payload.voice || "Chinese (Mandarin)_Cute_Spirit");
  const voice = /^[A-Za-z0-9 _()\-.]+$/.test(rawVoice) ? rawVoice : "Chinese (Mandarin)_Cute_Spirit";

  const upstream = await fetch("https://api.minimaxi.com/v1/t2a_v2", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "speech-02-hd",
      text,
      stream: false,
      voice_setting: {
        voice_id: voice,
        speed: Number(payload.speed) || 1.0,
        vol: Number(payload.vol) || 1.0,
        pitch: Number(payload.pitch) || 0
      },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 }
    })
  });

  const body = await upstream.text();
  if (!upstream.ok) {
    return new Response(body.slice(0, 500), { status: upstream.status, headers: cors });
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (_) {
    return new Response("Upstream parse error", { status: 502, headers: cors });
  }

  const br = data && data.base_resp;
  if (br && br.status_code !== 0) {
    return new Response("MiniMax 语音失败：" + (br.status_msg || br.status_code),
      { status: 502, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
  }

  const hex = ((data && data.data && data.data.audio) || "").replace(/\s+/g, "");
  if (!hex) {
    return new Response("未返回音频", { status: 502, headers: cors });
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return new Response(bytes, { status: 200, headers: { ...cors, "Content-Type": "audio/mpeg" } });
}
