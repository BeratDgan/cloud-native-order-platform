const { Pool } = require("pg");
const { InMemoryOrderRepository } = require("./order-repository");
const { PostgresOrderRepository } = require("./postgres-order-repository");

const REQUIRED_DATABASE_VARIABLES = [
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_NAME",
  "DATABASE_USER",
  "DATABASE_PASSWORD"
];

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function postgresConfigFromEnvironment(environment = process.env) {
  const databaseConfigured = REQUIRED_DATABASE_VARIABLES.some((name) => environment[name]);
  if (!databaseConfigured) return null;

  const missing = REQUIRED_DATABASE_VARIABLES.filter((name) => !environment[name]);
  if (missing.length > 0) {
    throw new Error(`Missing database environment variables: ${missing.join(", ")}`);
  }

  return {
    host: environment.DATABASE_HOST,
    port: positiveInteger(environment.DATABASE_PORT, 5432, "DATABASE_PORT"),
    database: environment.DATABASE_NAME,
    user: environment.DATABASE_USER,
    password: environment.DATABASE_PASSWORD,
    max: positiveInteger(environment.DATABASE_POOL_MAX, 5, "DATABASE_POOL_MAX"),
    connectionTimeoutMillis: positiveInteger(
      environment.DATABASE_CONNECTION_TIMEOUT_MS,
      3000,
      "DATABASE_CONNECTION_TIMEOUT_MS"
    ),
    idleTimeoutMillis: positiveInteger(
      environment.DATABASE_IDLE_TIMEOUT_MS,
      30000,
      "DATABASE_IDLE_TIMEOUT_MS"
    ),
    keepAlive: true
  };
}

function createOrderRepository({ environment = process.env, logger, PoolClass = Pool } = {}) {
  const config = postgresConfigFromEnvironment(environment);
  if (!config) return new InMemoryOrderRepository();

  const pool = new PoolClass(config);
  if (logger && typeof pool.on === "function") {
    pool.on("error", (error) => {
      logger.error("database.pool_error", { message: error.message });
    });
  }
  return new PostgresOrderRepository(pool);
}

module.exports = { createOrderRepository, postgresConfigFromEnvironment };
