import "server-only";

import { submissionsListController } from "@/lib/admin/admin-list-controllers";
import { buildSubmissionsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import {
  type SubmissionsListSearchParams,
  buildSubmissionsListPageModel,
} from "@/lib/admin/submissions/build-submissions-list-page-model";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import {
  type AdminSubmissionsListSummary,
  EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY,
  getAdminSubmissionsListSummary,
} from "@/lib/data/http/admin-submissions-summary.server";
import { getAdminUsersByIds } from "@/lib/data/http/admin-users.server";
import { getAdminCategoryById, getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { toAdminSubmissionTableRows } from "@/lib/data/view-models/admin-submissions.vm";
import type { CategoryNode } from "@auction/types";

export type AdminSubmissionsListPageViewModel = {
  model: ReturnType<typeof buildSubmissionsListPageModel>;
  summary: AdminSubmissionsListSummary;
  navCounts: AdminNavCounts;
  loadError: string | null;
  rows: Awaited<ReturnType<typeof submissionsListController.fetch>>["rows"];
  submissionRows: AdminSubmissionTableRow[];
  total: number;
  categories: CategoryNode[];
  activeFilterChips: ReturnType<typeof buildSubmissionsActiveFilterChips>;
  qualityGapsOnPage: number;
  awaitingOnPage: number;
};

export async function loadAdminSubmissionsListPage(input: {
  sp: SubmissionsListSearchParams;
  currentUserId: string;
}): Promise<AdminSubmissionsListPageViewModel> {
  const { sp, currentUserId } = input;
  const model = buildSubmissionsListPageModel(sp);
  const { query } = model;

  let loadError: string | null = null;
  let rows: Awaited<ReturnType<typeof submissionsListController.fetch>>["rows"] = [];
  let total = 0;
  try {
    const result = await submissionsListController.fetch(query);
    rows = result.rows;
    total = result.total ?? rows.length;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const sellerIds = [
    ...new Set(
      rows.map((s) => s.legalEntityId ?? s.sellerId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const categoryIds = [
    ...new Set(
      rows
        .map((s) => s.categoryIds?.[0] ?? s.categoryId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const assigneeIds = [
    ...new Set(
      rows.map((s) => s.assignedToUserId).filter((id): id is string => Boolean(id?.trim())),
    ),
  ];

  const [summary, navCounts, categories, sellerNameEntries, categoryNameEntries, assigneeUsers] =
    await Promise.all([
      getAdminSubmissionsListSummary().catch(() => EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY),
      getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS),
      (async () => {
        try {
          return await (await getServerCategoryReader()).tree();
        } catch {
          return [] as CategoryNode[];
        }
      })(),
      Promise.all(
        sellerIds.map(async (id) => {
          const entity = await getAdminLegalEntityById(id).catch(() => null);
          return [id, entity?.displayName ?? null] as const;
        }),
      ),
      Promise.all(
        categoryIds.map(async (id) => {
          const category = await getAdminCategoryById(id).catch(() => null);
          return [id, category?.name ?? null] as const;
        }),
      ),
      getAdminUsersByIds(assigneeIds).catch(() => []),
    ]);

  const sellerNameById = new Map(sellerNameEntries);
  const categoryNameById = new Map(categoryNameEntries);
  const assigneeNamesById = new Map(assigneeUsers.map((user) => [user.id, user.name] as const));

  const submissionRows = toAdminSubmissionTableRows(rows, {
    currentUserId,
    sellerNamesById: sellerNameById,
    categoryNamesById: categoryNameById,
    assigneeNamesById,
  });

  const qualityGapsOnPage = submissionRows.filter(
    (r) => r.blocksAccept || r.qualityGaps.length > 0,
  ).length;
  const awaitingOnPage = submissionRows.filter(
    (r) => r.status === "under_review" || r.status === "submitted",
  ).length;

  const categoryFilter = query.categoryId
    ? await getAdminCategoryById(query.categoryId).catch(() => null)
    : null;

  const activeFilterChips = buildSubmissionsActiveFilterChips(sp, {
    ...(model.initialQ ? { q: model.initialQ } : {}),
    ...(query.categoryId
      ? { categoryId: query.categoryId, categoryName: categoryFilter?.name ?? null }
      : {}),
    ...(query.qualityGaps ? { qualityGaps: true } : {}),
    ...(query.assignedToMe ? { assignedToMe: true } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
  });

  return {
    model,
    summary,
    navCounts,
    loadError,
    rows,
    submissionRows,
    total,
    categories,
    activeFilterChips,
    qualityGapsOnPage,
    awaitingOnPage,
  };
}
