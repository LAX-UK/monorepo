import { describe, expect, it } from "vitest";
import { XeroApiWritesDisabledError, assertXeroApiWritesAllowed } from "./xero-api-writes-guard.js";

describe("assertXeroApiWritesAllowed", () => {
  it("allows writes when flag is false", () => {
    expect(() => assertXeroApiWritesAllowed({ XERO_API_WRITES_DISABLED: false })).not.toThrow();
  });

  it("blocks writes when flag is true", () => {
    expect(() => assertXeroApiWritesAllowed({ XERO_API_WRITES_DISABLED: true })).toThrow(
      XeroApiWritesDisabledError,
    );
  });
});
