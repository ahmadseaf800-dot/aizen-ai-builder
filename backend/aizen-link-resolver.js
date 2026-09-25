const https = require("https");

function normalize(value) {
  return String(value || "").trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function directFromText(text) {
  const t = normalize(text);
  const urls = t.match(/https?:\/\/[^\s<>"'`]+/g) || [];
  return urls.map(url => url.replace(/[),.!؟]+$/g, ""));
}

function buildKnownUrl({ service, value }) {
  const v = normalize(value).replace(/^@/, "");
  if (!v) return null;
  const s = normalize(service).toLowerCase();
  if (s === "github") {
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)) return `https://github.com/${v}`;
    if (/^[A-Za-z0-9_.-]+$/.test(v)) return `https://github.com/${v}`;
  }
  if (s === "youtube") {
    if (/^UC[A-Za-z0-9_-]{10,}$/.test(v)) return `https://www.youtube.com/channel/${v}`;
    if (/^@?[A-Za-z0-9_.-]{2,}$/.test(v)) return `https://www.youtube.com/@${v}`;
  }
  if (s === "telegram") {
    if (/^[A-Za-z0-9_]{4,32}$/.test(v)) return `https://t.me/${v}`;
  }
  if (s === "discord") {
    if (/^[A-Za-z0-9_-]{2,100}$/.test(v)) return `https://discord.com/users/${v}`;
  }
  return null;
}

async function githubRepoExists(owner, repo) {
  return new Promise(resolve => {
    const req = https.request({ hostname: "api.github.com", path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, method: "GET", headers: { Accept: "application/vnd.github+json", "User-Agent": "Aizen-AI-Builder" } }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => body += c);
      res.on("end", () => resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, body }));
    });
    req.setTimeout(7000, () => { try { req.destroy(); } catch {} resolve({ ok: false, status: 0 }); });
    req.on("error", () => resolve({ ok: false, status: 0 }));
    req.end();
  });
}

async function resolveDirectLink({ service, value, text }) {
  const explicit = directFromText(text);
  if (explicit.length) return { found: true, url: explicit[0], verified: false, source: "user-text" };
  const url = buildKnownUrl({ service, value });
  if (!url) return { found: false, verified: false, url: null };
  if (String(service).toLowerCase() === "github" && url.includes("github.com/") && url.split("/").length >= 5) {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const check = await githubRepoExists(parts[0], parts[1]);
      if (!check.ok && check.status === 404) return { found: false, verified: false, url: null, reason: "GITHUB_NOT_FOUND" };
      return { found: true, url, verified: check.ok, source: "github-api" };
    }
  }
  return { found: true, url, verified: false, source: "known-pattern" };
}

module.exports = { directFromText, buildKnownUrl, resolveDirectLink };
