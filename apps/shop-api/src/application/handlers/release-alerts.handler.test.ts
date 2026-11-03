import { RELEASE_ALERT_CONSENT_TEXT } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import type { ReleaseAlertStore } from "../ports/release-alert.store.js";
import { createReleaseAlertHandlers } from "./release-alerts.handler.js";

const NOW = new Date("2026-11-02T12:00:00Z");

function store(overrides: Partial<ReleaseAlertStore> = {}): ReleaseAlertStore {
  return {
    requestConfirmation: vi.fn(async () => undefined),
    subscribeAccount: vi.fn(async () => "subscribed" as const),
    confirm: vi.fn(async () => "confirmed" as const),
    isConfirmed: vi.fn(async () => false),
    stopByEmail: vi.fn(async () => undefined),
    previewUnsubscribe: vi.fn(async () => null),
    unsubscribe: vi.fn(async () => true),
    ...overrides,
  };
}

function handlers(s: ReleaseAlertStore, accountEmail: string | null = "Ada@Example.com") {
  return createReleaseAlertHandlers({
    store: s,
    accountEmail: async () => accountEmail,
    now: () => NOW,
  });
}

describe("release alert handlers", () => {
  it("asks a visitor to confirm, with the consent text and the page they asked from", async () => {
    const s = store();
    const result = await handlers(s).subscribeGuest({ email: " Ada@Example.com ", source: "x" });
    expect(result).toBe("check_email");
    expect(s.requestConfirmation).toHaveBeenCalledWith({
      email: "ada@example.com",
      consent: { text: RELEASE_ALERT_CONSENT_TEXT, source: "x" },
      now: NOW,
    });
  });

  it("subscribes an account with its own normalised address and no confirmation", async () => {
    const s = store();
    const result = await handlers(s).subscribeAccount({ identitySubjectId: "sub-1" });
    expect(result).toBe("subscribed");
    expect(s.subscribeAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com", identitySubjectId: "sub-1" }),
    );
    expect(s.requestConfirmation).not.toHaveBeenCalled();
  });

  it("does nothing for an account with no address", async () => {
    const s = store();
    const h = handlers(s, null);
    expect(await h.subscribeAccount({ identitySubjectId: "sub-1" })).toBeNull();
    expect(await h.isSubscribed("sub-1")).toBe(false);
    await h.stopAccount("sub-1");
    expect(s.subscribeAccount).not.toHaveBeenCalled();
    expect(s.stopByEmail).not.toHaveBeenCalled();
  });

  it("reads and stops an account's subscription by its address", async () => {
    const s = store({ isConfirmed: vi.fn(async () => true) });
    const h = handlers(s);
    expect(await h.isSubscribed("sub-1")).toBe(true);
    expect(s.isConfirmed).toHaveBeenCalledWith("ada@example.com");
    await h.stopAccount("sub-1");
    expect(s.stopByEmail).toHaveBeenCalledWith("ada@example.com", NOW);
  });

  it("shows only a masked address on the stop page", async () => {
    const s = store({
      previewUnsubscribe: vi.fn(async () => ({ email: "ada@example.com", active: true })),
    });
    expect(await handlers(s).previewUnsubscribe("t")).toEqual({
      maskedEmail: "a•••@example.com",
      active: true,
    });
  });
});
