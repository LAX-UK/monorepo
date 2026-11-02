import { subjectExportManifestSchema, subjectExportPageSchema } from "@auction/identity-contracts";
import { SubjectExportRegistry } from "@auction/identity-contracts/subject-export-readers";
import type { SubjectExportCategory } from "@auction/identity-contracts/subject-export-readers";
import { describe, expect, it, vi } from "vitest";
import {
  SubjectExportService,
  UnknownSubjectExportCategoryError,
} from "./subject-export.service.js";

function fakeCategory(id: string, count = 2): SubjectExportCategory {
  return {
    id,
    count: vi.fn().mockResolvedValue(count),
    readPage: vi.fn().mockResolvedValue({
      records: [{ id: "1", origin: "provided" }],
      nextCursor: null,
    }),
  };
}

describe("SubjectExportRegistry", () => {
  it("refuses two categories with one id", () => {
    expect(() => new SubjectExportRegistry([fakeCategory("a"), fakeCategory("a")])).toThrow(
      "Duplicate",
    );
  });
});

describe("SubjectExportService", () => {
  it("answers the manifest in the contract's shape, with the contract's schema versions", async () => {
    const service = new SubjectExportService(
      new SubjectExportRegistry([fakeCategory("orders", 5), fakeCategory("basket", 0)]),
    );
    const manifest = await service.manifest("person");
    expect(subjectExportManifestSchema.parse(manifest)).toEqual({
      product: "shop",
      categories: [
        { id: "orders", schemaVersion: 1, count: 5 },
        { id: "basket", schemaVersion: 1, count: 0 },
      ],
    });
  });

  it("answers a page in the contract's shape", async () => {
    const category = fakeCategory("orders");
    const service = new SubjectExportService(new SubjectExportRegistry([category]));
    const page = await service.page("person", "orders", "cur");
    expect(subjectExportPageSchema.parse(page).records).toHaveLength(1);
    expect(category.readPage).toHaveBeenCalledWith("person", "cur");
  });

  it("refuses a category Shop does not serve", async () => {
    const service = new SubjectExportService(new SubjectExportRegistry([fakeCategory("orders")]));
    await expect(service.page("person", "nope", null)).rejects.toBeInstanceOf(
      UnknownSubjectExportCategoryError,
    );
  });

  it("does not pass a record without an origin through to Identity", async () => {
    const bad: SubjectExportCategory = {
      id: "orders",
      count: vi.fn(),
      readPage: vi.fn().mockResolvedValue({ records: [{ id: "1" }], nextCursor: null }),
    };
    const service = new SubjectExportService(new SubjectExportRegistry([bad]));
    await expect(service.page("person", "orders", null)).rejects.toThrow();
  });
});
