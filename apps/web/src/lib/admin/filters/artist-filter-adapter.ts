import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type ArtistFilterDraft = {
  q: string;
  country: string;
  status: string;
  kind: string;
  linked: string;
  categoryId: string;
  sort: string;
  featured: boolean;
  verified: boolean;
  includeArchived: boolean;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): ArtistFilterDraft {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    country: searchParams.get("country")?.trim() ?? "",
    status: searchParams.get("status")?.trim() ?? "",
    kind: searchParams.get("kind")?.trim() ?? "",
    linked: searchParams.get("linked")?.trim() || "any",
    categoryId: searchParams.get("categoryId")?.trim() ?? "",
    sort: searchParams.get("sort")?.trim() || "name_asc",
    featured: searchParams.get("featured") === "true",
    verified: searchParams.get("verified") === "true",
    includeArchived: searchParams.get("includeArchived") === "true",
  };
}

export const artistFilterAdapter: AdminFilterAdapter<ArtistFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    q: "",
    country: "",
    status: "",
    kind: "",
    linked: "any",
    categoryId: "",
    sort: "name_asc",
    featured: false,
    verified: false,
    includeArchived: false,
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        q: draft.q.trim() || null,
        country: draft.country.trim().toUpperCase() || null,
        status: draft.status.trim() || null,
        kind: draft.kind.trim() || null,
        linked: draft.linked === "any" ? null : draft.linked,
        categoryId: draft.categoryId.trim() || null,
        sort: draft.sort === "name_asc" ? null : draft.sort,
        featured: draft.featured ? "true" : null,
        verified: draft.verified ? "true" : null,
        includeArchived: draft.includeArchived ? "true" : null,
        backfill: null,
        duplicates: null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return JSON.stringify(draft) !== JSON.stringify(applied);
  },
};
