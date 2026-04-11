import type { Category } from "@auction/types";

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
}
