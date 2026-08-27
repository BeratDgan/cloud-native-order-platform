const CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

function escapeLabel(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

class HttpMetrics {
  constructor(service) {
    this.service = service;
    this.startedAt = Date.now() / 1000;
    this.samples = new Map();
  }

  observe({ method, route, status, durationSeconds }) {
    const labels = { method, route, status: String(status) };
    const key = JSON.stringify(labels);
    const sample = this.samples.get(key) || { labels, count: 0, sum: 0 };
    sample.count += 1;
    sample.sum += durationSeconds;
    this.samples.set(key, sample);
  }

  render() {
    const service = escapeLabel(this.service);
    const lines = [
      "# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.",
      "# TYPE process_start_time_seconds gauge",
      `process_start_time_seconds{service="${service}"} ${this.startedAt}`,
      "# HELP http_requests_total Total HTTP requests handled by the service.",
      "# TYPE http_requests_total counter",
      "# HELP http_request_duration_seconds HTTP request duration in seconds.",
      "# TYPE http_request_duration_seconds summary"
    ];

    for (const { labels, count, sum } of this.samples.values()) {
      const renderedLabels = `service="${service}",method="${escapeLabel(labels.method)}",route="${escapeLabel(labels.route)}",status="${escapeLabel(labels.status)}"`;
      lines.push(`http_requests_total{${renderedLabels}} ${count}`);
      lines.push(`http_request_duration_seconds_sum{${renderedLabels}} ${sum}`);
      lines.push(`http_request_duration_seconds_count{${renderedLabels}} ${count}`);
    }

    return `${lines.join("\n")}\n`;
  }
}

function metricsMiddleware(metrics) {
  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();
    response.once("finish", () => {
      const route = request.route?.path || request.path || "unknown";
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      metrics.observe({ method: request.method, route, status: response.statusCode, durationSeconds });
    });
    next();
  };
}

module.exports = { CONTENT_TYPE, HttpMetrics, metricsMiddleware };
