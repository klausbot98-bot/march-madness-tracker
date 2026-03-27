const { inferBetTypeFromPick, nextBetId, updateData } = require("../lib/data-store");
const { readBody, sendJson, sendMethodNotAllowed } = require("../lib/api-response");

const DEFAULT_BOOK = "draftkings";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendMethodNotAllowed(req, res, ["POST"]);

  try {
    const body = readBody(req);
    const game = String(body.game || "").trim();
    const pick = String(body.pick || "").trim();
    const line = Number(body.line ?? body.odds);
    const amount = Number(body.amount);
    const units = Number.isFinite(Number(body.units)) ? Number(body.units) : amount / 25;

    if (!game || !pick || !Number.isFinite(line) || !Number.isFinite(units) || units <= 0) {
      return sendJson(res, 400, { error: "game, pick, line/odds, and positive units/amount are required" });
    }

    const data = await updateData(async (current) => {
      current.bets.push({
        id: nextBetId(current),
        date: body.date || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()),
        gameTime: body.gameTime || "TBD",
        game,
        pick,
        line,
        originalLine: Number.isFinite(Number(body.originalLine)) ? Number(body.originalLine) : line,
        units,
        amount: Number.isFinite(amount) ? amount : Number((units * 25).toFixed(2)),
        book: body.book || DEFAULT_BOOK,
        type: body.type || inferBetTypeFromPick(pick),
        confidence: body.confidence || "medium",
        sharpSignal: body.sharpSignal ?? false,
        kenpomGap: body.kenpomGap ?? null,
        result: body.result || "placed",
        status: body.status || "placed",
        payout: Number.isFinite(Number(body.payout)) ? Number(body.payout) : 0,
        sport: body.sport || "ncaab",
        notes: body.notes || "",
      });
      return current;
    });

    sendJson(res, 201, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
