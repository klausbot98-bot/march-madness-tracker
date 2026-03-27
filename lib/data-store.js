import fs from "fs/promises";
import path from "path";

const SEED_PATH = path.join(process.cwd(), "data.json");
const GITHUB_OWNER = "kgv1213";
const GITHUB_REPO = "march-madness-tracker";
const GITHUB_PATH = "data.json";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

let cachedSha = null;

async function readBundledData() {
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

function buildGithubHeaders({ withAuth = false } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "march-madness-tracker",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (withAuth) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is required to write data");
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function decodeGithubContent(encoded) {
  return Buffer.from(String(encoded || "").replace(/\n/g, ""), "base64").toString("utf8");
}

async function parseGithubError(response) {
  try {
    const payload = await response.json();
    return payload?.message || `GitHub API request failed with ${response.status}`;
  } catch {
    return `GitHub API request failed with ${response.status}`;
  }
}

async function fetchGithubData() {
  const response = await fetch(GITHUB_API_URL, { headers: buildGithubHeaders() });
  if (!response.ok) {
    throw new Error(await parseGithubError(response));
  }

  const payload = await response.json();
  cachedSha = payload.sha || cachedSha;
  return {
    data: JSON.parse(decodeGithubContent(payload.content)),
    sha: payload.sha || null,
  };
}

async function readSeedData() {
  try {
    const { data } = await fetchGithubData();
    return data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Falling back to bundled data.json: ${error.message}`);
    }
    return readBundledData();
  }
}

export async function readData() {
  return normalizeData(await readSeedData());
}

async function putGithubData(normalized, sha) {
  const response = await fetch(GITHUB_API_URL, {
    method: "PUT",
    headers: {
      ...buildGithubHeaders({ withAuth: true }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Sync bet tracker state",
      content: Buffer.from(JSON.stringify(normalized, null, 2) + "\n", "utf8").toString("base64"),
      sha,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseGithubError(response));
  }

  const payload = await response.json();
  cachedSha = payload?.content?.sha || sha || cachedSha;
}

export async function writeData(nextData) {
  const normalized = normalizeData(cloneData(nextData));
  let sha = cachedSha;

  if (!sha) {
    try {
      ({ sha } = await fetchGithubData());
    } catch (error) {
      throw new Error(`Unable to determine current data.json SHA: ${error.message}`);
    }
  }

  try {
    await putGithubData(normalized, sha);
  } catch (error) {
    if (/sha/i.test(error.message) || /conflict/i.test(error.message)) {
      const latest = await fetchGithubData();
      await putGithubData(normalized, latest.sha);
    } else {
      throw error;
    }
  }

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
