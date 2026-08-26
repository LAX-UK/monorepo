import type { Database } from "@auction/db";
import {
  category,
  lotCategories,
  saleCategories,
  submissionCategories,
  userCategoryInterest,
} from "@auction/db/schema";
import {
  type AdminCategoriesListSummary,
  type AdminCategoriesMostUsed,
  type AdminCategory,
  type AdminCategoryListResult,
  type Category,
  type CategoryUsage,
  emptyCategoryUsage,
  withCategoryUsageTotal,
} from "@auction/types";
import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import type {
  CreateCategoryInput,
  ICategoryRepository,
  UpdateCategoryInput,
} from "../interfaces/category.repository.js";

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
    return rows.map((row) => ({ ...row, usage: usageById.get(row.id) ?? emptyCategoryUsage() }));
  }

  async findPageForAdmin(options: {
    includeArchived?: boolean;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<AdminCategoryListResult> {
    const needle = options.q?.trim();
    const where = and(
      options.includeArchived ? undefined : eq(category.archived, false),
      needle
        ? or(
            ilike(category.name, `%${needle}%`),
            ilike(category.slug, `%${needle}%`),
            ilike(category.description, `%${needle}%`),
          )
        : undefined,
    );
    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(category)
        .where(where)
        .orderBy(asc(category.sortOrder), asc(category.name))
        .limit(options.limit)
        .offset(options.offset),
      this.db.select({ value: count() }).from(category).where(where),
    ]);
    const categories = rows.map(mapCategory);
    const usageById = await this.usageForMany(categories.map((row) => row.id));
    return {
      rows: categories.map((row) => ({
        ...row,
        usage: usageById.get(row.id) ?? emptyCategoryUsage(),
      })),
      total: totalRows[0]?.value ?? 0,
    };
  }

  async summarizeForAdmin(
    options: { includeArchived?: boolean } = {},
  ): Promise<AdminCategoriesListSummary> {
    const lensWhere = options.includeArchived ? undefined : eq(category.archived, false);
    const [matching, active, archived, lots, sales, submissions, categoriesInLens] =
      await Promise.all([
        this.db.select({ value: count() }).from(category).where(lensWhere),
        this.db.select({ value: count() }).from(category).where(eq(category.archived, false)),
        this.db.select({ value: count() }).from(category).where(eq(category.archived, true)),
        this.db
          .select({ value: count() })
          .from(lotCategories)
          .innerJoin(category, eq(lotCategories.categoryId, category.id))
          .where(lensWhere),
        this.db
          .select({ value: count() })
          .from(saleCategories)
          .innerJoin(category, eq(saleCategories.categoryId, category.id))
          .where(lensWhere),
        this.db
          .select({ value: count() })
          .from(submissionCategories)
          .innerJoin(category, eq(submissionCategories.categoryId, category.id))
          .where(lensWhere),
        this.db
          .select({
            id: category.id,
            name: category.name,
            slug: category.slug,
          })
          .from(category)
          .where(lensWhere),
      ]);

    const usageById = await this.usageForMany(categoriesInLens.map((row) => row.id));
    let mostUsedCategory: AdminCategoriesMostUsed | null = null;

    for (const row of categoriesInLens) {
      const usage = usageById.get(row.id) ?? emptyCategoryUsage();
      // Admin assignment KPIs intentionally cover catalogue assignments only;
      // buyer interests participate in delete safety, not catalogue popularity.
      const assignmentTotal = usage.lots + usage.sales + usage.submissions;
      if (assignmentTotal === 0) continue;

      const candidate: AdminCategoriesMostUsed = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        usage: {
          lots: usage.lots,
          sales: usage.sales,
          submissions: usage.submissions,
          total: assignmentTotal,
        },
      };

      if (
        !mostUsedCategory ||
        assignmentTotal > mostUsedCategory.usage.total ||
        (assignmentTotal === mostUsedCategory.usage.total &&
          row.name.localeCompare(mostUsedCategory.name) < 0)
      ) {
        mostUsedCategory = candidate;
      }
    }

    return {
      totalCount: matching[0]?.value ?? 0,
      activeCount: active[0]?.value ?? 0,
      archivedCount: archived[0]?.value ?? 0,
      usageTotals: {
        lots: lots[0]?.value ?? 0,
        sales: sales[0]?.value ?? 0,
        submissions: submissions[0]?.value ?? 0,
      },
      mostUsedCategory,
    };
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
    return map.get(id) ?? emptyCategoryUsage();
  }

  async usageForMany(ids: string[]): Promise<Map<string, CategoryUsage>> {
    const result = new Map<string, CategoryUsage>();
    if (ids.length === 0) return result;
    for (const id of ids) {
      result.set(id, emptyCategoryUsage());
    }

    const [lotRows, saleRows, submissionRows, interestRows] = await Promise.all([
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
      this.db
        .select({ categoryId: userCategoryInterest.categoryId, value: count() })
        .from(userCategoryInterest)
        .where(inArray(userCategoryInterest.categoryId, ids))
        .groupBy(userCategoryInterest.categoryId),
    ]);

    for (const row of lotRows) {
      const current = result.get(row.categoryId) ?? emptyCategoryUsage();
      current.lots = row.value;
      result.set(row.categoryId, withCategoryUsageTotal(current));
    }
    for (const row of saleRows) {
      const current = result.get(row.categoryId) ?? emptyCategoryUsage();
      current.sales = row.value;
      result.set(row.categoryId, withCategoryUsageTotal(current));
    }
    for (const row of submissionRows) {
      const current = result.get(row.categoryId) ?? emptyCategoryUsage();
      current.submissions = row.value;
      result.set(row.categoryId, withCategoryUsageTotal(current));
    }
    for (const row of interestRows) {
      const current = result.get(row.categoryId) ?? emptyCategoryUsage();
      current.interests = row.value;
      result.set(row.categoryId, withCategoryUsageTotal(current));
    }

    return result;
  }
}
