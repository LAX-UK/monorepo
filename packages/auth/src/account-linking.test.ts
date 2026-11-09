import { describe, expect, it, vi } from "vitest";
import { recordSignInMethodChange, shouldNotifySocialAccountLinked } from "./account-linking.js";

const AT = new Date("2026-11-09T12:00:00Z");

function ports() {
  return {
    notices: { notify: vi.fn(async () => undefined) },
    events: { publish: vi.fn(async () => undefined) },
  };
}

describe("recordSignInMethodChange: one audit event and one email", () => {
  it("records a provider being added: the event names only the method, the email names the method", async () => {
    const { notices, events } = ports();
    await recordSignInMethodChange({
      notices,
      events,
      userId: "u1",
      providerId: "google",
      change: "added",
      at: AT,
      providerEmail: "ada@example.com",
    });
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith({
      type: "user.sign_in_method_added",
      userId: "u1",
      method: "google",
    });
    expect(notices.notify).toHaveBeenCalledTimes(1);
    expect(notices.notify).toHaveBeenCalledWith({
      kind: "sign_in_method_added",
      userId: "u1",
      at: AT,
      method: "google",
      detail: "ada@example.com",
    });
  });

  it("records a provider being removed", async () => {
    const { notices, events } = ports();
    await recordSignInMethodChange({
      notices,
      events,
      userId: "u1",
      providerId: "apple",
      change: "removed",
      at: AT,
    });
    expect(events.publish).toHaveBeenCalledWith({
      type: "user.sign_in_method_removed",
      userId: "u1",
      method: "apple",
    });
    expect(notices.notify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "sign_in_method_removed", method: "apple", detail: null }),
    );
  });

  it("says nothing about the password account or any other provider", async () => {
    const { notices, events } = ports();
    for (const providerId of ["credential", "github"]) {
      await recordSignInMethodChange({
        notices,
        events,
        userId: "u1",
        providerId,
        change: "added",
      });
    }
    expect(events.publish).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("still sends the email when the event cannot be recorded, and never throws", async () => {
    const { notices, events } = ports();
    events.publish.mockRejectedValueOnce(new Error("outbox unavailable"));
    await expect(
      recordSignInMethodChange({
        notices,
        events,
        userId: "u1",
        providerId: "google",
        change: "added",
      }),
    ).resolves.toBeUndefined();
    expect(notices.notify).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no ports are wired", async () => {
    await expect(
      recordSignInMethodChange({ userId: "u1", providerId: "google", change: "added" }),
    ).resolves.toBeUndefined();
  });
});

describe("shouldNotifySocialAccountLinked", () => {
  it("treats the account row written with the user at sign-up as no later link", () => {
    expect(
      shouldNotifySocialAccountLinked({
        userCreatedAt: "2026-11-09T12:00:00Z",
        accountCreatedAt: "2026-11-09T12:00:01Z",
      }),
    ).toBe(false);
    expect(
      shouldNotifySocialAccountLinked({
        userCreatedAt: "2026-11-09T12:00:00Z",
        accountCreatedAt: "2026-11-10T12:00:00Z",
      }),
    ).toBe(true);
  });
});
