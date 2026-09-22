const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {

  // عرض الواجهة
  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(__dirname, "../frontend/index.html");

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        res.writeHead(500, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        return res.end("Frontend Error");
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      res.end(data);
    });

    return;
  }

  // فحص السيرفر
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    });

    return res.end(JSON.stringify({
      success: true,
      name: "Aizen AI Builder",
      status: "healthy"
    }));
  }

  // إنشاء مشروع
  if (req.method === "POST" && req.url === "/api/create") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8"
        });

        res.end(JSON.stringify({
          success: true,
          message: "تم استلام المشروع",
          idea: data.idea,
          type: data.type
        }));

      } catch (error) {
        res.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8"
        });

        res.end(JSON.stringify({
          success: false,
          error: "بيانات غير صحيحة"
        }));
      }
    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify({
    success: false,
    error: "Not Found"
  }));
});

server.listen(PORT, () => {
  console.log(`Aizen Backend running on port ${PORT}`);
});
