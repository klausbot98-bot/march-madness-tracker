import { readData, writeData } from "../lib/data-store.js";
import { sendJson, sendMethodNotAllowed } from "../lib/api-response.js";
import { settleData } from "../lib/settlement.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendMethodNotAllowed(req, res, ["POST"]);

  try {
    const current = await readData();
    const { changed, data } = await settleData(current);
    if (changed) {
      await writeData(data);
    }
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
