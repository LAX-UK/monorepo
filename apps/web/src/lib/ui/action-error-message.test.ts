import { describe, expect, it } from "vitest";
import { actionResultNotifyMessage } from "./action-error-message";

describe("actionResultNotifyMessage", () => {
  it("maps session_required", () => {
    expect(
      actionResultNotifyMessage({ fallback: "Unauthorized", errorCode: "session_required" }),
    ).toMatch(/sign in again/i);
  });

  it("maps origin_blocked", () => {
    expect(
      actionResultNotifyMessage({ fallback: "Forbidden", errorCode: "origin_blocked" }),
    ).toMatch(/origin check/i);
  });

  it("maps missing_capability via meta", () => {
    const msg = actionResultNotifyMessage({
      fallback: "Forbidden",
      meta: {
        code: "missing_capability",
        required: ["catalogue.write"],
        actor: { role: "staff", staffRole: null },
      },
    });
    expect(msg).toMatch(/catalogue.write/);
    expect(msg).toMatch(/signing out/i);
  });

  it("returns fallback for unknown errors", () => {
    expect(actionResultNotifyMessage({ fallback: "Something broke" })).toBe("Something broke");
  });
});
