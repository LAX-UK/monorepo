import { describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { PayoutProblemNotifier } from "./payout-problem-notifier.js";

const payout = {
  id: "po1",
  legalEntityId: "org-1",
  status: "failed" as const,
  netAmount: "950.00",
  currency: "GBP",
};

describe("PayoutProblemNotifier", () => {
  it("tells everyone who reads the account's payouts, once per payout and status", async () => {
    const listUserIdsForAudience = vi.fn(async () => ["owner-1", "finance-1"]);
    const dispatch = vi.fn(async () => {});
    const notifier = new PayoutProblemNotifier(
      { listUserIdsForAudience },
      { dispatch },
      new NotificationFactory(),
    );

    await notifier.payoutProblem(payout);

    expect(listUserIdsForAudience).toHaveBeenCalledWith("org-1", "finance");
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith(
      "finance-1",
      expect.objectContaining({
        type: "payout_problem",
        meta: expect.objectContaining({
          outboxIdempotencyKey: "payout-problem:po1:failed:finance-1",
        }),
      }),
    );
  });

  it("never fails the payout change it reports", async () => {
    const notifier = new PayoutProblemNotifier(
      { listUserIdsForAudience: vi.fn(async () => ["owner-1"]) },
      { dispatch: vi.fn(async () => Promise.reject(new Error("down"))) },
      new NotificationFactory(),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifier.payoutProblem(payout)).resolves.toBeUndefined();
    error.mockRestore();
  });
});
