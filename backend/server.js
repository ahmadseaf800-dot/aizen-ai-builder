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


/* =========================================================
   CORS
========================================================= */

function setCORS(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    APP_ORIGIN
  );

  res.setHeader(
    "Vary",
    "Origin"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}


/* =========================================================
   JSON
========================================================= */

function sendJSON(res, status, data) {
  if (res.writableEnded) return;

  setCORS(res);

  res.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8"
  });

  res.end(
    JSON.stringify(data)
  );
}


/* =========================================================
   REQUEST BODY
========================================================= */

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
      callback(
        null,
        JSON.parse(body || "{}")
      );
    } catch (error) {
      callback(error, null);
    }
  });

  req.on("error", error => {
    callback(error, null);
  });
}


/* =========================================================
   BEARER TOKEN
========================================================= */

function getBearerToken(req) {
  const authorization =
    String(
      req.headers.authorization || ""
    );

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  return token || null;
}


/* =========================================================
   SUPABASE AUTH
========================================================= */

function verifySupabaseToken(
  token,
  callback
) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    return callback(
      new Error(
        "Supabase environment variables are missing"
      )
    );
  }

  const baseURL =
    SUPABASE_URL.replace(
      /\/$/,
      ""
    );

  let url;

  try {
    url = new URL(
      baseURL +
      "/auth/v1/user"
    );
  } catch {
    return callback(
      new Error(
        "Invalid SUPABASE_URL"
      )
    );
  }

  const request =
    https.request(
      {
        hostname:
          url.hostname,

        path:
          url.pathname +
          url.search,

        method:
          "GET",

        headers: {
          apikey:
            SUPABASE_ANON_KEY,

          Authorization:
            "Bearer " + token,

          Accept:
            "application/json"
        },

        timeout:
          10000
      },

      supabaseRes => {
        let body = "";

        supabaseRes.on(
          "data",
          chunk => {
            body +=
              chunk.toString("utf8");
          }
        );

        supabaseRes.on(
          "end",
          () => {
            if (
              supabaseRes.statusCode !==
              200
            ) {
              return callback(
                null,
                null
              );
            }

            try {
              const user =
                JSON.parse(body);

              if (
                !user ||
                !user.id
              ) {
                return callback(
                  null,
                  null
                );
              }

              callback(
                null,
                user
              );

            } catch {
              callback(
                null,
                null
              );
            }
          }
        );
      }
    );

  request.on(
    "timeout",
    () => {
      request.destroy();

      callback(
        new Error(
          "Supabase authentication timeout"
        )
      );
    }
  );

  request.on(
    "error",
    error => {
      callback(
        error
      );
    }
  );

  request.end();
}


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireAuth(
  req,
  res,
  callback
) {
  const token =
    getBearerToken(req);

  if (!token) {
    return sendJSON(
      res,
      401,
      {
        success: false,
        error:
          "يجب تسجيل الدخول أولاً"
      }
    );
  }

  verifySupabaseToken(
    token,
    (error, user) => {
      if (error) {
        console.error(
          "Supabase auth error:",
          error.message
        );

        return sendJSON(
          res,
          503,
          {
            success: false,
            error:
              "تعذر التحقق من جلسة تسجيل الدخول"
          }
        );
      }

      if (!user) {
        return sendJSON(
          res,
          401,
          {
            success: false,
            error:
              "جلسة تسجيل الدخول غير صالحة أو منتهية"
          }
        );
      }

      callback(
        user,
        token
      );
    }
  );
}


/* =========================================================
   SUPABASE REST REQUEST
========================================================= */

function supabaseRequest(
  method,
  endpoint,
  token,
  body,
  callback
) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    return callback(
      new Error(
        "Supabase configuration missing"
      )
    );
  }

  const baseURL =
    SUPABASE_URL.replace(
      /\/$/,
      ""
    );

  let url;

  try {
    url = new URL(
      baseURL +
      endpoint
    );
  } catch {
    return callback(
      new Error(
        "Invalid Supabase URL"
      )
    );
  }

  const requestBody =
    body === undefined
      ? null
      : JSON.stringify(body);

  const headers = {
    apikey:
      SUPABASE_ANON_KEY,

    Authorization:
      "Bearer " + token,

    Accept:
      "application/json"
  };

  if (requestBody) {
    headers[
      "Content-Type"
    ] =
      "application/json";

    headers[
      "Content-Length"
    ] =
      Buffer.byteLength(
        requestBody
      );
  }

  const request =
    https.request(
      {
        hostname:
          url.hostname,

        path:
          url.pathname +
          url.search,

        method,

        headers,

        timeout:
          20000
      },

      response => {
        let responseBody = "";

        response.on(
          "data",
          chunk => {
            responseBody +=
              chunk.toString(
                "utf8"
              );
          }
        );

        response.on(
          "end",
          () => {
            let parsed =
              null;

            try {
              parsed =
                responseBody
                  ? JSON.parse(
                      responseBody
                    )
                  : null;
            } catch {
              parsed =
                responseBody;
            }

            if (
              response.statusCode < 200 ||
              response.statusCode >= 300
            ) {
              return callback(
                new Error(
                  typeof parsed ===
                    "string"
                    ? parsed
                    : JSON.stringify(
                        parsed
                      )
                )
              );
            }

            callback(
              null,
              parsed
            );
          }
        );
      }
    );

  request.on(
    "timeout",
    () => {
      request.destroy();

      callback(
        new Error(
          "Supabase request timeout"
        )
      );
    }
  );

  request.on(
    "error",
    error => {
      callback(
        error
      );
    }
  );

  if (requestBody) {
    request.write(
      requestBody
    );
  }

  request.end();
}


