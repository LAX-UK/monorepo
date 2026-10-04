import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0195-0201 contracts", () => {
  it("0195 adds refunded order statuses alone", async () => {
    const forward = await readFile(resolve(drizzle, "0195_shop_order_refunded_status.sql"), "utf8");
    expect(forward).toContain("partially_refunded");
    expect(forward).toContain("refunded");
    expect(forward).toContain("lock_timeout");
  });

  it("0196 adds payout ledger source FK check", async () => {
    const forward = await readFile(resolve(drizzle, "0196_shop_payout_ledger_sources.sql"), "utf8");
    expect(forward).toContain("shop_payout_ledger_source_fk_check");
    expect(forward).toContain("third_party_sale_id");
    expect(forward).toContain("original_sale_id");
  });

  it("0197 extends refund outbox columns", async () => {
    const forward = await readFile(resolve(drizzle, "0197_shop_refund_outbox.sql"), "utf8");
    expect(forward).toContain("shop_refund_stripe_refund_uid");
    expect(forward).toContain("submit_attempts");
    expect(forward).toContain("stripe_dashboard");
  });

  it("0198 creates shop_admin_command", async () => {
    const forward = await readFile(resolve(drizzle, "0198_shop_admin_command.sql"), "utf8");
    expect(forward).toContain("shop_admin_command");
    expect(forward).toContain("command_type");
    expect(forward).toContain("idempotency_key");
  });

  it("0199 adds phase uniqueness indexes with duplicate preflight", async () => {
    const forward = await readFile(resolve(drizzle, "0199_shop_phase_uniqueness.sql"), "utf8");
    expect(forward).toContain("0199_shop_phase_uniqueness");
    expect(forward).toContain("shop_third_party_sale_edition_open_uid");
    expect(forward).toContain("shop_original_sale_artwork_open_uid");
    expect(forward).toContain("shop_basket_line_variant_uid");
    expect(forward).toContain("lock_timeout");
  });

  it("0200 creates shop_identity_merge_inbox", async () => {
    const forward = await readFile(resolve(drizzle, "0200_shop_identity_merge_inbox.sql"), "utf8");
    expect(forward).toContain("shop_identity_merge_inbox");
    expect(forward).toContain("event_id");
    expect(forward).toContain("domain_events");
  });

  it("0201 scopes shop_admin_command primary key by actor", async () => {
    const forward = await readFile(
      resolve(drizzle, "0201_shop_admin_command_actor_scope.sql"),
      "utf8",
    );
    expect(forward).toContain("actor_subject_id");
    expect(forward).toContain("shop_admin_command_pkey");
  });
});
