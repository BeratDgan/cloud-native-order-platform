const { randomUUID } = require("node:crypto");
const express = require("express");
const { silentLogger } = require("./logger");
const { CONTENT_TYPE, HttpMetrics, metricsMiddleware } = require("./metrics");
const { InMemoryOrderRepository } = require("./order-repository");

class UpstreamServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = "UpstreamServiceError";
  }
}

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function validateOrder(body) {
  const errors = [];
  const userId = String(body?.userId || "").trim();
  const product = String(body?.product || "").trim();
  const quantity = Number(body?.quantity);

  if (!isPositiveInteger(userId)) errors.push("Kullanıcı kimliği pozitif bir tam sayı olmalıdır.");
  if (product.length < 2 || product.length > 80) errors.push("Ürün adı 2 ile 80 karakter arasında olmalıdır.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) errors.push("Adet 1 ile 20 arasında bir tam sayı olmalıdır.");

  return { errors, value: { userId, product, quantity } };
}

function createOrderServiceApp({
  appVersion = "v1",
  userServiceUrl = "http://user-service:8080",
  repository = new InMemoryOrderRepository(),
  fetchImpl = global.fetch,
  logger = silentLogger
} = {}) {
  const app = express();
  const metrics = new HttpMetrics("order-service");
  const storageKind = repository.kind || "unknown";

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
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
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
        version: appVersion
      });
    });
    next();
  });
  app.use(metricsMiddleware(metrics));

  async function fetchUser(userId, requestId) {
    try {
      const userResponse = await fetchImpl(`${userServiceUrl}/users/${userId}`, {
        headers: { "x-request-id": requestId },
        signal: AbortSignal.timeout(2000)
      });
      if (!userResponse.ok) {
        throw new Error(`user-service returned HTTP ${userResponse.status}`);
      }
      return await userResponse.json();
    } catch (error) {
      logger.error("user_service.request_failed", {
        requestId,
        userId,
        message: error.message,
        version: appVersion
      });
      throw new UpstreamServiceError(error.message);
    }
  }

  app.get("/healthz", (_request, response) => {
    response.json({ status: "ok", service: "order-service", version: appVersion });
  });

  app.get("/readyz", asyncRoute(async (_request, response) => {
    const ready = await repository.isReady();
    response.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "order-service",
      storage: storageKind,
      version: appVersion
    });
  }));

  app.get("/metrics", (_request, response) => {
    response.type(CONTENT_TYPE).send(metrics.render());
  });

  app.get("/orders", asyncRoute(async (_request, response) => {
    const orders = await repository.list();
    response.json({ items: orders, count: orders.length, storage: storageKind, version: appVersion });
  }));

  app.post("/orders", asyncRoute(async (request, response) => {
    const { errors, value } = validateOrder(request.body);
    if (errors.length > 0) {
      return response.status(400).json({
        error: "INVALID_ORDER",
        message: "Sipariş bilgileri geçerli değil.",
        details: errors,
        requestId: request.requestId
      });
    }

    const user = await fetchUser(value.userId, request.requestId);
    const order = await repository.create({
      product: value.product,
      quantity: value.quantity,
      status: "CREATED",
      user,
      version: appVersion,
      servedBy: `order-service-${appVersion}`,
      createdAt: new Date().toISOString(),
      persisted: true
    });

    logger.info("order.created", { requestId: request.requestId, orderId: order.id, userId: value.userId, version: appVersion });
    return response.status(201).location(`/orders/${order.id}`).json(order);
  }));

  app.get("/orders/:id", asyncRoute(async (request, response) => {
    const { id } = request.params;
    if (!isPositiveInteger(id)) {
      return response.status(400).json({
        error: "INVALID_ORDER_ID",
        message: "Sipariş kimliği pozitif bir tam sayı olmalıdır.",
        requestId: request.requestId
      });
    }

    const storedOrder = await repository.findById(id);
    if (storedOrder) return response.json(storedOrder);

    const userId = String(Number(id) % 10 || 10);
    const user = await fetchUser(userId, request.requestId);
    return response.json({
      id,
      product: appVersion === "v2" ? "Canary Coffee" : "Demo Coffee",
      quantity: 1,
      status: "CREATED",
      user,
      version: appVersion,
      servedBy: `order-service-${appVersion}`,
      persisted: false
    });
  }));

  app.use((request, response) => {
    response.status(404).json({
      error: "NOT_FOUND",
      message: "İstenen kaynak bulunamadı.",
      requestId: request.requestId
    });
  });

  app.use((error, request, response, _next) => {
    if (error instanceof SyntaxError && error.status === 400) {
      return response.status(400).json({ error: "INVALID_JSON", message: "İstek gövdesi geçerli JSON olmalıdır.", requestId: request.requestId });
    }
    if (error instanceof UpstreamServiceError) {
      return response.status(502).json({
        error: "USER_SERVICE_UNAVAILABLE",
        message: "Kullanıcı servisine şu anda ulaşılamıyor.",
        version: appVersion,
        requestId: request.requestId
      });
    }

    logger.error("http.unhandled_error", { requestId: request.requestId, message: error.message, version: appVersion });
    return response.status(500).json({ error: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu.", requestId: request.requestId });
  });

  return app;
}

module.exports = { createOrderServiceApp, validateOrder };
