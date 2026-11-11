import { PASSKEY_NAME_INPUT_MAX_LENGTH, isValidPasskeyName } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { PASSKEY_NAME_LIMIT, isAcceptablePasskeyName } from "./passkey-name.js";

describe("the page's passkey name rule", () => {
  it("uses the issuer's length limit", () => {
    expect(PASSKEY_NAME_LIMIT).toBe(PASSKEY_NAME_INPUT_MAX_LENGTH);
  });

  it.each([
    "iCloud Keychain",
    "  Work laptop  ",
    "",
    "   ",
    "x".repeat(40),
    "x".repeat(41),
    "line\nbreak",
    "tab\there",
    "zero​width",
    "right‮to-left",
    "separator here",
    "Ünïcode name",
  ])("agrees with the issuer about %j", (name) => {
    expect(isAcceptablePasskeyName(name)).toBe(isValidPasskeyName(name));
  });
});
