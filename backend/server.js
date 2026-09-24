const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { AIZEN_CORE_VERSION, AIZEN_AGENT_CAPABILITIES, AIZEN_CORE_KNOWLEDGE, buildAizenCoreInstruction } = require("./aizen-core");

const PORT = Number(process.env.PORT || 3000);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_ORIGIN = process.env.APP_ORIGIN || "*";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const AI_PROVIDER = String(process.env.AI_PROVIDER || "auto").toLowerCase();
const OPENROUTER_API_KEY = String(process.env.OPENROUTER_API_KEY || "");
const OPENROUTER_MODEL = String(process.env.OPENROUTER_MODEL || "openrouter/free");
const OPENROUTER_SITE_URL = String(process.env.OPENROUTER_SITE_URL || "");
const OPENROUTER_APP_NAME = String(process.env.OPENROUTER_APP_NAME || "Aizen AI Builder");
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "");
const GROQ_MODEL = String(process.env.GROQ_MODEL || "llama-3.3-70b-versatile");
const SECRET_ENCRYPTION_KEY = String(process.env.SECRET_ENCRYPTION_KEY || "");
const AI_MAX_MESSAGE_CHARS = Number(process.env.AI_MAX_MESSAGE_CHARS || 120000);
const AI_CONTEXT_MESSAGES = Number(process.env.AI_CONTEXT_MESSAGES || 40);


function getAiMode(message, isBuild) {
  const text = String(message || "").trim();
  const command = text.match(/^\/(plan|review|fix|explain|debug|optimize|security|test)\b/i)?.[1]?.toLowerCase() || "";
  if (isBuild) return { command, mode: "builder" };
  if (command === "plan") return { command, mode: "planner" };
  if (command === "review") return { command, mode: "reviewer" };
  if (command === "fix" || command === "debug") return { command, mode: "debugger" };
  if (command === "explain") return { command, mode: "teacher" };
  if (command === "optimize") return { command, mode: "optimizer" };
  if (command === "security") return { command, mode: "security" };
  if (command === "test") return { command, mode: "tester" };
  return { command: "", mode: "assistant" };
}

function buildAiSystemInstruction(message, isBuild) {
  const { command, mode } = getAiMode(message, isBuild);
  const base = isBuild
    ? [
        "أنت Aizen AI Builder، مهندس برمجيات ووكيل بناء مشاريع.",
        "حوّل الطلب إلى مشروع حقيقي قابل للتشغيل، وليس مجرد نموذج شكلي.",
        "قبل إخراج الملفات: حلل المتطلبات، اختر بنية مناسبة، تحقق من dependencies والمسارات وواجهات API وتدفق البيانات والأمان.",
        "أنشئ كل الملفات الأساسية المطلوبة. عند إخراج الملفات استخدم FILE: path ثم code fence ومحتوى الملف الكامل.",
        "لا تضع مفاتيح API أو كلمات مرور أو توكنات حقيقية داخل الكود.",
        "لا تدّعي أنك شغّلت أو اختبرت المشروع فعلياً. بدلاً من ذلك أضف قائمة تحقق واختبارات قابلة للتنفيذ.",
        "إذا كانت المتطلبات ناقصة، اختر افتراضات آمنة ومعقولة واذكرها باختصار بدلاً من تعطيل البناء.",
        "بعد الإنشاء نفّذ مراجعة ذاتية ذهنية: syntax، imports، routes، state، edge cases، security، mobile UX، accessibility، وقابلية النشر.",
        "اجعل الناتج متوافقاً مع المشروع الحالي ولا تكسر الوظائف الموجودة."
      ].join(" ")
    : [
        "أنت Aizen AI، المساعد الذكي الرسمي داخل Aizen AI Builder.",
        "افهم السياق السابق قبل الإجابة، وأعطِ النتيجة العملية مباشرة.",
        "في البرمجة: لا تختلق APIs أو مكتبات أو خصائص غير مؤكدة، وفضّل حلولاً كاملة قابلة للتطبيق.",
        "عند وجود كود أو خطأ: حلل السبب، ثم قدم الإصلاح، ثم تحقق من الآثار الجانبية نظرياً.",
        "احترم خصوصية الأسرار ولا تطلب من المستخدم نشر مفاتيح أو توكنات سرية.",
        "إذا كانت المعلومة غير مؤكدة، صرّح بذلك بدلاً من اختلاقها.",
        "إذا سُئلت مين طورك أو صنعك فأجب: أحمد قسوم هو من صنعني بدون مساعدة، وهو يمثل الفريق كامل."
      ].join(" ");
  const modes = {
    planner:"وضع التخطيط: حوّل الفكرة إلى خطة تنفيذ مرتبة، مع بنية الملفات، الخطوات، المخاطر ومعايير النجاح.",
    reviewer:"وضع المراجعة: ابحث عن الأخطاء والثغرات ومشاكل الأداء وقابلية الصيانة، ثم اقترح إصلاحات محددة.",
    debugger:"وضع التصحيح: حدّد السبب الجذري أولاً، ثم أعطِ إصلاحاً دقيقاً واختبارات تحقق.",
    teacher:"وضع الشرح: اشرح ببساطة وبخطوات عملية، مع أمثلة عند الحاجة.",
    optimizer:"وضع التحسين: حسّن السرعة، استهلاك الموارد، جودة الكود وتجربة المستخدم دون كسر السلوك.",
    security:"وضع الأمان: افحص المصادقة، الصلاحيات، الأسرار، المدخلات، SSRF، XSS، SQL/RLS وسوء الإعدادات بحسب التقنية.",
    tester:"وضع الاختبار: أنشئ حالات اختبار تغطي النجاح والفشل والحالات الحدية، مع طريقة تشغيلها.",
    builder:"وضع البناء: نفّذ المشروع كاملاً مع مراجعة ذاتية قبل إنهاء الرد."
  };
  return base + (modes[mode] ? " " + modes[mode] : "") +
    (command ? " الأمر النشط: /" + command + "." : "");
}


const FRONTEND_PATH = path.join(__dirname, "..", "frontend", "index.html");

function sendJson(res, statusCode, data) {
  if (res.headersSent) return;

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  res.end(JSON.stringify(data));
}

function setCors(res) {
  const origin = res.req?.headers?.origin;

  if (APP_ORIGIN === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin === APP_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader("Access-Control-Expose-Headers", "Content-Type");
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim() || null;
}

function readJsonBody(req, res, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let rejected = false;

    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      if (rejected) return;

      size += Buffer.byteLength(chunk, "utf8");

      if (size > maxBytes) {
        rejected = true;
        reject(new Error("REQUEST_TOO_LARGE"));

        try {
          req.destroy();
        } catch {}
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      if (rejected) return;

      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });

    req.on("error", (error) => {
      if (!rejected) {
        rejected = true;
        reject(error);
      }
    });
  });
}

