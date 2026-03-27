const { readData } = require("../lib/data-store");
const { summarizeData } = require("../lib/bankroll");
const { sendJson, sendMethodNotAllowed } = require("../lib/api-response");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendMethodNotAllowed(req, res, ["GET"]);

  try {
    const data = await readData();
    sendJson(res, 200, summarizeData(data));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
