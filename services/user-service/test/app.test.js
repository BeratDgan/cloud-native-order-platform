const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const { createUserServiceApp } = require("../src/app");

async function startApp() {
  const server = createUserServiceApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

test("health and readiness endpoints report service state", async (t) => {
  const app = await startApp();
  t.after(app.close);

  const health = await fetch(`${app.baseUrl}/healthz`);
  const readiness = await fetch(`${app.baseUrl}/readyz`);

  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", service: "user-service" });
  assert.equal(readiness.status, 200);
});

test("returns a deterministic demo user", async (t) => {
  const app = await startApp();
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/users/7`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: "7",
    name: "Demo User 7",
    email: "user7@example.com",
    servedBy: "user-service"
  });
});

test("rejects an invalid user id with a useful error", async (t) => {
  const app = await startApp();
  t.after(app.close);

  const response = await fetch(`${app.baseUrl}/users/not-a-number`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "INVALID_USER_ID");
  assert.ok(body.requestId);
});

test("exposes Prometheus compatible metrics", async (t) => {
  const app = await startApp();
  t.after(app.close);

  await fetch(`${app.baseUrl}/healthz`);
  const response = await fetch(`${app.baseUrl}/metrics`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  assert.match(body, /http_requests_total/);
  assert.match(body, /route="\/healthz"/);
});
