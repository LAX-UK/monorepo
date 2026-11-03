import type { EmailEnqueueInput } from "@auction/auth";
import type { StaffEmailChangeRequest } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { verifyEmailChangeToken } from "../lib/email-change-token.js";
import { IdentityOperationError } from "./identity-operations.service.js";
import { StaffEmailChangeService } from "./staff-email-change.service.js";

const SECRET = "issuer-secret-for-tests-issuer-secret"; // gitleaks:allow
const NOW = new Date("2026-11-03T12:00:00.000Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";

const REQUEST: StaffEmailChangeRequest = {
  newEmail: "new@example.com",
  actorSubjectId: "staff-1",
  reason: "Lost the old mailbox; caller matched the KYC record.",
  proof: { kind: "kyc_match", kycSessionId: "kyc-1" },
};

function setup(overrides: { page?: string | undefined } = {}) {
  const calls: string[] = [];
  const operations = {
    readSubject: vi.fn(async () => ({
      id: SUBJECT,
      email: "Old@Example.com",
      name: "Ada",
      emailVerified: true,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    })),
    startStaffAssistedEmailChange: vi.fn(async () => {
      calls.push("start");
    }),
    cancelEmailChange: vi.fn(async () => {
      calls.push("cancel");
    }),
    revokeAllSessions: vi.fn(async () => {
      calls.push("revoke");
      return 3;
    }),
  };
  const email = {
    enqueue: vi.fn<(input: EmailEnqueueInput) => Promise<{ outboxId: string }>>(async (input) => {
      calls.push(`mail:${input.template}`);
      return { outboxId: "o1" };
    }),
  };
  const audit = vi.fn();
  const service = new StaffEmailChangeService(
    {
      operations: operations as never,
      email,
      authSecret: SECRET,
      confirmationPage:
        "page" in overrides ? overrides.page : "https://account.example/account/email-change",
      secureAccountUrl: "https://account.example/account/security",
      audit,
    },
    () => NOW,
  );
  return { service, operations, email, audit, calls };
}

describe("StaffEmailChangeService.start", () => {
  it("records the change with the old inbox vouched for by staff", async () => {
    const { service, operations } = setup();
    const result = await service.start(SUBJECT, REQUEST);
    expect(result).toEqual({ ok: true, pendingEmail: "new@example.com" });
    expect(operations.startStaffAssistedEmailChange).toHaveBeenCalledWith(
      SUBJECT,
      "new@example.com",
      new Date("2026-11-10T12:00:00.000Z"),
    );
  });

  it("revokes every session before either address is written to", async () => {
    const { service, operations, calls } = setup();
    await service.start(SUBJECT, REQUEST);
    expect(operations.revokeAllSessions).toHaveBeenCalledWith(SUBJECT);
    expect(calls).toEqual([
      "start",
      "revoke",
      "mail:staff-email-change-notice",
      "mail:staff-email-change-confirm",
    ]);
  });

  it("tells the old address what is happening and where the new one is", async () => {
    const { service, email } = setup();
    await service.start(SUBJECT, REQUEST);
    const notice = email.enqueue.mock.calls[0]?.[0];
    expect(notice?.to).toBe("Old@Example.com");
    expect(notice?.template).toBe("staff-email-change-notice");
    expect(notice?.vars).toMatchObject({
      newEmail: "new@example.com",
      secureAccountUrl: "https://account.example/account/security",
    });
  });

  it("sends the new address one link that confirms only the new inbox", async () => {
    const { service, email } = setup();
    await service.start(SUBJECT, REQUEST);
    const confirm = email.enqueue.mock.calls[1]?.[0];
    expect(confirm?.to).toBe("new@example.com");
    const url = String((confirm?.vars as { confirmationUrl: string }).confirmationUrl);
    expect(url.startsWith("https://account.example/account/email-change?t=")).toBe(true);
    const payload = verifyEmailChangeToken(
      decodeURIComponent(new URL(url).searchParams.get("t") ?? ""),
      SECRET,
      NOW,
    );
    expect(payload).toMatchObject({
      subjectId: SUBJECT,
      oldEmail: "Old@Example.com",
      newEmail: "new@example.com",
      confirmFor: "new",
    });
  });

  it("audits who did it, why and on what proof, and leaves the addresses out", async () => {
    const { service, audit } = setup();
    await service.start(SUBJECT, REQUEST);
    expect(audit).toHaveBeenCalledTimes(1);
    const [entry, message] = audit.mock.calls[0] ?? [];
    expect(message).toBe("staff_assisted_email_change_started");
    expect(entry).toEqual({
      subjectId: SUBJECT,
      actorSubjectId: "staff-1",
      reason: REQUEST.reason,
      proof: REQUEST.proof,
    });
  });

  it("cancels the pending change and audits nothing when sending fails", async () => {
    const { service, email, operations, audit } = setup();
    email.enqueue.mockRejectedValueOnce(new Error("outbox down"));
    await expect(service.start(SUBJECT, REQUEST)).rejects.toThrow("outbox down");
    expect(operations.cancelEmailChange).toHaveBeenCalledWith(SUBJECT);
    expect(audit).not.toHaveBeenCalled();
  });

  it("cancels the pending change when sessions cannot be revoked", async () => {
    const { service, operations, email } = setup();
    operations.revokeAllSessions.mockRejectedValueOnce(new Error("db down"));
    await expect(service.start(SUBJECT, REQUEST)).rejects.toThrow("db down");
    expect(operations.cancelEmailChange).toHaveBeenCalledWith(SUBJECT);
    expect(email.enqueue).not.toHaveBeenCalled();
  });

  it("refuses an address that is the account's own", async () => {
    const { service, operations } = setup();
    const result = await service.start(SUBJECT, { ...REQUEST, newEmail: "old@example.com" });
    expect(result).toEqual({ ok: false, kind: "same_email" });
    expect(operations.startStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("reports an address another account holds", async () => {
    const { service, operations, email } = setup();
    operations.startStaffAssistedEmailChange.mockRejectedValueOnce(
      new IdentityOperationError("email_taken"),
    );
    expect(await service.start(SUBJECT, REQUEST)).toEqual({ ok: false, kind: "email_taken" });
    expect(email.enqueue).not.toHaveBeenCalled();
  });

  it("reports an unknown account", async () => {
    const { service, operations } = setup();
    operations.readSubject.mockResolvedValueOnce(null as never);
    expect(await service.start(SUBJECT, REQUEST)).toEqual({
      ok: false,
      kind: "subject_not_found",
    });
  });

  it("cannot start without LAX Account's confirmation page", async () => {
    const { service, operations } = setup({ page: undefined });
    expect(await service.start(SUBJECT, REQUEST)).toEqual({
      ok: false,
      kind: "channel_unavailable",
    });
    expect(operations.startStaffAssistedEmailChange).not.toHaveBeenCalled();
  });
});