function httpsRequest(options, body = null, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const request = https.request(options, (response) => {
      let data = "";

      response.setEncoding("utf8");

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        if (finished) return;
        finished = true;

        resolve({
          statusCode: response.statusCode || 0,
          headers: response.headers,
          body: data,
        });
      });

      response.on("error", (error) => {
        if (finished) return;
        finished = true;
        reject(error);
      });
    });

    request.setTimeout(timeout, () => {
      if (finished) return;

      finished = true;

      try {
        request.destroy();
      } catch {}

      reject(new Error("REQUEST_TIMEOUT"));
    });

    request.on("error", (error) => {
      if (finished) return;
      finished = true;
      reject(error);
    });

    if (body !== null) {
      request.write(body);
    }

    request.end();
  });
}

/*
 * Verify the Supabase access token.
 *
 * The frontend logs in through Supabase Auth.
 * Supabase returns an access_token.
 * The frontend sends:
 *
 * Authorization: Bearer <access_token>
 *
 * This backend verifies that token against Supabase.
 */
async function verifySupabaseToken(token) {
  if (!token) {
    throw new Error("MISSING_TOKEN");
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const url = new URL(`${SUPABASE_URL}/auth/v1/user`);

  const response = await httpsRequest(
    {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
    null,
    10000
  );

  let data = null;

  try {
    data = JSON.parse(response.body);
  } catch {
    data = null;
  }

  if (response.statusCode !== 200 || !data || !data.id) {
    const error = new Error("INVALID_TOKEN");
    error.statusCode = response.statusCode;
    error.supabase = data;
    throw error;
  }

  return data;
}

async function requireAuth(req, res) {
  const token = getBearerToken(req);

  if (!token) {
    sendJson(res, 401, {
      success: false,
      error: "UNAUTHORIZED",
      message: "يجب تسجيل الدخول أولاً",
    });

    return null;
  }

  try {
    const user = await verifySupabaseToken(token);
    return user;
  } catch (error) {
    console.error("AUTH ERROR:", error.message);

    sendJson(res, 401, {
      success: false,
      error: "INVALID_SESSION",
      message: "جلسة تسجيل الدخول غير صالحة أو منتهية",
    });

    return null;
  }
}

/*
 * Supabase REST request.
 *
 * The user's access token is used here,
 * so Supabase RLS policies continue protecting
 * the user's data.
 */
async function supabaseRequest(method, endpoint, accessToken, body = null, extraHeaders = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const url = new URL(`${SUPABASE_URL}${endpoint}`);

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...extraHeaders,
  };

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await httpsRequest(
    {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
    },
    body === null ? null : JSON.stringify(body),
    15000
  );

  let data = null;

  if (response.body) {
    try {
      data = JSON.parse(response.body);
    } catch {
      data = response.body;
    }
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = new Error("SUPABASE_REQUEST_FAILED");
    error.statusCode = response.statusCode;
    error.data = data;
    throw error;
  }

  return data;
}

/*
 * Get a conversation and make sure it belongs
 * to the currently authenticated user.
 */
async function getConversation(accessToken, conversationId, userId) {
  if (!conversationId) return null;

  const safeId = encodeURIComponent(String(conversationId));

  const data = await supabaseRequest(
    "GET",
    `/rest/v1/conversations?id=eq.${safeId}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,user_id,title,pinned,archived,build_used,build_used_at,created_at,updated_at&limit=1`,
    accessToken
  );

  if (!Array.isArray(data) || data.length === 0) {
    const error = new Error("CONVERSATION_NOT_FOUND");
    error.statusCode = 404;
    throw error;
  }

  return data[0];
}

/*
 * Load messages from a conversation.
 */
async function getConversationMessages(accessToken, conversationId) {
  const safeId = encodeURIComponent(String(conversationId));

  const data = await supabaseRequest(
    "GET",
    `/rest/v1/messages?conversation_id=eq.${safeId}&select=id,conversation_id,user_id,role,content,metadata,created_at&order=created_at.asc&limit=5000`,
    accessToken
  );

  return Array.isArray(data) ? data : [];
}

/*
 * Convert DB messages into Gemini history.
 */
function buildGeminiInput(messages, currentMessage) {
  const history = [];

  for (const message of messages) {
    if (!message || !message.content) continue;

    const role =
      message.role === "assistant"
        ? "model"
        : "user";

    history.push({
      role,
      content: String(message.content),
    });
  }

  const messageText =
    String(currentMessage || "").trim().slice(0, AI_MAX_MESSAGE_CHARS);

  const lastItem =
    history.length
      ? history[history.length - 1]
      : null;

  if(
    messageText &&
    !(
      lastItem &&
      lastItem.role === "user" &&
      String(lastItem.content || "").trim() === messageText
    )
  ){
    history.push({
      role: "user",
      content: messageText,
    });
  }

  // Keep the context focused for faster responses while preserving the
  // most recent conversation turns. Very large histories slow generation
  // and can dilute the user's current request.
  const MAX_HISTORY_MESSAGES = Math.max(10, Math.min(AI_CONTEXT_MESSAGES, 80));
  const MAX_HISTORY_CHARS = 70000;

  let compacted = history.slice(-MAX_HISTORY_MESSAGES);
  let totalChars = 0;
  compacted = compacted.reverse().filter((item) => {
    const size = String(item.content || "").length;
    if (totalChars + size > MAX_HISTORY_CHARS) return false;
    totalChars += size;
    return true;
  }).reverse();

  return compacted;
}

/*
 * Call OpenRouter using OpenAI-compatible SSE streaming.
 * This keeps the provider key on the backend and never exposes it to the browser.
 */
function askOpenRouterStream(currentMessage, res, isBuild, history = [], retryCount = 0, fallbackProvider = null) {
  return new Promise((resolve) => {
    if (!OPENROUTER_API_KEY) {
      if (!res.headersSent) {
        sendJson(res, 500, {
          success: false,
          error: "OPENROUTER_NOT_CONFIGURED",
          message: "OPENROUTER_API_KEY غير موجود في إعدادات السيرفر",
        });
      }
      resolve();
      return;
    }

    const historyMessages = history
      .filter((message) => message && message.content)
      .map((message) => ({
        role: message.role === "model" ? "assistant" : "user",
        content: String(message.content),
      }));

    if (String(currentMessage || "").trim()) {
      const last = historyMessages[historyMessages.length - 1];
      const text = String(currentMessage).trim();
      if (!(last && last.role === "user" && String(last.content || "").trim() === text)) {
        historyMessages.push({ role: "user", content: text });
      }
    }

    const systemInstruction = buildAiSystemInstruction(currentMessage, isBuild);

    const payload = JSON.stringify({
      model: OPENROUTER_MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemInstruction },
        ...historyMessages,
      ],
    });

    const url = new URL("https://openrouter.ai/api/v1/chat/completions");
    let completed = false;

    const finish = () => {
      if (completed) return;
      completed = true;
      try {
        if (!res.writableEnded) {
          res.write("event: done\n");
          res.write("data: {}\n\n");
          res.end();
        }
      } catch {}
      resolve();
    };

    let request;
    try {
      request = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: "Bearer " + OPENROUTER_API_KEY,
          ...(OPENROUTER_SITE_URL ? { "HTTP-Referer": OPENROUTER_SITE_URL } : {}),
          "X-Title": OPENROUTER_APP_NAME,
          "Content-Length": Buffer.byteLength(payload),
        },
      }, (response) => {
        let buffer = "";
        response.setEncoding("utf8");
        if (response.statusCode >= 400) {
          response.on("data", (chunk) => {
            if (!completed) buffer += chunk;
          });
          response.on("end", () => {
            if (completed) return;

            let message = "فشل طلب مزود الذكاء الاصطناعي.";
            try {
              const parsed = JSON.parse(buffer);
              message = parsed?.error?.message || message;
            } catch {}

            if (response.statusCode === 429 && retryCount === 0) {
              console.error(
                "OPENROUTER RATE LIMIT: retrying once before fallback",
                "model=" + OPENROUTER_MODEL
              );
              setTimeout(() => {
                askOpenRouterStream(
                  currentMessage,
                  res,
                  isBuild,
                  history,
                  1,
                  fallbackProvider
                ).then(resolve);
              }, 2000);
              return;
            }

            if (fallbackProvider) {
              completed = true;
              askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
              return;
            }

            if (retryCount <= 1 && GEMINI_API_KEY) {
              console.error(
                "OPENROUTER API ERROR:",
                response.statusCode,
                "model=" + OPENROUTER_MODEL,
                message
              );
              askGeminiStream(currentMessage, res, isBuild, history).then(resolve);
              return;
            }

            completed = true;
            if (!res.headersSent) {
              sendJson(res, 502, {
                success: false,
                error: "OPENROUTER_API_ERROR",
                message: "تعذر تشغيل نموذج OpenRouter حالياً، وتمت محاولة البديل إن كان مفعلاً.",
                upstream_status: response.statusCode || 0,
              });
            }
            resolve();
          });
          response.on("error", () => {
            if (completed) return;
            completed = true;
            if (!res.headersSent) {
              sendJson(res, 502, {
                success: false,
                error: "OPENROUTER_RESPONSE_ERROR",
                message: "حدث خطأ أثناء قراءة رد مزود الذكاء الاصطناعي.",
              });
            }
            resolve();
          });
          return;
        }

        if (!res.headersSent) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
        }

        response.on("data", (chunk) => {
          if (completed) return;
          buffer += chunk;

          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || "";

          for (const rawEvent of events) {
            const lines = rawEvent.split(/\r?\n/);
            let dataText = "";
            for (const line of lines) {
              if (line.startsWith("data:")) dataText += line.slice(5).trim();
            }

            if (!dataText || dataText === "[DONE]") continue;

            let data;
            try { data = JSON.parse(dataText); } catch { continue; }

            const delta = data?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              res.write("event: text\n");
              res.write("data: " + JSON.stringify({ text: delta }) + "\n\n");
            }

            if (data?.choices?.[0]?.finish_reason) {
              res.write("event: complete\n");
              res.write("data: {}\n\n");
            }

            if (data?.error) {
              res.write("event: error\n");
              res.write("data: " + JSON.stringify({
                message: data.error.message || "حدث خطأ أثناء توليد الرد"
              }) + "\n\n");
            }
          }
        });

        response.on("end", finish);
        response.on("error", () => {
          if (completed) return;
          try {
            res.write("event: error\n");
            res.write("data: " + JSON.stringify({
              message: "انقطع اتصال مزود الذكاء الاصطناعي"
            }) + "\n\n");
          } catch {}
          finish();
        });
      });

      request.setTimeout(120000, () => {
        if (completed) return;
        try { request.destroy(); } catch {}
        try {
          res.write("event: error\n");
          res.write("data: " + JSON.stringify({
            message: "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي"
          }) + "\n\n");
        } catch {}
        finish();
      });

      request.on("error", () => {
        if (completed) return;
        if (!res.headersSent) {
          sendJson(res, 502, {
            success: false,
            error: "OPENROUTER_CONNECTION_ERROR",
            message: "تعذر الاتصال بمزود الذكاء الاصطناعي",
          });
          completed = true;
          resolve();
          return;
        }
        try {
          res.write("event: error\n");
          res.write("data: " + JSON.stringify({
            message: "تعذر الاتصال بمزود الذكاء الاصطناعي"
          }) + "\n\n");
        } catch {}
        finish();
      });

      request.write(payload);
      request.end();
    } catch (error) {
      console.error("OPENROUTER SETUP ERROR:", error.message);
      if (!res.headersSent) {
        sendJson(res, 500, {
          success: false,
          error: "OPENROUTER_ERROR",
          message: "حدث خطأ أثناء تشغيل مزود الذكاء الاصطناعي",
        });
      }
      completed = true;
      resolve();
    }
  });
}

