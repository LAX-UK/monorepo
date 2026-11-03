import { LEGAL_ENTITIES } from "@auction/branding";
import { SUBJECT_EXPORT_PRODUCTS, SUBJECT_EXPORT_PRODUCT_INFO } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { controllerNamesFor } from "./controller-names.js";
import { renderReadme } from "./readme.renderer.js";

describe("controllerNamesFor", () => {
  it("names a single company, and both companies for Account", () => {
    expect(controllerNamesFor("bid")).toBe(LEGAL_ENTITIES["london-auction-xchange"].name);
    expect(controllerNamesFor("shop")).toBe(LEGAL_ENTITIES["london-art-exchange"].name);
    expect(controllerNamesFor("account")).toBe(
      `${LEGAL_ENTITIES["london-auction-xchange"].name} and ${LEGAL_ENTITIES["london-art-exchange"].name}`,
    );
  });

  it("is what the README prints for every product", () => {
    const readme = renderReadme({ preparedAt: new Date("2026-11-02T10:00:00Z"), exportId: "e1" });
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      expect(readme).toContain(`Kept by ${controllerNamesFor(product)}.`);
      for (const id of SUBJECT_EXPORT_PRODUCT_INFO[product].controllers) {
        expect(readme).toContain(LEGAL_ENTITIES[id].name);
      }
    }
  });
});
