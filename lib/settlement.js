import { americanProfit, normalizeResult, ticketStake } from "./bankroll.js";

const DEFAULT_ODDS_API_KEY = "b0209c1a2ae85c22e05e0fdfe5ef010c";
const SPORTS = ["basketball_ncaab", "soccer_france_ligue_one", "soccer_england_efl_cup"];

function cleanName(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function teamMatches(left, right) {
  const a = cleanName(left);
  const b = cleanName(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function extractGameTeams(gameLabel) {
  return String(gameLabel || "").split(" vs ").map((team) => team.trim()).filter(Boolean);
}

function betMatchesGame(bet, gameTeams) {
  const betTeams = extractGameTeams(bet.game);
  return betTeams.length === 2 && betTeams.every((team) => gameTeams.some((candidate) => teamMatches(team, candidate)));
}

function parseSpreadPick(pick) {
  const match = String(pick || "").match(/(.+?)\s([+-][\d.]+)/);
  if (!match) return null;
  return { team: match[1].trim(), spread: Number(match[2]) };
}

function parseTotalPick(pick) {
  const match = String(pick || "").match(/^(.+?)\s+(Over|Under|O|U)\s*([\d.]+)/i);
  if (!match) return null;
  return {
    teams: match[1].split("/").map((team) => team.trim()).filter(Boolean),
    isUnder: /under|u/i.test(match[2]),
    total: Number(match[3]),
  };
}

function parseMoneylinePick(pick) {
  const match = String(pick || "").match(/^(.+?)\s+ML$/i);
  if (!match) return null;
  return { team: match[1].trim() };
}

function evaluateBet(bet, game) {
  if (normalizeResult(bet.result) === "push" || normalizeResult(bet.result) === "win" || normalizeResult(bet.result) === "loss") {
    return null;
  }
  const scores = game.scores || [];
  const home = game.home_team;
  const away = game.away_team;
  const homeScore = Number(scores.find((entry) => entry.name === home)?.score || 0);
  const awayScore = Number(scores.find((entry) => entry.name === away)?.score || 0);
  const score = `${away} ${awayScore} - ${home} ${homeScore}`;
  const type = String(bet.sourceType || bet.type || "").toLowerCase();
  const settlementPick = bet.sourcePick || bet.pick;

  if (type === "spread") {
    const parsed = parseSpreadPick(settlementPick);
    if (!parsed) return null;
    const isHome = teamMatches(parsed.team, home);
    const pickScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const margin = pickScore - oppScore + parsed.spread;
    return {
      result: margin > 0 ? "win" : margin < 0 ? "loss" : "push",
      score,
      payout: margin > 0 ? Number((ticketStake(bet) + americanProfit(bet.units, Number(bet.line))).toFixed(2)) : 0,
    };
  }

  if (type === "total") {
    const parsed = parseTotalPick(settlementPick);
    if (!parsed) return null;
    const totalPoints = homeScore + awayScore;
    const result = totalPoints < parsed.total ? (parsed.isUnder ? "win" : "loss") : totalPoints > parsed.total ? (parsed.isUnder ? "loss" : "win") : "push";
    return {
      result,
      score,
      payout: result === "win" ? Number((ticketStake(bet) + americanProfit(bet.units, Number(bet.line))).toFixed(2)) : 0,
    };
  }

  if (type === "moneyline" || type === "ml") {
    const parsed = parseMoneylinePick(settlementPick) || { team: String(settlementPick || "").trim() };
    const isHome = teamMatches(parsed.team, home);
    const pickScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const result = pickScore > oppScore ? "win" : pickScore < oppScore ? "loss" : "push";
    return {
      result,
      score,
      payout: result === "win" ? Number((ticketStake(bet) + americanProfit(bet.units, Number(bet.line))).toFixed(2)) : 0,
    };
  }

  return null;
}

function evaluateParlayLeg(leg, game) {
  const home = game.home_team;
  const away = game.away_team;
  const scores = game.scores || [];
  const homeScore = Number(scores.find((entry) => entry.name === home)?.score || 0);
  const awayScore = Number(scores.find((entry) => entry.name === away)?.score || 0);
  const score = `${away} ${awayScore} - ${home} ${homeScore}`;
  const moneyline = parseMoneylinePick(leg);
  const spread = parseSpreadPick(leg);
  const total = parseTotalPick(leg);

  if (moneyline) {
    const isHome = teamMatches(moneyline.team, home);
    const pickScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    return { result: pickScore > oppScore ? "win" : pickScore < oppScore ? "loss" : "push", score };
  }

  if (spread) {
    const isHome = teamMatches(spread.team, home);
    const pickScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const margin = pickScore - oppScore + spread.spread;
    return { result: margin > 0 ? "win" : margin < 0 ? "loss" : "push", score };
  }

  if (total) {
    const totalPoints = homeScore + awayScore;
    const result = totalPoints < total.total ? (total.isUnder ? "win" : "loss") : totalPoints > total.total ? (total.isUnder ? "loss" : "win") : "push";
    return { result, score };
  }

  return null;
}

async function fetchCompletedGames(apiKey) {
  const responses = await Promise.all(
    SPORTS.map(async (sport) => {
      try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${apiKey}&daysFrom=1`, { cache: "no-store" });
        if (!response.ok) return [];
        return response.json();
      } catch (error) {
        return [];
      }
    })
  );
  return responses.flat().filter((game) => game?.completed && Array.isArray(game.scores) && game.scores.length >= 2);
}

export async function settleData(currentData, { oddsApiKey = process.env.ODDS_API_KEY || DEFAULT_ODDS_API_KEY } = {}) {
  const nextData = JSON.parse(JSON.stringify(currentData));
  const games = await fetchCompletedGames(oddsApiKey);
  let changed = false;

  for (const bet of nextData.bets || []) {
    if (bet.result !== "placed") continue;
    const matchingBet = { ...bet, game: bet.sourceGame || bet.game };
    const game = games.find((candidate) => betMatchesGame(matchingBet, [candidate.away_team, candidate.home_team]));
    if (!game) continue;
    const settled = evaluateBet(bet, game);
    if (!settled || settled.result === "placed") continue;
    Object.assign(bet, settled, { status: settled.result });
    changed = true;
  }

  for (const parlay of nextData.parlays || []) {
    if (parlay.result !== "placed") continue;
    let parlayChanged = false;
    const legStates = { ...(parlay.legStates || {}) };
    for (const leg of parlay.legs || []) {
      if (["win", "loss", "push", "won", "lost"].includes(legStates[leg]?.result)) continue;
      const matchingBet = (nextData.bets || []).find((bet) => bet.pick === leg && ["win", "loss", "push", "won", "lost"].includes(bet.result));
      if (matchingBet) {
        legStates[leg] = { result: normalizeResult(matchingBet.result), score: matchingBet.score || "" };
        parlayChanged = true;
        continue;
      }

      const game = games.find((candidate) => {
        const parsed = parseTotalPick(leg);
        const teams = parsed?.teams || extractGameTeams(leg) || [];
        return teams.length && teams.every((team) => [candidate.away_team, candidate.home_team].some((candidateTeam) => teamMatches(team, candidateTeam)));
      });
      if (!game) continue;
      const settledLeg = evaluateParlayLeg(leg, game);
      if (!settledLeg) continue;
      legStates[leg] = settledLeg;
      parlayChanged = true;
    }

    if (!parlayChanged) continue;
    parlay.legStates = legStates;
    const legResults = (parlay.legs || []).map((leg) => normalizeResult(legStates[leg]?.result));
    if (legResults.some((result) => result === "loss")) {
      parlay.result = "loss";
      parlay.status = "loss";
      parlay.payout = 0;
    } else if (legResults.length && legResults.every((result) => result === "win")) {
      parlay.result = "win";
      parlay.status = "win";
      parlay.payout = Number((ticketStake(parlay) + americanProfit(parlay.units, Number(parlay.line))).toFixed(2));
    } else if (legResults.length && legResults.every((result) => result === "win" || result === "push")) {
      parlay.result = "push";
      parlay.status = "push";
      parlay.payout = 0;
    }
    changed = true;
  }

  return { changed, data: nextData };
}
