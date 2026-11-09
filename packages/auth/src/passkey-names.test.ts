import { describe, expect, it } from "vitest";
import { SUGGESTED_PASSKEY_NAME_MAX_LENGTH, suggestPasskeyName } from "./passkey-names.js";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

describe("suggestPasskeyName", () => {
  it("names a well-known authenticator by what the person knows it as", () => {
    expect(suggestPasskeyName({ aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4" })).toBe(
      "Google Password Manager",
    );
    expect(suggestPasskeyName({ aaguid: "FBFC3007-154E-4ECC-8C0B-6E020557D7BD" })).toBe(
      "iCloud Keychain",
    );
    expect(suggestPasskeyName({ aaguid: "08987058-cadc-4b81-b6e1-30de50dcbe96" })).toBe(
      "Windows Hello",
    );
    expect(suggestPasskeyName({ aaguid: "bada5566-a7aa-401f-bd96-45619a55120d" })).toBe(
      "1Password",
    );
    expect(suggestPasskeyName({ aaguid: "d548826e-79b4-db40-a3d8-11116f7e8349" })).toBe(
      "Bitwarden",
    );
    expect(suggestPasskeyName({ aaguid: "2fc0579f-8113-47ea-b116-bb5a8db9202a" })).toBe(
      "Security key",
    );
  });

  it("falls back to the browser and system when the authenticator is unknown or reports no identity", () => {
    const none = "00000000-0000-0000-0000-000000000000";
    expect(suggestPasskeyName({ aaguid: none, userAgent: CHROME_MAC })).toBe(
      "Passkey on Chrome on macOS",
    );
    expect(suggestPasskeyName({ aaguid: "not-listed", userAgent: SAFARI_IPHONE })).toBe(
      "Passkey on Safari on iOS",
    );
    expect(suggestPasskeyName({ userAgent: EDGE_WINDOWS })).toBe("Passkey on Edge on Windows");
  });

  it("says just Passkey when nothing is known", () => {
    expect(suggestPasskeyName({})).toBe("Passkey");
    expect(suggestPasskeyName({ aaguid: null, userAgent: "curl/8" })).toBe("Passkey");
  });

  it("is never longer than the limit", () => {
    expect(suggestPasskeyName({ userAgent: CHROME_MAC }).length).toBeLessThanOrEqual(
      SUGGESTED_PASSKEY_NAME_MAX_LENGTH,
    );
  });
});
