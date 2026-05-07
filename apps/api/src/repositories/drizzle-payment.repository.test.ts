import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

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
});
