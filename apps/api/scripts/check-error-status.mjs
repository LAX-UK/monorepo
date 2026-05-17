/**
 * Fails when route/middleware handlers return JSON error bodies without an explicit HTTP status.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "src");
const dirs = ["routes", "middleware"];

const errorBodyRe = /\b(error|forbidden|unauthorized)\s*:|ok\s*:\s*false/i;

function jsonCallSlice(lines, startIdx) {
  let depth = 0;
  let started = false;
  const parts = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    parts.push(line);
    for (const ch of line) {
      if (ch === "(") {
        depth++;
        started = true;
      } else if (ch === ")") {
        depth--;
        if (started && depth === 0) return parts.join("\n");
      }
    }
    if (parts.length > 12) break;
  }
  return parts.join("\n");
}

function hasExplicitStatus(jsonSlice) {
  return (
    /c\.json\s*\([^)]*,\s*[^)]+\)/s.test(jsonSlice) ||
    /c\.json\s*\(\s*[^,]+,\s*\d{3}/s.test(jsonSlice) ||
    /c\.json\s*\(\s*[^,]+,\s*asHttpStatus/s.test(jsonSlice) ||
    /c\.json\s*\(\s*[^,]+,\s*e\.status/s.test(jsonSlice) ||
    /c\.json\s*\(\s*[^,]+,\s*result\.status/s.test(jsonSlice)
  );
}

function checkFile(text) {
  const issues = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("c.json(")) continue;
    const slice = jsonCallSlice(lines, i);
    if (!errorBodyRe.test(slice)) continue;
    if (hasExplicitStatus(slice)) continue;
    issues.push({ line: i + 1, snippet: line.trim() });
  }
  return issues;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

let failed = false;
for (const sub of dirs) {
  const base = join(root, sub);
  for (const file of walk(base)) {
    const rel = file.replace(`${join(__dirname, "..")}/`, "");
    const text = readFileSync(file, "utf8");
    const issues = checkFile(text);
    if (issues.length > 0) {
      failed = true;
      console.error(`\n${rel}:`);
      for (const { line, snippet } of issues) {
        console.error(`  L${line}: ${snippet}`);
      }
    }
  }
}

if (failed) {
  console.error("\ncheck-error-status: add an explicit HTTP status to c.json error responses.");
  process.exit(1);
}

console.log("check-error-status: ok");
