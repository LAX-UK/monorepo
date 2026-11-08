import { describe, expect, it, vi } from "vitest";
import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import {
  AdminStaffEmailChangeService,
  STAFF_EMAIL_CHANGE_CANCEL_REQUESTED_EVENT,
  STAFF_EMAIL_CHANGE_KYC_VIEWED_EVENT,
  STAFF_EMAIL_CHANGE_REQUESTED_EVENT,
  type StaffEmailChangeActor,
} from "./admin-staff-email-change.service.js";

const TARGET_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const REASON = "Lost the old mailbox; caller matched the KYC record on a call.";

const ADMIN: StaffEmailChangeActor = {
  userId: "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14",
  role: "staff",
  staffRoles: ["administrator"],
};
const SUPPORT: StaffEmailChangeActor = {
  userId: "c8d0f3e1-5a27-4b69-9e14-7f2a6c8d0b35",
  role: "staff",
  staffRoles: ["client_services"],
};

const KYC_SESSION = {
  id: "kyc-verified",
  status: "verified",
  verifiedFirstName: "Ada",
  verifiedLastName: "Lovelace",
  verifiedDateOfBirth: "1990-12-10",
  decisionAt: new Date("2026-05-01T10:00:00.000Z"),
};

const KYC_BODY = {
  newEmail: "new@example.com",
  reason: REASON,
  proof: { kind: "kyc_match", kycSessionId: "kyc-verified" },
} as const;
const ID_BODY = {
  newEmail: "new@example.com",
  reason: REASON,
  proof: { kind: "id_check", reference: "IDV-2291" },
} as const;

function setup(
  options: {
    target?: { role: string } | null;
    sessions?: Record<string, unknown>[];
  } = {},
) {
  const identity = {
    startStaffAssistedEmailChange: vi.fn().mockResolvedValue({ pendingEmail: "new@example.com" }),
    cancelStaffAssistedEmailChange: vi.fn().mockResolvedValue(undefined),
  };
  const users = {
    getById: vi.fn().mockResolvedValue("target" in options ? options.target : { role: "client" }),
  };
  const kyc = { listSessionsForUser: vi.fn().mockResolvedValue(options.sessions ?? [KYC_SESSION]) };
  const audit = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminStaffEmailChangeService({
    identity,
    users: users as never,
    kyc: kyc as never,
    audit,
  });
  return { service, identity, users, kyc, audit };
}

