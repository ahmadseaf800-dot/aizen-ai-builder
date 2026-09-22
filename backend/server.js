const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL = "gemini-3.8-flash";

function sendJSON(res, status, data) {
  if (!res.headersSent) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8"
    });
  }

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


/* =========================
   GEMINI STREAMING
========================= */

function streamAI(message, res) {

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

    stream: true,

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
      "Accept": "text/event-stream",
      "x-goog-api-key": GEMINI_API_KEY,
      "Content-Length": Buffer.byteLength(requestData)
    },

    timeout: 60000
  };


  const request = https.request(options, response => {

    let rawData = "";

    if (
      response.statusCode < 200 ||
      response.statusCode >= 300
    ) {

      response.on("data", chunk => {
        rawData += chunk.toString();
      });

      response.on("end", () => {

        let errorMessage = "حدث خطأ من Gemini";

        try {

          const result =
            JSON.parse(rawData);

          errorMessage =
            result?.error?.message ||
            result?.errors?.[0]?.message ||
            errorMessage;

        } catch {}

        console.error(
          "Gemini HTTP Error:",
          response.statusCode,
          rawData
        );

        sendJSON(res, response.statusCode, {
          success: false,
          error: errorMessage
        });

      });

      return;
    }


    /*
      Streaming response
    */

    res.writeHead(200, {
      "Content-Type":
        "text/event-stream; charset=utf-8",

      "Cache-Control":
        "no-cache, no-transform",

      "Connection":
        "keep-alive",

      "X-Accel-Buffering":
        "no"
    });

    res.flushHeaders();


    let buffer = "";


    response.on("data", chunk => {

      buffer +=
        chunk.toString("utf8");


      /*
        توحيد CRLF و LF
      */

      buffer =
        buffer.replace(/\r\n/g, "\n");


      /*
        SSE events تفصل بينها سطرين
      */

      const events =
        buffer.split("\n\n");


      buffer =
        events.pop() || "";


      for (const eventBlock of events) {

        const lines =
          eventBlock.split("\n");


        let jsonText = "";


        for (const line of lines) {

          if (
            line.startsWith("data:")
          ) {

            const value =
              line
                .substring(5)
                .trim();

            if (value) {
              jsonText += value;
            }

          }

        }


        if (!jsonText) {
          continue;
        }


        /*
          نهاية Streaming
        */

        if (jsonText === "[DONE]") {

          res.write(
            "data: " +
            JSON.stringify({
              type: "done"
            }) +
            "\n\n"
          );

          continue;
        }


        try {

          const event =
            JSON.parse(jsonText);


          /*
            Google:
            event_type = step.delta
            delta.type = text
          */

          if (
            event.event_type ===
              "step.delta" &&
            event.delta &&
            event.delta.type ===
              "text" &&
            event.delta.text
          ) {

            res.write(
              "data: " +
              JSON.stringify({
                type: "text",
                text: event.delta.text
              }) +
              "\n\n"
            );

          }


          /*
            اكتمل الرد
          */

          if (
            event.event_type ===
              "interaction.completed"
          ) {

            res.write(
              "data: " +
              JSON.stringify({
                type: "done"
              }) +
              "\n\n"
            );

          }


          /*
            خطأ من Gemini
          */

          if (
            event.event_type ===
              "error"
          ) {

            res.write(
              "data: " +
              JSON.stringify({
                type: "error",
                error:
                  event?.error?.message ||
                  "حدث خطأ أثناء التوليد"
              }) +
              "\n\n"
            );

          }

        } catch (error) {

          console.log(
            "SSE JSON parse skipped:",
            jsonText
          );

        }

      }

    });


    response.on("end", () => {

      /*
        محاولة معالجة آخر event
      */

      if (buffer.trim()) {

        const lines =
          buffer
            .replace(/\r\n/g, "\n")
            .split("\n");

        let jsonText = "";

        for (const line of lines) {

          if (line.startsWith("data:")) {

            const value =
              line
                .substring(5)
                .trim();

            if (value) {
              jsonText += value;
            }

          }

        }

        if (jsonText) {

          try {

            const event =
              JSON.parse(jsonText);

            if (
              event.event_type ===
                "step.delta" &&
              event.delta?.type ===
                "text" &&
              event.delta.text
            ) {

              res.write(
                "data: " +
                JSON.stringify({
                  type: "text",
                  text: event.delta.text
                }) +
                "\n\n"
              );

            }

          } catch {}

        }

      }


      if (!res.writableEnded) {

        res.write(
          "data: " +
          JSON.stringify({
            type: "done"
          }) +
          "\n\n"
        );

        res.end();

      }

    });

  });


  request.on("timeout", () => {

    request.destroy();

    if (!res.headersSent) {

      return sendJSON(res, 504, {
        success: false,
        error: "انتهت مهلة الاتصال بـ Gemini"
      });

    }

    if (!res.writableEnded) {

      res.write(
        "data: " +
        JSON.stringify({
          type: "error",
          error: "انتهت مهلة الاتصال بـ Gemini"
        }) +
        "\n\n"
      );

      res.end();

    }

  });


  request.on("error", error => {

    console.error(
      "Gemini Request Error:",
      error
    );

    if (!res.headersSent) {

      return sendJSON(res, 500, {
        success: false,
        error: "تعذر الاتصال بـ Gemini"
      });

    }

    if (!res.writableEnded) {

      res.write(
        "data: " +
        JSON.stringify({
          type: "error",
          error: "تعذر الاتصال بـ Gemini"
        }) +
        "\n\n"
      );

      res.end();

    }

  });


  request.write(requestData);
  request.end();
}


/* =========================
   SERVER
========================= */

const server = http.createServer((req, res) => {


  /* الصفحة الرئيسية */

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
      (err, data) => {

        if (err) {

          return sendJSON(res, 500, {
            success: false,
            error: "Frontend Error"
          });

        }

        res.writeHead(200, {
          "Content-Type":
            "text/html; charset=utf-8"
        });

        res.end(data);

      }
    );

    return;
  }


  /* Health */

  if (
    req.method === "GET" &&
    req.url === "/api/health"
  ) {

    return sendJSON(res, 200, {
      success: true,
      name: "Aizen AI Builder",
      status: "healthy",
      model: MODEL
    });

  }


  /* AI Chat */

  if (
    req.method === "POST" &&
    req.url === "/api/chat"
  ) {

    return readBody(
      req,
      (error, data) => {

        if (error) {

          return sendJSON(res, 400, {
            success: false,
            error: "بيانات غير صحيحة"
          });

        }


        const message =
          String(
            data.message || ""
          ).trim();


        if (!message) {

          return sendJSON(res, 400, {
            success: false,
            error: "اكتب رسالة أولاً"
          });

        }


        streamAI(
          message,
          res
        );

      }
    );

  }


  /* إنشاء مشروع */

  if (
    req.method === "POST" &&
    req.url === "/api/create"
  ) {

    return readBody(
      req,
      (error, data) => {

        if (error) {

          return sendJSON(res, 400, {
            success: false,
            error: "بيانات غير صحيحة"
          });

        }


        sendJSON(res, 200, {

          success: true,

          message:
            "تم استلام المشروع",

          idea:
            data.idea || "",

          type:
            data.type || ""

        });

      }
    );

  }


  /* 404 */

  sendJSON(res, 404, {
    success: false,
    error: "Not Found"
  });

});


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

  }
);
