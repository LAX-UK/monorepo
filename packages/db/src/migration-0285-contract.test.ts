import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const journal = JSON.parse(
  readFileSync(join(import.meta.dirname, "../drizzle/meta/_journal.json"), "utf8"),
) as { entries: { idx: number; when: number; tag: string }[] };

/** The `when` of 0284_alert_engine, the last migration claimed before this one. */
const WHEN_OF_0284 = 1800086400000;

describe("migration 0285 journal entry", () => {
  const entry = journal.entries.find((row) => row.tag === "0285_shop_returns_stock");

  it("is numbered 285 and follows 0284 in time", () => {
    expect(entry?.idx).toBe(285);
    expect(entry?.when).toBeGreaterThan(WHEN_OF_0284);
  });

  it("is the newest entry in the journal", () => {
    const newest = Math.max(...journal.entries.map((row) => row.when));
    expect(entry?.when).toBe(newest);
  });
});
