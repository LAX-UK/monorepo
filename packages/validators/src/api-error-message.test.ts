import { describe, expect, it } from "vitest";
import {
  VALIDATION_FAILED_ERROR_CODE,
  buildValidationFailedBody,
  formatZodValidationError,
  normalizeApiErrorMessage,
  parseApiErrorCodeFromBody,
} from "./api-error-message.js";

describe("buildValidationFailedBody", () => {
  it("returns error message and validation_failed code", () => {
    expect(
      buildValidationFailedBody({
        issues: [{ message: "Country is required", code: "custom", path: ["country"] }],
      }),
    ).toEqual({
      error: "Country is required",
      errorCode: VALIDATION_FAILED_ERROR_CODE,
    });
  });
});

describe("parseApiErrorCodeFromBody", () => {
  it("prefers errorCode over error message", () => {
    expect(
      parseApiErrorCodeFromBody({
        errorCode: VALIDATION_FAILED_ERROR_CODE,
        error: "Country is required",
      }),
    ).toBe(VALIDATION_FAILED_ERROR_CODE);
  });

  it("falls back to code then string error", () => {
    expect(parseApiErrorCodeFromBody({ code: "session_required" })).toBe("session_required");
    expect(parseApiErrorCodeFromBody({ error: "legal_entity_not_found" })).toBe(
      "legal_entity_not_found",
    );
  });

  it("maps legacy Zod objects to validation_failed", () => {
    expect(
      parseApiErrorCodeFromBody({
        error: { name: "ZodError", issues: [{ message: "Invalid url" }] },
      }),
    ).toBe(VALIDATION_FAILED_ERROR_CODE);
  });
});

describe("formatZodValidationError", () => {
  it("returns the first issue message", () => {
    expect(
      formatZodValidationError({
        issues: [{ message: "Country is required", code: "custom", path: ["country"] }],
      }),
    ).toBe("Country is required");
  });

  it("falls back when issues are empty", () => {
    expect(formatZodValidationError({ issues: [] })).toBe("Invalid request.");
  });
});

describe("normalizeApiErrorMessage", () => {
  it("returns string errors as-is", () => {
    expect(normalizeApiErrorMessage("stripe_connect_failed", "fallback")).toBe(
      "stripe_connect_failed",
    );
  });

  it("maps Zod-shaped validation objects", () => {
    expect(
      normalizeApiErrorMessage(
        { name: "ZodError", issues: [{ message: "Invalid url" }] },
        "fallback",
      ),
    ).toBe("Invalid url");
  });

  it("maps objects with a message field", () => {
    expect(normalizeApiErrorMessage({ message: "Something went wrong" }, "fallback")).toBe(
      "Something went wrong",
    );
  });

  it("returns fallback for unknown shapes", () => {
    expect(normalizeApiErrorMessage({ code: "unknown" }, "fallback")).toBe("fallback");
  });
});
