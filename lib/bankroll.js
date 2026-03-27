export const UNIT_SIZE = 25;
export const DEFAULT_OPENING_CASH = 199.88;

export function normalizeResult(result) {
  if (result === "won") return "win";
  if (result === "lost") return "loss";
  return result || null;
}

export function isWin(result) {
  return normalizeResult(result) === "win";
}

export function isLoss(result) {
  return normalizeResult(result) === "loss";
}

export function isSettled(result) {
  return ["win", "won", "loss", "lost", "push"].includes(result);
}

export function unitToDollars(units) {
  return Number(units || 0) * UNIT_SIZE;
}

export function ticketStake(item) {
  const amount = Number(item?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return Number(unitToDollars(item?.units).toFixed(2));
}

function americanProfitFromStake(stake, odds) {
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

export function americanProfit(units, odds) {
  return americanProfitFromStake(unitToDollars(units), odds);
}

export function ticketProfit(item) {
  const stake = ticketStake(item);
  if (item.result === "placed") return -stake;
  if (isWin(item.result)) {
    if (item.payout != null) return Number(item.payout) - stake;
    return americanProfitFromStake(stake, Number(item.line));
  }
  if (isLoss(item.result)) return -stake;
  return 0;
}

export function ticketReturn(item) {
  const stake = ticketStake(item);
  if (!item.result || item.result === "placed") return 0;
  if (isWin(item.result)) {
    if (item.payout != null) return Number(item.payout);
    return stake + americanProfitFromStake(stake, Number(item.line));
  }
  if (normalizeResult(item.result) === "push") return stake;
  return 0;
}

export function allTickets(data) {
  return [
    ...(data.bets || []).map((bet) => ({ ...bet, ticketType: "bet", label: bet.pick })),
    ...(data.parlays || []).map((parlay) => ({ ...parlay, ticketType: "parlay", label: parlay.name || parlay.pick })),
  ];
}

export function openingCash(data) {
  const value = Number(data?.meta?.openingCash);
  return Number.isFinite(value) ? value : DEFAULT_OPENING_CASH;
}

export function summarizeData(data) {
  const tickets = allTickets(data);
  const settledTickets = tickets.filter((item) => isSettled(item.result));
  const placedTickets = tickets.filter((item) => item.result === "placed");
  const activeTickets = tickets.filter((item) => item.result === "placed" || isSettled(item.result));
  const totalWagered = activeTickets.reduce((sum, item) => sum + ticketStake(item), 0);
  const totalReturned = settledTickets.reduce((sum, item) => sum + ticketReturn(item), 0);
  const realized = tickets.reduce((sum, item) => sum + ticketProfit(item), 0);
  const settledRisked = settledTickets.reduce((sum, item) => sum + ticketStake(item), 0);
  const wins = settledTickets.filter((item) => isWin(item.result)).length;
  const losses = settledTickets.filter((item) => isLoss(item.result)).length;
  const pushes = settledTickets.filter((item) => item.result === "push").length;
  const placedCount = placedTickets.length;
  const notPlaced = tickets.filter((item) => !item.result).length;
  const atRisk = placedTickets.reduce((sum, item) => sum + ticketStake(item), 0);
  const roi = settledRisked ? (realized / settledRisked) * 100 : 0;
  const winRate = wins + losses ? (wins / (wins + losses)) * 100 : 0;
  const bankroll = openingCash(data) - totalWagered + totalReturned;
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
    bankroll,
    unitSize: UNIT_SIZE,
    openingCash: openingCash(data),
  };
}
