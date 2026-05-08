import { describe, expect, it } from "vitest";
import { xeroContactNumberForLegalEntity } from "./xero-legal-entity-contact.js";

describe("xeroContactNumberForLegalEntity", () => {
  it("uses compact uuid and LAXLE prefix within Xero ContactNumber limit", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const n = xeroContactNumberForLegalEntity(id);
    expect(n).toBe("LAXLEa1b2c3d4e5f67890abcdef1234567890");
    expect(n.length).toBeLessThanOrEqual(50);
  });
});
