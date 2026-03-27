const fs = require("fs/promises");
const path = require("path");
const { list, put } = require("@vercel/blob");

const SEED_PATH = path.join(process.cwd(), "data.json");
const BLOB_PATHNAME = "bet-tracker/data.json";

async function readSeedData() {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  return JSON.parse(raw);
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

async function readBlobData() {
  const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
  const blob = blobs.find((entry) => entry.pathname === BLOB_PATHNAME) || blobs[0];
  if (!blob?.url) return null;
  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch blob data: ${response.status}`);
  return response.json();
}

async function writeBlobData(data) {
  const body = JSON.stringify(data, null, 2);
  await put(BLOB_PATHNAME, body, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });
}

function canUseBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readData() {
  if (canUseBlob()) {
    try {
      const blobData = await readBlobData();
      if (blobData) return blobData;
    } catch (error) {
      console.warn("Blob read failed, falling back to seed data:", error.message);
    }
  }
  return readSeedData();
}

async function writeData(nextData) {
  const normalized = cloneData(nextData);
  if (canUseBlob()) {
    await writeBlobData(normalized);
    return normalized;
  }

  if (process.env.VERCEL) {
    throw new Error("Persistent writes require Vercel Blob. Set BLOB_READ_WRITE_TOKEN in Vercel.");
  }

  await fs.writeFile(SEED_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
  return normalized;
}

async function updateData(mutator) {
  const current = await readData();
  const next = await mutator(cloneData(current));
  if (!next || typeof next !== "object") throw new Error("Data mutator must return the full dataset");
  return writeData(next);
}

function inferBetTypeFromPick(pick) {
  const label = String(pick || "").toLowerCase();
  if (/over|under/.test(label)) return "total";
  if (/[+-]\d+(\.\d+)?/.test(label)) return "spread";
  return "moneyline";
}

function nextBetId(data) {
  return (data.bets || []).reduce((max, bet) => {
    const value = Number(bet.id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

module.exports = {
  inferBetTypeFromPick,
  nextBetId,
  readData,
  updateData,
};