describe("AdminStaffEmailChangeService.change", () => {
  it("records who moved whose account, why and on what proof, then asks Identity", async () => {
    const { service, identity, audit } = setup();
    const result = await service.change(SUPPORT, TARGET_ID, KYC_BODY);

    expect(result._unsafeUnwrap()).toEqual({ pendingEmail: "new@example.com" });
    expect(audit.publish).toHaveBeenCalledWith({
      eventType: STAFF_EMAIL_CHANGE_REQUESTED_EVENT,
      aggregateType: "user",
      aggregateId: TARGET_ID,
      actorUserId: SUPPORT.userId,
      payload: { reason: REASON, proofKind: "kyc_match", kycSessionId: "kyc-verified" },
    });
    expect(identity.startStaffAssistedEmailChange).toHaveBeenCalledWith({
      subjectId: TARGET_ID,
      newEmail: "new@example.com",
      actorUserId: SUPPORT.userId,
      reason: REASON,
      proof: KYC_BODY.proof,
    });
    expect(audit.publish.mock.invocationCallOrder[0]).toBeLessThan(
      identity.startStaffAssistedEmailChange.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("keeps the addresses out of the audit entry", async () => {
    const { service, audit } = setup();
    await service.change(ADMIN, TARGET_ID, ID_BODY);
    expect(JSON.stringify(audit.publish.mock.calls)).not.toContain("example.com");
  });

  it("records the reference of a fresh ID check", async () => {
    const { service, identity, audit } = setup({ sessions: [] });
    const result = await service.change(SUPPORT, TARGET_ID, ID_BODY);
    expect(result.isOk()).toBe(true);
    expect(audit.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { reason: REASON, proofKind: "id_check", proofReference: "IDV-2291" },
      }),
    );
    expect(identity.startStaffAssistedEmailChange).toHaveBeenCalled();
  });

  it.each([
    ["a fulfilment member", { userId: "f", role: "staff", staffRoles: ["fulfilment"] }],
    ["a finance member", { userId: "g", role: "staff", staffRoles: ["finance"] }],
    ["a read-only member", { userId: "h", role: "staff", staffRoles: ["read_only"] }],
    ["a client", { userId: "i", role: "client", staffRoles: [] }],
  ] as [string, StaffEmailChangeActor][])("refuses %s", async (_name, actor) => {
    const { service, identity, audit } = setup();
    const result = await service.change(actor, TARGET_ID, ID_BODY);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 403 });
    expect(audit.publish).not.toHaveBeenCalled();
    expect(identity.startStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("refuses staff changing their own address", async () => {
    const { service, identity } = setup();
    const result = await service.change(ADMIN, ADMIN.userId, ID_BODY);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 403 });
    expect(identity.startStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("lets only an Administrator move a staff account", async () => {
    const forSupport = setup({ target: { role: "staff" } });
    expect(
      (await forSupport.service.change(SUPPORT, TARGET_ID, ID_BODY))._unsafeUnwrapErr(),
    ).toMatchObject({ status: 403 });
    const forAdmin = setup({ target: { role: "staff" } });
    expect((await forAdmin.service.change(ADMIN, TARGET_ID, ID_BODY)).isOk()).toBe(true);
  });

  it("answers 404 for a person who does not exist", async () => {
    const { service, audit } = setup({ target: null });
    expect((await service.change(SUPPORT, TARGET_ID, ID_BODY))._unsafeUnwrapErr()).toMatchObject({
      status: 404,
    });
    expect(audit.publish).not.toHaveBeenCalled();
  });

  it("will not accept a KYC match with no verified record to match", async () => {
    const { service, identity, audit } = setup({
      sessions: [{ ...KYC_SESSION, status: "processing" }],
    });
    const result = await service.change(SUPPORT, TARGET_ID, KYC_BODY);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 422 });
    expect(audit.publish).not.toHaveBeenCalled();
    expect(identity.startStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("will not accept a KYC match naming a record that is not theirs", async () => {
    const { service, identity } = setup();
    const result = await service.change(SUPPORT, TARGET_ID, {
      ...KYC_BODY,
      proof: { kind: "kyc_match", kycSessionId: "someone-elses" },
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 422 });
    expect(identity.startStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it.each([
    ["email_taken", 409],
    ["same_email", 409],
    ["subject_not_found", 404],
  ])("maps Identity's %s to %i", async (code, status) => {
    const { service, identity } = setup();
    identity.startStaffAssistedEmailChange.mockRejectedValueOnce(
      new IdentityIssuerClientError("http", "refused", status, code),
    );
    expect((await service.change(SUPPORT, TARGET_ID, ID_BODY))._unsafeUnwrapErr()).toMatchObject({
      status,
    });
  });

  it("reports an outage as a bad gateway rather than leaking the cause", async () => {
    const { service, identity } = setup();
    identity.startStaffAssistedEmailChange.mockRejectedValueOnce(
      new IdentityIssuerClientError("network", "connect ECONNREFUSED 10.0.0.4"),
    );
    const error = (await service.change(SUPPORT, TARGET_ID, ID_BODY))._unsafeUnwrapErr();
    expect(error.status).toBe(502);
    expect(error.message).not.toContain("10.0.0.4");
  });
});

describe("AdminStaffEmailChangeService.kycRecord", () => {
  it("returns only the verified name and date of birth, and records that it was shown", async () => {
    const { service, audit } = setup();
    const result = await service.kycRecord(SUPPORT, TARGET_ID);
    expect(result._unsafeUnwrap()).toEqual({
      sessionId: "kyc-verified",
      firstName: "Ada",
      lastName: "Lovelace",
      dateOfBirth: "1990-12-10",
      verifiedAt: "2026-05-01T10:00:00.000Z",
    });
    expect(audit.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: STAFF_EMAIL_CHANGE_KYC_VIEWED_EVENT,
        actorUserId: SUPPORT.userId,
        payload: { kycSessionId: "kyc-verified" },
      }),
    );
  });

  it("returns null, and records nothing, when there is no verified record", async () => {
    const { service, audit } = setup({ sessions: [] });
    expect((await service.kycRecord(SUPPORT, TARGET_ID))._unsafeUnwrap()).toBeNull();
    expect(audit.publish).not.toHaveBeenCalled();
  });

  it("shows nothing to a role that may not change an email", async () => {
    const { service, kyc } = setup();
    const result = await service.kycRecord(
      { userId: "f", role: "staff", staffRoles: ["fulfilment"] },
      TARGET_ID,
    );
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 403 });
    expect(kyc.listSessionsForUser).not.toHaveBeenCalled();
  });
});

describe("AdminStaffEmailChangeService.cancel", () => {
  const CANCEL = { reason: "Caller found the old mailbox again." };

  it("records who withdrew it and why, then asks Identity to clear the pending change", async () => {
    const { service, identity, audit } = setup();
    const result = await service.cancel(SUPPORT, TARGET_ID, CANCEL);

    expect(result._unsafeUnwrap()).toEqual({ cancelled: true });
    expect(audit.publish).toHaveBeenCalledWith({
      eventType: STAFF_EMAIL_CHANGE_CANCEL_REQUESTED_EVENT,
      aggregateType: "user",
      aggregateId: TARGET_ID,
      actorUserId: SUPPORT.userId,
      payload: { reason: CANCEL.reason },
    });
    expect(identity.cancelStaffAssistedEmailChange).toHaveBeenCalledWith({
      subjectId: TARGET_ID,
      actorUserId: SUPPORT.userId,
      reason: CANCEL.reason,
    });
    // The record is made before Identity acts, so there is never a cancellation without it.
    expect(audit.publish.mock.invocationCallOrder[0]).toBeLessThan(
      identity.cancelStaffAssistedEmailChange.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it.each([
    ["a fulfilment member", { userId: "f", role: "staff", staffRoles: ["fulfilment"] }],
    ["a finance member", { userId: "g", role: "staff", staffRoles: ["finance"] }],
    ["a read-only member", { userId: "h", role: "staff", staffRoles: ["read_only"] }],
    ["a client", { userId: "i", role: "client", staffRoles: [] }],
  ] as [string, StaffEmailChangeActor][])("refuses %s", async (_name, actor) => {
    const { service, identity, audit } = setup();
    const result = await service.cancel(actor, TARGET_ID, CANCEL);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 403 });
    expect(audit.publish).not.toHaveBeenCalled();
    expect(identity.cancelStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("refuses staff acting on their own account", async () => {
    const { service, identity } = setup();
    const result = await service.cancel(ADMIN, ADMIN.userId, CANCEL);
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 403 });
    expect(identity.cancelStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("lets only an Administrator act on a staff account", async () => {
    const { service, identity } = setup({ target: { role: "staff" } });
    expect((await service.cancel(SUPPORT, TARGET_ID, CANCEL))._unsafeUnwrapErr()).toMatchObject({
      status: 403,
    });
    expect(identity.cancelStaffAssistedEmailChange).not.toHaveBeenCalled();
    expect((await service.cancel(ADMIN, TARGET_ID, CANCEL)).isOk()).toBe(true);
  });

  it("answers 404 for a person who does not exist, and records nothing", async () => {
    const { service, audit, identity } = setup({ target: null });
    const result = await service.cancel(ADMIN, TARGET_ID, CANCEL);
    expect(result._unsafeUnwrapErr()).toEqual({ status: 404, message: "User not found" });
    expect(audit.publish).not.toHaveBeenCalled();
    expect(identity.cancelStaffAssistedEmailChange).not.toHaveBeenCalled();
  });

  it("says when nothing is waiting: already done, cancelled or lapsed", async () => {
    const { service, identity } = setup();
    identity.cancelStaffAssistedEmailChange.mockRejectedValueOnce(
      new IdentityIssuerClientError("http", "refused", 409, "none_in_progress"),
    );
    const error = (await service.cancel(ADMIN, TARGET_ID, CANCEL))._unsafeUnwrapErr();
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/No email change is waiting/);
  });

  it("reports an outage as a bad gateway rather than leaking the cause", async () => {
    const { service, identity } = setup();
    identity.cancelStaffAssistedEmailChange.mockRejectedValueOnce(new Error("socket hang up"));
    expect((await service.cancel(ADMIN, TARGET_ID, CANCEL))._unsafeUnwrapErr().status).toBe(502);
  });
});
