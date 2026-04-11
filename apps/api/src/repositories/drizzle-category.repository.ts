import type { Database } from "@auction/db";
import { category } from "@auction/db/schema";
import type { Category } from "@auction/types";
import { asc } from "drizzle-orm";
import type { ICategoryRepository } from "../services/interfaces/category.js";

export class DrizzleCategoryRepository implements ICategoryRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.db.select().from(category).orderBy(asc(category.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      parentId: r.parentId,
    }));
  }
}
