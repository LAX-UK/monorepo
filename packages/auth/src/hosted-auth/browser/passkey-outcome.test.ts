import { describe, expect, it } from "vitest";
import { failureFromBrowserError, failureFromResponse } from "./passkey-outcome.js";

describe("failureFromBrowserError", () => {
  it.each([
    [{ name: "NotAllowedError" }, "cancelled"],
    [{ name: "WebAuthnError", cause: { name: "NotAllowedError" } }, "cancelled"],
    [{ name: "AbortError" }, "cancelled"],
    [{ code: "ERROR_CEREMONY_ABORTED" }, "cancelled"],
    [{ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" }, "already_on_device"],
    [{ name: "InvalidStateError" }, "already_on_device"],
    [{ code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG" }, "unsupported"],
    [{ name: "NotSupportedError" }, "unsupported"],
    [{ name: "SecurityError" }, "unavailable"],
    [new Error("boom"), "unavailable"],
    [null, "unavailable"],
    ["text", "unavailable"],
  ])("reads %j as %s", (error, expected) => {
    expect(failureFromBrowserError(error)).toBe(expected);
  });
});

describe("failureFromResponse", () => {
  it.each([
    [429, {}, "rate_limited"],
    [403, { code: "passkey_user_verification_required" }, "not_verified"],
    [403, { code: "passkey_wrong_person" }, "wrong_person"],
    [422, { code: "passkey_limit" }, "limit"],
    [403, { code: "passkey_enrolment_not_allowed" }, "expired"],
    [401, { code: "UNAUTHORIZED" }, "expired"],
    [401, { code: "PASSKEY_NOT_FOUND" }, "not_recognised"],
    [400, { code: "CHALLENGE_NOT_FOUND" }, "unavailable"],
    [500, { code: "UNKNOWN" }, "unavailable"],
    [503, null, "unavailable"],
    [400, "text", "unavailable"],
  ])("reads %i %j as %s", (status, body, expected) => {
    expect(failureFromResponse(status, body)).toBe(expected);
  });

  it("takes the rate limit over any code in the body", () => {
    expect(failureFromResponse(429, { code: "passkey_wrong_person" })).toBe("rate_limited");
  });
});
