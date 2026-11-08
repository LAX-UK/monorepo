import { describe, expect, it } from "vitest";
import { accountButtonView } from "./account-button.vm";

const person = { initials: "OG", name: "Oliver Grant" };

describe("accountButtonView", () => {
  it("shows an organisation as its tile with the person's initials as a badge", () => {
    expect(
      accountButtonView(
        { kind: "organisation", name: "Northbank Gallery", detail: "Owner", initials: "NG" },
        person,
      ),
    ).toEqual({
      kind: "organisation",
      tileInitials: "NG",
      badgeInitials: "OG",
      label: "Your accounts, acting as Northbank Gallery",
      title: "Northbank Gallery",
      caption: "Oliver Grant · Owner",
    });
  });

  it("shows the personal account as a round avatar with the word Personal", () => {
    expect(
      accountButtonView(
        { kind: "personal", name: "Personal", detail: "Oliver Grant", initials: "OG" },
        person,
      ),
    ).toEqual({
      kind: "personal",
      avatarInitials: "OG",
      text: "Personal",
      label: "Your accounts, Oliver Grant, Personal",
      title: "Oliver Grant",
      caption: "Personal",
    });
  });
});
