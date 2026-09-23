const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_ORIGIN = process.env.APP_ORIGIN || "*";

const GEMINI_MODEL = "gemini-3.6-flash";
const SECRET_ENCRYPTION_KEY = String(process.env.SECRET_ENCRYPTION_KEY || "");

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
async function supabaseRequest(method, endpoint, accessToken, body = null) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const url = new URL(`${SUPABASE_URL}${endpoint}`);

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
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
    `/rest/v1/messages?conversation_id=eq.${safeId}&select=id,conversation_id,user_id,role,content,metadata,created_at&order=created_at.asc&limit=100`,
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
    String(currentMessage || "").trim();

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

  return history;
}

/*
 * Call Gemini using SSE streaming.
 */
function askGeminiStream(currentMessage, res, isBuild, history = []) {
  return new Promise((resolve) => {
    if (!GEMINI_API_KEY) {
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

    const systemInstruction = isBuild
      ? `
أنت Aizen AI Builder، مساعد برمجي ذكي ودقيق.

هدفك تقديم إجابات صحيحة ومفيدة وقابلة للتنفيذ، مع أقل قدر ممكن من التأخير.

قواعد الإجابة:
1. افهم سؤال المستخدم قبل الإجابة ولا تفترض معلومات غير مذكورة.
2. إذا كانت المعلومة غير مؤكدة، صرّح بذلك بدلاً من اختلاقها.
3. أعطِ جواباً مباشراً أولاً، ثم التفاصيل الضرورية فقط.
4. في البرمجة، استخدم كوداً صحيحاً ومتوافقاً مع الإصدار الذي يحدده المستخدم.
5. حافظ على سياق المحادثة ولا تكرر الأسئلة أو المعلومات بلا حاجة.
6. عند إصلاح خطأ، حدّد السبب والحل العملي بوضوح.
7. لا تدّعي تنفيذ شيء لم ينفذه النظام فعلياً.
8. عند البناء، أخرج مشروعاً حقيقياً قابلاً للتشغيل، وليس مجرد واجهة شكلية.
9. في بناء المشاريع استخدم لكل ملف:
FILE: path/to/file.ext
```
كامل محتوى الملف
```
10. اجعل الملفات المطلوبة مترابطة، وضمّن الإعدادات والاعتماديات والتعليمات اللازمة للتشغيل.
11. لا تضع أسراراً حقيقية داخل الكود؛ استخدم متغيرات بيئة مثل TELEGRAM_BOT_TOKEN وDISCORD_BOT_TOKEN.
12. إذا طلب المستخدم شيئاً يعتمد على معلومات حديثة أو خارجية ولا تتوفر لك أداة تحقق، لا تخمّن.

كن سريعاً، دقيقاً، وعملياً.
`
      : `
أنت Aizen AI، مساعد برمجي ذكي داخل منصة Aizen AI Builder.

ساعد المستخدم في البرمجة، بناء التطبيقات والمواقع، إصلاح الأخطاء، شرح الأكواد، وتصميم المشاريع.

عندما يطلب المستخدم إنشاء شيء برمجياً:
- أعطه حلاً عملياً.
- استخدم كوداً صحيحاً.
- لا تدّعي تنفيذ عمليات لم يتم تنفيذها فعلياً.
- إذا كان الطلب متعلقاً بمشروعه، حافظ على سياق المحادثة.
`;

    const payload = JSON.stringify({
      model: GEMINI_MODEL,
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

            const events = buffer.split(/\n\n/);
            buffer = events.pop() || "";

            for (const rawEvent of events) {
              const lines = rawEvent.split("\n");

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

              /*
               * Gemini text delta.
               */
              if (
                eventName === "step.delta" &&
                data &&
                data.text
              ) {
                res.write("event: text\n");
                res.write(
                  `data: ${JSON.stringify({
                    text: String(data.text),
                  })}\n\n`
                );
              }

              /*
               * Some Gemini responses may contain
               * text inside other delta structures.
               */
              else if (
                data &&
                typeof data.text === "string"
              ) {
                res.write("event: text\n");
                res.write(
                  `data: ${JSON.stringify({
                    text: data.text,
                  })}\n\n`
                );
              }

              else if (
                eventName === "interaction.completed"
              ) {
                res.write("event: complete\n");
                res.write("data: {}\n\n");
              }

              else if (
                eventName === "error" ||
                data.error
              ) {
                res.write("event: error\n");
                res.write(
                  `data: ${JSON.stringify({
                    message:
                      data?.error?.message ||
                      data?.message ||
                      "حدث خطأ أثناء توليد الرد",
                  })}\n\n`
                );
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
      conversation = await getConversation(
        accessToken,
        conversationId,
        user.id
      );

      history = await getConversationMessages(
        accessToken,
        conversationId
      );
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

    await askGeminiStream(
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
      message: "البيانات المرسلة غير صحيحة",
    });

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
   * Build/Create
   */
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
  console.log(`Frontend: ${FRONTEND_PATH}`);
  console.log("====================================");
});