function askGroqStream(currentMessage, res, isBuild, history = [], fallbackProvider = null) {
  return new Promise((resolve) => {
    if (!GROQ_API_KEY) {
      if (fallbackProvider) {
        askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
        return;
      }
      if (!res.headersSent) sendJson(res, 500, {
        success: false,
        error: "GROQ_NOT_CONFIGURED",
        message: "GROQ_API_KEY غير موجود في إعدادات السيرفر",
      });
      resolve();
      return;
    }

    const messages = history.filter((m) => m && m.content).map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: String(m.content),
    }));

    const text = String(currentMessage || "").trim();
    if (text) {
      const last = messages[messages.length - 1];
      if (!(last && last.role === "user" && String(last.content || "").trim() === text)) {
        messages.push({ role: "user", content: text });
      }
    }

    const payload = JSON.stringify({
      model: GROQ_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: buildAizenCoreInstruction({ mode: getAiMode(currentMessage, isBuild).mode, isBuild, userRequest: currentMessage }),
        },
        ...messages,
      ],
    });

    const url = new URL("https://api.groq.com/openai/v1/chat/completions");

    httpsRequest({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + GROQ_API_KEY,
        "Content-Length": Buffer.byteLength(payload),
      },
    }, payload, 120000).then((response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        console.error("GROQ API ERROR:", response.statusCode);
        if (fallbackProvider) {
          askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
          return;
        }
        if (!res.headersSent) sendJson(res, 502, {
          success: false,
          error: "GROQ_API_ERROR",
          message: "تعذر تشغيل مزود الذكاء الاصطناعي حالياً.",
          upstream_status: response.statusCode || 0,
        });
        resolve();
        return;
      }

      let data = null;
      try { data = JSON.parse(response.body); } catch {}
      const output = data?.choices?.[0]?.message?.content;

      if (!output) {
        if (fallbackProvider) {
          askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
          return;
        }
        if (!res.headersSent) sendJson(res, 502, {
          success: false,
          error: "GROQ_EMPTY_RESPONSE",
          message: "لم يصل رد من مزود الذكاء الاصطناعي.",
        });
        resolve();
        return;
      }

      if (!res.headersSent) res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      res.write("event: text\n");
      res.write("data: " + JSON.stringify({ text: String(output) }) + "\n\n");
      res.write("event: complete\n");
      res.write("data: {}\n\n");
      res.write("event: done\n");
      res.write("data: {}\n\n");
      res.end();
      resolve();
    }).catch((error) => {
      console.error("GROQ REQUEST ERROR:", error.message);
      if (fallbackProvider) {
        askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
        return;
      }
      if (!res.headersSent) sendJson(res, 502, {
        success: false,
        error: "GROQ_CONNECTION_ERROR",
        message: "تعذر الاتصال بمزود الذكاء الاصطناعي.",
      });
      resolve();
    });
  });
}

