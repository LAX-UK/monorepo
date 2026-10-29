import { ORGANISATION_ACCOUNT, PERSONAL_ACCOUNT } from "@/test/fake-account-directory";
import { describe, expect, it } from "vitest";
import { buildSwitchConfirmation } from "./switch-confirmation.vm";

describe("buildSwitchConfirmation", () => {
  it("names both accounts and the role before anything changes", () => {
    expect(
      buildSwitchConfirmation({
        requested: ORGANISATION_ACCOUNT,
        current: PERSONAL_ACCOUNT,
        personName: "Lena Fischer",
      }),
    ).toEqual({
      title: "Open this as Northbank Gallery?",
      description:
        "You're using LAX Bid as your personal account. The link you followed is for Northbank Gallery, where your role is Admin.",
      continueLabel: "Continue as Northbank Gallery",
      stayLabel: "Stay as Personal",
      tile: { kind: "organisation", initials: "NG" },
    });
  });

  it("asks before going back to the personal account too", () => {
    const confirmation = buildSwitchConfirmation({
      requested: PERSONAL_ACCOUNT,
      current: ORGANISATION_ACCOUNT,
      personName: "Lena Fischer",
    });
    expect(confirmation.title).toBe("Open this as Personal?");
    expect(confirmation.description).toBe(
      "You're using LAX Bid as Northbank Gallery. The link you followed is for your personal account.",
    );
    expect(confirmation.stayLabel).toBe("Stay as Northbank Gallery");
    expect(confirmation.tile).toEqual({ kind: "personal", initials: "LF" });
  });

  it("offers Home when the browser has no account in use yet", () => {
    const confirmation = buildSwitchConfirmation({
      requested: ORGANISATION_ACCOUNT,
      current: null,
      personName: "Lena Fischer",
    });
    expect(confirmation.description).toBe(
      "The link you followed is for Northbank Gallery, where your role is Admin.",
    );
    expect(confirmation.stayLabel).toBe("Go to Home");
  });
});
