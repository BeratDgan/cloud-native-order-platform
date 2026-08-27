const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const test = require("node:test");
const { createWebServer } = require("../src/server");

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("serves the application and its health endpoint", async (t) => {
  const server = createWebServer();
  const baseUrl = await listen(server);
  t.after(() => close(server));

  const page = await fetch(baseUrl);
  const health = await fetch(`${baseUrl}/healthz`);

  assert.equal(page.status, 200);
  assert.match(await page.text(), /Sipariş Masası/);
  assert.deepEqual(await health.json(), { status: "ok", service: "web-app" });
});

test("proxies API requests to order-service", async (t) => {
  const upstream = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json", "x-request-id": "test-request" });
    response.end(JSON.stringify({ items: [], count: 0, version: "v1" }));
  });
  const upstreamUrl = await listen(upstream);
  t.after(() => close(upstream));

  const server = createWebServer({ orderServiceUrl: upstreamUrl });
  const baseUrl = await listen(server);
  t.after(() => close(server));

  const response = await fetch(`${baseUrl}/api/orders`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "test-request");
  assert.deepEqual(await response.json(), { items: [], count: 0, version: "v1" });
});
