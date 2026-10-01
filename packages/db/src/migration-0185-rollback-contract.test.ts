import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0185 rollback contract", () => {
  it("refuses rollback when merchandise lines would violate restored NOT NULL constraints", async () => {
    const rollback = await readFile(resolve(drizzle, "0185_rollback.sql"), "utf8");
    expect(rollback).toContain("0185 rollback blocked");
    expect(rollback).toContain("product_variant_id");
  });
});
