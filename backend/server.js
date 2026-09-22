const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

function askAI(message, callback) {

  if (!GEMINI_API_KEY) {
    return callback(
      new Error("GEMINI_API_KEY غير موجود في Render")
    );
  }

  const requestData = JSON.stringify({
    system_instruction: {
      parts: [
        {
          text:
            "أنت Aizen AI، مساعد ذكي داخل منصة Aizen AI Builder. أجب بالعربية بشكل واضح ومفيد. ساعد المستخدم في البرمجة وبناء المواقع والتطبيقات والبوتات. إذا طلب المستخدم مشروعاً، ساعده في التخطيط والكود."
        }
      ]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: message
          }
        ]
      }
    ]
  });

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path:
      "/v1beta/models/gemini-3.6-flash:generateContent?key=" +
      encodeURIComponent(GEMINI_API_KEY),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestData)
    }
  };

  const request = https.request(options, response => {

    let data = "";

    response.on("data", chunk => {
      data += chunk;
    });

    response.on("end", () => {

      try {

        const result = JSON.parse(data);

        if (
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          return callback(
            new Error(
              result?.error?.message ||
              "حدث خطأ من Gemini"
            )
          );
        }

        const reply =
          result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
          return callback(
            new Error("Gemini لم يرجع أي رد")
          );
        }

        callback(null, reply);

      } catch (error) {

        callback(
          new Error("استجابة غير صحيحة من Gemini")
        );

      }

    });

  });

  request.on("error", error => {
    callback(error);
  });

  request.write(requestData);
  request.end();
}


const server = http.createServer((req, res) => {

  if (req.method === "GET" && req.url === "/") {

    const filePath =
      path.join(__dirname, "../frontend/index.html");

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
      status: "healthy"
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

      const message =
        String(data.message || "").trim();

      if (!message) {
        return sendJSON(res, 400, {
          success: false,
          error: "اكتب رسالة أولاً"
        });
      }

      askAI(message, (aiError, reply) => {

        if (aiError) {

          console.error(aiError);

          return sendJSON(res, 500, {
            success: false,
            error: aiError.message
          });

        }

        sendJSON(res, 200, {
          success: true,
          reply: reply
        });

      });

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
});
