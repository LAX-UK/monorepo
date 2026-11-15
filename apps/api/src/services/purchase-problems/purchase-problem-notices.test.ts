import { describe, expect, it, vi } from "vitest";
import { EmailPurchaseProblemNotices } from "./purchase-problem-notices.js";

const PROBLEM_ID = "3f2a9c1e-7b4d-4e0a-9d1f-5c6b7a8e9f00";
const TX = {} as never;
const base = {
  problemId: PROBLEM_ID,
  lotId: "lot-1",
  lotTitle: "Pool study",
  reportedByUserId: "u-buyer" as string | null,
};

function setup(
  user: { name: string | null; email: string | null } | null = {
    name: "Ada",
    email: "ada@example.test",
  },
) {
  const enqueueInTransaction = vi.fn().mockResolvedValue({ outboxId: "o-1" });
  const findById = vi.fn().mockResolvedValue(user);
  const notices = new EmailPurchaseProblemNotices({
    usersFor: () => ({ findById }),
    email: { enqueueInTransaction },
    webOrigin: "https://lax.bid/",
    contactEmail: "info@lax.bid",
  });
  return { notices, enqueueInTransaction, findById };
}

describe("EmailPurchaseProblemNotices", () => {
  it("queues the confirmation to the reporter, keyed by the report", async () => {
    const { notices, enqueueInTransaction } = setup();
    await notices.queueReported(TX, { ...base, category: "damaged" });
    expect(enqueueInTransaction).toHaveBeenCalledWith(TX, {
      template: "bid-purchase-problem-received",
      to: "ada@example.test",
      userId: "u-buyer",
      category: "transactional",
      idempotencyKey: `bid-purchase-problem-received:${PROBLEM_ID}`,
      vars: {
        userName: "Ada",
        reference: "PR-3F2A9C1E",
        lotTitle: "Pool study",
        categoryLabel: "Damaged",
        purchaseUrl: "https://lax.bid/purchases/lot-1",
        contactEmail: "info@lax.bid",
      },
    });
  });

  it("queues the resolution, keyed by the report, without a category", async () => {
    const { notices, enqueueInTransaction } = setup();
    await notices.queueResolved(TX, base);
    const [, email] = enqueueInTransaction.mock.calls[0] ?? [];
    expect(email).toMatchObject({
      template: "bid-purchase-problem-resolved",
      idempotencyKey: `bid-purchase-problem-resolved:${PROBLEM_ID}`,
    });
    expect(email.vars).not.toHaveProperty("categoryLabel");
  });

  it("writes to nobody when the reporter is unknown, gone or has no address", async () => {
    const gone = setup(null);
    await gone.notices.queueResolved(TX, base);
    const blank = setup({ name: "Ada", email: null });
    await blank.notices.queueReported(TX, { ...base, category: "other" });
    const unknown = setup();
    await unknown.notices.queueResolved(TX, { ...base, reportedByUserId: null });
    expect(unknown.findById).not.toHaveBeenCalled();
    for (const run of [gone, blank, unknown]) {
      expect(run.enqueueInTransaction).not.toHaveBeenCalled();
    }
  });
});
