import type { SubjectExportCategory } from "./subject-export.types.js";

/** The categories LAX Bid answers for, in the order the download lists them. */
export class SubjectExportRegistry {
  private readonly byId = new Map<string, SubjectExportCategory>();

  constructor(categories: readonly SubjectExportCategory[]) {
    for (const category of categories) {
      if (this.byId.has(category.id)) {
        throw new Error(`Duplicate subject export category: ${category.id}`);
      }
      this.byId.set(category.id, category);
    }
  }

  list(): readonly SubjectExportCategory[] {
    return [...this.byId.values()];
  }

  find(categoryId: string): SubjectExportCategory | undefined {
    return this.byId.get(categoryId);
  }
}