/* =========================================================
   LOAD CONVERSATION MESSAGES
========================================================= */

function loadConversationMessages(
  conversationId,
  userId,
  token,
  callback
) {
  const endpoint =
    "/rest/v1/messages" +
    "?select=role,content,created_at" +
    "&conversation_id=eq." +
    encodeURIComponent(
      conversationId
    ) +
    "&user_id=eq." +
    encodeURIComponent(
      userId
    ) +
    "&order=created_at.asc" +
    "&limit=100";

  supabaseRequest(
    "GET",
    endpoint,
    token,
    undefined,
    callback
  );
}


/* =========================================================
   LOAD LATEST USER MESSAGE
========================================================= */

function loadLatestUserMessage(
  conversationId,
  userId,
  token,
  callback
) {
  const endpoint =
    "/rest/v1/messages" +
    "?select=content,created_at" +
    "&conversation_id=eq." +
    encodeURIComponent(
      conversationId
    ) +
    "&user_id=eq." +
    encodeURIComponent(
      userId
    ) +
    "&role=eq.user" +
    "&order=created_at.desc" +
    "&limit=1";

  supabaseRequest(
    "GET",
    endpoint,
    token,
    undefined,
    (error, data) => {
      if (error) {
        return callback(
          error
        );
      }

      const message =
        Array.isArray(data) &&
        data.length
          ? data[0].content
          : "";

      callback(
        null,
        message
      );
    }
  );
}


/* =========================================================
   BUILD GEMINI INPUT
========================================================= */

function buildGeminiInput(
  currentMessage,
  history,
  isBuild
) {
  const lines = [];

  if (isBuild) {
    lines.push(
      "وضع BUILD مفعل."
    );

    lines.push(
      "حلل فكرة المستخدم وأنشئ خطة عملية لبناء المشروع."
    );

    lines.push(
      "قدم الملفات والكود والخطوات المطلوبة بشكل منظم."
    );
  }

  if (
    Array.isArray(history)
  ) {
    for (
      const message
      of history
    ) {
      const role =
        message.role ===
        "assistant"
          ? "Aizen"
          : "المستخدم";

      lines.push(
        `${role}: ${message.content}`
      );
    }
  }

  if (
    currentMessage
  ) {
    lines.push(
      `المستخدم: ${currentMessage}`
    );
  }

  return lines.join(
    "\n\n"
  );
}


/* =========================================================
   GEMINI STREAM
========================================================= */

