import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const accountSrc = join(root, "apps/account/src");

// Account's teal (PRODUCT_ACCENTS.account and its dark-surface value in @auction/branding).
const ACCOUNT_ACCENT = /#0f766e\b|#2dd4bf\b/i;

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

describe("Account accent exclusivity", () => {
  it("keeps Account's teal out of Bid, Shop and Art (LAX colour rule in docs/DESIGN_SYSTEM.md)", () => {
    for (const app of ["web", "shop", "art"]) {
      for (const file of walk(join(root, "apps", app, "src"))) {
        const match = readFileSync(file, "utf8").match(ACCOUNT_ACCENT);
        assert.equal(
          match,
          null,
          `${rel(file)} uses Account's accent (${match?.[0]}); each product owns its own accent.`,
        );
      }
    }
  });

  it("never lets teal mark a success state in Account", () => {
    const css = readFileSync(join(accountSrc, "app/globals.css"), "utf8");
    for (const line of css.split("\n")) {
      if (/--color-(?:on-)?success/.test(line)) {
        assert.doesNotMatch(
          line,
          /#0f766e|#2dd4bf|product-accent/i,
          `Success tokens must stay green: ${line.trim()}`,
        );
      }
    }
  });
});

describe("Hosted sign-in theme contract", () => {
  const hostedAuthSrc = join(root, "packages/auth/src/hosted-auth");

  function hostedSources(dir = hostedAuthSrc, acc = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) hostedSources(full, acc);
      else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) acc.push(full);
    }
    return acc;
  }

  it("never uses LAX Bid's navy in hosted pages, which are the LAX Account for every product", () => {
    const BID_ACCENT = /midnight|#0[89]1f5b\b|#202759\b/i;
    for (const file of hostedSources()) {
      const match = readFileSync(file, "utf8").match(BID_ACCENT);
      assert.equal(match, null, `${rel(file)} uses Bid's accent (${match?.[0]}).`);
    }
  });

  it("points the hosted link and focus-ring tokens at neutral ink and Account teal", () => {
    const css = readFileSync(join(hostedAuthSrc, "styles.ts"), "utf8");
    assert.match(css, /--color-ring: \$\{t\.accent\}/);
    assert.match(css, /--color-ring: \$\{t\.accentOnDark\}/);
    assert.match(css, /--color-link: \$\{t\.ink\}/);
  });

  it("does not load fonts from third parties", () => {
    for (const file of hostedSources()) {
      assert.doesNotMatch(
        readFileSync(file, "utf8"),
        /fonts\.(googleapis|gstatic)\.com/,
        rel(file),
      );
    }
  });
});
