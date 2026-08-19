import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0154 contract", () => {
  it("removes and can restore the auth email pipeline grants", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0154_revoke_auth_email_pipeline.sql"), "utf8"),
      readFile(resolve(drizzle, "0154_rollback.sql"), "utf8"),
    ]);

    for (const table of ["email_outbox", "email_suppression"]) {
      expect(forward).toContain(`REVOKE ALL PRIVILEGES ON TABLE public.${table} FROM auth_app`);
    }
    expect(rollback).toContain("GRANT INSERT, SELECT ON TABLE public.email_outbox TO auth_app");
    expect(rollback).toContain("GRANT SELECT ON TABLE public.email_suppression TO auth_app");
  });
});
