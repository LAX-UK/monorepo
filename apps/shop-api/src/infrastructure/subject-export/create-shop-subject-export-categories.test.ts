import { SUBJECT_EXPORT_CATEGORIES } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { createShopSubjectExportRegistry } from "./create-shop-subject-export-categories.js";

describe("Shop subject export registry", () => {
  it("registers exactly the Shop categories of the shared contract, in its order", () => {
    // The readers are built without touching a database; only their ids are read.
    const registry = createShopSubjectExportRegistry({
      db: {} as never,
      files: {} as never,
      origins: { shop: "https://shop.example", art: "https://art.example" },
    });
    expect(registry.list().map((c) => c.id)).toEqual(
      SUBJECT_EXPORT_CATEGORIES.shop.map((c) => c.id),
    );
  });
});
