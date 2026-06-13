import type { AdminCategory, Category } from "@auction/types";
import type {
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from "@auction/validators";
import type { z } from "zod";

export type CreateCategoryInput = z.infer<typeof adminCreateCategoryBodySchema>;
export type UpdateCategoryInput = z.infer<typeof adminUpdateCategoryBodySchema>;

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
