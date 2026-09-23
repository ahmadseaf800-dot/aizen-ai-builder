const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const APP_ORIGIN = process.env.APP_ORIGIN || "*";

const MODEL = "gemini-3.6-flash";

/* =========================
   CORS
========================= */

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}

/* =========================
   JSON RESPONSE
========================= */

function sendJSON(res, status, data) {
  if (res.writableEnded) return;

  setCORS(res);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

/* =========================
   READ REQUEST BODY
========================= */

function readBody(req, callback) {
  let body = "";

  req.on("data", chunk => {
    body += chunk.toString();

    if (body.length > 2_000_000) {
      req.destroy();
    }
  });

  req.on("end", () => {
    try {
      callback(null, JSON.parse(body || "{}"));
    } catch (error) {
      callback(error, null);
    }
  });

  req.on("error", error => {
    callback(error, null);
  });
}

/* =========================
   GET BEARER TOKEN
========================= */

function getBearerToken(req) {
  const authorization = String(
    req.headers.authorization || ""
  );

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization
    .slice(7)
    .trim();

  return token || null;
}

/* =========================
   VERIFY SUPABASE SESSION
========================= */

function verifySupabaseToken(token, callback) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return callback(
      new Error(
        "SUPABASE_URL أو SUPABASE_ANON_KEY غير موجود"
      )
    );
  }

  const baseURL = SUPABASE_URL.replace(/\/$/, "");

  let url;

  try {
    url = new URL(
      baseURL + "/auth/v1/user"
    );
  } catch (error) {
    return callback(
      new Error("SUPABASE_URL غير صالح")
    );
  }

  const request = https.request(
    {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",

      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + token,
        Accept: "application/json"
      },

      timeout: 10000
    },

    supabaseRes => {
      let body = "";

      supabaseRes.on("data", chunk => {
        body += chunk.toString("utf8");
      });

      supabaseRes.on("end", () => {
        if (supabaseRes.statusCode !== 200) {
          return callback(null, null);
        }

        try {
          const user = JSON.parse(body);

          if (!user || !user.id) {
            return callback(null, null);
          }

          callback(null, user);
        } catch (error) {
          callback(null, null);
        }
      });
    }
  );

  request.on("timeout", () => {
    request.destroy();

    callback(
      new Error(
        "انتهت مهلة التحقق من Supabase"
      )
    );
  });

  request.on("error", error => {
    callback(error);
  });

  request.end();
}

/* =========================
   AUTH MIDDLEWARE
========================= */

function requireAuth(req, res, callback) {
  const token = getBearerToken(req);

  if (!token) {
    return sendJSON(res, 401, {
      success: false,
      error: "يجب تسجيل الدخول أولاً"
    });
  }

  verifySupabaseToken(
    token,
    (error, user) => {
      if (error) {
        console.error(
          "Supabase auth error:",
          error.message
        );

        return sendJSON(res, 503, {
          success: false,
          error:
            "تعذر التحقق من جلسة تسجيل الدخول"
        });
      }

      if (!user) {
        return sendJSON(res, 401, {
          success: false,
          error:
            "جلسة تسجيل الدخول غير صالحة أو منتهية"
        });
      }

      callback(user, token);
    }
  );
}

/* =========================
   GEMINI STREAM
========================= */

