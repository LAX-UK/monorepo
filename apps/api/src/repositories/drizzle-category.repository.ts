import type { Database } from "@auction/db";
import { category, lotCategories, saleCategories, submissionCategories } from "@auction/db/schema";
import type { AdminCategory, Category, CategoryUsage } from "@auction/types";
import { asc, count, eq } from "drizzle-orm";
import type {
  CreateCategoryInput,
  ICategoryRepository,
  UpdateCategoryInput,
} from "../services/interfaces/category.js";

function mapCategory(r: typeof category.$inferSelect): Category {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    archived: r.archived,
    sortOrder: r.sortOrder,
    parentId: r.parentId,
    heroImageKey: r.heroImageKey ?? null,
  };
}

export class DrizzleCategoryRepository implements ICategoryRepository {
  constructor(private readonly db: Database) {}

  async findAll(options: { includeArchived?: boolean } = {}): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(category)
      .where(options.includeArchived ? undefined : eq(category.archived, false))
      .orderBy(asc(category.sortOrder), asc(category.name));
    return rows.map(mapCategory);
  }

  async findAllForAdmin(options: { includeArchived?: boolean } = {}): Promise<AdminCategory[]> {
    const rows = await this.findAll(options);
    const usageRows = await Promise.all(rows.map((row) => this.usageFor(row.id)));
    return rows.map((row, index) => ({ ...row, usage: usageRows[index] ?? emptyUsage() }));
  }

  async findById(id: string): Promise<Category | null> {
    const [row] = await this.db.select().from(category).where(eq(category.id, id)).limit(1);
    return row ? mapCategory(row) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const [row] = await this.db.select().from(category).where(eq(category.slug, slug)).limit(1);
    return row ? mapCategory(row) : null;
  }

  async create(input: CreateCategoryInput & { slug: string }): Promise<Category> {
    const [row] = await this.db
      .insert(category)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
        heroImageKey: input.heroImageKey ?? null,
      })
      .returning();
    if (!row) throw new Error("Category create failed");
    return mapCategory(row);
  }

  async update(
    id: string,
    input: UpdateCategoryInput & { slug?: string | undefined },
  ): Promise<Category | null> {
    const [row] = await this.db
      .update(category)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
        ...(input.heroImageKey !== undefined ? { heroImageKey: input.heroImageKey ?? null } : {}),
      })
      .where(eq(category.id, id))
      .returning();
    return row ? mapCategory(row) : null;
  }

  async archive(id: string): Promise<Category | null> {
    return this.update(id, { archived: true });
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(category)
      .where(eq(category.id, id))
      .returning({ id: category.id });
    return rows.length > 0;
  }

  async usageFor(id: string): Promise<CategoryUsage> {
    const [lots] = await this.db
      .select({ value: count() })
      .from(lotCategories)
      .where(eq(lotCategories.categoryId, id));
    const [sales] = await this.db
      .select({ value: count() })
      .from(saleCategories)
      .where(eq(saleCategories.categoryId, id));
    const [submissions] = await this.db
      .select({ value: count() })
      .from(submissionCategories)
      .where(eq(submissionCategories.categoryId, id));
    const usage = {
      lots: lots?.value ?? 0,
      sales: sales?.value ?? 0,
      submissions: submissions?.value ?? 0,
    };
    return { ...usage, total: usage.lots + usage.sales + usage.submissions };
  }
}

function emptyUsage(): CategoryUsage {
  return { lots: 0, sales: 0, submissions: 0, total: 0 };
}
