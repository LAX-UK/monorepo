import { describe, expect, it } from "vitest";
import { classifyZohoError } from "./retry-classification.js";
import { ZohoCrmAuthError, ZohoCrmHttpError } from "./types.js";

describe("classifyZohoError", () => {
  it("classifies auth errors as fatal", () => {
    expect(classifyZohoError(new ZohoCrmAuthError("token"))).toBe("fatal");
  });

  it("classifies rate limits as retryable", () => {
    expect(classifyZohoError(new ZohoCrmHttpError(429, "rate"))).toBe("retryable");
  });

  it("classifies 5xx as retryable", () => {
    expect(classifyZohoError(new ZohoCrmHttpError(502, "bad gateway"))).toBe("retryable");
  });
});
