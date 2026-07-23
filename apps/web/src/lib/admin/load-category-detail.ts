import { getAdminCategoryById, getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";
import { notFound } from "next/navigation";
import { cache } from "react";

export const loadAdminCategoryDetail = cache(async (categoryId: string): Promise<AdminCategory> => {
  const category = await getAdminCategoryById(categoryId);
  if (!category) notFound();
  return category;
});

/** Shared cached taxonomy context for category detail layout and tabs. */
export const loadAdminCategoryTree = cache(() => getAdminCategoryList({ includeArchived: true }));
