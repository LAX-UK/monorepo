import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0158 contract", () => {
  it("removes and can restore the auth product-table grants", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0158_revoke_auth_product_reads.sql"), "utf8"),
      readFile(resolve(drizzle, "0158_rollback.sql"), "utf8"),
    ]);

    for (const table of ["bid_user_profile", "external_accounts"]) {
      expect(forward).toContain(`REVOKE ALL PRIVILEGES ON TABLE public.${table} FROM auth_app`);
    }
    expect(rollback).toContain("GRANT SELECT ON TABLE public.bid_user_profile TO auth_app");
    expect(rollback).toContain(
      "GRANT SELECT, UPDATE ON TABLE public.external_accounts TO auth_app",
    );
  });
});