function askProviderFallback(provider, currentMessage, res, isBuild, history = []) {
  if (provider === "groq") {
    return askGroqStream(currentMessage, res, isBuild, history, "openrouter");
  }
  if (provider === "openrouter") {
    return askOpenRouterStream(currentMessage, res, isBuild, history);
  }
  if (provider === "gemini") {
    return askGeminiStream(currentMessage, res, isBuild, history, null, 0, "groq");
  }
  return Promise.resolve();
}

function askAIStream(currentMessage, res, isBuild, history = []) {
  if (AI_PROVIDER === "auto") {
    // Stable automatic chain for both chat and builds: Gemini -> Groq -> OpenRouter.
    // The database may keep unlimited messages; each provider receives the bounded context window.
    if (GEMINI_API_KEY) {
      return askGeminiStream(currentMessage, res, isBuild, history, null, 0, "groq");
    }
    if (GROQ_API_KEY) {
      return askGroqStream(currentMessage, res, isBuild, history, "openrouter");
    }
    if (OPENROUTER_API_KEY) {
      return askOpenRouterStream(currentMessage, res, isBuild, history);
    }
    return askGeminiStream(currentMessage, res, isBuild, history);
  }

  if (AI_PROVIDER === "groq") {
    return askGroqStream(currentMessage, res, isBuild, history);
  }

  if (AI_PROVIDER === "openrouter") {
    return askOpenRouterStream(currentMessage, res, isBuild, history);
  }

  if (AI_PROVIDER === "gemini") {
    return askGeminiStream(currentMessage, res, isBuild, history);
  }

  if (OPENROUTER_API_KEY) {
    return askOpenRouterStream(currentMessage, res, isBuild, history);
  }

  return askGeminiStream(currentMessage, res, isBuild, history);
}

/*
 * Call Gemini using SSE streaming.
 */
function askGeminiStream(currentMessage, res, isBuild, history = [], modelOverride = null, retryCount = 0, fallbackProvider = null) {
  return new Promise((resolve) => {
    if (!GEMINI_API_KEY) {
      if (fallbackProvider) {
        askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
        return;
      }
      if (!res.headersSent) {
        sendJson(res, 500, {
          success: false,
          error: "GEMINI_NOT_CONFIGURED",
          message: "GEMINI_API_KEY غير موجود في إعدادات السيرفر",
        });
      }

      resolve();
      return;
    }

    const historySteps = history
      .filter((message) => message && message.content)
      .map((message) => ({
        type: "text",
        text: `[${message.role === "model" ? "ASSISTANT" : "USER"}]\n${String(message.content)}`,
      }));

    const input = [
      ...historySteps,
      ...(String(currentMessage || "").trim()
        ? [{ type: "text", text: String(currentMessage).trim() }]
        : []),
    ];

    const legacySystemInstruction = isBuild
      ? `
أنت Aizen AI Builder، مهندس برمجيات ومساعد ذكي دقيق.

أولوية كل رد: الصحة، فهم المطلوب، ثم السرعة. لا تختلق معلومات أو نتائج.

قواعد البناء:
1. حلل الطلب داخلياً قبل الإجابة، ثم أعطِ نتيجة واضحة ومباشرة.
2. التزم بإصدارات وتقنيات المستخدم ولا تستبدلها بلا سبب.
3. إذا كان هناك نقص جوهري يمنع التنفيذ، اذكره بوضوح؛ وإلا لا تكثر من الأسئلة.
4. عند إصلاح مشكلة، اشرح السبب الحقيقي والحل العملي وتجنب الحلول الوهمية.
5. أنشئ مشروعاً حقيقياً قابلاً للتشغيل، وليس مجرد واجهة تجريبية.
6. اجعل الملفات مترابطة، وأضف package/config/deployment files المطلوبة عند الحاجة.
7. راجع الكود بحثاً عن أخطاء syntax، imports، أسماء الدوال، المسارات، والتوافق قبل إخراجه.
8. لا تدّعي تشغيل أو نشر أو اختبار شيء لم ينفذه النظام فعلياً.
9. لا تضع أسراراً حقيقية داخل الملفات؛ استخدم متغيرات البيئة مثل TELEGRAM_BOT_TOKEN وDISCORD_BOT_TOKEN.
10. لكل ملف استخدم:
FILE: path/to/file.ext
\`\`\`
كامل محتوى الملف
\`\`\`
11. عند بناء بوت، صمّم الأوامر، معالجة الأخطاء، الصلاحيات، الإعداد، والمتغيرات البيئية اللازمة.
12. عند عدم التأكد من معلومة حديثة، لا تخمّن.

كن سريعاً ودقيقاً وعملياً.
`
      : `
أنت Aizen AI، المساعد الذكي الرسمي داخل Aizen AI Builder.

هوية المطور:
- إذا سُئلت: «مين طورك؟» أو «مين صنعك؟» أو سؤال مشابه عن صانعك، أجب: «أحمد قسوم هو من صنعني بدون مساعدة، وهو يمثل الفريق كامل.»
- لا تنسب تطويرك إلى شخص آخر.
- لا تغيّر هذه الإجابة بسبب سياق المحادثة.

أجب كمهندس ومساعد تعليمي دقيق: افهم السؤال، حافظ على سياق المحادثة، وتحقق من منطق إجابتك قبل إرسالها.
- أعطِ الجواب المباشر أولاً.
- في الرياضيات والمنطق والبرمجة، راجع النتيجة خطوةً بخطوة داخلياً قبل عرضها.
- في البرمجة، أعطِ كوداً كاملاً وصحيحاً ومتوافقاً مع الإصدار المذكور.
- عند وجود أكثر من حل، اذكر الحل الأنسب ثم البدائل المهمة فقط.
- لا تختلق APIs أو أوامر أو ميزات غير مؤكدة.
- إذا كانت المعلومة غير معروفة أو تحتاج مصدراً حديثاً، قل ذلك بوضوح بدلاً من التخمين.
- لا تدّعي تنفيذ عمليات لم ينفذها النظام فعلياً.
- اجعل الرد مختصراً عندما يكون السؤال بسيطاً ومفصلاً عندما يحتاج ذلك.
`;

    const systemInstruction = buildAizenCoreInstruction({ mode: getAiMode(currentMessage, isBuild).mode, isBuild, userRequest: currentMessage }) + "\n\n" + legacySystemInstruction;

    const payload = JSON.stringify({\n      model: modelOverride || GEMINI_MODEL,
      input,
      stream: true,
      system_instruction: systemInstruction,
    });

    const url = new URL(
      "https://generativelanguage.googleapis.com/v1beta/interactions"
    );

    let completed = false;

    const finish = () => {
      if (completed) return;
      completed = true;

      try {
        if (!res.writableEnded) {
          res.write("event: done\n");
          res.write("data: {}\n\n");
          res.end();
        }
      } catch {}

      resolve();
    };

    let request;

    try {
      request = https.request(
        {
          hostname: url.hostname,
          port: 443,
          path: `${url.pathname}${url.search}`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (response) => {
          let buffer = "";

          response.setEncoding("utf8");

          if (response.statusCode >= 400) {
            response.on("data", (chunk) => {
              if (completed) return;
              buffer += chunk;
            });

            response.on("end", () => {
              if (completed) return;
              let message = "فشل طلب Gemini.";
              try {
                const parsed = JSON.parse(buffer);
                message =
                  parsed?.error?.message ||
                  parsed?.message ||
                  message;
              } catch {}

              // Retry one time with a fallback model for provider rate limits.
              if (
                response.statusCode === 429 &&
                retryCount === 0 &&
                GEMINI_FALLBACK_MODEL &&
                GEMINI_FALLBACK_MODEL !== (modelOverride || GEMINI_MODEL)
              ) {
                askGeminiStream(
                  currentMessage,
                  res,
                  isBuild,
                  history,
                  GEMINI_FALLBACK_MODEL,
                  1,
                  fallbackProvider
                ).then(resolve);
                return;
              }

              if (fallbackProvider) {
                completed = true;
                askProviderFallback(fallbackProvider, currentMessage, res, isBuild, history).then(resolve);
                return;
              }

              completed = true;

              if (!res.headersSent) {
                sendJson(res, 502, {
                  success: false,
                  error: "GEMINI_API_ERROR",
                  message,
                  upstream_status: response.statusCode || 0,
                });
              }

              resolve();
            });

            response.on("error", (error) => {
              if (completed) return;
              completed = true;

              if (!res.headersSent) {
                sendJson(res, 502, {
                  success: false,
                  error: "GEMINI_RESPONSE_ERROR",
                  message: "حدث خطأ أثناء قراءة رد Gemini.",
                });
              }

              resolve();
            });

            return;
          }

          if (!res.headersSent) {
            res.writeHead(200, {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            });
          }

          response.on("data", (chunk) => {
            if (completed) return;

            buffer += chunk;

            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || "";

            for (const rawEvent of events) {
              const lines = rawEvent.split(/\r?\n/);

              let eventName = "";
              let dataText = "";

              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventName = line.slice(6).trim();
                }

                if (line.startsWith("data:")) {
                  dataText += line.slice(5).trim();
                }
              }

              if (!dataText) continue;

              let data;

              try {
                data = JSON.parse(dataText);
              } catch {
                continue;
              }

              const findText = (value, depth = 0) => {
                if (depth > 5 || value == null) return "";
                if (typeof value === "string") return value;
                if (Array.isArray(value)) {
                  for (const item of value) {
                    const found = findText(item, depth + 1);
                    if (found) return found;
                  }
                  return "";
                }
                if (typeof value !== "object") return "";
                for (const key of ["text", "output_text", "delta", "content"]) {
                  if (typeof value[key] === "string" && value[key]) return value[key];
                }
                for (const key of ["step", "content", "output", "delta", "data"]) {
                  if (value[key] && typeof value[key] === "object") {
                    const found = findText(value[key], depth + 1);
                    if (found) return found;
                  }
                }
                return "";
              };

              const deltaText =
                eventName === "error" || data?.error ? "" : findText(data);

              if (deltaText) {
                res.write("event: text\n");
                res.write(`data: ${JSON.stringify({ text: String(deltaText) })}\n\n`);
              }

              if (
                eventName === "interaction.completed" ||
                eventName === "interaction.complete" ||
                eventName === "response.completed"
              ) {
                res.write("event: complete\n");
                res.write("data: {}\n\n");
              }

              if (eventName === "error" || data?.error) {
                res.write("event: error\n");
                res.write(`data: ${JSON.stringify({
                  message: data?.error?.message || data?.message || "حدث خطأ أثناء توليد الرد",
                })}\n\n`);
              }
            }
          });

          response.on("end", finish);

          response.on("error", (error) => {
            if (completed) return;

            console.error("GEMINI RESPONSE ERROR:", error);

            try {
              res.write("event: error\n");
              res.write(
                `data: ${JSON.stringify({
                  message: "انقطع اتصال Gemini",
                })}\n\n`
              );
            } catch {}

            finish();
          });
        }
      );

      request.setTimeout(120000, () => {
        if (completed) return;

        try {
          request.destroy();
        } catch {}

        try {
          res.write("event: error\n");
          res.write(
            `data: ${JSON.stringify({
              message: "انتهت مهلة الاتصال مع Gemini",
            })}\n\n`
          );
        } catch {}

        finish();
      });

      request.on("error", (error) => {
        if (completed) return;

        console.error("GEMINI REQUEST ERROR:", error);

        try {
          if (!res.headersSent) {
            sendJson(res, 502, {
              success: false,
              error: "GEMINI_CONNECTION_ERROR",
              message: "تعذر الاتصال بخدمة Gemini",
            });

            completed = true;
            resolve();
            return;
          }

          res.write("event: error\n");
          res.write(
            `data: ${JSON.stringify({
              message: "تعذر الاتصال بخدمة Gemini",
            })}\n\n`
          );
        } catch {}

        finish();
      });

      request.write(payload);
      request.end();
    } catch (error) {
      console.error("GEMINI SETUP ERROR:", error);

      if (!res.headersSent) {
        sendJson(res, 500, {
          success: false,
          error: "GEMINI_ERROR",
          message: "حدث خطأ أثناء تشغيل Gemini",
        });
      }

      completed = true;
      resolve();
    }
  });
}


