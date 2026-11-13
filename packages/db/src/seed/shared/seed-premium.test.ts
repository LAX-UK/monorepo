import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seedRoot = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("seed buyer's premium", () => {
  it("never types a flat premium rate or a premium percentage into a seeded sale or lot", () => {
    const offenders = sourceFiles(seedRoot).flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .map((line, index) => ({ path, line: index + 1, text: line }))
        .filter(
          ({ text }) =>
            /buyerPremiumRate:\s*"0\.(?!15(00)?")/.test(text) || /premium[^\n]*\b\d+%/i.test(text),
        )
        .map(({ path: p, line, text }) => `${p}:${line}: ${text.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
