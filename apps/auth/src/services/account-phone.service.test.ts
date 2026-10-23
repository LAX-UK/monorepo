import { InvalidPhoneNumberError, PhoneVerificationRateLimitedError } from "@auction/auth";
import type { EmailEnqueueInput } from "@auction/auth";
import { describe, expect, it, vi } from "vitest";
import { AccountPhoneService } from "./account-phone.service.js";
import { IdentityOperationError } from "./identity-operations.service.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const PHONE = "+447700900123";
const NOW = new Date("2026-10-23T12:00:00.000Z");

function setup(options: { recent?: boolean; configured?: boolean } = {}) {
  const createdAt = new Date(NOW.getTime() - (options.recent === false ? 3_600_000 : 60_000));
  const operations = {
    listSessions: vi.fn(async () => [
      {
        id: "current",
        createdAt,
        updatedAt: createdAt,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        lastPasswordAuthAt: null,
        isCurrent: true,
      },
    ]),
    readSubject: vi.fn(async () => ({
      id: SUBJECT,
      email: "ada@example.com",
      name: "Ada",
      emailVerified: true,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    })),
    setVerifiedPhone: vi.fn(async () => undefined),
  };
  const sms = {
    isConfigured: vi.fn(() => options.configured ?? true),
    sendOtp: vi.fn(async () => ({ sid: "sid" })),
    checkOtp: vi.fn(async () => ({ valid: true })),
  };
  const email = {
    enqueue: vi.fn<(input: EmailEnqueueInput) => Promise<{ outboxId: string }>>(async () => ({
      outboxId: "o1",
    })),
  };
  const onNoticeFailure = vi.fn();
  const service = new AccountPhoneService(
    { operations: operations as never, sms, email, onNoticeFailure },
    () => NOW,
  );
  return { service, operations, sms, email, onNoticeFailure };
}

describe("AccountPhoneService.sendCode", () => {
  it("sends a code to the number after a recent sign-in", async () => {
    const { service, sms } = setup();
    expect(await service.sendCode(SUBJECT, "current", PHONE)).toEqual({ ok: true });
    expect(sms.sendOtp).toHaveBeenCalledWith(PHONE, { ipAddress: undefined });
  });

  it("needs a recent sign-in before it spends an SMS", async () => {
    const { service, sms } = setup({ recent: false });
    expect(await service.sendCode(SUBJECT, "current", PHONE)).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it("is unavailable when no SMS provider is configured", async () => {
    const { service, sms } = setup({ configured: false });
    expect(await service.sendCode(SUBJECT, "current", PHONE)).toEqual({
      ok: false,
      kind: "unavailable",
    });
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it("maps the provider's rejection of the number and its own rate limit", async () => {
    const { service, sms } = setup();
    sms.sendOtp.mockRejectedValueOnce(new InvalidPhoneNumberError(PHONE));
    expect(await service.sendCode(SUBJECT, "current", PHONE)).toEqual({
      ok: false,
      kind: "invalid_phone",
    });
    sms.sendOtp.mockRejectedValueOnce(new PhoneVerificationRateLimitedError());
    expect(await service.sendCode(SUBJECT, "current", PHONE)).toEqual({
      ok: false,
      kind: "rate_limited",
    });
  });
});

describe("AccountPhoneService.verify", () => {
  it("saves the number as verified contact information and tells the account's email", async () => {
    const { service, operations, email } = setup();
    expect(await service.verify(SUBJECT, "current", PHONE, "123456")).toEqual({
      ok: true,
      phone: PHONE,
    });
    expect(operations.setVerifiedPhone).toHaveBeenCalledWith(SUBJECT, PHONE);
    expect(email.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com", template: "new-device-login" }),
    );
    expect(String(email.enqueue.mock.calls[0]?.[0].vars.deviceSummary)).not.toContain("7700900123");
  });

  it("saves nothing for a wrong code", async () => {
    const { service, sms, operations } = setup();
    sms.checkOtp.mockResolvedValueOnce({ valid: false });
    expect(await service.verify(SUBJECT, "current", PHONE, "000000")).toEqual({
      ok: false,
      kind: "invalid_code",
    });
    expect(operations.setVerifiedPhone).not.toHaveBeenCalled();
  });

  it("needs a recent sign-in before it checks the code", async () => {
    const { service, sms } = setup({ recent: false });
    expect(await service.verify(SUBJECT, "current", PHONE, "123456")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(sms.checkOtp).not.toHaveBeenCalled();
  });

  it("reports a number another person already holds", async () => {
    const { service, operations } = setup();
    operations.setVerifiedPhone.mockRejectedValueOnce(new IdentityOperationError("phone_taken"));
    expect(await service.verify(SUBJECT, "current", PHONE, "123456")).toEqual({
      ok: false,
      kind: "phone_taken",
    });
  });

  it("reports the provider's rate limit on checks", async () => {
    const { service, sms } = setup();
    sms.checkOtp.mockRejectedValueOnce(new PhoneVerificationRateLimitedError());
    expect(await service.verify(SUBJECT, "current", PHONE, "123456")).toEqual({
      ok: false,
      kind: "rate_limited",
    });
  });

  it("still succeeds when the notice email cannot be queued", async () => {
    const { service, email, onNoticeFailure } = setup();
    email.enqueue.mockRejectedValueOnce(new Error("outbox down"));
    expect(await service.verify(SUBJECT, "current", PHONE, "123456")).toEqual({
      ok: true,
      phone: PHONE,
    });
    expect(onNoticeFailure).toHaveBeenCalledTimes(1);
  });
});
