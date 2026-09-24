import { describe, expect, it } from "vitest";
import {
  IdentityRejectedError,
  IdentityUnavailableError,
  isIdentityRejected,
  isIdentityUnavailable,
  throwTokenEndpointFailure,
} from "../errors.js";

describe("identity-rp error taxonomy contract", () => {
  it("classifies unreachable issuer as unavailable", () => {
    expect(() => throwTokenEndpointFailure(null, "down")).toThrow(IdentityUnavailableError);
    expect(isIdentityUnavailable(new IdentityUnavailableError("down"))).toBe(true);
    expect(isIdentityRejected(new IdentityUnavailableError("down"))).toBe(false);
  });

  it("classifies 4xx as rejected and 5xx as unavailable", () => {
    expect(() => throwTokenEndpointFailure(401, "bad")).toThrow(IdentityRejectedError);
    expect(() => throwTokenEndpointFailure(503, "bad")).toThrow(IdentityUnavailableError);
  });

  it("classifies rate limits and timeouts as unavailable", () => {
    expect(() => throwTokenEndpointFailure(429, "limited")).toThrow(IdentityUnavailableError);
    expect(() => throwTokenEndpointFailure(408, "timeout")).toThrow(IdentityUnavailableError);
  });

  it("carries oauth error codes on rejected failures", () => {
    try {
      throwTokenEndpointFailure(400, "bad", "invalid_grant");
    } catch (error) {
      expect(error).toBeInstanceOf(IdentityRejectedError);
      expect((error as IdentityRejectedError).oauthError).toBe("invalid_grant");
    }
  });
});
