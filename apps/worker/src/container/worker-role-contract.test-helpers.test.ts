import { describe, expect, it } from "vitest";
import { reachedPrivilegeCheck } from "./worker-role-contract.test-helpers.js";

const failure = (code: string) => Object.assign(new Error("query failed"), { code });

describe("reachedPrivilegeCheck", () => {
  it.each([
    ["42501", "a denial"],
    ["23503", "a foreign key violation"],
    ["23505", "a unique violation"],
    ["23514", "a check violation"],
    ["21000", "a cardinality violation"],
    ["40001", "a serialization failure"],
    ["55P03", "a lock that is not available"],
    ["P0001", "an error raised by PL/pgSQL"],
  ])("counts %s (%s) as past the privilege check", (code) => {
    expect(reachedPrivilegeCheck(failure(code))).toBe(true);
  });

  it.each([
    ["22P02", "an invalid uuid or enum text"],
    ["22003", "a value out of range"],
    ["42601", "a syntax error"],
    ["42703", "an undefined column"],
    ["42P01", "an undefined table"],
    ["42883", "an undefined function"],
    ["42804", "a datatype mismatch"],
    ["08006", "a connection failure"],
    ["25P02", "a transaction already aborted"],
    ["57014", "a cancelled statement"],
  ])("does not count %s (%s)", (code) => {
    expect(reachedPrivilegeCheck(failure(code))).toBe(false);
  });

  it("follows the cause chain to the code", () => {
    const wrapped = new Error("Failed query", { cause: failure("42501") });
    expect(reachedPrivilegeCheck(wrapped)).toBe(true);
    expect(reachedPrivilegeCheck(new Error("Failed query", { cause: failure("42601") }))).toBe(
      false,
    );
  });

  it("does not count an error with no SQLSTATE", () => {
    expect(reachedPrivilegeCheck(new Error("returned early in code"))).toBe(false);
    expect(reachedPrivilegeCheck("not an error")).toBe(false);
  });
});
