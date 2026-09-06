import type { IdentityDatabase } from "@auction/identity-db";
import { describe, expect, it, vi } from "vitest";
import { createPasswordResetSessionRevoker } from "./create-auth-issuer.js";

function setup(publish = vi.fn(async () => undefined)) {
  const returning = vi.fn(async () => [{ id: "session-1" }, { id: "session-2" }]);
  const where = vi.fn(() => ({ returning }));
  const transaction = { delete: vi.fn(() => ({ where })) };
  const db = {
    transaction: vi.fn(async (operation: (tx: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  } as unknown as IdentityDatabase;
  const logout = { revokeSubject: vi.fn(async () => 2) };
  const revoke = createPasswordResetSessionRevoker({
    db,
    logout,
    identityEventPublisher: { publish },
  });
  return { db, logout, publish, revoke, transaction };
}

describe("password-reset session revocation", () => {
  it("commits session deletion and the credential event before logout dispatch", async () => {
    const { logout, publish, revoke, transaction } = setup();

    await expect(revoke("subject-1")).resolves.toBe(2);

    expect(transaction.delete).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      {
        type: "user.credential_changed",
        userId: "subject-1",
        changeType: "update",
      },
      { transaction },
    );
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      logout.revokeSubject.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not dispatch logout when the state transaction fails", async () => {
    const { logout, revoke } = setup(vi.fn().mockRejectedValue(new Error("outbox unavailable")));

    await expect(revoke("subject-1")).rejects.toThrow("outbox unavailable");
    expect(logout.revokeSubject).not.toHaveBeenCalled();
  });
});
