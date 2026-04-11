import type { Category } from "@auction/types";
import type { ICategoryRepository } from "./interfaces/category.js";

export class CategoryService {
  constructor(private readonly categories: ICategoryRepository) {}

  list(): Promise<Category[]> {
    return this.categories.findAll();
  }
}
