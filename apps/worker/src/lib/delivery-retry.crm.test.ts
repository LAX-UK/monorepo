import { describe, expect, it } from "vitest";
import { CrmGatewayError } from "../integrations/crm/crm-gateway-error.js";
import { classifyDeliveryError } from "./delivery-retry.js";

describe("classifyDeliveryError CRM gateway", () => {
  it("treats non-retryable CrmGatewayError as fatal even when status is 502", () => {
    const err = new CrmGatewayError({
      code: "INVALID_DATA",
      message: "bad payload",
      status: 502,
      retryable: false,
    });
    expect(classifyDeliveryError(err)).toBe("fatal");
  });
});
