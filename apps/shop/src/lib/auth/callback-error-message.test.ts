import { describe, expect, it } from "vitest";
import { callbackErrorMessage } from "./callback-error-message.js";

describe("callbackErrorMessage", () => {
  it("maps known OIDC errors to shopper-friendly recovery copy", () => {
    expect(callbackErrorMessage("access_denied")).toContain("cancelled sign-in");
    expect(callbackErrorMessage("temporarily_unavailable")).toContain("temporarily unavailable");
  });

  it("does not expose unknown protocol error values", () => {
    const opaqueError = "provider_internal_code_493";
    expect(callbackErrorMessage(opaqueError)).not.toContain(opaqueError);
    expect(callbackErrorMessage(opaqueError)).toContain("try again");
  });
});
