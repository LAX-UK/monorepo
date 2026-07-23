import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";
import type { LotListSortKey } from "@/lib/admin/lots-list-sort";

export type LotFilterDraft = {
  artistId: string;
  saleId: string;
  categoryId: string;
  sort: LotListSortKey | "";
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): LotFilterDraft {
  return {
    artistId: searchParams.get("artistId")?.trim() ?? "",
    saleId: searchParams.get("saleId")?.trim() ?? "",
    categoryId: searchParams.get("categoryId")?.trim() ?? "",
    sort: (searchParams.get("sort")?.trim() ?? "") as LotFilterDraft["sort"],
  };
}

export const lotFilterAdapter: AdminFilterAdapter<LotFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    artistId: "",
    saleId: "",
    categoryId: "",
    sort: "",
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        artistId: draft.artistId.trim() || null,
        saleId: draft.saleId.trim() || null,
        categoryId: draft.categoryId.trim() || null,
        sort: draft.sort || null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return (
      draft.artistId !== applied.artistId ||
      draft.saleId !== applied.saleId ||
      draft.categoryId !== applied.categoryId ||
      draft.sort !== applied.sort
    );
  },
};
