import { describe, expect, it } from "vitest";
import {
  LAX_PRODUCT_NAMES,
  LEGAL_ENTITIES,
  legalEntitiesFor,
  legalEntityFacts,
  legalEntityFor,
  legalOperatorSentence,
  productCopyrightLine,
} from "../src/legal-entity.js";

describe("LAX legal entities", () => {
  it("names the operator of each product", () => {
    expect(legalEntityFor("bid").name).toBe("London Auction Xchange LTD");
    expect(legalEntityFor("shop").name).toBe("London Art Exchange Ltd");
    expect(legalEntityFor("art").name).toBe("London Art Exchange Ltd");
  });

  it("provides LAX Account through both companies", () => {
    expect(legalEntitiesFor("account").map((entity) => entity.name)).toEqual([
      "London Auction Xchange LTD",
      "London Art Exchange Ltd",
    ]);
    expect(legalOperatorSentence("account")).toBe(
      "LAX Account is provided by London Auction Xchange LTD and London Art Exchange Ltd.",
    );
  });

  it("states one operator for single-company products", () => {
    expect(legalOperatorSentence("bid")).toBe("LAX Bid is operated by London Auction Xchange LTD.");
    expect(legalOperatorSentence("art")).toBe("lax.art is operated by London Art Exchange Ltd.");
  });

  it("writes a copyright line per product", () => {
    expect(productCopyrightLine("shop", 2026)).toBe(
      "© 2026 London Art Exchange Ltd. All rights reserved.",
    );
    expect(productCopyrightLine("bid", 2026)).toBe(
      "© 2026 London Auction Xchange LTD. All rights reserved.",
    );
    expect(productCopyrightLine("account", 2026)).toBe(
      "© 2026 London Auction Xchange LTD and London Art Exchange Ltd. All rights reserved.",
    );
  });

  it("registers both companies at New Cavendish Street", () => {
    for (const entity of Object.values(LEGAL_ENTITIES)) {
      expect(entity.registeredAddress.inline).toBe(
        "156 New Cavendish Street, Marylebone, London W1W 6YW, United Kingdom",
      );
    }
  });

  it("never shares a company or VAT number between companies", () => {
    const [xchange, artExchange] = Object.values(LEGAL_ENTITIES);
    for (const key of ["companyNumber", "vatNumber"] as const) {
      if (xchange?.[key] !== undefined || artExchange?.[key] !== undefined) {
        expect(xchange?.[key]).not.toBe(artExchange?.[key]);
      }
    }
  });

  it("shows a named placeholder for unconfirmed registration details", () => {
    const facts = legalEntityFacts(legalEntityFor("bid"));
    expect(facts.companyNumber).toBe("[TO CONFIRM: London Auction Xchange LTD company number]");
    expect(facts.vatNumber).toBe(
      "[TO CONFIRM: London Auction Xchange LTD VAT registration number]",
    );
    expect(facts.registeredIn).toBe("England and Wales");
  });

  it("uses London Art Exchange Ltd's published details and leaves out its VAT number", () => {
    const facts = legalEntityFacts(legalEntityFor("shop"));
    expect(facts.companyNumber).toBe("12874213");
    expect(facts.registeredIn).toBe("England and Wales");
    expect(facts.vatNumber).toBeNull();
  });

  it("writes the gallery as lax.art", () => {
    expect(LAX_PRODUCT_NAMES.art).toBe("lax.art");
  });
});
