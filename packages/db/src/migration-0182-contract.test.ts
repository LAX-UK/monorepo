import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0182 contract", () => {
  it("adds two-axis edition columns with rollback", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0182_shop_edition_two_axis.sql"), "utf8"),
      readFile(resolve(drizzle, "0182_rollback.sql"), "utf8"),
    ]);
    expect(forward).toContain("shop_edition_listing_status");
    expect(forward).toContain("listing_status");
    expect(rollback).toContain('DROP TYPE IF EXISTS "shop_edition_listing_status"');
  });
});
