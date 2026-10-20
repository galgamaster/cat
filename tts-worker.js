// Cloudflare Worker：自然人声代理，基于 MiniMax 海螺语音（T2A v2）。
// Key 放在服务端 Secret，前端只调用本 Worker，返回 MP3 音频。
//
// 部署后在 Worker 的 Variables and Secrets 里添加：
//   MINIMAX_API_KEY = 你的 MiniMax Key（platform.minimaxi.com）
// 然后在网页「设置 → 语音服务地址」填本 Worker 的地址即可。

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

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
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1
        }
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
      return new Response("Upstream parse error: " + body.slice(0, 300),
        { status: 502, headers: cors });
    }

    const baseResp = data && data.base_resp;
    if (baseResp && baseResp.status_code !== 0) {
      return new Response(
        "MiniMax 语音失败：" + (baseResp.status_msg || baseResp.status_code),
        { status: 502, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    const audio = (data && data.data && data.data.audio) || "";
    const clean = audio.replace(/\s+/g, "");
    if (!clean) {
      return new Response("MiniMax 未返回音频", { status: 502, headers: cors });
    }

    function hexToBytes(hex) {
      if (hex.length % 2 !== 0) throw new Error("odd hex");
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        const v = parseInt(hex.substr(i, 2), 16);
        if (Number.isNaN(v)) throw new Error("bad hex");
        bytes[i / 2] = v;
      }
      return bytes;
    }

    try {
      const bytes = hexToBytes(clean);
      return new Response(bytes, {
        status: 200,
        headers: { ...cors, "Content-Type": "audio/mpeg" }
      });
    } catch (_) {
      return new Response("音频解码失败", { status: 502, headers: cors });
    }
  }
};
