import {
  type SubjectExportManifest,
  type SubjectExportPage,
  findSubjectExportCategory,
  subjectExportManifestSchema,
  subjectExportPageSchema,
} from "@auction/identity-contracts";
import type { SubjectExportRegistry } from "./subject-export.registry.js";

export class UnknownSubjectExportCategoryError extends Error {
  constructor(readonly categoryId: string) {
    super("unknown_export_category");
    this.name = "UnknownSubjectExportCategoryError";
  }
}

/** The read side of "Download my data" for LAX Account: what is held, then each category a page at a time. */
export class SubjectExportReader {
  constructor(private readonly registry: SubjectExportRegistry) {}

  async manifest(subjectId: string): Promise<SubjectExportManifest> {
    const categories = await Promise.all(
      this.registry.list().map(async (category) => ({
        id: category.id,
        schemaVersion: findSubjectExportCategory("account", category.id)?.schemaVersion ?? 1,
        count: await category.count(subjectId),
      })),
    );
    return subjectExportManifestSchema.parse({ product: "account", categories });
  }

  async page(
    subjectId: string,
    categoryId: string,
    cursor: string | null,
  ): Promise<SubjectExportPage> {
    const category = this.registry.find(categoryId);
    if (!category) throw new UnknownSubjectExportCategoryError(categoryId);
    return subjectExportPageSchema.parse(await category.readPage(subjectId, cursor));
  }
}
