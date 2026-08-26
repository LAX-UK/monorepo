import type {
  CreateCategoryInput,
  ICategoryRepository,
  UpdateCategoryInput,
} from "@auction/persistence/interfaces";
import type {
  AdminCategoriesListSummary,
  AdminCategory,
  AdminCategoryListResult,
  Category,
} from "@auction/types";
import { slugifyRecordKey } from "@auction/types";
import { normalizeCategoryHierarchy, validateCategoryParent } from "@auction/validators";
import { CategoryError } from "../lib/errors.js";
import { findPostgresError } from "../lib/pg-error.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ICategoryService } from "./interfaces/category-service.js";

const CATEGORY_IN_USE_MESSAGE =
  "Archive categories that are already used by lots, sales, submissions, or buyer interests";

type CategoryMutationContext = {
  actorUserId?: string | null;
};

export class CategoryService implements ICategoryService {
  constructor(
    private readonly categories: ICategoryRepository,
    private readonly domainEventSink?: IDomainEventSink | null,
  ) {}

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
        usage: source?.usage ?? { lots: 0, sales: 0, submissions: 0, interests: 0, total: 0 },
      };
    });
  }

  async listPageForAdmin(options: {
    includeArchived?: boolean;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<AdminCategoryListResult> {
    return this.categories.findPageForAdmin(options);
  }

  async summarizeForAdmin(
    options: { includeArchived?: boolean } = {},
  ): Promise<AdminCategoriesListSummary> {
    return this.categories.summarizeForAdmin(options);
  }

  async getForAdmin(id: string): Promise<AdminCategory | null> {
    const category = await this.categories.findById(id);
    if (!category) return null;
    const usage = await this.categories.usageFor(id);
    return { ...category, usage };
  }

  async create(input: CreateCategoryInput, ctx: CategoryMutationContext = {}): Promise<Category> {
    const slug = await this.uniqueSlug(input.name);
    const categories = await this.categories.findAll({ includeArchived: true });
    const issue = validateCategoryParent(categories, "new", input.parentId);
    if (issue) throw new CategoryError(issue.message);
    const created = await this.categories.create({ ...input, slug });
    await this.publishEvent({
      aggregateId: created.id,
      eventType: "category.created",
      payload: { name: created.name, slug: created.slug },
      actorUserId: ctx.actorUserId ?? null,
    });
    return created;
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
    ctx: CategoryMutationContext = {},
  ): Promise<Category> {
    const existing = await this.categories.findById(id);
    if (!existing) throw new CategoryError("Category not found");
    const categories = await this.categories.findAll({ includeArchived: true });
    const issue = validateCategoryParent(categories, id, input.parentId);
    if (issue) throw new CategoryError(issue.message);
    const updated = await this.categories.update(id, input);
    if (!updated) throw new CategoryError("Category not found");
    await this.publishEvent({
      aggregateId: id,
      eventType: "category.updated",
      payload: { name: updated.name, slug: updated.slug },
      actorUserId: ctx.actorUserId ?? null,
    });
    return updated;
  }

  async archive(id: string, ctx: CategoryMutationContext = {}): Promise<Category> {
    const archived = await this.categories.archive(id);
    if (!archived) throw new CategoryError("Category not found");
    await this.publishEvent({
      aggregateId: id,
      eventType: "category.archived",
      payload: { name: archived.name },
      actorUserId: ctx.actorUserId ?? null,
    });
    return archived;
  }

  async delete(id: string, ctx: CategoryMutationContext = {}): Promise<void> {
    const usage = await this.categories.usageFor(id);
    if (usage.total > 0) {
      throw new CategoryError(CATEGORY_IN_USE_MESSAGE);
    }
    const existing = await this.categories.findById(id);
    let deleted: boolean;
    try {
      deleted = await this.categories.delete(id);
    } catch (error) {
      // A reference can be inserted after the usage check. Translate the
      // database constraint instead of leaking an opaque 500.
      if (findPostgresError(error)?.code === "23503") {
        throw new CategoryError(CATEGORY_IN_USE_MESSAGE);
      }
      throw error;
    }
    if (!deleted) throw new CategoryError("Category not found");
    await this.publishEvent({
      aggregateId: id,
      eventType: "category.deleted",
      payload: { name: existing?.name ?? id },
      actorUserId: ctx.actorUserId ?? null,
    });
  }

  private async publishEvent(input: {
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    actorUserId?: string | null;
  }): Promise<void> {
    if (!this.domainEventSink) return;
    await this.domainEventSink.publish({
      aggregateType: "category",
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      actorUserId: input.actorUserId ?? null,
    });
  }

  private async uniqueSlug(value: string, ignoreId?: string): Promise<string> {
    const base = slugifyRecordKey(value);
    if (!base) throw new CategoryError("Category slug cannot be empty");

    for (let index = 0; index < 100; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.categories.findBySlug(candidate);
      if (!existing || existing.id === ignoreId) return candidate;
    }

    throw new CategoryError("Could not generate a unique category slug");
  }
}
