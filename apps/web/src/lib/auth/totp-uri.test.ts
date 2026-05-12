import { parseTotpSecretFromUri } from "@/lib/auth/totp-uri";
import { describe, expect, it } from "vitest";

describe("parseTotpSecretFromUri", () => {
  it("reads secret query param from otpauth URI", () => {
    const uri =
      "otpauth://totp/LAX:a%40b.com?secret=JBSWY3DPEHPK3PXP&issuer=LAX&algorithm=SHA1&digits=6&period=30";
    expect(parseTotpSecretFromUri(uri)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("returns null for invalid URI", () => {
    expect(parseTotpSecretFromUri("not-a-url")).toBeNull();
  });
});