function runAIToText(currentMessage, isBuild = false, history = []) {
  return new Promise((resolve, reject) => {
    let output = "";
    let errorPayload = null;
    let streamBuffer = "";
    const capture = {
      headersSent: false,
      writableEnded: false,
      writeHead() { this.headersSent = true; },
      write(chunk) {
        streamBuffer += String(chunk || "");
        const events = streamBuffer.split(/\r?\n\r?\n/);
        streamBuffer = events.pop() || "";
        for (const event of events) {
          const lines = event.split(/\r?\n/);
          let eventName = "";
          let dataText = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            if (line.startsWith("data:")) dataText += line.slice(5).trim();
          }
          if (!dataText || dataText === "[DONE]") continue;
          try {
            const parsed = JSON.parse(dataText);
            if (eventName === "text" && typeof parsed?.text === "string") output += parsed.text;
            if (eventName === "error") errorPayload = parsed?.message || "فشل تشغيل وكيل البرمجة.";
          } catch {}
        }
      },
      end() { this.writableEnded = true; }
    };
    askAIStream(currentMessage, capture, isBuild, history)
      .then(() => errorPayload && !output.trim() ? reject(new Error(errorPayload)) : resolve(output.trim()))
      .catch(reject);
  });
}

function extractAgentFileBlocks(text) {
  const source = String(text || "");
  const fence = String.fromCharCode(96).repeat(3);
  const re = new RegExp("FILE:\\s*([^\\r\\n]+)\\r?\\n\\s*" + fence + "(?:[^\\r\\n]*)\\r?\\n([\\s\\S]*?)" + fence, "g");
  const blocks = [];
  let match;
  while ((match = re.exec(source)) !== null && blocks.length < 40) {
    const filePath = String(match[1] || "").trim().replace(/^\/+/, "");
    const content = String(match[2] || "").replace(/\r?\n$/, "");
    if (!filePath || filePath.includes("..") || filePath.startsWith(".git/") || filePath.length > 240 || content.length > 500000) continue;
    blocks.push({
      path: filePath,
      content,
      file_type: filePath.includes(".") ? filePath.split(".").pop() : "text",
      size_bytes: Buffer.byteLength(content, "utf8")
    });
  }
  return blocks;
}

