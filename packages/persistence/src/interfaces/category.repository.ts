import type { AdminCategory, Category } from "@auction/types";
import type {
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from "@auction/validators";

/** Inferred output of the admin category zod schemas (equivalent to `z.infer`,
 * expressed via `_output` so this package does not depend on zod directly). */
export type CreateCategoryInput = (typeof adminCreateCategoryBodySchema)["_output"];
export type UpdateCategoryInput = (typeof adminUpdateCategoryBodySchema)["_output"];

export interface ICategoryRepository {
  findAll(options?: { includeArchived?: boolean }): Promise<Category[]>;
  findAllForAdmin(options?: { includeArchived?: boolean }): Promise<AdminCategory[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(input: CreateCategoryInput & { slug: string }): Promise<Category>;
  update(
    id: string,
    input: UpdateCategoryInput & { slug?: string | undefined },
  ): Promise<Category | null>;
  archive(id: string): Promise<Category | null>;
  delete(id: string): Promise<boolean>;
  usageFor(id: string): Promise<AdminCategory["usage"]>;
  usageForMany(ids: string[]): Promise<Map<string, AdminCategory["usage"]>>;
}
