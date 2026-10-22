import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const accountSrc = join(root, "apps/account/src");

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(css|tsx|ts)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function rel(full) {
  return full.slice(root.length + 1);
}

describe("Account theme contract", () => {
  it("never uses LAX Bid's navy accent (LAX colour rule in docs/DESIGN_SYSTEM.md)", () => {
    const BID_ACCENT = /brand-midnight|#0[89]1f5b\b/i;
    for (const file of walk(accountSrc)) {
      const text = readFileSync(file, "utf8");
      const match = text.match(BID_ACCENT);
      assert.equal(
        match,
        null,
        `${rel(file)} uses Bid's accent (${match?.[0]}); use neutral tokens.`,
      );
    }
  });
});
