import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { assertSilverAcr } from "./acr-policy";

describe("assertSilverAcr", () => {
  it("accepts silver acr", () => {
    expect(() => assertSilverAcr(OIDC_ACR_SILVER)).not.toThrow();
  });

  it("rejects missing or weak acr", () => {
    expect(() => assertSilverAcr(undefined)).toThrow(/Silver MFA/);
    expect(() => assertSilverAcr("bronze")).toThrow(/Silver MFA/);
  });
});
