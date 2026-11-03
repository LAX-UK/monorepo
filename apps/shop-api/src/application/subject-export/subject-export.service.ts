import {
  type SubjectExportManifest,
  type SubjectExportPage,
  findSubjectExportCategory,
  subjectExportManifestSchema,
  subjectExportPageSchema,
} from "@auction/identity-contracts";
import type { SubjectExportRegistry } from "@auction/identity-contracts/subject-export-readers";

export class UnknownSubjectExportCategoryError extends Error {
  constructor(readonly categoryId: string) {
    super("unknown_export_category");
    this.name = "UnknownSubjectExportCategoryError";
  }
}

/** Answers Identity's export questions for LAX Shop and lax.art: what is held, then each category a page at a time. */
export class SubjectExportService {
  constructor(private readonly registry: SubjectExportRegistry) {}

  async manifest(subjectId: string): Promise<SubjectExportManifest> {
    const categories = await Promise.all(
      this.registry.list().map(async (category) => ({
        id: category.id,
        schemaVersion: this.schemaVersion(category.id),
        count: await category.count(subjectId),
      })),
    );
    return subjectExportManifestSchema.parse({ product: "shop", categories });
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

  private schemaVersion(categoryId: string): number {
    return findSubjectExportCategory("shop", categoryId)?.schemaVersion ?? 1;
  }
}
