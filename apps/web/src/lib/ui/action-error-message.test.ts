import { describe, expect, it } from "vitest";
import {
  actionResultNotifyMessage,
  normalizeApiErrorMessage,
  normalizeFetchErrorMessage,
} from "./action-error-message";

describe("normalizeApiErrorMessage", () => {
  it("re-exports the shared validators helper", () => {
    expect(normalizeApiErrorMessage("stripe_connect_failed", "fallback")).toBe(
      "stripe_connect_failed",
    );
  });

  it("maps Zod validation objects to the first issue message", () => {
    expect(
      normalizeApiErrorMessage(
        {
          name: "ZodError",
          issues: [{ message: "Country is required" }],
        },
        "fallback",
      ),
    ).toBe("Country is required");
  });

  it("returns fallback for unknown object shapes", () => {
    expect(normalizeApiErrorMessage({ code: "unknown" }, "fallback")).toBe("fallback");
  });
});

describe("normalizeFetchErrorMessage", () => {
  it("normalizes error from a response body", () => {
    expect(normalizeFetchErrorMessage({ error: "sync_failed" }, "fallback")).toBe("sync_failed");
  });
});

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
