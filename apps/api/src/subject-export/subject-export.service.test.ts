import {
  SUBJECT_EXPORT_CATEGORIES,
  subjectExportManifestSchema,
  subjectExportPageSchema,
} from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { createBidSubjectExportRegistry } from "./create-bid-subject-export-categories.js";
import { SubjectExportRegistry } from "./subject-export.registry.js";
import {
  SubjectExportService,
  UnknownSubjectExportCategoryError,
} from "./subject-export.service.js";
import type { SubjectExportCategory } from "./subject-export.types.js";

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

  it("registers exactly the Bid categories of the shared contract, in its order", () => {
    // The readers are built without touching a database; only their ids are read.
    const registry = createBidSubjectExportRegistry({
      db: {} as never,
      files: {} as never,
      webOrigin: "https://bid.example",
    });
    expect(registry.list().map((c) => c.id)).toEqual(
      SUBJECT_EXPORT_CATEGORIES.bid.map((c) => c.id),
    );
  });
});

describe("SubjectExportService", () => {
  it("answers the manifest in the contract's shape, with the contract's schema versions", async () => {
    const service = new SubjectExportService(
      new SubjectExportRegistry([fakeCategory("bids", 5), fakeCategory("messages", 0)]),
    );
    const manifest = await service.manifest("person");
    expect(subjectExportManifestSchema.parse(manifest)).toEqual({
      product: "bid",
      categories: [
        { id: "bids", schemaVersion: 1, count: 5 },
        { id: "messages", schemaVersion: 1, count: 0 },
      ],
    });
  });

  it("answers a page in the contract's shape", async () => {
    const category = fakeCategory("bids");
    const service = new SubjectExportService(new SubjectExportRegistry([category]));
    const page = await service.page("person", "bids", "cur");
    expect(subjectExportPageSchema.parse(page).records).toHaveLength(1);
    expect(category.readPage).toHaveBeenCalledWith("person", "cur");
  });

  it("refuses a category Bid does not serve", async () => {
    const service = new SubjectExportService(new SubjectExportRegistry([fakeCategory("bids")]));
    await expect(service.page("person", "nope", null)).rejects.toBeInstanceOf(
      UnknownSubjectExportCategoryError,
    );
  });

  it("does not pass a record without an origin through to Identity", async () => {
    const bad: SubjectExportCategory = {
      id: "bids",
      count: vi.fn(),
      readPage: vi.fn().mockResolvedValue({ records: [{ id: "1" }], nextCursor: null }),
    };
    const service = new SubjectExportService(new SubjectExportRegistry([bad]));
    await expect(service.page("person", "bids", null)).rejects.toThrow();
  });
});
