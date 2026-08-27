const { randomUUID } = require("node:crypto");
const express = require("express");
const { silentLogger } = require("./logger");
const { CONTENT_TYPE, HttpMetrics, metricsMiddleware } = require("./metrics");

function isPositiveInteger(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function createUserServiceApp({ logger = silentLogger } = {}) {
  const app = express();
  const metrics = new HttpMetrics("user-service");

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const startedAt = process.hrtime.bigint();
    const requestId = request.get("x-request-id") || randomUUID();
    request.requestId = requestId;
    response.set("x-request-id", requestId);
    response.once("finish", () => {
      logger.info("http.request_completed", {
        requestId,
        method: request.method,
        path: request.originalUrl,
        status: response.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6
      });
    });
    next();
  });
  app.use(metricsMiddleware(metrics));

  app.get("/healthz", (_request, response) => {
    response.json({ status: "ok", service: "user-service" });
  });

  app.get("/readyz", (_request, response) => {
    response.json({ status: "ready", service: "user-service" });
  });

  app.get("/metrics", (_request, response) => {
    response.type(CONTENT_TYPE).send(metrics.render());
  });

  app.get("/users/:id", (request, response) => {
    const { id } = request.params;
    if (!isPositiveInteger(id)) {
      return response.status(400).json({
        error: "INVALID_USER_ID",
        message: "Kullanıcı kimliği pozitif bir tam sayı olmalıdır.",
        requestId: request.requestId
      });
    }

    return response.json({
      id,
      name: `Demo User ${id}`,
      email: `user${id}@example.com`,
      servedBy: "user-service"
    });
  });

  app.use((request, response) => {
    response.status(404).json({
      error: "NOT_FOUND",
      message: "İstenen kaynak bulunamadı.",
      requestId: request.requestId
    });
  });

  return app;
}

module.exports = { createUserServiceApp };
