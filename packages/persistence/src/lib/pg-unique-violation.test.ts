import { describe, expect, it } from "vitest";
import { isPgUniqueViolation } from "./pg-unique-violation.js";

describe("isPgUniqueViolation", () => {
  it("matches a bare driver error", () => {
    expect(isPgUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("matches an error wrapped as cause (Drizzle query error)", () => {
    const wrapped = Object.assign(new Error("Failed query"), { cause: { code: "23505" } });
    expect(isPgUniqueViolation(wrapped)).toBe(true);
  });

  it("matches a nested cause chain", () => {
    const deep = { cause: { cause: { cause: { code: "23505" } } } };
    expect(isPgUniqueViolation(deep)).toBe(true);
  });

  it("rejects other SQLSTATEs, including when wrapped", () => {
    expect(isPgUniqueViolation({ code: "23503" })).toBe(false);
    expect(isPgUniqueViolation({ cause: { code: "40P01" } })).toBe(false);
  });

  it("rejects non-objects and errors without a code", () => {
    expect(isPgUniqueViolation(null)).toBe(false);
    expect(isPgUniqueViolation(undefined)).toBe(false);
    expect(isPgUniqueViolation("23505")).toBe(false);
    expect(isPgUniqueViolation(new Error("boom"))).toBe(false);
  });

  it("terminates on a cyclic cause chain", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(isPgUniqueViolation(a)).toBe(false);
  });
});