function askGeminiStream(
  message,
  res,
  isBuild = false,
  history = []
) {
  if (!GEMINI_API_KEY) {
    return sendJSON(
      res,
      500,
      {
        success: false,
        error:
          "GEMINI_API_KEY غير موجود في Render"
      }
    );
  }

  const input =
    buildGeminiInput(
      message,
      history,
      isBuild
    );

  const requestData =
    JSON.stringify({
      model:
        MODEL,

      input,

      stream:
        true,

      system_instruction:
        "أنت Aizen AI، مساعد ذكي داخل منصة Aizen AI Builder. " +
        "أجب بالعربية بشكل واضح ومباشر. " +
        "ساعد المستخدم في البرمجة وبناء المواقع والتطبيقات والبوتات والألعاب والمشاريع. " +
        "افهم سياق المحادثة قبل الإجابة. " +
        "عند طلب بناء مشروع، قدم نتيجة عملية ومنظمة. " +
        "لا تطيل بدون حاجة."
    });

  const url =
    new URL(
      "https://generativelanguage.googleapis.com/v1beta/interactions"
    );

  const request =
    https.request(
      {
        hostname:
          url.hostname,

        path:
          url.pathname,

        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "text/event-stream",

          "x-goog-api-key":
            GEMINI_API_KEY,

          "Content-Length":
            Buffer.byteLength(
              requestData
            )
        },

        timeout:
          120000
      },

      geminiRes => {

        /* =====================
           GEMINI ERROR
        ===================== */

        if (
          geminiRes.statusCode < 200 ||
          geminiRes.statusCode >= 300
        ) {
          let errorBody =
            "";

          geminiRes.on(
            "data",
            chunk => {
              errorBody +=
                chunk.toString(
                  "utf8"
                );
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
                  JSON.parse(
                    errorBody
                  );

                errorMessage =
                  result?.error
                    ?.message ||
                  result?.message ||
                  errorMessage;

              } catch {}

              if (
                !res.writableEnded
              ) {
                sendJSON(
                  res,
                  geminiRes.statusCode,
                  {
                    success:
                      false,

                    error:
                      errorMessage
                  }
                );
              }
            }
          );

          return;
        }


        /* =====================
           SSE HEADERS
        ===================== */

        setCORS(res);

        res.writeHead(
          200,
          {
            "Content-Type":
              "text/event-stream; charset=utf-8",

            "Cache-Control":
              "no-cache, no-transform",

            Connection:
              "keep-alive",

            "X-Accel-Buffering":
              "no"
          }
        );


        let buffer = "";


        /* =====================
           STREAM DATA
        ===================== */

        geminiRes.on(
          "data",
          chunk => {
            buffer +=
              chunk.toString(
                "utf8"
              );

            const events =
              buffer.split(
                "\n\n"
              );

            buffer =
              events.pop() ||
              "";

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


        /* =====================
           STREAM END
        ===================== */

        geminiRes.on(
          "end",
          () => {

            if (
              buffer.trim()
            ) {
              processSSEEvent(
                buffer,
                res
              );
            }

            if (
              !res.writableEnded
            ) {
              res.write(
                "event: done\n" +
                "data: " +
                JSON.stringify({
                  success:
                    true
                }) +
                "\n\n"
              );

              res.end();
            }

            console.log(
              "Gemini stream finished."
            );
          }
        );


        /* =====================
           STREAM ERROR
        ===================== */

        geminiRes.on(
          "error",
          error => {
            console.error(
              "Gemini stream error:",
              error
            );

            if (
              !res.writableEnded
            ) {
              res.write(
                "event: error\n" +
                "data: " +
                JSON.stringify({
                  success:
                    false,

                  error:
                    "انقطع الاتصال مع Gemini"
                }) +
                "\n\n"
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

      if (
        !res.writableEnded
      ) {
        res.write(
          "event: error\n" +
          "data: " +
          JSON.stringify({
            success:
              false,

            error:
              "انتهت مهلة الاتصال بـ Gemini"
          }) +
          "\n\n"
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

      if (
        !res.writableEnded
      ) {
        sendJSON(
          res,
          500,
          {
            success:
              false,

            error:
              "تعذر الاتصال بـ Gemini"
          }
        );
      }
    }
  );


  request.write(
    requestData
  );

  request.end();
}


/* =========================================================
   PROCESS GEMINI SSE
========================================================= */

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
    eventBlock.split(
      "\n"
    );

  let eventType =
    "";

  let dataText =
    "";

  for (
    const line
    of lines
  ) {
    if (
      line.startsWith(
        "event:"
      )
    ) {
      eventType =
        line
          .slice(6)
          .trim();
    }

    if (
      line.startsWith(
        "data:"
      )
    ) {
      dataText +=
        line
          .slice(5)
          .trim();
    }
  }

  if (!dataText) {
    return;
  }

  try {
    const data =
      JSON.parse(
        dataText
      );


    /* =====================
       ERROR
    ===================== */

    if (
      eventType ===
        "error" ||
      data.event_type ===
        "error"
    ) {
      res.write(
        "event: error\n" +
        "data: " +
        JSON.stringify({
          success:
            false,

          error:
            data?.error
              ?.message ||
            "حدث خطأ أثناء التوليد"
        }) +
        "\n\n"
      );

      return;
    }


    /* =====================
       TEXT
    ===================== */

    if (
      eventType ===
        "step.delta" ||
      data.event_type ===
        "step.delta"
    ) {
      const delta =
        data.delta;

      if (
        delta?.type ===
          "text" &&
        delta.text
      ) {
        res.write(
          "event: text\n" +
          "data: " +
          JSON.stringify({
            text:
              delta.text
          }) +
          "\n\n"
        );
      }

      return;
    }


    /* =====================
       COMPLETED
    ===================== */

    if (
      eventType ===
        "interaction.completed" ||
      data.event_type ===
        "interaction.completed"
    ) {
      res.write(
        "event: complete\n" +
        "data: " +
        JSON.stringify({
          success:
            true
        }) +
        "\n\n"
      );
    }

  } catch (error) {
    console.error(
      "SSE parse error:",
      error
    );
  }
}


/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(
    (req, res) => {

      setCORS(res);


      /* =====================
         OPTIONS
      ===================== */

      if (
        req.method ===
        "OPTIONS"
      ) {
        res.writeHead(
          204
        );

        res.end();

        return;
      }


      /* =====================
         FRONTEND
      ===================== */

      if (
        req.method ===
          "GET" &&
        req.url === "/"
      ) {
        const filePath =
          path.join(
            __dirname,
            "../frontend/index.html"
          );

        return fs.readFile(
          filePath,
          "utf8",
          (error, data) => {

            if (error) {
              return sendJSON(
                res,
                500,
                {
                  success:
                    false,

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

            res.end(
              data
            );
          }
        );
      }


      /* =====================
         HEALTH
      ===================== */

      if (
        req.method ===
          "GET" &&
        req.url ===
          "/api/health"
      ) {
        return sendJSON(
          res,
          200,
          {
            success:
              true,

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


      /* =====================
         CHAT
      ===================== */

      if (
        req.method ===
          "POST" &&
        req.url ===
          "/api/chat"
      ) {
        return requireAuth(
          req,
          res,
          (
            user,
            token
          ) => {

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
                      success:
                        false,

                      error:
                        "بيانات غير صحيحة"
                    }
                  );
                }


                const conversationId =
                  String(
                    data.conversationId ||
                    ""
                  ).trim();


                const isBuild =
                  Boolean(
                    data.build
                  );


                let message =
                  String(
                    data.message ||
                    ""
                  ).trim();


                /* =================
                   CURRENT MESSAGE
                ================= */

                if (message) {

                  return loadConversationMessages(
                    conversationId,
                    user.id,
                    token,
                    (
                      historyError,
                      history
                    ) => {

                      if (
                        historyError
                      ) {
                        console.error(
                          historyError
                        );

                        history =
                          [];
                      }

                      askGeminiStream(
                        message,
                        res,
                        isBuild,
                        history
                      );
                    }
                  );
                }


                /* =================
                   BUILD MODE
                   FRONTEND SENDS:
                   conversationId
                   build:true
                ================= */

                if (
                  conversationId &&
                  isBuild
                ) {

                  return loadLatestUserMessage(
                    conversationId,
                    user.id,
                    token,
                    (
                      latestError,
                      latestMessage
                    ) => {

                      if (
                        latestError
                      ) {
                        console.error(
                          latestError
                        );

                        return sendJSON(
                          res,
                          500,
                          {
                            success:
                              false,

                            error:
                              "تعذر تحميل فكرة المشروع"
                          }
                        );
                      }


                      if (
                        !latestMessage
                      ) {
                        return sendJSON(
                          res,
                          400,
                          {
                            success:
                              false,

                            error:
                              "لا توجد فكرة مشروع لبنائها"
                          }
                        );
                      }


                      loadConversationMessages(
                        conversationId,
                        user.id,
                        token,
                        (
                          historyError,
                          history
                        ) => {

                          if (
                            historyError
                          ) {
                            console.error(
                              historyError
                            );

                            history =
                              [];
                          }

                          askGeminiStream(
                            latestMessage,
                            res,
                            true,
                            history
                          );
                        }
                      );
                    }
                  );
                }


                return sendJSON(
                  res,
                  400,
                  {
                    success:
                      false,

                    error:
                      "اكتب رسالة أولاً"
                  }
                );
              }
            );
          }
        );
      }


      /* =====================
         CREATE PROJECT
      ===================== */

      if (
        req.method ===
          "POST" &&
        req.url ===
          "/api/create"
      ) {
        return requireAuth(
          req,
          res,
          (
            user,
            token
          ) => {

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
                      success:
                        false,

                      error:
                        "بيانات غير صحيحة"
                    }
                  );
                }


                const idea =
                  String(
                    data.idea ||
                    data.message ||
                    ""
                  ).trim();


                const type =
                  String(
                    data.type ||
                    "Web"
                  ).trim();


                if (!idea) {
                  return sendJSON(
                    res,
                    400,
                    {
                      success:
                        false,

                      error:
                        "أدخل فكرة المشروع"
                    }
                  );
                }


                return sendJSON(
                  res,
                  200,
                  {
                    success:
                      true,

                    message:
                      "تم استلام المشروع",

                    idea,

                    type,

                    user_id:
                      user.id
                  }
                );
              }
            );
          }
        );
      }


      /* =====================
         NOT FOUND
      ===================== */

      return sendJSON(
        res,
        404,
        {
          success:
            false,

          error:
            "Not Found"
        }
      );
    }
  );


/* =========================================================
   START SERVER
========================================================= */

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
