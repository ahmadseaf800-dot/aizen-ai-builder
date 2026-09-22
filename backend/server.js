const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL = "gemini-3.6-flash";

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJSON(res, status, data) {
  setCORS(res);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

function readBody(req, callback) {
  let body = "";

  req.on("data", chunk => {
    body += chunk.toString();
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

function askGeminiStream(message, res) {
  if (!GEMINI_API_KEY) {
    return sendJSON(res, 500, {
      success: false,
      error: "GEMINI_API_KEY غير موجود في Render"
    });
  }

  const requestData = JSON.stringify({
    model: MODEL,
    input: message,
    stream: true,
    system_instruction:
      "أنت Aizen AI، مساعد ذكي داخل منصة Aizen AI Builder. " +
      "أجب بالعربية بشكل واضح ومباشر. " +
      "ساعد المستخدم في البرمجة وبناء المواقع والتطبيقات والبوتات. " +
      "إذا طلب المستخدم بناء مشروع، اشرح الخطة والكود المطلوب بشكل عملي. " +
      "لا تطيل بدون حاجة."
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: "/v1beta/interactions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "x-goog-api-key": GEMINI_API_KEY,
      "Content-Length": Buffer.byteLength(requestData)
    },
    timeout: 120000
  };

  console.log("Streaming request to Gemini...");
  console.log("Model:", MODEL);

  const request = https.request(options, geminiRes => {
    if (geminiRes.statusCode < 200 || geminiRes.statusCode >= 300) {
      let errorBody = "";

      geminiRes.on("data", chunk => {
        errorBody += chunk.toString("utf8");
      });

      geminiRes.on("end", () => {
        console.error("Gemini error:", geminiRes.statusCode, errorBody);

        let errorMessage = "حدث خطأ من Gemini";

        try {
          const result = JSON.parse(errorBody);
          errorMessage =
            result?.error?.message ||
            result?.message ||
            errorMessage;
        } catch {}

        if (!res.writableEnded) {
          sendJSON(res, geminiRes.statusCode, {
            success: false,
            error: errorMessage
          });
        }
      });

      return;
    }

    setCORS(res);

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "X-Accel-Buffering": "no"
    });

    let buffer = "";

    geminiRes.on("data", chunk => {
      buffer += chunk.toString("utf8");

      const events = buffer.split("\n\n");

      buffer = events.pop() || "";

      for (const eventBlock of events) {
        processSSEEvent(eventBlock, res);
      }
    });

    geminiRes.on("end", () => {
      if (buffer.trim()) {
        processSSEEvent(buffer, res);
      }

      if (!res.writableEnded) {
        res.write(
          `event: done\ndata: ${JSON.stringify({
            success: true
          })}\n\n`
        );

        res.end();
      }

      console.log("Gemini stream finished.");
    });

    geminiRes.on("error", error => {
      console.error("Gemini stream error:", error);

      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            success: false,
            error: "انقطع الاتصال مع Gemini"
          })}\n\n`
        );

        res.end();
      }
    });
  });

  request.on("timeout", () => {
    request.destroy();

    if (!res.writableEnded) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          success: false,
          error: "انتهت مهلة الاتصال بـ Gemini"
        })}\n\n`
      );

      res.end();
    }
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

function processSSEEvent(eventBlock, res) {
  if (!eventBlock || res.writableEnded) return;

  const lines = eventBlock.split("\n");

  let eventType = "";
  let dataText = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataText += line.slice(5).trim();
    }
  }

  if (!dataText) return;

  try {
    const data = JSON.parse(dataText);

    if (eventType === "error" || data.event_type === "error") {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          success: false,
          error:
            data?.error?.message ||
            "حدث خطأ أثناء التوليد"
        })}\n\n`
      );
      return;
    }

    if (
      eventType === "step.delta" ||
      data.event_type === "step.delta"
    ) {
      const delta = data.delta;

      if (delta?.type === "text" && delta.text) {
        res.write(
          `event: text\ndata: ${JSON.stringify({
            text: delta.text
          })}\n\n`
        );
      }
    }

    if (
      eventType === "interaction.completed" ||
      data.event_type === "interaction.completed"
    ) {
      res.write(
        `event: complete\ndata: ${JSON.stringify({
          success: true
        })}\n\n`
      );
    }
  } catch (error) {
    console.error("SSE parse error:", error);
  }
}

const server = http.createServer((req, res) => {
  setCORS(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(__dirname, "../frontend/index.html");

    fs.readFile(filePath, "utf8", (error, data) => {
      if (error) {
        return sendJSON(res, 500, {
          success: false,
          error: "Frontend Error"
        });
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
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
      model: MODEL,
      streaming: true
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

      const message = String(data.message || "").trim();

      if (!message) {
        return sendJSON(res, 400, {
          success: false,
          error: "اكتب رسالة أولاً"
        });
      }

      askGeminiStream(message, res);
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
  console.log("Aizen Backend running on port " + PORT);
  console.log("Gemini model: " + MODEL);
  console.log("Streaming: enabled");
});
