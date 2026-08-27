const { createOrderServiceApp } = require("./app");
const { createJsonLogger } = require("./logger");

const port = Number(process.env.PORT || 8080);
const appVersion = process.env.APP_VERSION || "v1";
const userServiceUrl = process.env.USER_SERVICE_URL || "http://user-service:8080";
const logger = createJsonLogger("order-service");
const app = createOrderServiceApp({ appVersion, userServiceUrl, logger });

const server = app.listen(port, "0.0.0.0", () => {
  logger.info("server.started", { port, version: appVersion });
});

function shutdown(signal) {
  logger.info("server.stopping", { signal, version: appVersion });
  server.close((error) => {
    if (error) {
      logger.error("server.stop_failed", { message: error.message });
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
