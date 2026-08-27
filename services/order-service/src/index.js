const express = require("express");

const app = express();
const port = Number(process.env.PORT || 8080);
const appVersion = process.env.APP_VERSION || "v1";
const userServiceUrl = process.env.USER_SERVICE_URL || "http://user-service:8080";

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok", version: appVersion });
});

app.get("/orders/:id", async (request, response) => {
  const { id } = request.params;

  try {
    const userId = String((Number.parseInt(id, 10) || 1) % 10 || 10);
    const userResponse = await fetch(`${userServiceUrl}/users/${userId}`, {
      signal: AbortSignal.timeout(2000)
    });

    if (!userResponse.ok) {
      throw new Error(`user-service returned HTTP ${userResponse.status}`);
    }

    const user = await userResponse.json();

    response.json({
      id,
      product: appVersion === "v2" ? "Canary Coffee" : "Demo Coffee",
      quantity: 1,
      status: "CREATED",
      user,
      version: appVersion,
      servedBy: `order-service-${appVersion}`
    });
  } catch (error) {
    console.error("Failed to fetch user", error);
    response.status(502).json({
      error: "USER_SERVICE_UNAVAILABLE",
      version: appVersion
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`order-service ${appVersion} listening on port ${port}`);
});
