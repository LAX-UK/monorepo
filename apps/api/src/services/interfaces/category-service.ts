import type { Category } from "@auction/types";

export interface ICategoryService {
  list(): Promise<Category[]>;
  /** Categories a visitor can browse: those holding at least one published lot. */
  listWithPublishedLots(): Promise<Category[]>;
}
