/**
 * Aizen Local Agent Runtime
 *
 * Provider-neutral runtime for an OpenAI-compatible local model (for example
 * llama.cpp, Ollama-compatible gateways, vLLM or another self-hosted server).
 * This is Aizen's own orchestration layer; the model weights remain replaceable.
 *
 * No artificial daily message counter is implemented here. Real limits are
 * determined by the local model server, CPU/GPU/RAM and deployment resources.
 */
const https = require("https");
const http = require("http");

const URL = String(process.env.AIZEN_LOCAL_MODEL_URL || "").replace(/\/$/, "");
const MODEL = String(process.env.AIZEN_LOCAL_MODEL_NAME || "aizen-local");
const TIMEOUT = Math.max(5000, Number(process.env.AIZEN_LOCAL_MODEL_TIMEOUT_MS || 120000));
const MAX_RETRIES = Math.max(0, Number(process.env.AIZEN_LOCAL_MODEL_RETRIES || 2));

function endpoint() {
  if (!URL) throw new Error("AIZEN_LOCAL_MODEL_URL is not configured");
  return new URLClass(URL + "/v1/chat/completions");
}

const URLClass = global.URL;

function requestJson(target, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const transport = target.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload);
    const req = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...headers },
      timeout: TIMEOUT
    }, res => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
        const message = parsed?.error?.message || parsed?.message || `Local model HTTP ${res.statusCode}`;
        const err = new Error(message);
        err.status = res.statusCode;
        err.providerResponse = parsed;
        reject(err);
      });
    });
    req.on("timeout", () => req.destroy(new Error("Local model request timed out")));
    req.on("error", reject);
    req.end(body);
  });
}

async function chat(messages, options = {}) {
  const target = endpoint();
  const payload = {
    model: options.model || MODEL,
    messages: Array.isArray(messages) ? messages : [],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens ?? 8192,
    stream: false
  };
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await requestJson(target, payload, options.headers || {});
      const text = response?.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new Error("Local model returned no assistant content");
      return { text, raw: response, model: payload.model };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function health() {
  const target = new URLClass(URL + "/v1/models");
  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.get({ hostname: target.hostname, port: target.port || (target.protocol === "https:" ? 443 : 80), path: target.pathname, timeout: 8000 }, res => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", c => data += c);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`Local model health HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Local model health timeout")));
    req.on("error", reject);
  });
}

module.exports = {
  isConfigured: () => Boolean(URL),
  model: MODEL,
  chat,
  health
};
