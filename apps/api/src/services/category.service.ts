import type { AdminCategory, Category } from "@auction/types";
import { normalizeCategoryHierarchy, validateCategoryParent } from "@auction/validators";
import { CategoryError } from "../lib/errors.js";
import type {
  CreateCategoryInput,
  ICategoryRepository,
  UpdateCategoryInput,
} from "./interfaces/category.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

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

  async listForAdmin(options: { includeArchived?: boolean } = {}): Promise<AdminCategory[]> {
    const categories = await this.categories.findAllForAdmin(options);
    const normalized = normalizeCategoryHierarchy(categories);
    return normalized.map((category) => {
      const source = categories.find((row) => row.id === category.id);
      return {
        ...category,
        usage: source?.usage ?? { lots: 0, sales: 0, submissions: 0, total: 0 },
      };
    });
  }

  async getForAdmin(id: string): Promise<AdminCategory | null> {
    const category = await this.categories.findById(id);
    if (!category) return null;
    const usage = await this.categories.usageFor(id);
    return { ...category, usage };
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const slug = await this.uniqueSlug(input.slug ?? input.name);
    const categories = await this.categories.findAll({ includeArchived: true });
    const issue = validateCategoryParent(categories, "new", input.parentId);
    if (issue) throw new CategoryError(issue.message);
    return this.categories.create({ ...input, slug });
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.categories.findById(id);
    if (!existing) throw new CategoryError("Category not found");
    const categories = await this.categories.findAll({ includeArchived: true });
    const issue = validateCategoryParent(categories, id, input.parentId);
    if (issue) throw new CategoryError(issue.message);
    const slug = input.slug !== undefined ? await this.uniqueSlug(input.slug, id) : undefined;
    const next: UpdateCategoryInput & { slug?: string | undefined } = { ...input };
    if (slug !== undefined) next.slug = slug;
    const updated = await this.categories.update(id, next);
    if (!updated) throw new CategoryError("Category not found");
    return updated;
  }

  async archive(id: string): Promise<Category> {
    const archived = await this.categories.archive(id);
    if (!archived) throw new CategoryError("Category not found");
    return archived;
  }

  async delete(id: string): Promise<void> {
    const usage = await this.categories.usageFor(id);
    if (usage.total > 0) {
      throw new CategoryError(
        "Archive categories that are already used by lots, sales, or submissions",
      );
    }
    const deleted = await this.categories.delete(id);
    if (!deleted) throw new CategoryError("Category not found");
  }

  private async uniqueSlug(value: string, ignoreId?: string): Promise<string> {
    const base = slugify(value);
    if (!base) throw new CategoryError("Category slug cannot be empty");

    for (let index = 0; index < 100; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.categories.findBySlug(candidate);
      if (!existing || existing.id === ignoreId) return candidate;
    }

    throw new CategoryError("Could not generate a unique category slug");
  }
}
