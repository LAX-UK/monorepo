import { describe, expect, it } from "vitest";
import { pendingEmailChangeState } from "./pending-email-change.js";

const NOW = new Date("2026-11-03T12:00:00Z");
const later = new Date(NOW.getTime() + 60_000);
const earlier = new Date(NOW.getTime() - 60_000);

describe("pendingEmailChangeState", () => {
  it("is none without a pending address", () => {
    expect(
      pendingEmailChangeState({ pendingNewEmail: null, emailChangeExpiresAt: null }, NOW),
    ).toEqual({
      kind: "none",
    });
  });

  it("is waiting while the links are valid", () => {
    expect(
      pendingEmailChangeState({ pendingNewEmail: "n@x.co", emailChangeExpiresAt: later }, NOW),
    ).toEqual({ kind: "waiting", email: "n@x.co" });
  });

  it("is expired once the window has passed, including at the exact moment", () => {
    for (const at of [earlier, NOW]) {
      expect(
        pendingEmailChangeState({ pendingNewEmail: "n@x.co", emailChangeExpiresAt: at }, NOW),
      ).toEqual({ kind: "expired" });
    }
  });

  it("treats a row without an expiry as waiting", () => {
    expect(
      pendingEmailChangeState({ pendingNewEmail: "n@x.co", emailChangeExpiresAt: null }, NOW),
    ).toEqual({ kind: "waiting", email: "n@x.co" });
  });
});
