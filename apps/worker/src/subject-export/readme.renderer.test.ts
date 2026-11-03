import {
  SUBJECT_EXPORT_CATEGORIES,
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_PRODUCT_INFO,
} from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { controllerNamesFor } from "./controller-names.js";
import { renderReadme } from "./readme.renderer.js";

const readme = renderReadme({
  preparedAt: new Date("2026-11-02T14:03:11.000Z"),
  exportId: "11111111-1111-4111-8111-111111111111",
});

describe("README.txt", () => {
  it("covers every category the contract defines, under its own file name", () => {
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      for (const category of SUBJECT_EXPORT_CATEGORIES[product]) {
        expect(readme, `${product}/${category.id}`).toContain(`${product}/${category.id}.json`);
        expect(readme).toContain(category.description);
      }
    }
  });

  it("describes every field of every category with the contract's sentence", () => {
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      for (const category of SUBJECT_EXPORT_CATEGORIES[product]) {
        for (const field of category.fields) {
          expect(readme, `${product}/${category.id}.${field.name}`).toContain(field.description);
        }
      }
    }
  });

  it("names each product with the company that answers for it", () => {
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      const info = SUBJECT_EXPORT_PRODUCT_INFO[product];
      expect(readme).toContain(info.name);
      expect(readme).toContain(controllerNamesFor(product));
    }
    expect(readme).toContain("London Auction Xchange LTD");
    expect(readme).toContain("London Art Exchange Ltd");
  });

  it("explains the rules that apply to every file", () => {
    expect(readme).toMatch(/ISO 8601 in UTC/);
    expect(readme).toMatch(/minor/);
    expect(readme).toMatch(/origin/);
    expect(readme).toMatch(/"included" is false/);
    expect(readme).toMatch(/ask us/i);
  });
});
