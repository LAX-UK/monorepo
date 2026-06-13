import type { Database } from "@auction/db";
import { category, lotCategories, saleCategories, submissionCategories } from "@auction/db/schema";
import type { AdminCategory, Category, CategoryUsage } from "@auction/types";
import { asc, count, eq, inArray } from "drizzle-orm";
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
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
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
    const usageById = await this.usageForMany(rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, usage: usageById.get(row.id) ?? emptyUsage() }));
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
        updatedAt: new Date(),
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
    const map = await this.usageForMany([id]);
    return map.get(id) ?? emptyUsage();
  }

  async usageForMany(ids: string[]): Promise<Map<string, CategoryUsage>> {
    const result = new Map<string, CategoryUsage>();
    if (ids.length === 0) return result;
    for (const id of ids) {
      result.set(id, emptyUsage());
    }

    const [lotRows, saleRows, submissionRows] = await Promise.all([
      this.db
        .select({ categoryId: lotCategories.categoryId, value: count() })
        .from(lotCategories)
        .where(inArray(lotCategories.categoryId, ids))
        .groupBy(lotCategories.categoryId),
      this.db
        .select({ categoryId: saleCategories.categoryId, value: count() })
        .from(saleCategories)
        .where(inArray(saleCategories.categoryId, ids))
        .groupBy(saleCategories.categoryId),
      this.db
        .select({ categoryId: submissionCategories.categoryId, value: count() })
        .from(submissionCategories)
        .where(inArray(submissionCategories.categoryId, ids))
        .groupBy(submissionCategories.categoryId),
    ]);

    for (const row of lotRows) {
      const current = result.get(row.categoryId) ?? emptyUsage();
      current.lots = row.value;
      current.total = current.lots + current.sales + current.submissions;
      result.set(row.categoryId, current);
    }
    for (const row of saleRows) {
      const current = result.get(row.categoryId) ?? emptyUsage();
      current.sales = row.value;
      current.total = current.lots + current.sales + current.submissions;
      result.set(row.categoryId, current);
    }
    for (const row of submissionRows) {
      const current = result.get(row.categoryId) ?? emptyUsage();
      current.submissions = row.value;
      current.total = current.lots + current.sales + current.submissions;
      result.set(row.categoryId, current);
    }

    return result;
  }
}

function emptyUsage(): CategoryUsage {
  return { lots: 0, sales: 0, submissions: 0, total: 0 };
}