function compactProjectFiles(files, maxChars = 120000) {
  const result = [];
  let total = 0;
  for (const file of (Array.isArray(files) ? files : [])) {
    const pathName = String(file?.path || "").trim();
    const content = String(file?.content || "");
    if (!pathName || pathName.includes("..")) continue;
    const remaining = maxChars - total;
    if (remaining <= 0) break;
    const clipped = content.length > remaining ? content.slice(0, remaining) : content;
    result.push("FILE: " + pathName + "\n[CODE]\n" + clipped + "\n[/CODE]");
    total += clipped.length;
  }
  return result.join("\n\n");
}

async function handleCodingAgent(req, res, user) {
  let data;
  try {
    data = await readJsonBody(req, res, 2 * 1024 * 1024);
  } catch (error) {
    sendJson(res, error.message === "REQUEST_TOO_LARGE" ? 413 : 400, {
      success: false,
      error: error.message === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
      message: "البيانات المرسلة غير صحيحة"
    });
    return;
  }

  const projectId = String(data.projectId || "").trim();
  const conversationId = String(data.conversationId || "").trim();
  const instruction = String(data.instruction || "").trim();
  if (!projectId || !instruction) {
    sendJson(res, 400, { success:false, error:"AGENT_FIELDS_REQUIRED", message:"المشروع وتعليمات الوكيل مطلوبة" });
    return;
  }

  try {
    const token = getBearerToken(req);
    const projectRows = await supabaseRequest("GET",
      "/rest/v1/projects?id=eq." + encodeURIComponent(projectId) + "&user_id=eq." + encodeURIComponent(user.id) + "&select=id,name,type,description,status&limit=1",
      token);
    if (!Array.isArray(projectRows) || !projectRows.length) {
      sendJson(res, 404, {success:false,error:"PROJECT_NOT_FOUND",message:"المشروع غير موجود أو لا تملك صلاحية الوصول إليه"});
      return;
    }

    const projectFiles = await supabaseRequest("GET",
      "/rest/v1/project_files?project_id=eq." + encodeURIComponent(projectId) + "&user_id=eq." + encodeURIComponent(user.id) + "&select=path,content,file_type,size_bytes&order=path.asc&limit=1000",
      token);
    const files = Array.isArray(projectFiles) ? projectFiles : [];
    const project = projectRows[0];
    const context = compactProjectFiles(files, 220000);
    let conversationContext = "(لا توجد محادثة مرتبطة بالوكيل)";
    if (conversationId) {
      try {
        const agentConversation = await getConversation(token, conversationId, user.id);
        const agentMessages = await getConversationMessages(token, conversationId);
        conversationContext = agentMessages.slice(-200).map(m => "[" + (m.role === "assistant" ? "AIZEN" : "USER") + "]\n" + String(m.content || "")).join("\n\n").slice(-120000) || "(المحادثة فارغة)";
      } catch (conversationError) {
        console.error("CODING AGENT CONVERSATION CONTEXT ERROR:", conversationError.message);
      }
    }

    const firstPrompt = [
      buildAizenCoreInstruction({ mode:"builder", isBuild:true, userRequest: instruction }),
      "أنت Aizen Coding Agent. نفّذ: تحليل المتطلبات ثم خطة مختصرة ثم تعديل الملفات ثم مراجعة ذاتية.",
      "لا تكسر الوظائف الموجودة. لا تحذف ملفات إلا إذا طلب المستخدم ذلك.",
      "طلب المستخدم:", instruction,
      "قاعدة معرفة Aizen الأساسية:", AIZEN_CORE_KNOWLEDGE,
      "صلاحيات الوكيل ضمن هذا الطلب:", AIZEN_AGENT_CAPABILITIES,
      "سياق المحادثة المرتبطة:", conversationContext,
      "اسم المشروع:", project.name,
      "النوع:", project.type || "custom",
      "الوصف:", project.description || "",
      "الملفات الحالية:", context || "(لا توجد ملفات محفوظة بعد)",
      "أخرج فقط الملفات الجديدة أو المعدلة بصيغة FILE: path ثم code fence ومحتوى الملف الكامل.",
      "إذا لا يوجد تغيير ضروري أخرج NO_CHANGES فقط. لا تضع أسراراً حقيقية. لا تدّعي تشغيل الاختبارات فعلياً.",
      "راجع syntax وimports والمسارات والحالة والأمان قبل الإخراج."
    ].join("\n");

    const firstPass = await runAIToText(firstPrompt, false, []);
    if (!firstPass || firstPass === "NO_CHANGES") {
      sendJson(res, 200, {success:true,changed:0,stage:"reviewed",message:"حلّل Aizen المشروع ولم يجد تغييرات ضرورية."});
      return;
    }

    const proposed = extractAgentFileBlocks(firstPass);
    if (!proposed.length) {
      sendJson(res, 422, {success:false,error:"AGENT_NO_FILE_BLOCKS",message:"لم يُرجع الوكيل ملفات قابلة للتطبيق."});
      return;
    }

    const proposedContext = compactProjectFiles(proposed, 120000);
    const reviewPrompt = [
      "أنت المراجع النهائي داخل Aizen Coding Agent.",
      "راجع التعديلات المقترحة مقارنة بطلب المستخدم والملفات الحالية.",
      "صحح syntax/import/path/state/security/regression problems.",
      "أعد فقط النسخة النهائية الكاملة للملفات التي يجب إنشاؤها أو تعديلها.",
      "إذا كانت سليمة أعدها كما هي. لا تضف أسراراً حقيقية.",
      "قاعدة معرفة Aizen الأساسية:", AIZEN_CORE_KNOWLEDGE,
      "صلاحيات الوكيل ضمن هذا الطلب:", AIZEN_AGENT_CAPABILITIES,
      "طلب المستخدم:", instruction,
      "سياق المحادثة المرتبطة:", conversationContext,
      "الملفات الحالية:", context || "(لا توجد ملفات محفوظة بعد)",
      "التعديلات المقترحة:", proposedContext
    ].join("\n");

    const reviewed = await runAIToText(reviewPrompt, false, []);
    const finalFiles = extractAgentFileBlocks(reviewed || firstPass);
    if (!finalFiles.length) {
      sendJson(res, 422, {success:false,error:"AGENT_REVIEW_NO_FILES",message:"فشلت المراجعة في إنتاج ملفات قابلة للتطبيق، ولم يتم تغيير المشروع."});
      return;
    }

    const rows = finalFiles.map(file => ({
      project_id: projectId,
      user_id: user.id,
      path: file.path,
      content: file.content,
      file_type: file.file_type,
      size_bytes: file.size_bytes,
      updated_at: new Date().toISOString()
    }));

    const saved = await supabaseRequest("POST",
      "/rest/v1/project_files?on_conflict=project_id%2Cpath",
      token, rows, { "Prefer": "resolution=merge-duplicates,return=representation" });

    await supabaseRequest("PATCH",
      "/rest/v1/projects?id=eq." + encodeURIComponent(projectId) + "&user_id=eq." + encodeURIComponent(user.id),
      token, {status:"ready",updated_at:new Date().toISOString()});

    sendJson(res, 200, {
      success:true,
      changed:finalFiles.length,
      files:finalFiles.map(file=>file.path),
      stage:"analyzed_planned_edited_reviewed",
      saved:Array.isArray(saved) ? saved.length : finalFiles.length
    });
  } catch (error) {
    console.error("CODING AGENT ERROR:", error);
    if (!res.headersSent) sendJson(res, 500, {success:false,error:"CODING_AGENT_ERROR",message:"تعذر تشغيل وكيل البرمجة. لم يتم تطبيق التعديل."});
  }
}

