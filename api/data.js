import { readData, writeData } from "../lib/data-store.js";
import { readBody, sendJson, sendMethodNotAllowed } from "../lib/api-response.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return sendMethodNotAllowed(req, res, ["GET", "POST"]);

  try {
    const data = req.method === "GET" ? await readData() : await writeData(readBody(req));
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
