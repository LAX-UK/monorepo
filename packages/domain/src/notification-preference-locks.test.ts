import { describe, expect, it } from "vitest";
import {
  notificationPreferenceLocked,
  withLockedPreferencesOn,
} from "./notification-preference-locks.js";

describe("notification preference locks", () => {
  it("locks the emails that protect a bid or a payment", () => {
    expect(notificationPreferenceLocked("outbidEmail")).toBe(true);
    expect(notificationPreferenceLocked("wonEmail")).toBe(true);
    expect(notificationPreferenceLocked("outbidInApp")).toBe(false);
    expect(notificationPreferenceLocked("watchlistEmail")).toBe(false);
  });

  it("holds locked alerts on in a change and leaves the rest as asked", () => {
    expect(
      withLockedPreferencesOn({ outbidEmail: false, wonEmail: false, lostEmail: false }),
    ).toEqual({ outbidEmail: true, wonEmail: true, lostEmail: false });
  });

  it("adds nothing a change did not mention", () => {
    expect(withLockedPreferencesOn({ quietStart: "22:00" })).toEqual({ quietStart: "22:00" });
  });
});
