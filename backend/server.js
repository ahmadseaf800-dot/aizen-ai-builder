const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.url === "/" || req.url === "/api/health") {
    res.writeHead(200);
    return res.end(JSON.stringify({
      success: true,
      name: "Aizen AI Builder",
      status: "healthy"
    }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({
    success: false,
    error: "Not Found"
  }));
});

server.listen(PORT, () => {
  console.log(`Aizen Backend running on port ${PORT}`);
});
