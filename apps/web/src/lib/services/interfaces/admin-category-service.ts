import type {
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateCategoryInput = z.infer<typeof adminCreateCategoryBodySchema>;
export type UpdateCategoryInput = z.infer<typeof adminUpdateCategoryBodySchema>;

export interface IAdminCategoryService {
  create(input: CreateCategoryInput): Promise<ServiceResult<{ id: string }>>;
  update(id: string, input: UpdateCategoryInput): Promise<ServiceResult<Record<string, unknown>>>;
  archive(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  delete(id: string): Promise<ServiceResult<Record<string, unknown>>>;
}
