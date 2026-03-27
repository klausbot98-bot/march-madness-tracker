const UNIT_SIZE = 25;
const STARTING_BANKROLL = 212.5;
const BANKROLL_CORRECTION = -13.58;

function normalizeResult(result) {
  if (result === "won") return "win";
  if (result === "lost") return "loss";
  return result || null;
}

function isWin(result) {
  return normalizeResult(result) === "win";
}

function isLoss(result) {
  return normalizeResult(result) === "loss";
}

function isSettled(result) {
  return ["win", "won", "loss", "lost", "push"].includes(result);
}

function unitToDollars(units) {
  return Number(units || 0) * UNIT_SIZE;
}

function americanProfit(units, odds) {
  const stake = unitToDollars(units);
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

function ticketProfit(item) {
  if (item.result === "placed") return -unitToDollars(item.units);
  if (isWin(item.result)) {
    if (item.payout != null) return Number(item.payout) - unitToDollars(item.units);
    return americanProfit(item.units, Number(item.line));
  }
  if (isLoss(item.result)) return -unitToDollars(item.units);
  return 0;
}

function ticketReturn(item) {
  if (!item.result || item.result === "placed") return 0;
  if (isWin(item.result)) {
    if (item.payout != null) return Number(item.payout);
    return unitToDollars(item.units) + americanProfit(item.units, Number(item.line));
  }
  if (normalizeResult(item.result) === "push") return unitToDollars(item.units);
  return 0;
}

function allTickets(data) {
  return [
    ...(data.bets || []).map((bet) => ({ ...bet, ticketType: "bet", label: bet.pick })),
    ...(data.parlays || []).map((parlay) => ({ ...parlay, ticketType: "parlay", label: parlay.name })),
  ];
}

function summarizeData(data) {
  const tickets = allTickets(data);
  const settledTickets = tickets.filter((item) => isSettled(item.result));
  const placedTickets = tickets.filter((item) => item.result === "placed");
  const activeTickets = tickets.filter((item) => item.result === "placed" || isSettled(item.result));
  const totalWagered = activeTickets.reduce((sum, item) => sum + unitToDollars(item.units), 0);
  const totalReturned = settledTickets.reduce((sum, item) => sum + ticketReturn(item), 0);
  const realized = tickets.reduce((sum, item) => sum + ticketProfit(item), 0);
  const settledRisked = settledTickets.reduce((sum, item) => sum + unitToDollars(item.units), 0);
  const wins = settledTickets.filter((item) => isWin(item.result)).length;
  const losses = settledTickets.filter((item) => isLoss(item.result)).length;
  const pushes = settledTickets.filter((item) => item.result === "push").length;
  const placedCount = placedTickets.length;
  const notPlaced = tickets.filter((item) => !item.result).length;
  const atRisk = placedTickets.reduce((sum, item) => sum + unitToDollars(item.units), 0);
  const roi = settledRisked ? (realized / settledRisked) * 100 : 0;
  const winRate = wins + losses ? (wins / (wins + losses)) * 100 : 0;
  return {
    totalWagered,
    totalReturned,
    realized,
    roi,
    winRate,
    wins,
    losses,
    pushes,
    placedCount,
    atRisk,
    notPlaced,
    settledCount: settledTickets.length,
    bankroll: STARTING_BANKROLL + realized + BANKROLL_CORRECTION,
    unitSize: UNIT_SIZE,
    startingBankroll: STARTING_BANKROLL,
    bankrollCorrection: BANKROLL_CORRECTION,
  };
}

module.exports = {
  BANKROLL_CORRECTION,
  STARTING_BANKROLL,
  UNIT_SIZE,
  summarizeData,
};
