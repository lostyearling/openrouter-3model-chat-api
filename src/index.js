const MODELS = {
  gpt5_2: "openai/gpt-5.2",
  gemini3pro: "google/gemini-3-pro-preview",
  claude_sonnet_4_5: "anthropic/claude-sonnet-4.5",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

const sessions = new Map();

function initSession(sessionId, systemPrompt) {
  const sys = systemPrompt || "You are a helpful assistant.";
  const histories = {};
  for (const k of Object.keys(MODELS)) {
    histories[k] = [{ role: "system", content: sys }];
  }
  const s = { system: sys, histories };
  sessions.set(sessionId, s);
  return s;
}

async function callOpenRouter({ apiKey, model, messages, referer, title }) {
  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": referer || "http://localhost",
      "X-Title": title || "workers-3model-chat",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`OpenRouter HTTP ${resp.status}: ${text}`);
  }
  const data = JSON.parse(text);
  return data?.choices?.[0]?.message?.content ?? "";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return jsonResponse({ ok: true }, 200);
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "openrouter-3model-chat" });
    }

    if (request.method !== "POST" || url.pathname !== "/chat") {
      return jsonResponse({ error: "Not Found" }, 404);
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: "Missing OPENROUTER_API_KEY (set as Worker secret)" }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const message = (body?.message ?? "").toString().trim();
    if (!message) {
      return jsonResponse({ error: "Missing 'message' in request body" }, 400);
    }

    const sessionId = (body?.sessionId ?? "default").toString();
    const systemPrompt = body?.systemPrompt ? String(body.systemPrompt) : undefined;

    const session = sessions.get(sessionId) ?? initSession(sessionId, systemPrompt);

    for (const k of Object.keys(MODELS)) {
      session.histories[k].push({ role: "user", content: message });
    }

    const outputs = {};
    for (const [k, modelId] of Object.entries(MODELS)) {
      try {
        const reply = await callOpenRouter({
          apiKey,
          model: modelId,
          messages: session.histories[k],
          referer: "https://workers.dev",
          title: "openrouter-3model-chat-api",
        });
        session.histories[k].push({ role: "assistant", content: reply });
        outputs[k] = { model: modelId, reply };
      } catch (e) {
        session.histories[k].pop();
        outputs[k] = { model: modelId, error: String(e?.message || e) };
      }
    }

    return jsonResponse({
      sessionId,
      input: message,
      outputs,
    });
  },
};
