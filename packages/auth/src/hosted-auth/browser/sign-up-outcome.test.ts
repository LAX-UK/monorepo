import { describe, expect, it } from "vitest";
import { signUpOutcome } from "./sign-up-outcome.js";

describe("sign-up enumeration outcome", () => {
  it("makes success and existing-account 4xx indistinguishable when verification is required", () => {
    expect(signUpOutcome({ requireEmailVerification: true, status: 200 })).toBe("check-email");
    expect(signUpOutcome({ requireEmailVerification: true, status: 422 })).toBe("check-email");
  });

  it("keeps a generic error when verification is off or the issuer fails", () => {
    expect(signUpOutcome({ requireEmailVerification: false, status: 200 })).toBe("created");
    expect(signUpOutcome({ requireEmailVerification: false, status: 422 })).toBe("generic-error");
    expect(signUpOutcome({ requireEmailVerification: true, status: 500 })).toBe("generic-error");
  });
});
