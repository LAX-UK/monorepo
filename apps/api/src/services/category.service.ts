import type { Category } from "@auction/types";
import { normalizeCategoryHierarchy, validateCategoryParent } from "@auction/validators";
import { CategoryError } from "../lib/errors.js";
import type { ICategoryRepository } from "./interfaces/category.js";

export class CategoryService {
  constructor(private readonly categories: ICategoryRepository) {}

  async list(): Promise<Category[]> {
    const categories = await this.categories.findAll();
    return normalizeCategoryHierarchy(categories);
  }

  async validateParent(categoryId: string, parentId: string | null | undefined): Promise<void> {
    const categories = await this.categories.findAll();
    const issue = validateCategoryParent(categories, categoryId, parentId);
    if (issue) {
      throw new CategoryError(issue.message);
    }
  }
}
