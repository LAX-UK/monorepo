import { describe, expect, it, vi } from "vitest";
import { AccountPasswordService } from "./account-password.service.js";
import {
  IdentityOperationError,
  type IdentityOperationErrorCode,
  type IdentitySession,
} from "./identity-operations.service.js";

const NOW = new Date("2026-11-02T12:00:00.000Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";

function session(overrides: Partial<IdentitySession> & { id: string }): IdentitySession {
  return {
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: new Date(NOW.getTime() - 30_000),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ipAddress: "203.0.113.9",
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
    lastPasswordAuthAt: null,
    lastActiveAt: new Date(NOW.getTime() - 30_000),
    signedInAt: new Date(NOW.getTime() - 60_000),
    isStaff: false,
    previousIds: [],
    isCurrent: false,
    ...overrides,
  };
}

const fresh = session({ id: "current" });
const stale = session({ id: "current", createdAt: new Date(NOW.getTime() - 10 * 60_000) });
const input = { currentPassword: "Current-password-1", newPassword: "A-better-passphrase-2" };

function setup(sessions: IdentitySession[], change?: () => Promise<unknown>) {
  const operations = {
    listSessions: vi.fn().mockResolvedValue(sessions),
    changeAccountPassword: vi.fn(
      change ?? (async () => ({ created: false, revokedSessionIds: ["other-1"] })),
    ),
  };
  const durable = { settle: vi.fn(async () => undefined) };
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new AccountPasswordService(
    { operations: operations as never, durable, notices },
    () => NOW,
  );
  return { service, operations, durable, notices };
}

describe("AccountPasswordService.change", () => {
  it("changes the password, keeps this sign-in and ends every other one", async () => {
    const { service, operations, durable } = setup([fresh]);

    expect(await service.change(SUBJECT, "current", input)).toEqual({ ok: true, created: false });

    expect(operations.changeAccountPassword).toHaveBeenCalledWith(SUBJECT, {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      keepSessionId: "current",
    });
    expect(durable.settle).toHaveBeenCalledWith("account-password", {
      kind: "revoke_tokens_except_session",
      userId: SUBJECT,
      keepSessionId: "current",
    });
  });

  it("emails the person after the change, naming the browser and never the password", async () => {
    const { service, notices } = setup([fresh]);
    await service.change(SUBJECT, "current", input);

    expect(notices.notify).toHaveBeenCalledWith({
      kind: "password_changed",
      userId: SUBJECT,
      at: NOW,
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
    });
    expect(JSON.stringify(notices.notify.mock.calls)).not.toContain(input.newPassword);
  });

  it("reports that a first password was created for a social-only account", async () => {
    const { service, operations } = setup([fresh], async () => ({
      created: true,
      revokedSessionIds: [],
    }));
    expect(
      await service.change(SUBJECT, "current", { currentPassword: null, newPassword: "x" }),
    ).toEqual({
      ok: true,
      created: true,
    });
    expect(operations.changeAccountPassword).toHaveBeenCalledWith(
      SUBJECT,
      expect.objectContaining({ currentPassword: null }),
    );
  });

  it("needs a recent sign-in: a stale session changes nothing and says nothing", async () => {
    const { service, operations, durable, notices } = setup([stale]);
    expect(await service.change(SUBJECT, "current", input)).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(operations.changeAccountPassword).not.toHaveBeenCalled();
    expect(durable.settle).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("refuses a session id that is not one of the person's live sessions", async () => {
    const { service, operations } = setup([fresh]);
    expect(await service.change(SUBJECT, "someone-elses", input)).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(operations.changeAccountPassword).not.toHaveBeenCalled();
  });

  it.each<IdentityOperationErrorCode>([
    "invalid_password",
    "invalid_password_policy",
    "password_breached",
    "same_password",
  ])("reports %s and leaves sessions and the inbox alone", async (code) => {
    const { service, durable, notices } = setup([fresh], async () => {
      throw new IdentityOperationError(code);
    });
    expect(await service.change(SUBJECT, "current", input)).toEqual({ ok: false, kind: code });
    expect(durable.settle).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("lets an unexpected failure through rather than reporting a false success", async () => {
    const { service, notices } = setup([fresh], async () => {
      throw new Error("db down");
    });
    await expect(service.change(SUBJECT, "current", input)).rejects.toThrow("db down");
    expect(notices.notify).not.toHaveBeenCalled();
  });
});
