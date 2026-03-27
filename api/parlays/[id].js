import { updateData } from "../../lib/data-store.js";
import { readBody, sendJson, sendMethodNotAllowed } from "../../lib/api-response.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return sendMethodNotAllowed(req, res, ["PATCH"]);

  try {
    const body = readBody(req);
    const id = String(req.query.id);
    const data = await updateData(async (current) => {
      const parlay = (current.parlays || []).find((entry) => String(entry.id) === id);
      if (!parlay) {
        const error = new Error(`Parlay ${id} not found`);
        error.statusCode = 404;
        throw error;
      }

      Object.assign(parlay, {
        ...body,
        id: parlay.id,
      });

      if (body.line != null) parlay.line = Number(body.line);
      if (body.units != null) parlay.units = Number(body.units);
      if (body.payout != null) parlay.payout = Number(body.payout);
      if (parlay.result && parlay.result !== "placed" && !body.status) parlay.status = parlay.result;

      return current;
    });

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
