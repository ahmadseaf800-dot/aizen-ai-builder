/**
 * Aizen Local Engine
 * Provider-neutral adapter for a self-hosted OpenAI-compatible model.
 *
 * This does NOT contain a model's weights. Point AIZEN_LOCAL_MODEL_URL at
 * Ollama, llama.cpp server, vLLM, or another OpenAI-compatible local service.
 */
const https = require("https");
const http = require("http");

function localConfig(env = process.env) {
  const baseUrl = String(env.AIZEN_LOCAL_MODEL_URL || "").replace(/\/$/, "");
  return {
    enabled: Boolean(baseUrl),
    baseUrl,
    model: String(env.AIZEN_LOCAL_MODEL_NAME || "aizen-local"),
    timeoutMs: Number(env.AIZEN_LOCAL_TIMEOUT_MS || 120000),
    maxTokens: Number(env.AIZEN_LOCAL_MAX_TOKENS || 4096),
  };
}

function requestJson(urlString, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload);
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, response => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { data += chunk; });
      response.on("end", () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(parsed?.error?.message || `LOCAL_MODEL_HTTP_${response.statusCode}`);
          error.statusCode = response.statusCode;
          error.data = parsed || data.slice(0, 4000);
          reject(error);
          return;
        }
        resolve(parsed);
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("LOCAL_MODEL_TIMEOUT")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function chat(messages, options = {}) {
  const config = localConfig(options.env || process.env);
  if (!config.enabled) throw new Error("AIZEN_LOCAL_MODEL_NOT_CONFIGURED");
  const payload = {
    model: options.model || config.model,
    messages,
    stream: false,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens || config.maxTokens,
  };
  const data = await requestJson(`${config.baseUrl}/v1/chat/completions`, payload, config.timeoutMs);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("LOCAL_MODEL_INVALID_RESPONSE");
  return { text, raw: data };
}

module.exports = { localConfig, chat };
