import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import {
  PUBLIC_LOT_STATUSES,
  isPublicCatalogLot,
  isPublicCatalogSale,
  resolvePublicSaleListFilter,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import {
  presentLotsImages,
  presentSaleAdminImages,
  presentSaleImages,
  presentSalesWithLotsImages,
} from "../../lib/media-presenters.js";
import type { SaleServiceDeps } from "./sale-types.js";

export async function getByIdWithLots(
  deps: SaleServiceDeps,
  id: string,
): Promise<{ sale: Sale; lots: Lot[] } | null> {
  const sale = await deps.saleRepo.findById(id);
  if (!sale) return null;
  const lots = await deps.lotRepo.findBySaleId(id);
  return { sale, lots };
}

/** Staff catalogue edit: raw storage keys plus parallel resolved URLs for thumbnails. */
export async function getSaleDetailForCatalogAdmin(
  deps: SaleServiceDeps,
  saleId: string,
): Promise<{
  data: { sale: Awaited<ReturnType<typeof presentSaleAdminImages>>; lots: Lot[] };
} | null> {
  const bundle = await getByIdWithLots(deps, saleId);
  if (!bundle) return null;
  const sale = await presentSaleAdminImages(
    deps.mediaUrlResolver,
    bundle.sale,
    deps.mediaAssetEnricher,
  );
  const lots = await presentLotsImages(deps.mediaUrlResolver, bundle.lots, deps.mediaAssetEnricher);
  return { data: { sale, lots } };
}

/** Public sale detail: bundle, follow flag, resolved media URLs. */
export async function getSaleDetailForPublicApi(
  deps: SaleServiceDeps,
  saleId: string,
  viewerUserId: string | undefined,
  viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
): Promise<{ data: { sale: Sale; lots: Lot[]; viewer: { isFollowing: boolean } } } | null> {
  const bundle = await getByIdWithLots(deps, saleId);
  if (!bundle) return null;

  const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole);
  if (!canPreview && !isPublicCatalogSale(bundle.sale)) return null;

  const isFollowing =
    viewerUserId && deps.saleFollowReader
      ? await deps.saleFollowReader.isFollowing(viewerUserId, saleId)
      : false;
  const [sale, lots] = await Promise.all([
    presentSaleImages(deps.mediaUrlResolver, bundle.sale, deps.mediaAssetEnricher),
    presentLotsImages(deps.mediaUrlResolver, bundle.lots, deps.mediaAssetEnricher),
  ]);
  const visibleLots = canPreview
    ? lots
    : lots.filter((lot) => isPublicCatalogLot(lot, bundle.sale));
  return { data: { sale, lots: visibleLots, viewer: { isFollowing } } };
}

export async function list(
  deps: SaleServiceDeps,
  filter: Parameters<ISaleRepository["list"]>[0],
): Promise<{ sale: Sale; lots: Lot[] }[]> {
  const sales = await deps.saleRepo.list(filter);
  if (sales.length === 0) return [];
  const allLots = await deps.lotRepo.findBySaleIds(sales.map((s) => s.id));
  const bySale = new Map<string, Lot[]>();
  for (const l of allLots) {
    if (!l.saleId) continue;
    const arr = bySale.get(l.saleId) ?? [];
    arr.push(l);
    bySale.set(l.saleId, arr);
  }
  return sales.map((s) => ({ sale: s, lots: bySale.get(s.id) ?? [] }));
}

export async function listSalesForPublicApi(
  deps: SaleServiceDeps,
  filter: Parameters<ISaleRepository["list"]>[0],
  viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
): Promise<{ data: { sale: Sale; lots: Lot[] }[] }> {
  const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole);
  const resolved = resolvePublicSaleListFilter({
    status: filter.status,
    statuses: filter.statuses,
    viewerCanSeeNonPublic: canPreview,
  });
  const queryFilter = {
    ...filter,
    ...(resolved.statuses !== undefined
      ? { statuses: resolved.statuses, status: undefined }
      : resolved.status !== undefined
        ? { status: resolved.status, statuses: undefined }
        : {}),
  };
  const rows = await list(deps, queryFilter);
  const data = await presentSalesWithLotsImages(
    deps.catalogueMediaUrlResolver,
    rows,
    deps.mediaAssetEnricher,
  );
  if (canPreview) return { data };
  return {
    data: data
      .filter(({ sale }) => isPublicCatalogSale(sale))
      .map(({ sale, lots }) => ({
        sale,
        lots: lots.filter((lot) => isPublicCatalogLot(lot, sale)),
      })),
  };
}

export async function listSaleLotsPageForPublicApi(
  deps: SaleServiceDeps,
  saleId: string,
  opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
  viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
): Promise<{
  data: {
    items: Lot[];
    total: number;
    limit: number;
    offset: number;
    sort: typeof opts.sort;
  };
} | null> {
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) return null;

  const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole);
  if (!canPreview && !isPublicCatalogSale(sale)) return null;

  const page = await deps.lotRepo.listCatalogLotsBySalePage({
    saleId,
    sort: opts.sort ?? "lot",
    limit: opts.limit,
    offset: opts.offset,
    ...(canPreview
      ? {}
      : {
          lotStatuses: [...PUBLIC_LOT_STATUSES],
          requirePublicSale: true,
        }),
  });
  const items = await presentLotsImages(deps.mediaUrlResolver, page.items, deps.mediaAssetEnricher);
  return {
    data: {
      items,
      total: page.total,
      limit: opts.limit,
      offset: opts.offset,
      sort: opts.sort,
    },
  };
}

/** Paginated lots for a sale; used by the saleroom catalog (server-side pagination). */
export async function listLotsPage(
  deps: SaleServiceDeps,
  saleId: string,
  opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
): Promise<{ items: Lot[]; total: number } | null> {
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) return null;
  return deps.lotRepo.listCatalogLotsBySalePage({
    saleId,
    sort: opts.sort ?? "lot",
    limit: opts.limit,
    offset: opts.offset,
  });
}

/** Read sale by id for joins (e.g. portfolio pricing). Resolves cover image URLs when configured. */
export async function getById(deps: SaleServiceDeps, id: string): Promise<Sale | null> {
  const row = await deps.saleRepo.findById(id);
  if (!row) return null;
  return presentSaleImages(deps.mediaUrlResolver, row, deps.mediaAssetEnricher);
}

/** Batch read by ids — single DB round trip for portfolio / lot-list pricing joins. */
export async function findByIds(deps: SaleServiceDeps, ids: string[]): Promise<Sale[]> {
  if (ids.length === 0) return [];
  const rows = await deps.saleRepo.findByIds(ids);
  return Promise.all(
    rows.map((r) => presentSaleImages(deps.mediaUrlResolver, r, deps.mediaAssetEnricher)),
  );
}
