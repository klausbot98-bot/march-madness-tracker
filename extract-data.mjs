import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./index.html", import.meta.url), "utf8");

function extractArray(name) {
  const startToken = `const ${name} = [`;
  const startIndex = source.indexOf(startToken);
  if (startIndex === -1) {
    throw new Error(`Could not find ${name}`);
  }

  let cursor = startIndex + startToken.length - 1;
  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (; cursor < source.length; cursor += 1) {
    const char = source[cursor];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex + `${`const ${name} = `}`.length, cursor + 1);
      }
    }
  }

  throw new Error(`Could not parse ${name}`);
}

const context = vm.createContext({ BET_BOOK: "draftkings" });
const bets = vm.runInContext(`(${extractArray("BETS")})`, context);
const parlays = vm.runInContext(`(${extractArray("PARLAYS")})`, context);
const aiPicks = vm.runInContext(`(${extractArray("AI_PICKS")})`, context);

writeFileSync(
  new URL("./data.json", import.meta.url),
  `${JSON.stringify({ bets, parlays, aiPicks }, null, 2)}\n`,
  "utf8"
);
