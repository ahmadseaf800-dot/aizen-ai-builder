const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL = "gemini-3.6-flash";


/* =========================
   JSON RESPONSE
========================= */

function sendJSON(res, status, data) {

  res.writeHead(status, {

    "Content-Type":
      "application/json; charset=utf-8",

    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET,POST,OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type"

  });

  res.end(
    JSON.stringify(data)
  );
}


/* =========================
   CORS
========================= */

function handleCORS(req, res) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {

    res.writeHead(204);

    res.end();

    return true;
  }

  return false;
}


/* =========================
   READ BODY
========================= */

function readBody(req, callback) {

  let body = "";

  req.on(
    "data",
    chunk => {
      body += chunk;
    }
  );

  req.on(
    "end",
    () => {

      try {

        callback(
          null,
          JSON.parse(
            body || "{}"
          )
        );

      } catch (error) {

        callback(
          error,
          null
        );

      }

    }
  );

}


/* =========================
   GEMINI
========================= */

function askGemini(
  message,
  res
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


  const requestData =
    JSON.stringify({

      model:
        MODEL,

      input:
        message,

      system_instruction:
        "أنت Aizen AI، مساعد ذكي داخل منصة Aizen AI Builder. " +
        "أجب بالعربية بشكل واضح ومباشر. " +
        "ساعد المستخدم في البرمجة وبناء المواقع والتطبيقات والبوتات. " +
        "إذا طلب المستخدم بناء مشروع، ساعده في التخطيط والكود."

    });


  const options = {

    hostname:
      "generativelanguage.googleapis.com",

    path:
      "/v1beta/interactions",

    method:
      "POST",

    headers: {

      "Content-Type":
        "application/json",

      "x-goog-api-key":
        GEMINI_API_KEY,

      "Content-Length":
        Buffer.byteLength(
          requestData
        )

    },

    timeout:
      60000

  };


  console.log(
    "Sending request to Gemini..."
  );

  console.log(
    "Model:",
    MODEL
  );


  const request =
    https.request(
      options,
      response => {

        let body = "";


        response.on(
          "data",
          chunk => {

            body +=
              chunk.toString(
                "utf8"
              );

          }
        );


        response.on(
          "end",
          () => {

            console.log(
              "Gemini status:",
              response.statusCode
            );

            console.log(
              "Gemini response:",
              body
            );


            if (
              response.statusCode <
                200 ||
              response.statusCode >=
                300
            ) {

              let errorMessage =
                "حدث خطأ من Gemini";


              try {

                const result =
                  JSON.parse(
                    body
                  );


                errorMessage =
                  result?.error?.message ||
                  errorMessage;

              } catch {}


              return sendJSON(
                res,
                response.statusCode,
                {
                  success: false,
                  error:
                    errorMessage
                }
              );

            }


            try {

              const result =
                JSON.parse(
                  body
                );


              let text = "";


              /* =====================
                 CURRENT FORMAT
              ===================== */

              if (
                Array.isArray(
                  result.steps
                )
              ) {

                for (
                  const step
                  of result.steps
                ) {

                  if (
                    step.type !==
                    "model_output"
                  ) {
                    continue;
                  }


                  if (
                    !Array.isArray(
                      step.content
                    )
                  ) {
                    continue;
                  }


                  for (
                    const content
                    of step.content
                  ) {

                    if (
                      content.type ===
                        "text" &&
                      content.text
                    ) {

                      text +=
                        content.text;

                    }

                  }

                }

              }


              /* =====================
                 FALLBACK
              ===================== */

              if (
                !text &&
                Array.isArray(
                  result.output
                )
              ) {

                for (
                  const item
                  of result.output
                ) {

                  if (
                    item?.text
                  ) {

                    text +=
                      item.text;

                  }

                }

              }


              if (
                !text &&
                typeof result.output ===
                  "string"
              ) {

                text =
                  result.output;

              }


              if (
                !text &&
                result.text
              ) {

                text =
                  result.text;

              }


              if (!text) {

                text =
                  "وصل رد من Gemini لكن لم أستطع استخراج النص.";

              }


              sendJSON(
                res,
                200,
                {
                  success: true,
                  text: text
                }
              );


            } catch (error) {

              console.error(
                "JSON parse error:",
                error
              );


              sendJSON(
                res,
                500,
                {
                  success: false,
                  error:
                    "تعذر قراءة رد Gemini"
                }
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


      if (
        !res.writableEnded
      ) {

        sendJSON(
          res,
          504,
          {
            success: false,
            error:
              "انتهت مهلة الاتصال بـ Gemini"
          }
        );

      }

    }
  );


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
            success: false,
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


/* =========================
   SERVER
========================= */

const server =
  http.createServer(
    (req, res) => {


      /* CORS */

      if (
        handleCORS(
          req,
          res
        )
      ) {
        return;
      }


      /* =====================
         HOME
      ===================== */

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
                  "text/html; charset=utf-8",

                "Access-Control-Allow-Origin":
                  "*"
              }
            );


            res.end(
              data
            );

          }
        );


        return;

      }


      /* =====================
         HEALTH
      ===================== */

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
              MODEL
          }
        );

      }


      /* =====================
         CHAT
      ===================== */

      if (
        req.method === "POST" &&
        req.url === "/api/chat"
      ) {

        return readBody(
          req,
          (error, data) => {

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


            askGemini(
              message,
              res
            );

          }
        );

      }


      /* =====================
         CREATE
      ===================== */

      if (
        req.method === "POST" &&
        req.url === "/api/create"
      ) {

        return readBody(
          req,
          (error, data) => {

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


            sendJSON(
              res,
              200,
              {
                success: true,
                message:
                  "تم استلام المشروع",
                idea:
                  data.idea || "",
                type:
                  data.type || ""
              }
            );

          }
        );

      }


      /* =====================
         404
      ===================== */

      sendJSON(
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
