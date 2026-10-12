import { describe, expect, it } from "vitest";
import { artCallbackErrorMessage, artCallbackErrorReference } from "./art-callback-error";

describe("art callback error", () => {
  it("keeps known identity reasons as the support reference", () => {
    expect(artCallbackErrorReference("invalid_state")).toBe("invalid_state");
    expect(artCallbackErrorMessage("invalid_state")).toBe(
      "Your sign-in session expired or was interrupted. Please try again.",
    );
  });

  it("never echoes unknown or repeated reasons", () => {
    expect(artCallbackErrorReference("<script>")).toBe("unknown");
    expect(artCallbackErrorReference("constructor")).toBe("unknown");
    expect(artCallbackErrorReference(["access_denied", "x"])).toBe("unknown");
    expect(artCallbackErrorReference(undefined)).toBe("unknown");
    expect(artCallbackErrorMessage("unknown")).toBe(
      "We could not complete sign-in. Please try again.",
    );
  });
});
