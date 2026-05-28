import { describe, expect, it } from "vitest";
import { mapKycSessionStartError } from "./kyc-session-errors";

describe("mapKycSessionStartError", () => {
  it("maps known string error codes", () => {
    expect(mapKycSessionStartError("kyc_not_configured", 503)).toContain("temporarily unavailable");
    expect(mapKycSessionStartError("kyc_already_approved", 409)).toContain("already verified");
  });

  it("returns a string for Zod-shaped validation errors", () => {
    const zodLike = { name: "ZodError", issues: [{ message: "Invalid url" }] };
    const message = mapKycSessionStartError(zodLike, 400);
    expect(typeof message).toBe("string");
    expect(message).toContain("Could not start verification");
  });

  it("maps API string validation messages on 400 to friendly KYC copy", () => {
    expect(mapKycSessionStartError("Invalid url", 400)).toContain("Could not start verification");
  });
});
