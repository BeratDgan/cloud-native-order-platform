const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const { createOrderServiceApp } = require("../src/app");

function userResponse(url) {
  const id = String(url).split("/").at(-1);
  return Promise.resolve(new Response(JSON.stringify({
    id,
    name: `Demo User ${id}`,
    email: `user${id}@example.com`,
    servedBy: "user-service"
  }), { status: 200, headers: { "content-type": "application/json" } }));
}

async function startApp(options = {}) {
  const server = createOrderServiceApp({ fetchImpl: userResponse, ...options }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

test("preserves the demo order response used by Istio traffic tests", async (t) => {
  const app = await startApp({ appVersion: "v2" });
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/orders/42`);
  const order = await response.json();

  assert.equal(response.status, 200);
  assert.equal(order.id, "42");
  assert.equal(order.product, "Canary Coffee");
  assert.equal(order.version, "v2");
  assert.equal(order.user.id, "2");
  assert.equal(order.persisted, false);
});

test("creates and lists an in-memory order", async (t) => {
  const app = await startApp();
  t.after(app.close);

  const createdResponse = await fetch(`${app.baseUrl}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: 3, product: "Filter Coffee", quantity: 2 })
  });
  const created = await createdResponse.json();
  const listResponse = await fetch(`${app.baseUrl}/orders`);
  const list = await listResponse.json();

  assert.equal(createdResponse.status, 201);
  assert.equal(created.id, "1000");
  assert.equal(created.persisted, true);
  assert.equal(list.count, 1);
  assert.deepEqual(list.items[0], created);
});

test("returns validation details for an invalid order", async (t) => {
  const app = await startApp();
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "x", product: "", quantity: 0 })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "INVALID_ORDER");
  assert.equal(body.details.length, 3);
});

test("maps an unavailable user-service to HTTP 502", async (t) => {
  const app = await startApp({ fetchImpl: async () => { throw new Error("connection refused"); } });
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/orders/8`);
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.error, "USER_SERVICE_UNAVAILABLE");
  assert.ok(body.requestId);
});

test("reports readiness and Prometheus metrics", async (t) => {
  const app = await startApp();
  t.after(app.close);

  const readiness = await fetch(`${app.baseUrl}/readyz`);
  await fetch(`${app.baseUrl}/healthz`);
  const metrics = await fetch(`${app.baseUrl}/metrics`);
  const body = await metrics.text();

  assert.equal(readiness.status, 200);
  assert.match(body, /http_requests_total/);
  assert.match(body, /route="\/healthz"/);
});
