import { describe, expect, it } from "vitest";
import { LEGAL_ACCEPTANCE_FIELD } from "../../auth-hooks/legal-acceptance.js";
import { legalAcceptanceFields } from "./legal-acceptance.js";

describe("legal acceptance fields sent from the sign-up page", () => {
  it("names the product under the field the issuer reads", () => {
    expect(legalAcceptanceFields("shop")).toEqual({
      [LEGAL_ACCEPTANCE_FIELD]: { product: "shop" },
    });
  });

  it("claims nothing when the page carries no product", () => {
    expect(legalAcceptanceFields(undefined)).toEqual({});
    expect(legalAcceptanceFields("")).toEqual({});
  });
});
