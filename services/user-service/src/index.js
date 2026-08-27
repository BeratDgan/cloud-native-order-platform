const express = require("express");

const app = express();
const port = Number(process.env.PORT || 8080);

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/users/:id", (request, response) => {
  const { id } = request.params;

  response.json({
    id,
    name: `Demo User ${id}`,
    email: `user${id}@example.com`,
    servedBy: "user-service"
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`user-service listening on port ${port}`);
});
