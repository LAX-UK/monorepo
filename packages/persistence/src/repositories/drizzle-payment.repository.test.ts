import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { DrizzlePaymentRepository, adminTableWhere } from "./drizzle-payment.repository.js";

describe("DrizzlePaymentRepository", () => {
  it("writes stripeChargeId when creating a captured payment row", async () => {
    const values = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: "00000000-0000-4000-8000-000000000001",
          lotId: "00000000-0000-4000-8000-000000000002",
          buyerId: "buyer-1",
          buyerLegalEntityId: "00000000-0000-4000-8000-000000000003",
          sellerLegalEntityId: "00000000-0000-4000-8000-000000000004",
          amount: "125.00",
          platformFee: "6.25",
          stripePaymentIntentId: "pi_test",
          stripeChargeId: "ch_test",
          status: "captured",
          createdAt: new Date(),
        },
      ]),
    });
    const db = {
      insert: vi.fn().mockReturnValue({ values }),
    } as unknown as Database;
    const repo = new DrizzlePaymentRepository(db);

    const created = await repo.create({
      lotId: "00000000-0000-4000-8000-000000000002",
      paidByUserId: "buyer-1",
      buyerLegalEntityId: "00000000-0000-4000-8000-000000000003",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000004",
      amount: "125.00",
      platformFee: "6.25",
      stripePaymentIntentId: "pi_test",
      stripeChargeId: "ch_test",
      status: "captured",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        stripePaymentIntentId: "pi_test",
        stripeChargeId: "ch_test",
        status: "captured",
      }),
    );
    expect(created.stripeChargeId).toBe("ch_test");
  });

  it("can persist the charge id after capture", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const db = {
      update: vi.fn().mockReturnValue({ set }),
    } as unknown as Database;
    const repo = new DrizzlePaymentRepository(db);

    await repo.updateStripeChargeId("00000000-0000-4000-8000-000000000001", "ch_captured");

    expect(db.update).toHaveBeenCalledWith(payment);
    expect(set).toHaveBeenCalledWith({ stripeChargeId: "ch_captured" });
    expect(where).toHaveBeenCalled();
  });

  it("applyAuthorizedInTransaction only moves pending to authorized", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "pay-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const tx = {
      update: vi.fn().mockReturnValue({ set }),
    } as unknown as Database;
    const repo = new DrizzlePaymentRepository({} as Database);

    const ok = await repo.applyAuthorizedInTransaction(tx, "pay-1");
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith({ status: "authorized" });
  });

  it("applyCancelledInTransaction only cancels pending or authorized rows", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "pay-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const tx = {
      update: vi.fn().mockReturnValue({ set }),
    } as unknown as Database;
    const repo = new DrizzlePaymentRepository({} as Database);

    const ok = await repo.applyCancelledInTransaction(tx, "pay-1");
    expect(ok).toBe(true);
    expect(set).toHaveBeenCalledWith({ status: "cancelled" });
  });
});

describe("adminTableWhere", () => {
  it("returns no condition without a status or search term", () => {
    expect(adminTableWhere({})).toBeUndefined();
    expect(adminTableWhere({ q: "   " })).toBeUndefined();
  });

  it("casts the uuid id and the enum fulfilment status to text before ilike", () => {
    const where = adminTableWhere({ q: "zzzz-no-match" });
    const query = new PgDialect().sqlToQuery(where as never);
    expect(query.sql).toContain('"payment"."id"::text ilike');
    expect(query.sql).toContain('"lot_fulfilment"."status"::text ilike');
    expect(query.sql).not.toMatch(/"payment"\."id" ilike/);
    expect(query.sql).not.toMatch(/"lot_fulfilment"\."status" ilike/);
    expect(query.params).toEqual(Array(6).fill("%zzzz-no-match%"));
  });

  it("combines the status filter with the search term", () => {
    const query = new PgDialect().sqlToQuery(
      adminTableWhere({ status: "captured", q: "abc" }) as never,
    );
    expect(query.sql).toContain('"payment"."status" = $1');
    expect(query.params[0]).toBe("captured");
  });
});
