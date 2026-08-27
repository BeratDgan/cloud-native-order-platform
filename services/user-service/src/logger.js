function write(stream, level, service, event, fields = {}) {
  stream.write(`${JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
    ...fields
  })}\n`);
}

function createJsonLogger(service) {
  return {
    info(event, fields) {
      write(process.stdout, "info", service, event, fields);
    },
    error(event, fields) {
      write(process.stderr, "error", service, event, fields);
    }
  };
}

const silentLogger = {
  info() {},
  error() {}
};

module.exports = { createJsonLogger, silentLogger };
