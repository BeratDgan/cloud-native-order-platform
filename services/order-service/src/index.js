const { createOrderServiceApp } = require("./app");
const { createOrderRepository } = require("./database");
const { createJsonLogger } = require("./logger");

const port = Number(process.env.PORT || 8080);
const appVersion = process.env.APP_VERSION || "v1";
const userServiceUrl = process.env.USER_SERVICE_URL || "http://user-service:8080";
const logger = createJsonLogger("order-service");

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function start() {
  const repository = createOrderRepository({ logger });
  try {
    await repository.initialize?.();
  } catch (error) {
    await repository.close?.();
    throw error;
  }

  const app = createOrderServiceApp({ appVersion, userServiceUrl, repository, logger });
  const server = app.listen(port, "0.0.0.0", () => {
    logger.info("server.started", { port, version: appVersion, storage: repository.kind });
  });
  let stopping = false;

  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    logger.info("server.stopping", { signal, version: appVersion });

    try {
      await closeServer(server);
      await repository.close?.();
      logger.info("server.stopped", { signal, version: appVersion });
    } catch (error) {
      logger.error("server.stop_failed", { message: error.message, version: appVersion });
      process.exitCode = 1;
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((error) => {
  logger.error("server.start_failed", { message: error.message, version: appVersion });
  process.exitCode = 1;
});
