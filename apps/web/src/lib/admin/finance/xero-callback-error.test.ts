import { describe, expect, it } from "vitest";
import {
  XERO_CALLBACK_ERROR_MESSAGES,
  xeroCallbackErrorCodeForStatus,
  xeroCallbackErrorMessage,
} from "./xero-callback-error";

describe("xeroCallbackErrorCodeForStatus", () => {
  it.each([
    [401, "not_authorised"],
    [403, "not_authorised"],
    [400, "rejected"],
    [409, "rejected"],
    [422, "rejected"],
    [500, "unavailable"],
    [502, "unavailable"],
  ])("maps %s to %s", (status, code) => {
    expect(xeroCallbackErrorCodeForStatus(status)).toBe(code);
  });
});

describe("xeroCallbackErrorMessage", () => {
  it("returns the sentence for a known code", () => {
    expect(xeroCallbackErrorMessage("rejected")).toBe(XERO_CALLBACK_ERROR_MESSAGES.rejected);
  });

  it("shows nothing for no value", () => {
    expect(xeroCallbackErrorMessage(undefined)).toBeNull();
    expect(xeroCallbackErrorMessage("")).toBeNull();
  });

  it("never echoes a value that is not a known code", () => {
    const shown = xeroCallbackErrorMessage("Your account is locked, call 0123 456 789");
    expect(shown).toBe("Xero could not be connected.");
    expect(xeroCallbackErrorMessage("constructor")).toBe("Xero could not be connected.");
  });
});
