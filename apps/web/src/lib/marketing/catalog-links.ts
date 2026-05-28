import { firstString } from "@/lib/admin/admin-list-params";
import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { artistPath, lotPath, salePath } from "@/lib/seo/url";

type LotUrlFields = { id: string; title: string };
type SaleUrlFields = { id: string; title: string };
type ArtistUrlFields = { id: string; name: string };

export type CatalogLinkParams = Record<string, string | undefined | null>;

/** Append or replace query params on a path. */
export function mergeCatalogQueryParams(
  path: string,
  params?: CatalogLinkParams | URLSearchParams,
): string {
  if (!params) return path;

  const out = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (value) out.set(key, value);
    });
  } else {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") out.set(key, value);
    }
  }

  const q = out.toString();
  return q ? `${path}?${q}` : path;
}

/** Catalogue lot link with optional carry params (e.g. `view=list`). */
export function lotCatalogHref(lot: LotUrlFields, carryParams?: CatalogLinkParams): string {
  return mergeCatalogQueryParams(lotPath(lot), carryParams);
}

/** Params to carry when linking from a catalogue list in list/grid mode. */
export function catalogViewCarryParams(
  view: CatalogLayoutView | string | undefined,
): CatalogLinkParams | undefined {
  if (!view || view === "grid") return undefined;
  return { view: String(view) };
}

/** Params to carry when linking from a saleroom catalogue to lot detail. */
export function saleroomLotLinkParams(
  layoutView: CatalogLayoutView,
  statusFilter: "live" | "upcoming" | "ended" | null,
): CatalogLinkParams {
  const params: CatalogLinkParams = { from: "sale" };
  if (layoutView !== "grid") params.view = layoutView;
  if (statusFilter) params.status = statusFilter;
  return params;
}

/** Saleroom back link from lot detail — restores view + status filters. */
export function saleCatalogBackHref(
  sale: SaleUrlFields,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  const view = firstString(searchParams.view);
  if (view && view !== "grid") qs.set("view", view);
  const status = firstString(searchParams.status);
  if (status === "live" || status === "upcoming" || status === "ended") {
    qs.set("status", status);
  }
  return mergeCatalogQueryParams(salePath(sale), qs);
}

export type ArtistProfileLinkContext = {
  fromPath: string;
  searchParams: Record<string, string | string[] | undefined>;
  layoutView: CatalogLayoutView;
};

/** Artist profile link preserving directory filters for back navigation. */
export function artistProfileHref(artist: ArtistUrlFields, ctx?: ArtistProfileLinkContext): string {
  if (!ctx) return artistPath(artist);

  const params: CatalogLinkParams = { from: ctx.fromPath };
  const q = firstString(ctx.searchParams.q);
  if (q) params.q = q;
  const sort = firstString(ctx.searchParams.sort);
  if (sort && sort !== "name_asc") params.sort = sort;
  if (ctx.layoutView !== "grid") params.view = ctx.layoutView;

  return mergeCatalogQueryParams(artistPath(artist), params);
}

/** Back link to artist directory with preserved filters. */
export function artistDirectoryBackHref(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const from = firstString(searchParams.from) ?? "/artists";
  return artistDirectoryWithQuery(
    from,
    {},
    {
      q: firstString(searchParams.q) ?? null,
      sort: firstString(searchParams.sort) ?? null,
      view: firstString(searchParams.view) ?? null,
      from: null,
    },
  );
}
