import { inferBetTypeFromPick, nextBetId, updateData } from "../../lib/data-store.js";
import { readBody, sendJson, sendMethodNotAllowed } from "../../lib/api-response.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendMethodNotAllowed(req, res, ["POST"]);

  try {
    const body = readBody(req);
    const id = String(body.id || "");
    if (!id) return sendJson(res, 400, { error: "Pick id is required" });

    const data = await updateData(async (current) => {
      const index = (current.aiPicks || []).findIndex((pick) => String(pick.id) === id);
      if (index === -1) {
        const error = new Error(`Pick ${id} not found`);
        error.statusCode = 404;
        throw error;
      }

      const pick = current.aiPicks[index];
      const units = Number.isFinite(Number(body.units)) ? Number(body.units) : Number(pick.units) || 1;
      const line = Number.isFinite(Number(body.line ?? body.odds)) ? Number(body.line ?? body.odds) : Number(pick.odds) || -110;

      current.bets.push({
        id: nextBetId(current),
        date: pick.date || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()),
        gameTime: body.gameTime || pick.gameTime || "TBD",
        game: body.game || pick.game,
        pick: body.pick || pick.pick,
        line,
        originalLine: Number.isFinite(Number(body.originalLine)) ? Number(body.originalLine) : line,
        units,
        amount: Number.isFinite(Number(body.amount)) ? Number(body.amount) : Number((units * 25).toFixed(2)),
        book: body.book || "draftkings",
        type: body.type || inferBetTypeFromPick(body.pick || pick.pick),
        confidence: body.confidence || (Number(pick.confidence) >= 4 ? "high" : Number(pick.confidence) >= 2 ? "medium" : "low"),
        result: body.result || "placed",
        status: body.status || "placed",
        payout: Number.isFinite(Number(body.payout)) ? Number(body.payout) : 0,
        sport: body.sport || pick.sport || "ncaab",
        notes: body.notes || pick.analysis || "AI pick placed via app",
      });

      current.aiPicks.splice(index, 1);
      return current;
    });

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
