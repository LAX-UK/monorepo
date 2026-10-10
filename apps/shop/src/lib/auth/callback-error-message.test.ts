import { describe, expect, it } from "vitest";
import { callbackErrorMessage, callbackErrorReference } from "./callback-error-message.js";

describe("callbackErrorMessage", () => {
  it("maps known OIDC errors to shopper-friendly recovery copy", () => {
    expect(callbackErrorMessage("access_denied")).toContain("cancelled sign-in");
    expect(callbackErrorMessage("temporarily_unavailable")).toContain("temporarily unavailable");
    expect(callbackErrorMessage("missing_refresh_token")).toContain(
      "session could not be established",
    );
  });

  it("does not expose unknown protocol error values", () => {
    const opaqueError = "provider_internal_code_493";
    expect(callbackErrorMessage(opaqueError)).not.toContain(opaqueError);
    expect(callbackErrorMessage(opaqueError)).toContain("try again");
  });

  it("uses plain language instead of protocol jargon", () => {
    expect(callbackErrorMessage("token_exchange_failed")).not.toMatch(/exchange|code/i);
    expect(callbackErrorMessage("invalid_id_token")).not.toMatch(/token/i);
  });
});

describe("callbackErrorReference", () => {
  it("keeps known codes and collapses anything else to unknown", () => {
    expect(callbackErrorReference("invalid_state")).toBe("invalid_state");
    expect(callbackErrorReference("<script>")).toBe("unknown");
    expect(callbackErrorReference("toString")).toBe("unknown");
  });
});
