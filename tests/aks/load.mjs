// Read-only autoscaling load test. It requests an intentionally missing order ID,
// exercising web-app, order-service, user-service and PostgreSQL without writing data.
const baseUrl = process.argv[2] || "http://127.0.0.1:18080";
const durationSeconds = Number(process.argv[3] || 120);
const concurrency = Number(process.argv[4] || 30);
const requestUrl = new URL("/api/orders/999999999", baseUrl);

if (!Number.isInteger(durationSeconds) || durationSeconds < 10) {
  throw new Error("Duration must be an integer of at least 10 seconds.");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) {
  throw new Error("Concurrency must be an integer between 1 and 100.");
}

const deadline = Date.now() + durationSeconds * 1000;
const startedAt = Date.now();
const results = {
  completed: 0,
  failed: 0,
  versions: { v1: 0, v2: 0 },
};

async function worker() {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(requestUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json();
      if (!response.ok || !Object.hasOwn(results.versions, body.version)) {
        results.failed++;
        continue;
      }
      results.completed++;
      results.versions[body.version]++;
    } catch {
      results.failed++;
    }
  }
}

const progress = setInterval(() => {
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`${elapsedSeconds}s: ${results.completed} successful, ${results.failed} failed`);
}, 10000);

console.log(`Load: ${requestUrl} | duration=${durationSeconds}s | concurrency=${concurrency}`);
await Promise.all(Array.from({ length: concurrency }, worker));
clearInterval(progress);

const elapsedSeconds = (Date.now() - startedAt) / 1000;
const total = results.completed + results.failed;
console.log(JSON.stringify({
  ...results,
  requestsPerSecond: Number((total / elapsedSeconds).toFixed(1)),
}, null, 2));

if (results.completed === 0) process.exitCode = 1;
