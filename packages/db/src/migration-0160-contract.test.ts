import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0160 contract", () => {
  it("revokes and can restore the staged worker user-table read", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0160_revoke_worker_user_reads.sql"), "utf8"),
      readFile(resolve(drizzle, "0160_rollback.sql"), "utf8"),
    ]);

    expect(forward).toContain('REVOKE SELECT ON TABLE public."user" FROM worker_app');
    expect(rollback).toContain('GRANT SELECT ON TABLE public."user" TO worker_app');
  });
});