/*
 * /api/chat
 *
 * Normal request:
 * {
 *   message,
 *   conversationId
 * }
 *
 * Build request can also use:
 * {
 *   message,
 *   conversationId,
 *   build: true
 * }
 */
async function handleChat(req, res, user) {
  const accessToken = getBearerToken(req);

  let data;

  try {
    data = await readJsonBody(req);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(res, 413, {
        success: false,
        error: "REQUEST_TOO_LARGE",
      });
      return;
    }

    sendJson(res, 400, {
      success: false,
      error: "INVALID_JSON",
      message: "البيانات المرسلة غير صحيحة",
    });

    return;
  }

  const message = String(data.message || "").trim();
  const conversationId = data.conversationId
    ? String(data.conversationId)
    : null;

  const isBuild = Boolean(data.build);

  if (!message && !conversationId) {
    sendJson(res, 400, {
      success: false,
      error: "MESSAGE_REQUIRED",
      message: "الرسالة مطلوبة",
    });

    return;
  }

  try {
    let conversation = null;
    let history = [];

    if (conversationId) {
      [conversation, history] = await Promise.all([
        getConversation(accessToken, conversationId, user.id),
        getConversationMessages(accessToken, conversationId)
      ]);
    }

    let currentMessage = message;

    /*
     * If Build is called without a new message,
     * use the latest user message from the conversation.
     */
    if (!currentMessage && conversationId) {
      const latestUserMessage = [...history]
        .reverse()
        .find((item) => item.role === "user");

      currentMessage = latestUserMessage
        ? String(latestUserMessage.content || "")
        : "";
    }

    if (!currentMessage) {
      sendJson(res, 400, {
        success: false,
        error: "MESSAGE_REQUIRED",
        message: "لا توجد رسالة لبناء المشروع",
      });

      return;
    }

    await askAIStream(
      currentMessage,
      res,
      isBuild,
      history
    );
  } catch (error) {
    console.error("CHAT ERROR:", error);

    if (error.message === "CONVERSATION_NOT_FOUND") {
      sendJson(res, 404, {
        success: false,
        error: "CONVERSATION_NOT_FOUND",
        message: "المحادثة غير موجودة أو لا تملك صلاحية الوصول إليها",
      });

      return;
    }

    if (!res.headersSent) {
      sendJson(res, 500, {
        success: false,
        error: "CHAT_ERROR",
        message: "حدث خطأ أثناء معالجة الرسالة",
      });
    }
  }
}

function encryptSecret(value) {
  if (!SECRET_ENCRYPTION_KEY) throw new Error("SECRET_ENCRYPTION_KEY_MISSING");
  const key = crypto.createHash("sha256").update(SECRET_ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

async function verifyBotToken(type, value) {
  const token = String(value || "").trim();
  if (!token) return { valid: false, message: "التوكن مطلوب." };

  if (type === "telegram_bot") {
    const safeToken = encodeURIComponent(token);
    const url = new URL("https://api.telegram.org/bot" + safeToken + "/getMe");
    const response = await httpsRequest({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "GET",
      headers: { Accept: "application/json" }
    }, null, 10000);
    let data = null;
    try { data = JSON.parse(response.body); } catch {}
    if (response.statusCode === 200 && data?.ok === true && data?.result?.is_bot === true) {
      return { valid: true, bot: { id: data.result.id, username: data.result.username || "", name: data.result.first_name || "" } };
    }
    return { valid: false, message: "هذا ليس توكن Telegram صالحاً لبوت. أنشئ التوكن من @BotFather ثم جرّبه مرة أخرى." };
  }

  if (type === "discord_bot") {
    const url = new URL("https://discord.com/api/v10/users/@me");
    const response = await httpsRequest({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bot " + token
      }
    }, null, 10000);
    let data = null;
    try { data = JSON.parse(response.body); } catch {}
    if (response.statusCode === 200 && data?.id) {
      return { valid: true, bot: { id: data.id, username: data.username || "", name: data.global_name || data.username || "" } };
    }
    return { valid: false, message: "هذا ليس توكن Discord صالحاً لبوت. أنشئ توكن البوت من Discord Developer Portal ثم جرّبه مرة أخرى." };
  }

  return { valid: false, message: "نوع البوت غير مدعوم." };
}

async function handleVerifyBotToken(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 64 * 1024); }
  catch { sendJson(res, 400, { success:false, error:"INVALID_JSON", message:"البيانات المرسلة غير صحيحة" }); return; }
  const type = String(data.type || "").trim();
  const token = String(data.token || "").trim();
  if (!["telegram_bot","discord_bot"].includes(type) || !token) {
    sendJson(res, 400, { success:false, error:"BOT_TOKEN_FIELDS_REQUIRED", message:"نوع البوت والتوكن مطلوبان" }); return;
  }
  try {
    const result = await verifyBotToken(type, token);
    if (!result.valid) {
      sendJson(res, 422, { success:false, error:"INVALID_BOT_TOKEN", message:result.message });
      return;
    }
    sendJson(res, 200, { success:true, verified:true, bot:result.bot });
  } catch (error) {
    console.error("BOT TOKEN VERIFY ERROR:", error.message);
    sendJson(res, 502, { success:false, error:"BOT_TOKEN_VERIFY_FAILED", message:"تعذر التحقق من التوكن الآن. حاول مرة أخرى." });
  }
}

async function handleProjectSecret(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 64 * 1024); }
  catch { sendJson(res, 400, {success:false,error:"INVALID_JSON",message:"البيانات المرسلة غير صحيحة"}); return; }
  const projectId = String(data.projectId || "").trim();
  const name = String(data.name || "").trim();
  const value = String(data.value || "");
  if (!projectId || !name || !value) { sendJson(res, 400, {success:false,error:"SECRET_FIELDS_REQUIRED",message:"المشروع واسم السر والتوكن مطلوبة"}); return; }
  if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(name)) { sendJson(res, 400, {success:false,error:"INVALID_SECRET_NAME",message:"اسم السر غير صالح"}); return; }
  try {
    const encryptedValue = encryptSecret(value);
    const body = JSON.stringify({project_id:projectId,user_id:user.id,name,encrypted_value:encryptedValue,updated_at:new Date().toISOString()});
    const url = new URL(SUPABASE_URL + "/rest/v1/project_secrets");
    const response = await httpsRequest({hostname:url.hostname,path:url.pathname + "?on_conflict=project_id%2Cname",method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer " + getBearerToken(req),"Prefer":"resolution=merge-duplicates,return=minimal"}}, body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error("PROJECT SECRET SAVE ERROR:", response.statusCode, response.body);
      sendJson(res, 500, {success:false,error:"SECRET_SAVE_FAILED",message:"تعذر حفظ السر بأمان"}); return;
    }
    sendJson(res, 200, {success:true,stored:true,name});
  } catch (error) {
    console.error("PROJECT SECRET ERROR:", error);
    const missing = error.message === "SECRET_ENCRYPTION_KEY_MISSING";
    sendJson(res, 500, {success:false,error:missing ? "SECRET_ENCRYPTION_KEY_MISSING" : "SECRET_SAVE_FAILED",message:missing ? "أضف SECRET_ENCRYPTION_KEY في إعدادات الاستضافة." : "تعذر حفظ السر بأمان"});
  }
}

