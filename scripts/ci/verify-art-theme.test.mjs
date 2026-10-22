import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const artSrc = join(root, "apps/art/src");

const TOKEN_FILE = "apps/art/src/app/base.css";

const PALETTE_UTILITY =
  /\b(?:text|bg|border|fill|stroke|ring|outline|decoration|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/;

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

describe("Art theme contract", () => {
  it("documents theme contract in Figma inventory SSOT", () => {
    const doc = readFileSync(join(root, "docs/ui/art-figma-inventory.md"), "utf8");
    assert.match(doc, /base\.css|semantic|theme contract/i);
    assert.match(doc, /verify-art-theme/);
  });

  it("forbids Tailwind palette utilities in art components", () => {
    const files = walk(artSrc).filter((f) => f.endsWith(".tsx"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const match = text.match(PALETTE_UTILITY);
      assert.equal(
        match,
        null,
        `${rel(file)} must use semantic tokens, not ${match?.[0] ?? "palette utilities"}.`,
      );
    }
  });

  it("never uses LAX Bid's navy accent (LAX colour rule in docs/DESIGN_SYSTEM.md)", () => {
    const BID_ACCENT = /brand-midnight|#0[89]1f5b\b/i;
    for (const file of walk(artSrc)) {
      const text = readFileSync(file, "utf8");
      const match = text.match(BID_ACCENT);
      assert.equal(
        match,
        null,
        `${rel(file)} uses Bid's accent (${match?.[0]}); use neutral tokens.`,
      );
    }
  });

  it("never uses LAX Account's teal accent (LAX colour rule in docs/DESIGN_SYSTEM.md)", () => {
    const ACCOUNT_ACCENT = /#0f766e\b|#2dd4bf\b/i;
    for (const file of walk(artSrc)) {
      const text = readFileSync(file, "utf8");
      const match = text.match(ACCOUNT_ACCENT);
      assert.equal(
        match,
        null,
        `${rel(file)} uses Account's accent (${match?.[0]}); use neutral tokens.`,
      );
    }
  });

  it("declares semantic tokens only in base.css among art stylesheets", () => {
    const files = walk(artSrc).filter((f) => f.endsWith(".css") && rel(f) !== TOKEN_FILE);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(
        text,
        /#[0-9a-fA-F]{6}\b/,
        `${rel(file)} must not introduce raw hex colors`,
      );
    }
  });
});
