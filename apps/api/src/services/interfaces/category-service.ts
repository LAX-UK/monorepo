import type { Category } from "@auction/types";

export interface ICategoryService {
  list(): Promise<Category[]>;
}
