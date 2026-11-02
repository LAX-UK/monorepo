import { describe, expect, it } from "vitest";
import { mayEnquireForOrganisation } from "./marketing-enquiry-entity.js";

describe("mayEnquireForOrganisation", () => {
  it("lets owners, admins, finance and buyer agents enquire to buy for an organisation", () => {
    for (const role of ["owner", "admin", "finance", "buyer_agent"] as const) {
      expect(mayEnquireForOrganisation(role, "private_sale_buy")).toBe(true);
    }
    for (const role of ["consignor", "viewer"] as const) {
      expect(mayEnquireForOrganisation(role, "private_sale_buy")).toBe(false);
    }
  });

  it("lets the members who may send works enquire to sell for an organisation", () => {
    for (const role of ["owner", "admin", "consignor"] as const) {
      expect(mayEnquireForOrganisation(role, "private_sale_sell")).toBe(true);
    }
    for (const role of ["finance", "viewer", "buyer_agent"] as const) {
      expect(mayEnquireForOrganisation(role, "private_sale_sell")).toBe(false);
    }
  });

  it("never links a general enquiry to an organisation", () => {
    expect(mayEnquireForOrganisation("owner", "general")).toBe(false);
    expect(mayEnquireForOrganisation("owner", "press")).toBe(false);
  });
});
