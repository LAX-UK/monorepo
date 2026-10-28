import "server-only";

import { artistsListController } from "@/lib/admin/admin-list-controllers";
import { artistsQueue } from "@/lib/admin/artists/artists-staff-list.vm";
import { categoryPickerOptions } from "@/lib/admin/catalog/category-picker-options";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminArtistStats, getLotArtistBackfillReviewTasks } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  ARTIST_MERGE_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import type { EntityOption } from "@auction/staff-ui";
import { type AdminArtistListRow, type UserRole, userHasAccessTo } from "@auction/types";

export type AdminArtistsListSearchParams = Record<string, string | string[] | undefined>;

/**
 * The artists list: one page of rows with the total behind it, the registry stats and the lot
 * artist backfill count for the strips, the category tree for the filter, and what the signed-in
 * role may do. The two review queues (`?duplicates=1`, `?backfill=1`) are pages of their own, so
 * for them nothing of the list is fetched.
 */
export async function loadAdminArtistsListPage(sp: AdminArtistsListSearchParams) {
  const queue = artistsQueue(sp);
  const user = await getServerSessionUser().catch(() => null);
  const can = (access: Parameters<typeof userHasAccessTo>[2]) =>
    user != null && userHasAccessTo(user.role as UserRole, user.staffRoles, access);
  const permissions = {
    canWrite: can(ARTIST_WRITE_ACCESS),
    canReview: can(ARTIST_REVIEW_ACCESS),
    canMerge: can(ARTIST_MERGE_ACCESS),
  };
  const query = artistsListController.parseQuery(sp);
  const error = safeDecodeAdminErrorParam(sp.error);

  if (queue) {
    return {
      queue,
      query,
      rows: [] as AdminArtistListRow[],
      total: 0,
      stats: null,
      backfillTasks: 0,
      categoryOptions: [] as EntityOption[],
      loadError: error,
      permissions,
    };
  }

  const categoryOptions = await getServerCategoryReader()
    .then((reader) => reader.tree())
    .then((tree) => categoryPickerOptions(tree))
    .catch(() => [] as EntityOption[]);

  const [list, stats, backfillTasks] = await Promise.all([
    artistsListController.fetch(query).then(
      (result) => ({ rows: result.rows, total: result.total ?? result.rows.length, error: null }),
      (e) => ({
        rows: [] as AdminArtistListRow[],
        total: 0,
        error: e instanceof Error ? e.message : "Could not load artists.",
      }),
    ),
    getAdminArtistStats().catch(() => null),
    getLotArtistBackfillReviewTasks()
      .then((tasks) => tasks.length)
      .catch(() => 0),
  ]);

  return {
    queue,
    query,
    rows: list.rows,
    total: list.total,
    stats,
    backfillTasks,
    categoryOptions,
    loadError: list.error ?? error,
    permissions,
  };
}
