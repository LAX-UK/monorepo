import { describe, expect, it, vi } from "vitest";
import { AccountContactService } from "./account-contact.service.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-23T12:00:00.000Z");

function session(id: string, createdAt: Date) {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ipAddress: null,
    userAgent: null,
    lastPasswordAuthAt: null,
    isCurrent: false,
  };
}

function setup(sessionCreatedAt = new Date(NOW.getTime() - 60_000)) {
  const operations = {
    readSubject: vi.fn(async () => ({
      id: SUBJECT,
      email: "ada@example.com",
      name: "Ada",
      emailVerified: true,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    })),
    readSecurityStatus: vi.fn(async () => ({
      twoFactorEnabled: false,
      phoneNumber: "+447700900123",
      phoneNumberVerified: true,
      pendingNewEmail: "next@example.com",
      emailChangeExpiresAt: null,
    })),
    listSessions: vi.fn(async () => [session("current", sessionCreatedAt)]),
  };
  const emailChange = {
    start: vi.fn(async () => ({ ok: true as const, pendingEmail: "next@example.com" })),
    cancel: vi.fn(async () => ({ ok: true as const })),
  };
  const service = new AccountContactService(
    { operations: operations as never, emailChange },
    () => NOW,
  );
  return { service, operations, emailChange };
}

describe("AccountContactService", () => {
  it("reads the live contact details", async () => {
    const { service } = setup();
    expect(await service.read(SUBJECT)).toEqual({
      email: "ada@example.com",
      emailVerified: true,
      pendingEmail: "next@example.com",
      phone: "+447700900123",
      phoneVerified: true,
    });
  });

  it("reads nothing for an unknown person", async () => {
    const { service, operations } = setup();
    operations.readSubject.mockResolvedValueOnce(null as never);
    expect(await service.read(SUBJECT)).toBeNull();
  });

  it("starts an email change for the account channel after a recent sign-in", async () => {
    const { service, emailChange } = setup();
    const result = await service.startEmailChange(SUBJECT, "current", "next@example.com");
    expect(result).toEqual({ ok: true, pendingEmail: "next@example.com" });
    expect(emailChange.start).toHaveBeenCalledWith(SUBJECT, "next@example.com", "account");
  });

  it.each([
    ["a sign-in older than the step-up window", "current", new Date(NOW.getTime() - 3_600_000)],
    [
      "a sign-in that is not one of the person's own",
      "someone-elses",
      new Date(NOW.getTime() - 1_000),
    ],
  ])("asks to sign in again for %s", async (_label, sid, createdAt) => {
    const { service, emailChange } = setup(createdAt);
    expect(await service.startEmailChange(SUBJECT, sid, "next@example.com")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(emailChange.start).not.toHaveBeenCalled();
  });

  it("cancels with any live sign-in, even an old one", async () => {
    const { service, emailChange } = setup(new Date(NOW.getTime() - 3_600_000));
    expect(await service.cancelEmailChange(SUBJECT, "current")).toEqual({ ok: true });
    expect(emailChange.cancel).toHaveBeenCalledWith(SUBJECT);
  });

  it("does not cancel for a sign-in that is not live", async () => {
    const { service, emailChange } = setup();
    expect(await service.cancelEmailChange(SUBJECT, "unknown")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(emailChange.cancel).not.toHaveBeenCalled();
  });
});
