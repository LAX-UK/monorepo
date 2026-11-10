import { describe, expect, it } from "vitest";
import {
  SESSION_REQUIRED_CODE,
  TOKEN_EXPIRED_CODE,
  TOKEN_KEY_UNKNOWN_CODE,
  isTokenReplaceableCode,
} from "./auth-rejection.js";

describe("isTokenReplaceableCode", () => {
  it("accepts only the codes a fresh token fixes", () => {
    expect(isTokenReplaceableCode(TOKEN_KEY_UNKNOWN_CODE)).toBe(true);
    expect(isTokenReplaceableCode(TOKEN_EXPIRED_CODE)).toBe(true);
    for (const other of [SESSION_REQUIRED_CODE, "forbidden", "", undefined, null, 401]) {
      expect(isTokenReplaceableCode(other)).toBe(false);
    }
  });
});
