const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresOrderRepository } = require("../src/postgres-order-repository");

class FakePool {
  constructor(responses = []) {
    this.responses = [...responses];
    this.calls = [];
    this.closed = false;
  }

  async query(text, values) {
    this.calls.push({ text, values });
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response || { rows: [] };
  }

  async end() {
    this.closed = true;
  }
}

const storedRow = {
  id: "1000",
  product: "Filter Coffee",
  quantity: 2,
  status: "CREATED",
  user_data: { id: "3", name: "Demo User 3" },
  version: "v2",
  served_by: "order-service-v2",
  created_at: new Date("2026-09-02T10:00:00.000Z")
};

test("initializes the orders table and index idempotently", async () => {
  const pool = new FakePool();
  const repository = new PostgresOrderRepository(pool);

  await repository.initialize();

  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS orders/);
  assert.match(pool.calls[1].text, /CREATE INDEX IF NOT EXISTS orders_created_at_idx/);
});

test("creates and maps a persisted order", async () => {
  const pool = new FakePool([{ rows: [storedRow] }]);
  const repository = new PostgresOrderRepository(pool);
  const order = await repository.create({
    product: "Filter Coffee",
    quantity: 2,
    status: "CREATED",
    user: storedRow.user_data,
    version: "v2",
    servedBy: "order-service-v2",
    createdAt: "2026-09-02T10:00:00.000Z"
  });

  assert.equal(pool.calls[0].values.length, 7);
  assert.deepEqual(order, {
    id: "1000",
    product: "Filter Coffee",
    quantity: 2,
    status: "CREATED",
    user: storedRow.user_data,
    version: "v2",
    servedBy: "order-service-v2",
    createdAt: "2026-09-02T10:00:00.000Z",
    persisted: true
  });
});

test("finds and lists orders while preserving database order", async () => {
  const pool = new FakePool([
    { rows: [storedRow] },
    { rows: [storedRow, { ...storedRow, id: "999" }] }
  ]);
  const repository = new PostgresOrderRepository(pool);

  const found = await repository.findById("1000");
  const listed = await repository.list();

  assert.equal(found.id, "1000");
  assert.deepEqual(listed.map((order) => order.id), ["1000", "999"]);
});

test("returns null when an order does not exist", async () => {
  const repository = new PostgresOrderRepository(new FakePool([{ rows: [] }]));
  assert.equal(await repository.findById("404"), null);
});

test("reports a healthy database connection", async () => {
  const repository = new PostgresOrderRepository(new FakePool([{ rows: [{ result: 1 }] }]));
  assert.equal(await repository.isReady(), true);
});

test("reports readiness failures and closes the pool", async () => {
  const pool = new FakePool([new Error("connection refused")]);
  const repository = new PostgresOrderRepository(pool);

  assert.equal(await repository.isReady(), false);
  await repository.close();
  assert.equal(pool.closed, true);
});
