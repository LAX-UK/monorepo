import { describe, expect, it } from "vitest";
import { CrmGatewayError } from "../crm/crm-gateway-error.js";
import { mapZohoErrorToCrmGatewayError } from "./map-zoho-to-crm-gateway-error.js";
import { ZohoCrmRecordError } from "./types.js";

describe("mapZohoErrorToCrmGatewayError", () => {
  it("marks TOO_MANY_REQUESTS as retryable", () => {
    const err = mapZohoErrorToCrmGatewayError(
      new ZohoCrmRecordError("TOO_MANY_REQUESTS", "rate limited", 429),
    );
    expect(err).toBeInstanceOf(CrmGatewayError);
    expect(err.retryable).toBe(true);
  });
});
