const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  res.writeHead(200);

  res.end(JSON.stringify({
    success: true,
    aizen: "TEST-12345",
    url: req.url,
    message: "THIS IS AIZEN BACKEND"
  }));
});

server.listen(PORT, () => {
  console.log("AIZEN TEST SERVER running on port " + PORT);
});
