import { describe, expect, it } from "vitest";
import { toCrmGatewayError } from "./classify-crm-error.js";
import { CrmGatewayError, crmPersonNotLinkedError } from "./crm-gateway-error.js";

describe("toCrmGatewayError", () => {
  it("treats ECONNRESET as retryable", () => {
    const err = toCrmGatewayError(
      Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
    );
    expect(err.retryable).toBe(true);
  });

  it("preserves CrmGatewayError person_not_linked", () => {
    const err = toCrmGatewayError(crmPersonNotLinkedError());
    expect(err).toBeInstanceOf(CrmGatewayError);
    expect(err.retryable).toBe(true);
  });
});