/*
 * /api/create
 *
 * This endpoint verifies the authenticated user
 * and accepts a project/build request.
 *
 * Actual project rows can be created from the frontend
 * through Supabase using RLS.
 */
async function handleCreate(req, res, user) {
  let data;

  try {
    data = await readJsonBody(req);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(res, 413, {
        success: false,
        error: "REQUEST_TOO_LARGE",
      });
      return;
    }

    sendJson(res, 400, {
      success: false,
      error: "INVALID_JSON",
      message: "البيانات المرسلة غير صحيحة",    });

    return;
  }

  const idea = String(
    data.idea || data.message || ""
  ).trim();

  const type = String(
    data.type || "Web"
  ).trim();

  if (!idea) {
    sendJson(res, 400, {
      success: false,
      error: "IDEA_REQUIRED",
      message: "فكرة المشروع مطلوبة",
    });

    return;
  }

  sendJson(res, 200, {
    success: true,
    message: "تم استلام طلب بناء المشروع",
    idea,
    type,
    user_id: user.id,
  });
}

/*
 * /api/me
 *
 * Useful for checking the currently authenticated
 * Supabase user from the backend.
 */
async function handleMe(req, res, user) {
  sendJson(res, 200, {
    success: true,
    user: {
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      created_at: user.created_at || null,
      display_name:
        user.user_metadata?.display_name || "",
      avatar_url:
        user.user_metadata?.avatar_url || "",
    },
  });
}

/*
 * Main HTTP server.
 */
const server = http.createServer(async (req, res) => {
  setCors(res);

  const method = req.method || "GET";
  const pathname = (req.url || "/").split("?")[0];

  /*
   * CORS preflight
   */
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  /*
   * Health check
   */
  if (
    method === "GET" &&
    pathname === "/api/health"
  ) {
    sendJson(res, 200, {
      success: true,
      status: "ok",
      service: "Aizen AI Builder",
      authenticated_backend: Boolean(
        SUPABASE_URL && SUPABASE_ANON_KEY
      ),
      gemini_configured: Boolean(
        GEMINI_API_KEY
      ),
      openrouter_configured: Boolean(
        OPENROUTER_API_KEY
      ),
      groq_configured: Boolean(
        GROQ_API_KEY
      ),
      routing_mode: AI_PROVIDER === "auto" ? "smart-auto" : "manual",
      ai_modes: ["assistant","planner","reviewer","debugger","teacher","optimizer","security","tester","builder"],
      coding_agent: true,
      coding_agent_stages: ["analyze","plan","edit","review"],
      max_message_chars: AI_MAX_MESSAGE_CHARS,
      uptime_seconds: Math.floor(process.uptime()),
      aizen_core_version: AIZEN_CORE_VERSION,
      aizen_agent_capabilities: 11,
      chat_primary: GEMINI_API_KEY ? "gemini" : (GROQ_API_KEY ? "groq" : (OPENROUTER_API_KEY ? "openrouter" : null)),
      build_primary: GROQ_API_KEY ? "groq" : (GEMINI_API_KEY ? "gemini" : (OPENROUTER_API_KEY ? "openrouter" : null)),
      ai_provider: AI_PROVIDER,
      aizen_core: {version:AIZEN_CORE_VERSION,capabilities:AIZEN_AGENT_CAPABILITIES.split("\n").length},
      openrouter_model: OPENROUTER_API_KEY ? OPENROUTER_MODEL : null,
    });

    return;
  }

  /*
   * Current user
   */
  if (
    method === "GET" &&
    pathname === "/api/me"
  ) {
    const user = await requireAuth(req, res);

    if (!user) return;

    await handleMe(req, res, user);
    return;
  }

  /*
   * Chat
   */
  if (
    method === "POST" &&
    pathname === "/api/chat"
  ) {
    const user = await requireAuth(req, res);

    if (!user) return;

    await handleChat(req, res, user);
    return;
  }

  /*
   * AI Coding Agent
   */
  if (method === "POST" && pathname === "/api/agent") {
    const user = await requireAuth(req, res);
    if (!user) return;
    await handleCodingAgent(req, res, user);
    return;
  }

  /*
   * Build/Create
   */
  if (method === "POST" && pathname === "/api/verify-bot-token") {
    const user = await requireAuth(req, res);
    if (!user) return;
    await handleVerifyBotToken(req, res, user);
    return;
  }

  if (method === "POST" && pathname === "/api/project-secret") {
    const user = await requireAuth(req, res);
    if (!user) return;
    await handleProjectSecret(req, res, user);
    return;
  }

  if (
    method === "POST" &&
    pathname === "/api/create"
  ) {
    const user = await requireAuth(req, res);

    if (!user) return;

    await handleCreate(req, res, user);
    return;
  }

  /*
   * Frontend
   */
  if (
    method === "GET" &&
    (pathname === "/" || pathname === "/index.html")
  ) {
    fs.readFile(FRONTEND_PATH, (error, content) => {
      if (error) {
        console.error("FRONTEND ERROR:", error);

        sendJson(res, 500, {
          success: false,
          error: "FRONTEND_NOT_FOUND",
          message: "لم يتم العثور على frontend/index.html",
        });

        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });

      res.end(content);
    });

    return;
  }

  /*
   * 404
   */
  sendJson(res, 404, {
    success: false,
    error: "NOT_FOUND",
    message: "المسار غير موجود",
  });
});

server.on("clientError", (error, socket) => {
  console.error("CLIENT ERROR:", error.message);

  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch {}
});

server.listen(PORT, () => {
  console.log("====================================");
  console.log("Aizen AI Builder Backend");
  console.log("====================================");
  console.log(`Port: ${PORT}`);
  console.log(`Supabase: ${SUPABASE_URL ? "configured" : "missing"}`);
  console.log(`Gemini: ${GEMINI_API_KEY ? "configured" : "missing"}`);
  console.log(`OpenRouter: ${OPENROUTER_API_KEY ? "configured" : "missing"}`);
  console.log(`OpenRouter model: ${OPENROUTER_API_KEY ? OPENROUTER_MODEL : "not configured"}`);
  console.log(`Groq: ${GROQ_API_KEY ? "configured" : "missing"}`);
  console.log(`Groq model: ${GROQ_API_KEY ? GROQ_MODEL : "not configured"}`);
  console.log(`AI provider: ${AI_PROVIDER}`);
  console.log(`Frontend: ${FRONTEND_PATH}`);
  console.log("====================================");
});