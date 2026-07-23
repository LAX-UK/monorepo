import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";
import type { SaleListSortKey } from "@/lib/admin/sales-list-sort";

export type SaleFilterDraft = {
  lifecycle: string;
  delivery: string;
  sort: SaleListSortKey | "";
};

function parseDraft(
  searchParams: URLSearchParams,
  preserved: AdminFilterPreserved,
): SaleFilterDraft {
  const lens = preserved.lens ?? searchParams.get("lens") ?? "";
  const lifecycleFromLens =
    lens && lens !== "all" && lens !== "setup"
      ? lens
      : (searchParams.get("lifecycle")?.trim() ?? "");
  return {
    lifecycle: lifecycleFromLens,
    delivery: searchParams.get("delivery")?.trim() ?? "",
    sort: (searchParams.get("sort")?.trim() ?? "") as SaleFilterDraft["sort"],
  };
}

export const saleFilterAdapter: AdminFilterAdapter<SaleFilterDraft> = {
  parse: parseDraft,
  defaults: (preserved) => ({
    lifecycle: "",
    delivery: "",
    sort: "",
    ...(preserved.lens && preserved.lens !== "all" ? {} : {}),
  }),
  buildHref(pathname, current, draft, preserved) {
    const lens = preserved.lens ?? current.get("lens") ?? "";
    const lensLocked = lens !== "" && lens !== "all" && lens !== "setup";
    const params = mergeFilterSearchParams(
      current,
      {
        delivery: draft.delivery.trim() || null,
        sort: draft.sort || null,
        ...(lensLocked
          ? {}
          : {
              lifecycle: draft.lifecycle.trim() || null,
            }),
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return (
      draft.lifecycle !== applied.lifecycle ||
      draft.delivery !== applied.delivery ||
      draft.sort !== applied.sort
    );
  },
};
