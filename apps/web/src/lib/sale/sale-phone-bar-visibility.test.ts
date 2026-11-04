import { describe, expect, it } from "vitest";
import { shouldShowSalePhoneBar } from "./sale-phone-bar-visibility";

describe("shouldShowSalePhoneBar", () => {
  it("waits until the page has been read", () => {
    expect(shouldShowSalePhoneBar({ heroActionsPresent: null, heroActionsOutOfView: false })).toBe(
      false,
    );
  });

  it("stays hidden while the hero actions are on screen", () => {
    expect(shouldShowSalePhoneBar({ heroActionsPresent: true, heroActionsOutOfView: false })).toBe(
      false,
    );
  });

  it("shows once the hero actions have scrolled out", () => {
    expect(shouldShowSalePhoneBar({ heroActionsPresent: true, heroActionsOutOfView: true })).toBe(
      true,
    );
  });

  it("shows at once when the page has no hero actions to stand in for", () => {
    expect(shouldShowSalePhoneBar({ heroActionsPresent: false, heroActionsOutOfView: false })).toBe(
      true,
    );
  });
});
