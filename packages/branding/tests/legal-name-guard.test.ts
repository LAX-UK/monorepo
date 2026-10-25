import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Company names and product names come from `legal-entity.ts`. A product that types a company
 * name, or writes the gallery as "LAX Art", drifts the moment an entity or name changes.
 */

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

const SCANNED_ROOTS = [
  "apps/account/src",
  "apps/api/src",
  "apps/art/src",
  "apps/auth/src",
  "apps/event/src",
  "apps/shop/src",
  "apps/shop-admin/src",
  "apps/shop-api/src",
  "apps/shop-identity/src",
  "apps/web/src",
  "apps/worker/src",
  "packages/email/src",
  "packages/identity-contracts/src",
  "packages/lax-ecosystem/src",
  "packages/marketing-ui/src",
  "packages/shop-portal/src",
  "packages/ui/src",
];

const SOURCE_FILE = /\.(ts|tsx|mts|js|mjs)$/;
const TEST_FILE = /(\.test\.|\.spec\.|\.test-util\.|\/testing\/|\/__tests__\/|\/e2e\/)/;

/** Registered company names, in any casing of the suffix. */
const COMPANY_NAME = /London Auction Xchange|London Art Exchange (Ltd|Limited)\b/i;
/** The gallery is written "lax.art". */
const RETIRED_PRODUCT_NAME = /\bLAX Art\b(?! Exchange)/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

function listSources(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === "node_modules" || name === "dist" || name === ".next") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSources(path);
    return SOURCE_FILE.test(name) ? [path] : [];
  });
}

function findViolations(pattern: RegExp): string[] {
  const violations: string[] = [];
  for (const root of SCANNED_ROOTS) {
    for (const file of listSources(join(REPO_ROOT, root))) {
      const rel = relative(REPO_ROOT, file);
      if (TEST_FILE.test(rel)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (COMMENT_LINE.test(line)) return;
          if (pattern.test(line)) violations.push(`${rel}:${index + 1}: ${line.trim()}`);
        });
    }
  }
  return violations;
}

describe("legal and product names", () => {
  it("are not typed into product code; use legalEntityFor / legalEntitiesFor", () => {
    expect(findViolations(COMPANY_NAME)).toEqual([]);
  });

  it("write the gallery as lax.art; use LAX_PRODUCT_NAMES", () => {
    expect(findViolations(RETIRED_PRODUCT_NAME)).toEqual([]);
  });
});
