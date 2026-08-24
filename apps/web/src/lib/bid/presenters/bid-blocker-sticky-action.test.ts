import { describe, expect, it } from "vitest";
import { bidBlockerStickyAction, bidBlockerStickyLabel } from "./bid-blocker-sticky-action";

describe("bidBlockerStickyAction", () => {
  it("returns the presentation action for compact bars", () => {
    const action = bidBlockerStickyAction({
      tone: "info",
      title: "Sign in to bid",
      detail: "Use your account.",
      action: {
        kind: "link",
        href: "/login?next=%2Flot%2Fx",
        label: "Sign in to continue",
        shortLabel: "Sign in",
      },
    });
    expect(action).toMatchObject({ kind: "link", shortLabel: "Sign in" });
    expect(action && bidBlockerStickyLabel(action)).toBe("Sign in");
  });

  it("returns null when the presentation has no action", () => {
    expect(
      bidBlockerStickyAction({
        tone: "neutral",
        title: "Unavailable",
        detail: "Bidding is closed.",
      }),
    ).toBeNull();
  });
});
