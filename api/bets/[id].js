import { updateData } from "../../lib/data-store.js";
import { readBody, sendJson, sendMethodNotAllowed } from "../../lib/api-response.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return sendMethodNotAllowed(req, res, ["PATCH"]);

  try {
    const body = readBody(req);
    const id = String(req.query.id);
    const data = await updateData(async (current) => {
      const bet = (current.bets || []).find((entry) => String(entry.id) === id);
      if (!bet) {
        const error = new Error(`Bet ${id} not found`);
        error.statusCode = 404;
        throw error;
      }

      Object.assign(bet, {
        ...body,
        id: bet.id,
      });

      if (body.line != null) bet.line = Number(body.line);
      if (body.originalLine != null) bet.originalLine = Number(body.originalLine);
      if (body.units != null) bet.units = Number(body.units);
      if (body.amount != null) bet.amount = Number(body.amount);
      if (body.payout != null) bet.payout = Number(body.payout);
      if (body.kenpomGap != null) bet.kenpomGap = body.kenpomGap === null ? null : Number(body.kenpomGap);
      if (!bet.amount && bet.units) bet.amount = Number((Number(bet.units) * 25).toFixed(2));
      if (bet.result && bet.result !== "placed" && !body.status) bet.status = bet.result;

      return current;
    });

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
