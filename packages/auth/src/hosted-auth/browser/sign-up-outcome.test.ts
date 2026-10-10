import { describe, expect, it } from "vitest";
import { isPasswordBreachedResponse, signUpOutcome } from "./sign-up-outcome.js";

describe("sign-up enumeration outcome", () => {
  it("makes success and existing-account 4xx indistinguishable when verification is required", () => {
    expect(signUpOutcome({ requireEmailVerification: true, status: 200 })).toBe("check-email");
    expect(signUpOutcome({ requireEmailVerification: true, status: 422 })).toBe("check-email");
  });

  it("surfaces breached passwords so the user can pick another one", () => {
    const data = { code: "PASSWORD_BREACHED", message: "PASSWORD_BREACHED" };
    expect(signUpOutcome({ requireEmailVerification: true, status: 400, data })).toBe(
      "password-breached",
    );
    expect(signUpOutcome({ requireEmailVerification: false, status: 400, data })).toBe(
      "password-breached",
    );
    expect(
      signUpOutcome({ requireEmailVerification: true, status: 422, data: { code: "OTHER" } }),
    ).toBe("check-email");
    expect(isPasswordBreachedResponse(500, data)).toBe(false);
  });

  it("keeps a generic error when verification is off or the issuer fails", () => {
    expect(signUpOutcome({ requireEmailVerification: false, status: 200 })).toBe("created");
    expect(signUpOutcome({ requireEmailVerification: false, status: 422 })).toBe("generic-error");
    expect(signUpOutcome({ requireEmailVerification: true, status: 500 })).toBe("generic-error");
  });
});
