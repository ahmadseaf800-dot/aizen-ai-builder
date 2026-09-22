const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL = "gemini-3.8-flash";

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

function readBody(req, callback) {
  let body = "";

  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      callback(null, JSON.parse(body || "{}"));
    } catch (error) {
      callback(error, null);
    }
  });
}

function askGemini(message, res) {
  if (!GEMINI_API_KEY) {
    return sendJSON(res, 500, {
      success: false,
      error: "GEMINI_API_KEY غير موجود في Render"
    });
  }

  const requestData = JSON.stringify({
    model: MODEL,

    input: message,

    system_instruction:
      "أنت Aizen AI، مساعد ذكي داخل منصة Aizen AI Builder. " +
      "أجب بالعربية بشكل واضح ومباشر. " +
      "ساعد المستخدم في البرمجة وبناء المواقع والتطبيقات والبوتات. " +
      "إذا طلب المستخدم بناء مشروع، ساعده في التخطيط والكود.",

    generation_config: {
      max_output_tokens: 1024
    }
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",

    path: "/v1beta/interactions",

    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
      "Content-Length": Buffer.byteLength(requestData)
    },

    timeout: 60000
  };

  const request = https.request(options, response => {
    let body = "";

    response.on("data", chunk => {
      body += chunk.toString("utf8");
    });

    response.on("end", () => {
      console.log("Gemini status:", response.statusCode);
      console.log("Gemini response:", body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        let errorMessage = "حدث خطأ من Gemini";

        try {
          const result = JSON.parse(body);

          errorMessage =
            result?.error?.message ||
            result?.errors?.[0]?.message ||
            errorMessage;
        } catch {}

        return sendJSON(res, response.statusCode, {
          success: false,
          error: errorMessage
        });
      }

      try {
        const result = JSON.parse(body);

        let text = "";

        if (result.output) {
          if (typeof result.output === "string") {
            text = result.output;
          }

          if (Array.isArray(result.output)) {
            for (const item of result.output) {
              if (item?.type === "text" && item?.text) {
                text += item.text;
              }

              if (item?.content) {
                if (typeof item.content === "string") {
                  text += item.content;
                }

                if (Array.isArray(item.content)) {
                  for (const content of item.content) {
                    if (content?.text) {
                      text += content.text;
                    }
                  }
                }
              }
            }
          }
        }

        if (!text && result.response) {
          if (typeof result.response === "string") {
            text = result.response;
          }

          if (Array.isArray(result.response)) {
            for (const item of result.response) {
              if (item?.text) {
                text += item.text;
              }

              if (item?.content) {
                if (typeof item.content === "string") {
                  text += item.content;
                }

                if (Array.isArray(item.content)) {
                  for (const content of item.content) {
                    if (content?.text) {
                      text += content.text;
                    }
                  }
                }
              }
            }
          }
        }

        if (!text && result.text) {
          text = result.text;
        }

        if (!text) {
          text = "وصل رد من Gemini لكن لم أستطع استخراج النص.";
        }

        return sendJSON(res, 200, {
          success: true,
          text: text
        });

      } catch (error) {
        console.error("Parse error:", error);

        return sendJSON(res, 500, {
          success: false,
          error: "تعذر قراءة رد Gemini"
        });
      }
    });
  });

  request.on("timeout", () => {
    request.destroy();

    sendJSON(res, 504, {
      success: false,
      error: "انتهت مهلة الاتصال بـ Gemini"
    });
  });

  request.on("error", error => {
    console.error("Gemini request error:", error);

    if (!res.writableEnded) {
      sendJSON(res, 500, {
        success: false,
        error: "تعذر الاتصال بـ Gemini"
      });
    }
  });

  request.write(requestData);
  request.end();
}

const server = http.createServer((req, res) => {

  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(
      __dirname,
      "../frontend/index.html"
    );

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        return sendJSON(res, 500, {
          success: false,
          error: "Frontend Error"
        });
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      res.end(data);
    });

    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    return sendJSON(res, 200, {
      success: true,
      name: "Aizen AI Builder",
      status: "healthy",
      model: MODEL
    });
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    return readBody(req, (error, data) => {

      if (error) {
        return sendJSON(res, 400, {
          success: false,
          error: "بيانات غير صحيحة"
        });
      }

      const message = String(
        data.message || ""
      ).trim();

      if (!message) {
        return sendJSON(res, 400, {
          success: false,
          error: "اكتب رسالة أولاً"
        });
      }

      askGemini(message, res);
    });
  }

  if (req.method === "POST" && req.url === "/api/create") {
    return readBody(req, (error, data) => {

      if (error) {
        return sendJSON(res, 400, {
          success: false,
          error: "بيانات غير صحيحة"
        });
      }

      sendJSON(res, 200, {
        success: true,
        message: "تم استلام المشروع",
        idea: data.idea || "",
        type: data.type || ""
      });
    });
  }

  sendJSON(res, 404, {
    success: false,
    error: "Not Found"
  });
});

server.listen(PORT, () => {
  console.log(
    "Aizen Backend running on port " + PORT
  );

  console.log(
    "Gemini model: " + MODEL
  );
});
