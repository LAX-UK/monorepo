import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import { AccountDeletionPendingError } from "../errors/account-deletion-pending-error.js";
import { guardAgainstPendingDeletion } from "./guard-against-pending-deletion.js";

describe("guardAgainstPendingDeletion", () => {
  it("refuses a new order while a deletion request stands, and does not run the command", async () => {
    const command = vi.fn(async () => "order");
    const guarded = guardAgainstPendingDeletion(
      { requestedAt: async () => new Date("2026-11-02T10:00:00Z") },
      command,
    );

    const error = await guarded({ subject: "s1" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AccountDeletionPendingError);
    const refusal = error as AccountDeletionPendingError;
    expect(refusal.statusCode).toBe(403);
    expect(refusal.code).toBe(SHOP_API_ERROR_CODES.ACCOUNT_DELETION_PENDING);
    expect(refusal.message).toBe(
      "Your account is due to be deleted on 2 December. Cancel deletion to continue.",
    );
    expect(refusal.responseFields()).toEqual({ deletionDueAt: "2026-12-02T10:00:00.000Z" });
    expect(command).not.toHaveBeenCalled();
  });

  it("runs the command when there is no request", async () => {
    const command = vi.fn(async (input: { subject: string }) => `order for ${input.subject}`);
    const guarded = guardAgainstPendingDeletion({ requestedAt: async () => null }, command);

    await expect(guarded({ subject: "s1" })).resolves.toBe("order for s1");
    expect(command).toHaveBeenCalledOnce();
  });
});
