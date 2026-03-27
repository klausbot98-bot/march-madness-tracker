import fs from "fs/promises";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const SEED_PATH = path.join(process.cwd(), "data.json");
const execFileAsync = promisify(execFile);

async function readSeedData() {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  return JSON.parse(raw);
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeData(data) {
  return {
    meta: data?.meta || {},
    bets: Array.isArray(data?.bets) ? data.bets : [],
    parlays: Array.isArray(data?.parlays) ? data.parlays : [],
    aiPicks: Array.isArray(data?.aiPicks) ? data.aiPicks : [],
    passedPickIds: Array.from(new Set((Array.isArray(data?.passedPickIds) ? data.passedPickIds : []).map((id) => String(id)))),
  };
}

async function runGit(args) {
  return execFileAsync("git", args, { cwd: process.cwd() });
}

export async function readData() {
  return normalizeData(await readSeedData());
}

async function syncRepoData() {
  await runGit(["add", "data.json"]);

  let hasChanges = false;
  try {
    await runGit(["diff", "--cached", "--quiet", "--", "data.json"]);
  } catch (error) {
    if (error.code === 1) {
      hasChanges = true;
    } else {
      throw error;
    }
  }

  if (!hasChanges) return;

  await runGit(["commit", "-m", "Sync bet tracker state"]);
  await runGit(["push", "origin", "main"]);
  await runGit(["push", "vercel-origin", "main"]);
}

export async function writeData(nextData) {
  const normalized = normalizeData(cloneData(nextData));
  await fs.writeFile(SEED_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
  await syncRepoData();
  return normalized;
}

export async function updateData(mutator) {
  const current = await readData();
  const next = await mutator(cloneData(current));
  if (!next || typeof next !== "object") throw new Error("Data mutator must return the full dataset");
  return writeData(next);
}

export function inferBetTypeFromPick(pick) {
  const label = String(pick || "").toLowerCase();
  if (/over|under/.test(label)) return "total";
  if (/[+-]\d+(\.\d+)?/.test(label)) return "spread";
  return "moneyline";
}

export function nextBetId(data) {
  return (data.bets || []).reduce((max, bet) => {
    const value = Number(bet.id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}
