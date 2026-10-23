import type { EmailEnqueueInput } from "@auction/auth";
import { describe, expect, it, vi } from "vitest";
import { verifyEmailChangeToken } from "../lib/email-change-token.js";
import { EmailChangeService } from "./email-change.service.js";
import { IdentityOperationError } from "./identity-operations.service.js";

const SECRET = "issuer-secret-for-tests-issuer-secret";
const NOW = new Date("2026-10-23T12:00:00.000Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";

function setup() {
  const operations = {
    readSubject: vi.fn(async () => ({
      id: SUBJECT,
      email: "Old@Example.com",
      name: "Ada",
      emailVerified: true,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    })),
    startEmailChange: vi.fn(async () => undefined),
    cancelEmailChange: vi.fn(async () => undefined),
    confirmEmailChange: vi.fn(async () => false),
  };
  const email = {
    enqueue: vi.fn<(input: EmailEnqueueInput) => Promise<{ outboxId: string }>>(async () => ({
      outboxId: "o1",
    })),
  };
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new EmailChangeService(
    {
      operations: operations as never,
      email,
      notices,
      authSecret: SECRET,
      confirmationPages: {
        account: "https://account.example/account/email-change",
        bid: "https://bid.example/dashboard/settings/account/confirm",
      },
    },
    () => NOW,
  );
  return { service, operations, email, notices };
}

function tokenFrom(url: unknown): string {
  return decodeURIComponent(new URL(String(url)).searchParams.get("t") ?? "");
}

describe("EmailChangeService.start", () => {
  it("stores the change and emails both inboxes a link to the channel's page", async () => {
    const { service, operations, email } = setup();
    const result = await service.start(SUBJECT, " New@Example.com ", "account");

    expect(result).toEqual({ ok: true, pendingEmail: "new@example.com" });
    expect(operations.startEmailChange).toHaveBeenCalledWith(
      SUBJECT,
      "new@example.com",
      new Date("2026-10-30T12:00:00.000Z"),
    );
    const sent = email.enqueue.mock.calls.map(([input]) => input);
    expect(sent.map((mail) => mail.to)).toEqual(["Old@Example.com", "new@example.com"]);
    for (const mail of sent) {
      expect(mail.template).toBe("change-email");
      const vars = mail.vars as unknown as { confirmationUrl: string };
      expect(
        vars.confirmationUrl.startsWith("https://account.example/account/email-change?t="),
      ).toBe(true);
    }
  });

  it("signs one link per inbox so each side confirms only its own", async () => {
    const { service, email } = setup();
    await service.start(SUBJECT, "new@example.com", "bid");
    const urls = email.enqueue.mock.calls.map(([input]) => String(input.vars.confirmationUrl));
    expect(urls[0]?.startsWith("https://bid.example/dashboard/settings/account/confirm?t=")).toBe(
      true,
    );
    const sides = urls.map(
      (url) => verifyEmailChangeToken(tokenFrom(url), SECRET, NOW)?.confirmFor,
    );
    expect(sides).toEqual(["old", "new"]);
  });

  it("refuses the current address without storing or emailing", async () => {
    const { service, operations, email } = setup();
    expect(await service.start(SUBJECT, "old@example.com", "account")).toEqual({
      ok: false,
      kind: "same_email",
    });
    expect(operations.startEmailChange).not.toHaveBeenCalled();
    expect(email.enqueue).not.toHaveBeenCalled();
  });

  it("reports an address another person holds, and sends nothing", async () => {
    const { service, operations, email } = setup();
    operations.startEmailChange.mockRejectedValueOnce(new IdentityOperationError("email_taken"));
    expect(await service.start(SUBJECT, "taken@example.com", "account")).toEqual({
      ok: false,
      kind: "email_taken",
    });
    expect(email.enqueue).not.toHaveBeenCalled();
  });

  it("reports an unknown subject", async () => {
    const { service, operations } = setup();
    operations.readSubject.mockResolvedValueOnce(null as never);
    expect(await service.start(SUBJECT, "new@example.com", "account")).toEqual({
      ok: false,
      kind: "subject_not_found",
    });
  });

  it("cannot start for a channel with no confirmation page", async () => {
    const operations = { readSubject: vi.fn() };
    const service = new EmailChangeService({
      operations: operations as never,
      email: { enqueue: vi.fn() },
      notices: { notify: vi.fn() },
      authSecret: SECRET,
      confirmationPages: { bid: "https://bid.example/confirm" },
    });
    expect(await service.start(SUBJECT, "new@example.com", "account")).toEqual({
      ok: false,
      kind: "channel_unavailable",
    });
    expect(operations.readSubject).not.toHaveBeenCalled();
  });

  it("lets an unexpected failure propagate", async () => {
    const { service, operations } = setup();
    operations.startEmailChange.mockRejectedValueOnce(new Error("database down"));
    await expect(service.start(SUBJECT, "new@example.com", "account")).rejects.toThrow(
      "database down",
    );
  });
});

describe("EmailChangeService.confirm", () => {
  async function issuedToken(side: 0 | 1): Promise<string> {
    const { service, email } = setup();
    await service.start(SUBJECT, "new@example.com", "account");
    return tokenFrom(email.enqueue.mock.calls[side]?.[0].vars.confirmationUrl);
  }

  it("applies the confirmation named by the token", async () => {
    const token = await issuedToken(1);
    const { service, operations, notices } = setup();
    operations.confirmEmailChange.mockResolvedValueOnce(true as never);
    expect(await service.confirm(token)).toEqual({
      ok: true,
      subjectId: SUBJECT,
      completed: true,
      confirmedFor: "new",
    });
    expect(operations.confirmEmailChange).toHaveBeenCalledWith({
      subjectId: SUBJECT,
      oldEmail: "Old@Example.com",
      newEmail: "new@example.com",
      confirmFor: "new",
    });
    expect(notices.notify).toHaveBeenCalledWith({
      kind: "email_changed",
      userId: SUBJECT,
      at: NOW,
      previousEmail: "Old@Example.com",
      newEmail: "new@example.com",
    });
  });

  it("does not announce a change that still waits for the other inbox", async () => {
    const token = await issuedToken(0);
    const { service, operations, notices } = setup();
    operations.confirmEmailChange.mockResolvedValueOnce(false as never);
    await service.confirm(token);
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("is not complete after the first inbox", async () => {
    const token = await issuedToken(0);
    const { service } = setup();
    expect(await service.confirm(token)).toMatchObject({
      ok: true,
      completed: false,
      confirmedFor: "old",
    });
  });

  it("rejects a forged token without touching storage", async () => {
    const { service, operations } = setup();
    expect(await service.confirm("forged.token")).toEqual({ ok: false, kind: "invalid_token" });
    expect(operations.confirmEmailChange).not.toHaveBeenCalled();
  });

  it.each(["stale_flow", "expired", "email_taken", "subject_not_found"] as const)(
    "maps the %s outcome",
    async (code) => {
      const token = await issuedToken(0);
      const { service, operations } = setup();
      operations.confirmEmailChange.mockRejectedValueOnce(new IdentityOperationError(code));
      expect(await service.confirm(token)).toEqual({ ok: false, kind: code });
    },
  );
});

describe("EmailChangeService.cancel", () => {
  it("cancels a change in progress", async () => {
    const { service, operations } = setup();
    expect(await service.cancel(SUBJECT)).toEqual({ ok: true });
    expect(operations.cancelEmailChange).toHaveBeenCalledWith(SUBJECT);
  });

  it("says when there is nothing to cancel", async () => {
    const { service, operations } = setup();
    operations.cancelEmailChange.mockRejectedValueOnce(
      new IdentityOperationError("none_in_progress"),
    );
    expect(await service.cancel(SUBJECT)).toEqual({ ok: false, kind: "none_in_progress" });
  });
});