function askGeminiStream(message, res) {
  if (!GEMINI_API_KEY) {
    return sendJSON(res, 500, {
      success: false,
      error:
        "GEMINI_API_KEY غير موجود في Render"
    });
  }

  const requestData = JSON.stringify({
    model: MODEL,

    input: message,

    stream: true,

    system_instruction:
      "أنت Aizen AI، مساعد ذكي داخل منصة Aizen AI Builder. " +
      "أجب بالعربية بشكل واضح ومباشر. " +
      "ساعد المستخدم في البرمجة وبناء المواقع والتطبيقات والبوتات والألعاب والمشاريع. " +
      "إذا طلب المستخدم بناء مشروع، افهم المطلوب أولاً ثم قدم حلاً عملياً ومنظماً. " +
      "لا تطيل بدون حاجة."
  });

  const options = {
    hostname:
      "generativelanguage.googleapis.com",

    path:
      "/v1beta/interactions",

    method: "POST",

    headers: {
      "Content-Type":
        "application/json",

      Accept:
        "text/event-stream",

      "x-goog-api-key":
        GEMINI_API_KEY,

      "Content-Length":
        Buffer.byteLength(requestData)
    },

    timeout: 120000
  };

  console.log(
    "Streaming request to Gemini..."
  );

  console.log(
    "Model:",
    MODEL
  );

  const request = https.request(
    options,
    geminiRes => {
      /* =========================
         GEMINI ERROR
      ========================= */

      if (
        geminiRes.statusCode < 200 ||
        geminiRes.statusCode >= 300
      ) {
        let errorBody = "";

        geminiRes.on(
          "data",
          chunk => {
            errorBody +=
              chunk.toString("utf8");
          }
        );

        geminiRes.on(
          "end",
          () => {
            console.error(
              "Gemini error:",
              geminiRes.statusCode,
              errorBody
            );

            let errorMessage =
              "حدث خطأ من Gemini";

            try {
              const result =
                JSON.parse(errorBody);

              errorMessage =
                result?.error?.message ||
                result?.message ||
                errorMessage;
            } catch {}

            if (!res.writableEnded) {
              sendJSON(
                res,
                geminiRes.statusCode,
                {
                  success: false,
                  error: errorMessage
                }
              );
            }
          }
        );

        return;
      }

      /* =========================
         SSE HEADERS
      ========================= */

      setCORS(res);

      res.writeHead(200, {
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-cache, no-transform",

        Connection:
          "keep-alive",

        "X-Accel-Buffering":
          "no"
      });

      let buffer = "";

      /* =========================
         RECEIVE STREAM
      ========================= */

      geminiRes.on(
        "data",
        chunk => {
          buffer +=
            chunk.toString("utf8");

          const events =
            buffer.split("\n\n");

          buffer =
            events.pop() || "";

          for (
            const eventBlock
            of events
          ) {
            processSSEEvent(
              eventBlock,
              res
            );
          }
        }
      );

      /* =========================
         STREAM FINISHED
      ========================= */

      geminiRes.on(
        "end",
        () => {
          if (buffer.trim()) {
            processSSEEvent(
              buffer,
              res
            );
          }

          if (!res.writableEnded) {
            res.write(
              `event: done\ndata: ${JSON.stringify(
                {
                  success: true
                }
              )}\n\n`
            );

            res.end();
          }

          console.log(
            "Gemini stream finished."
          );
        }
      );

      /* =========================
         STREAM ERROR
      ========================= */

      geminiRes.on(
        "error",
        error => {
          console.error(
            "Gemini stream error:",
            error
          );

          if (!res.writableEnded) {
            res.write(
              `event: error\ndata: ${JSON.stringify(
                {
                  success: false,
                  error:
                    "انقطع الاتصال مع Gemini"
                }
              )}\n\n`
            );

            res.end();
          }
        }
      );
    }
  );

  /* =========================
     REQUEST TIMEOUT
  ========================= */

  request.on(
    "timeout",
    () => {
      request.destroy();

      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify(
            {
              success: false,
              error:
                "انتهت مهلة الاتصال بـ Gemini"
            }
          )}\n\n`
        );

        res.end();
      }
    }
  );

  /* =========================
     REQUEST ERROR
  ========================= */

  request.on(
    "error",
    error => {
      console.error(
        "Gemini request error:",
        error
      );

      if (!res.writableEnded) {
        sendJSON(res, 500, {
          success: false,
          error:
            "تعذر الاتصال بـ Gemini"
        });
      }
    }
  );

  request.write(requestData);
  request.end();
}

/* =========================
   PROCESS GEMINI SSE
========================= */

function processSSEEvent(
  eventBlock,
  res
) {
  if (
    !eventBlock ||
    res.writableEnded
  ) {
    return;
  }

  const lines =
    eventBlock.split("\n");

  let eventType = "";
  let dataText = "";

  for (
    const line of lines
  ) {
    if (
      line.startsWith("event:")
    ) {
      eventType =
        line.slice(6).trim();
    }

    if (
      line.startsWith("data:")
    ) {
      dataText +=
        line.slice(5).trim();
    }
  }

  if (!dataText) {
    return;
  }

  try {
    const data =
      JSON.parse(dataText);

    /* =========================
       ERROR
    ========================= */

    if (
      eventType === "error" ||
      data.event_type === "error"
    ) {
      res.write(
        `event: error\ndata: ${JSON.stringify(
          {
            success: false,
            error:
              data?.error?.message ||
              "حدث خطأ أثناء التوليد"
          }
        )}\n\n`
      );

      return;
    }

    /* =========================
       TEXT DELTA
    ========================= */

    if (
      eventType ===
        "step.delta" ||
      data.event_type ===
        "step.delta"
    ) {
      const delta =
        data.delta;

      if (
        delta?.type === "text" &&
        delta.text
      ) {
        res.write(
          `event: text\ndata: ${JSON.stringify(
            {
              text: delta.text
            }
          )}\n\n`
        );
      }
    }

    /* =========================
       COMPLETED
    ========================= */

    if (
      eventType ===
        "interaction.completed" ||
      data.event_type ===
        "interaction.completed"
    ) {
      res.write(
        `event: complete\ndata: ${JSON.stringify(
          {
            success: true
          }
        )}\n\n`
      );
    }
  } catch (error) {
    console.error(
      "SSE parse error:",
      error
    );
  }
}

/* =========================
   HTTP SERVER
========================= */

const server =
  http.createServer(
    (req, res) => {
      setCORS(res);

      /* =========================
         OPTIONS
      ========================= */

      if (
        req.method === "OPTIONS"
      ) {
        res.writeHead(204);
        res.end();
        return;
      }

      /* =========================
         FRONTEND
      ========================= */

      if (
        req.method === "GET" &&
        req.url === "/"
      ) {
        const filePath =
          path.join(
            __dirname,
            "../frontend/index.html"
          );

        fs.readFile(
          filePath,
          "utf8",
          (error, data) => {
            if (error) {
              return sendJSON(
                res,
                500,
                {
                  success: false,
                  error:
                    "Frontend Error"
                }
              );
            }

            res.writeHead(
              200,
              {
                "Content-Type":
                  "text/html; charset=utf-8"
              }
            );

            res.end(data);
          }
        );

        return;
      }

      /* =========================
         HEALTH
      ========================= */

      if (
        req.method === "GET" &&
        req.url === "/api/health"
      ) {
        return sendJSON(
          res,
          200,
          {
            success: true,
            name:
              "Aizen AI Builder",

            status:
              "healthy",

            model:
              MODEL,

            streaming:
              true,

            authentication:
              "supabase"
          }
        );
      }

      /* =========================
         CHAT
      ========================= */

      if (
        req.method === "POST" &&
        req.url === "/api/chat"
      ) {
        return requireAuth(
          req,
          res,
          user => {
            readBody(
              req,
              (
                error,
                data
              ) => {
                if (error) {
                  return sendJSON(
                    res,
                    400,
                    {
                      success: false,
                      error:
                        "بيانات غير صحيحة"
                    }
                  );
                }

                const message =
                  String(
                    data.message ||
                      ""
                  ).trim();

                if (!message) {
                  return sendJSON(
                    res,
                    400,
                    {
                      success: false,
                      error:
                        "اكتب رسالة أولاً"
                    }
                  );
                }

                console.log(
                  "Authenticated user:",
                  user.id
                );

                askGeminiStream(
                  message,
                  res
                );
              }
            );
          }
        );
      }

      /* =========================
         CREATE PROJECT
      ========================= */

      if (
        req.method === "POST" &&
        req.url === "/api/create"
      ) {
        return requireAuth(
          req,
          res,
          user => {
            readBody(
              req,
              (
                error,
                data
              ) => {
                if (error) {
                  return sendJSON(
                    res,
                    400,
                    {
                      success: false,
                      error:
                        "بيانات غير صحيحة"
                    }
                  );
                }

                return sendJSON(
                  res,
                  200,
                  {
                    success: true,

                    message:
                      "تم استلام المشروع",

                    idea:
                      data.idea || "",

                    type:
                      data.type || "",

                    user_id:
                      user.id
                  }
                );
              }
            );
          }
        );
      }

      /* =========================
         NOT FOUND
      ========================= */

      return sendJSON(
        res,
        404,
        {
          success: false,
          error:
            "Not Found"
        }
      );
    }
  );

/* =========================
   START SERVER
========================= */

server.listen(
  PORT,
  () => {
    console.log(
      "Aizen Backend running on port " +
        PORT
    );

    console.log(
      "Gemini model: " +
        MODEL
    );

    console.log(
      "Supabase authentication: enabled"
    );
  }
);
