import { describe, expect, it } from "vitest";
import { classifyZohoError } from "./retry-classification.js";
import { ZohoCrmAuthError, ZohoCrmHttpError } from "./types.js";

describe("classifyZohoError", () => {
  it("classifies auth errors as fatal unless token refresh hit 5xx", () => {
    expect(classifyZohoError(new ZohoCrmAuthError("token"))).toBe("fatal");
    expect(classifyZohoError(new ZohoCrmAuthError("zoho_token_refresh_failed_503", 503))).toBe(
      "retryable",
    );
  });

  it("classifies rate limits as retryable", () => {
    expect(classifyZohoError(new ZohoCrmHttpError(429, "rate"))).toBe("retryable");
  });

  it("classifies 5xx as retryable", () => {
    expect(classifyZohoError(new ZohoCrmHttpError(502, "bad gateway"))).toBe("retryable");
  });
});
