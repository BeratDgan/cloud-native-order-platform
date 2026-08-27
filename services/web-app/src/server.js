const http = require("node:http");
const path = require("node:path");
const { readFile, stat } = require("node:fs/promises");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf"
};

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function setSecurityHeaders(response) {
  response.setHeader("content-security-policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
}

async function proxyApi(request, response, targetBaseUrl, pathname) {
  try {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const target = new URL(pathname.replace(/^\/api/, "") || "/", targetBaseUrl);
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        accept: request.headers.accept || "application/json",
        ...(request.headers["content-type"] ? { "content-type": request.headers["content-type"] } : {}),
        ...(request.headers["x-request-id"] ? { "x-request-id": request.headers["x-request-id"] } : {})
      },
      body,
      signal: AbortSignal.timeout(5000)
    });

    response.statusCode = upstream.status;
    response.setHeader("content-type", upstream.headers.get("content-type") || "application/octet-stream");
    const requestId = upstream.headers.get("x-request-id");
    if (requestId) response.setHeader("x-request-id", requestId);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    sendJson(response, error.message === "REQUEST_TOO_LARGE" ? 413 : 502, {
      error: error.message === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "ORDER_SERVICE_UNAVAILABLE",
      message: error.message === "REQUEST_TOO_LARGE"
        ? "İstek gövdesi çok büyük."
        : "Web uygulaması order-service'e ulaşamadı."
    });
  }
}

async function serveStatic(response, publicDir, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "INVALID_PATH", message: "Geçersiz adres." });
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relativePath);
  const publicRoot = path.resolve(publicDir);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) {
    sendJson(response, 403, { error: "FORBIDDEN", message: "Bu dosyaya erişilemez." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("NOT_A_FILE");
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "NOT_FOUND", message: "İstenen sayfa bulunamadı." });
  }
}

function createWebServer({
  orderServiceUrl = process.env.ORDER_SERVICE_URL || "http://127.0.0.1:8080",
  publicDir = path.join(__dirname, "..", "public")
} = {}) {
  return http.createServer(async (request, response) => {
    setSecurityHeaders(response);
    const url = new URL(request.url, "http://web-app.local");

    if (url.pathname === "/healthz") {
      sendJson(response, 200, { status: "ok", service: "web-app" });
      return;
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      await proxyApi(request, response, orderServiceUrl, `${url.pathname}${url.search}`);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "METHOD_NOT_ALLOWED", message: "Bu yöntem desteklenmiyor." });
      return;
    }

    await serveStatic(response, publicDir, url.pathname);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createWebServer().listen(port, "0.0.0.0", () => {
    process.stdout.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "web-app",
      event: "server.started",
      port
    })}\n`);
  });
}

module.exports = { createWebServer };
