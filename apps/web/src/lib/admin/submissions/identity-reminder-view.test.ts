import { describe, expect, it } from "vitest";
import { identityReminderView } from "./identity-reminder-view";

const now = new Date("2026-10-28T12:00:00Z");

describe("identityReminderView", () => {
  it("can send the first reminder", () => {
    expect(identityReminderView(undefined, now)).toEqual({ canSend: true, status: null });
    expect(identityReminderView({ lastSentAt: null, nextAllowedAt: null }, now)).toEqual({
      canSend: true,
      status: null,
    });
  });

  it("waits a day after the last one and says when", () => {
    const view = identityReminderView(
      {
        lastSentAt: new Date("2026-10-28T09:00:00Z"),
        nextAllowedAt: new Date("2026-10-29T09:00:00Z"),
      },
      now,
    );
    expect(view.canSend).toBe(false);
    expect(view.status).toMatch(/^Last reminded 28 Oct.*You can send another from 29 Oct/);
  });

  it("can send again once the day has passed", () => {
    const view = identityReminderView(
      {
        lastSentAt: new Date("2026-10-26T09:00:00Z"),
        nextAllowedAt: new Date("2026-10-27T09:00:00Z"),
      },
      now,
    );
    expect(view.canSend).toBe(true);
    expect(view.status).toMatch(/^Last reminded 26 Oct/);
  });
});
