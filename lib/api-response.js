function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

function sendMethodNotAllowed(req, res, methods) {
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: `Method ${req.method} not allowed` });
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  return {};
}

module.exports = {
  readBody,
  sendJson,
  sendMethodNotAllowed,
};
