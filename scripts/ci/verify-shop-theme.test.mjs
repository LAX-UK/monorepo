import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const shopSrc = join(root, "apps/shop/src");

const TOKEN_FILE = "apps/shop/src/app/base.css";

const PALETTE_UTILITY =
  /\b(?:text|bg|border|fill|stroke|ring|outline|decoration|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/;

const RAW_COLOR =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\bcolor:\s*(?:white|black)\b|\bbackground:\s*(?:white|black)\b/;

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

function lineHasFixedContrast(line) {
  return line.includes("THEME_FIXED_CONTRAST");
}

describe("Shop theme contract", () => {
  it("declares semantic tokens only in base.css", () => {
    const files = walk(shopSrc).filter((f) => f.endsWith(".css") && rel(f) !== TOKEN_FILE);
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!RAW_COLOR.test(line)) continue;
        if (lineHasFixedContrast(line)) continue;
        assert.fail(
          `${rel(file)}:${i + 1} uses a raw color literal; use semantic CSS variables or mark THEME_FIXED_CONTRAST.`,
        );
      }
    }
  });

  it("forbids Tailwind palette utilities in Shop components", () => {
    const files = walk(shopSrc).filter((f) => f.endsWith(".tsx"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const match = text.match(PALETTE_UTILITY);
      assert.equal(
        match,
        null,
        `${rel(file)} must use semantic tokens (text-on-surface, bg-surface, etc.), not ${match?.[0] ?? "palette utilities"}.`,
      );
    }
  });

  it("documents theme contract in storefront SSOT", () => {
    const doc = readFileSync(join(root, "docs/ui/shop-storefront-architecture.md"), "utf8");
    assert.match(doc, /semantic.*token|light\/dark|theme contract/i);
    assert.match(doc, /verify-shop-theme/);
  });
});
