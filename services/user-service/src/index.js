const { createUserServiceApp } = require("./app");
const { createJsonLogger } = require("./logger");

const port = Number(process.env.PORT || 8080);
const logger = createJsonLogger("user-service");
const app = createUserServiceApp({ logger });

const server = app.listen(port, "0.0.0.0", () => {
  logger.info("server.started", { port });
});

function shutdown(signal) {
  logger.info("server.stopping", { signal });
  server.close((error) => {
    if (error) {
      logger.error("server.stop_failed", { message: error.message });
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
