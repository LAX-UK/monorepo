import {
  firstString,
  parseListSearchParams,
  sliceAdminListWindow,
} from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminCategoryList } from "@/lib/data/http/admin.server";
import type { AdminCategory } from "@auction/types";

export type CategoriesListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
};

export const categoriesListController: IAdminListController<AdminCategory, CategoriesListQuery> = {
  id: "categories",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const includeArchived = firstString(sp.includeArchived) === "true";
    return { ...base, includeArchived, limit: Math.min(200, base.limit) };
  },
  async fetch(q) {
    const all = await getAdminCategoryList({
      includeArchived: Boolean(q.includeArchived),
      ...(q.q !== undefined && q.q !== "" ? { q: q.q } : {}),
    });
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};
