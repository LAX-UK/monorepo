import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0156 contract", () => {
  it("repairs the PII purge for the Identity-only user schema", async () => {
    const forward = await readFile(resolve(drizzle, "0156_repair_user_pii_purge.sql"), "utf8");

    expect(forward).toContain("CREATE OR REPLACE FUNCTION public.user_pii_purge");
    expect(forward).toContain("pending_new_email = NULL");
    expect(forward).not.toMatch(/\b(first_name|last_name|mobile)\s*=/);
  });
});
