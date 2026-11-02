import {
  SUBJECT_EXPORT_CATEGORIES,
  subjectExportManifestSchema,
  subjectExportPageSchema,
} from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { createAccountSubjectExportRegistry } from "./create-account-subject-export-categories.js";
import {
  SubjectExportReader,
  UnknownSubjectExportCategoryError,
} from "./subject-export-reader.service.js";
import { SubjectExportRegistry } from "./subject-export.registry.js";
import type { SubjectExportCategory } from "./subject-export.types.js";

const fake = (id: string, count = 2): SubjectExportCategory => ({
  id,
  count: vi.fn().mockResolvedValue(count),
  readPage: vi
    .fn()
    .mockResolvedValue({ records: [{ id: "1", origin: "provided" }], nextCursor: null }),
});

describe("SubjectExportRegistry", () => {
  it("refuses two categories with one id", () => {
    expect(() => new SubjectExportRegistry([fake("a"), fake("a")])).toThrow("Duplicate");
  });

  it("registers exactly the Account categories of the shared contract, in its order", () => {
    // The readers are built without touching a database; only their ids are read.
    const registry = createAccountSubjectExportRegistry({} as never);
    expect(registry.list().map((c) => c.id)).toEqual(
      SUBJECT_EXPORT_CATEGORIES.account.map((c) => c.id),
    );
  });
});

describe("SubjectExportReader", () => {
  const reader = new SubjectExportReader(
    new SubjectExportRegistry([fake("profile", 1), fake("contact", 3)]),
  );

  it("answers a manifest naming the account product, with counts", async () => {
    const manifest = await reader.manifest("u1");
    expect(subjectExportManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest).toEqual({
      product: "account",
      categories: [
        { id: "profile", schemaVersion: 1, count: 1 },
        { id: "contact", schemaVersion: 1, count: 3 },
      ],
    });
  });

  it("answers a page and refuses an unknown category", async () => {
    expect(
      subjectExportPageSchema.safeParse(await reader.page("u1", "profile", null)).success,
    ).toBe(true);
    await expect(reader.page("u1", "nope", null)).rejects.toBeInstanceOf(
      UnknownSubjectExportCategoryError,
    );
  });
});
