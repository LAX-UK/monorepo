import { buildListHref } from "@/lib/admin/admin-list-params";
import { flattenCategoryTaxonomyRows } from "@/lib/admin/categories/category-taxonomy-rows";
import { isoDate } from "@/lib/admin/iso-date";
import { panelParamRedirect } from "@/lib/admin/list-record";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import {
  type Metric,
  type SortState,
  type DataView as StaffDataView,
  type StatusPresentation,
  decodeSort,
  encodeSort,
} from "@auction/staff-ui";
import type { AdminCategoriesListSummary, AdminCategory } from "@auction/types";

export const CATEGORIES_LIST_PATH = "/admin/categories";

export type CategoriesListSearch = Record<string, string | string[] | undefined>;

/** One category as the staff list shows it; plain data, so it crosses to the client as is. */
export type CategoriesStaffRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  archived: boolean;
  status: StatusPresentation;
  /** Nesting level in the taxonomy; 0 for a top-level category. */
  depth: number;
  /** "/ceramics", or "Sub-category · /ceramics". */
  context: string;
  lots: number;
  sales: number;
  submissions: number;
  interests: number;
  /** Every place the category is assigned; deleting is only possible at 0. */
  assignments: number;
  sortOrder: number;
  hasHeroImage: boolean;
  updatedAt: string;
  createdAt: string;
  href: string;
  editHref: string;
  canDelete: boolean;
};

const count = new Intl.NumberFormat("en-GB");

/** "Not used yet", "1 assignment", "14 assignments". */
export function assignmentsLabel(assignments: number): string {
  if (assignments === 0) return "Not used yet";
  return `${count.format(assignments)} ${assignments === 1 ? "assignment" : "assignments"}`;
}

/** Rows in taxonomy order, so sub-categories sit under their parent within the page. */
export function toCategoriesStaffRows(categories: readonly AdminCategory[]): CategoriesStaffRow[] {
  return flattenCategoryTaxonomyRows([...categories]).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    archived: category.archived,
    status: staffStatus("category", category.archived ? "archived" : "active"),
    depth: category.depth,
    context: `${category.depth > 0 ? "Sub-category · " : ""}/${category.slug}`,
    lots: category.usage.lots,
    sales: category.usage.sales,
    submissions: category.usage.submissions,
    interests: category.usage.interests,
    assignments: category.usage.total,
    sortOrder: category.sortOrder,
    hasHeroImage: Boolean(category.heroImageKey),
    updatedAt: isoDate(category.updatedAt),
    createdAt: isoDate(category.createdAt),
    href: adminCategoryHref(category.id),
    editHref: `${CATEGORIES_LIST_PATH}/${category.id}/edit`,
    canDelete: category.usage.total === 0,
  }));
}

/** The list URL with `patch` applied; any change returns to the first page. */
export function categoriesListHref(
  current: CategoriesListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: CategoriesListSearch = { ...current };
  for (const key of ["error", "success", "category", "new"]) delete base[key];
  return buildListHref(CATEGORIES_LIST_PATH, base, { offset: null, ...patch });
}

/** A category's page. */
export function adminCategoryHref(categoryId: string): string {
  return `${CATEGORIES_LIST_PATH}/${categoryId}`;
}

/**
 * An old panel link (`/admin/categories?category=ID`) opens the category's page now, still in
 * the list it named; null when there is no `?category=`.
 */
export function categoryPanelRedirect(current: CategoriesListSearch): string | null {
  const { new: _new, ...rest } = current;
  return panelParamRedirect(rest, "category", adminCategoryHref);
}

/** Taxonomy order: each parent, then its sub-categories, as the API returns them. */
export const CATEGORIES_DEFAULT_SORT: SortState = { columnId: "category", direction: "asc" };

/** What each sortable column sorts by; the category column keeps the taxonomy order. */
const CATEGORY_SORT_VALUES: Record<string, ((row: CategoriesStaffRow) => number | string) | null> =
  {
    category: null,
    lots: (row) => row.lots,
    sales: (row) => row.sales,
    submissions: (row) => row.submissions,
    updated: (row) => row.updatedAt,
  };

/** The sort in the URL (`?sort=-lots`); the taxonomy order when it names no sortable column. */
export function categoriesSortState(sort: string | string[] | undefined): SortState {
  const decoded = decodeSort(typeof sort === "string" ? sort : sort?.[0]);
  return decoded && decoded.columnId in CATEGORY_SORT_VALUES ? decoded : CATEGORIES_DEFAULT_SORT;
}

/** The list sorted by a column; the default order is left out of the URL. */
export function categoriesSortHref(current: CategoriesListSearch, sort: SortState): string {
  const isDefault =
    sort.columnId === CATEGORIES_DEFAULT_SORT.columnId &&
    sort.direction === CATEGORIES_DEFAULT_SORT.direction;
  return categoriesListHref(current, { sort: isDefault ? null : encodeSort(sort) });
}

/**
 * The page's rows in the URL's sort. The API returns categories in taxonomy order only, so the
 * page sorts the rows it loaded; ties keep the taxonomy order in both directions.
 */
export function sortCategoriesRows(
  rows: readonly CategoriesStaffRow[],
  sort: SortState,
): CategoriesStaffRow[] {
  const value = CATEGORY_SORT_VALUES[sort.columnId];
  if (!value) return sort.direction === "desc" ? [...rows].reverse() : [...rows];
  const sign = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return x < y ? -sign : x > y ? sign : 0;
  });
}

/** Active categories, or every category with the archived ones; counts when the summary loaded. */
export function categoriesViews(
  search: CategoriesListSearch,
  summary: AdminCategoriesListSummary | null,
): StaffDataView[] {
  return [
    {
      id: "active",
      label: "Active",
      href: categoriesListHref(search, { includeArchived: null }),
      ...(summary ? { count: summary.activeCount } : {}),
    },
    {
      id: "archived",
      label: "Include archived",
      href: categoriesListHref(search, { includeArchived: "true" }),
      ...(summary ? { count: summary.totalCount } : {}),
    },
  ];
}

export function categoriesActiveView(includeArchived: boolean): string {
  return includeArchived ? "archived" : "active";
}

/** Headline numbers across the taxonomy, from the categories summary. */
export function categoriesMetrics(summary: AdminCategoriesListSummary): Metric[] {
  const { lots, sales, submissions } = summary.usageTotals;
  const most = summary.mostUsedCategory;
  return [
    { id: "active", label: "Active categories", value: count.format(summary.activeCount) },
    { id: "archived", label: "Archived", value: count.format(summary.archivedCount) },
    { id: "assignments", label: "Assignments", value: count.format(lots + sales + submissions) },
    ...(most ? [{ id: "most-used", label: "Most used", value: most.name }] : []),
  ];
}

/** "1–50 of 312 categories", with the singular for exactly one. */
export function categoriesRangeSummary(offset: number, shown: number, total: number): string {
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  return `${range} of ${count.format(total)} ${total === 1 ? "category" : "categories"}`;
}
