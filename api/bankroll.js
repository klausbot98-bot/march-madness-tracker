import { summarizeData } from "../lib/bankroll.js";
import { readData } from "../lib/data-store.js";
import { sendJson, sendMethodNotAllowed } from "../lib/api-response.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendMethodNotAllowed(req, res, ["GET"]);

  try {
    const data = await readData();
    sendJson(res, 200, summarizeData(data));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
