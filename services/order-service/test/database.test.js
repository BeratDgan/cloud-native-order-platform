const assert = require("node:assert/strict");
const test = require("node:test");
const { createOrderRepository, postgresConfigFromEnvironment } = require("../src/database");

const databaseEnvironment = {
  DATABASE_HOST: "postgresql",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "orders",
  DATABASE_USER: "app_user",
  DATABASE_PASSWORD: "test-password"
};

test("uses the in-memory repository when database configuration is absent", () => {
  const repository = createOrderRepository({ environment: {} });
  assert.equal(repository.kind, "memory");
});

test("validates partial database configuration", () => {
  assert.throws(
    () => postgresConfigFromEnvironment({ DATABASE_HOST: "postgresql" }),
    /Missing database environment variables/
  );
});

test("creates a PostgreSQL repository with bounded pool settings", async () => {
  let receivedConfig;
  class FakePool {
    constructor(config) {
      receivedConfig = config;
    }

    async end() {}
  }

  const repository = createOrderRepository({
    environment: databaseEnvironment,
    PoolClass: FakePool
  });

  assert.equal(repository.kind, "postgres");
  assert.equal(receivedConfig.host, "postgresql");
  assert.equal(receivedConfig.port, 5432);
  assert.equal(receivedConfig.max, 5);
  assert.equal(receivedConfig.password, "test-password");
  await repository.close();
});
