import { describe, expect, it } from "vitest";
import {
  buildLotEditTabFields,
  lotFormValidationBanner,
  resolveLotFormEditTabForField,
} from "./lot-form-field-ownership";

describe("resolveLotFormEditTabForField", () => {
  it("maps identity fields to overview", () => {
    expect(resolveLotFormEditTabForField("title")).toBe("overview");
  });

  it("maps sale fields to sale tab", () => {
    expect(resolveLotFormEditTabForField("saleId")).toBe("sale");
  });

  it("maps catalogue fields to catalogue tab", () => {
    expect(resolveLotFormEditTabForField("startTime")).toBe("catalogue");
  });
});

describe("buildLotEditTabFields", () => {
  it("includes dutch fields on catalogue tab", () => {
    const tabs = buildLotEditTabFields("dutch");
    expect(tabs.catalogue).toContain("dutchDecrementAmount");
  });
});

describe("lotFormValidationBanner", () => {
  it("includes location when multiple errors", () => {
    expect(lotFormValidationBanner(2, "Catalogue")).toContain("Catalogue");
    expect(lotFormValidationBanner(2, "Catalogue")).toContain("2");
  });
});
