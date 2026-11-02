import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale, StaffRoles, WithdrawnLotView } from "@auction/types";
import {
  isPublicCatalogLot,
  isPublicCatalogSale,
  isPublicCatalogueLot,
  resolvePublicSaleListFilter,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import { presentCatalogueRowForPublic } from "../../lib/lot-public-view.js";
import {
  presentLotsImages,
  presentSaleAdminImages,
  presentSaleImages,
  presentSalesWithLotsImages,
} from "../../lib/media-presenters.js";
import {
  withAtgLotResults,
  withSellingPlatform,
  withSellingPlatforms,
} from "../sale-selling-platform.js";
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
  viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
): Promise<{
  data: { sale: Sale; lots: (Lot | WithdrawnLotView)[]; viewer: { isFollowing: boolean } };
} | null> {
  const bundle = await getByIdWithLots(deps, saleId);
  if (!bundle) return null;

  const saleWithPlatform = await withSellingPlatform(deps.saleChannelReader, bundle.sale);
  const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRoles);
  // A cancelled sale keeps its address so a link someone was given lands on a notice; it reads as
  // the sale and nothing of its catalogue.
  const cancelledNotice = !canPreview && saleWithPlatform.status === "cancelled";
  if (!canPreview && !cancelledNotice && !isPublicCatalogSale(saleWithPlatform)) return null;

  const isFollowing =
    viewerUserId && deps.saleFollowReader
      ? await deps.saleFollowReader.isFollowing(viewerUserId, saleId)
      : false;
  const [sale, lots] = await Promise.all([
    presentSaleImages(deps.mediaUrlResolver, saleWithPlatform, deps.mediaAssetEnricher),
    cancelledNotice
      ? Promise.resolve([])
      : withAtgLotResults(deps.saleChannelReader, saleWithPlatform, bundle.lots).then((rows) =>
          presentLotsImages(deps.mediaUrlResolver, rows, deps.mediaAssetEnricher),
        ),
  ]);
  const visibleLots = canPreview
    ? lots
    : lots
        .filter((lot) => isPublicCatalogueLot(lot, saleWithPlatform))
        .map(presentCatalogueRowForPublic);
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
  viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
): Promise<{ data: { sale: Sale; lots: Lot[] }[] }> {
  const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRoles);
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
    ...(canPreview ? {} : { includeAtgOwnedDrafts: true }),
  };
  const rows = await list(deps, queryFilter);
  const data = await presentSalesWithLotsImages(
    deps.catalogueMediaUrlResolver,
    rows,
    deps.mediaAssetEnricher,
  );
  if (canPreview) return { data };
  const sales = await withSellingPlatforms(
    deps.saleChannelReader,
    data.map(({ sale }) => sale),
  );
  const enriched = data.map((row, i) => ({ sale: sales[i] ?? row.sale, lots: row.lots }));
  return {
    data: enriched
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
  viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
): Promise<{
  data: {
    items: (Lot | WithdrawnLotView)[];
    total: number;
    limit: number;
    offset: number;
    sort: typeof opts.sort;
  };
} | null> {
  const saleRow = await deps.saleRepo.findById(saleId);
  if (!saleRow) return null;
  const sale = await withSellingPlatform(deps.saleChannelReader, saleRow);

  const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRoles);
  if (!canPreview && !isPublicCatalogSale(sale)) return null;

  const page = await deps.lotRepo.listCatalogLotsBySalePage({
    saleId,
    sort: opts.sort ?? "lot",
    limit: opts.limit,
    offset: opts.offset,
    ...(canPreview
      ? {}
      : {
          requirePublicSale: true,
        }),
  });
  const items = await presentLotsImages(
    deps.mediaUrlResolver,
    await withAtgLotResults(deps.saleChannelReader, sale, page.items),
    deps.mediaAssetEnricher,
  );
  return {
    data: {
      items: canPreview ? items : items.map(presentCatalogueRowForPublic),
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

/** Sale row plus computed ATG/LAX selling platform for public catalogue guards. */
export async function getByIdForPublicCatalog(
  deps: SaleServiceDeps,
  id: string,
): Promise<Sale | null> {
  const row = await deps.saleRepo.findById(id);
  if (!row) return null;
  return withSellingPlatform(deps.saleChannelReader, row);
}

/** Batch read by ids — single DB round trip for portfolio / lot-list pricing joins. */
export async function findByIds(deps: SaleServiceDeps, ids: string[]): Promise<Sale[]> {
  if (ids.length === 0) return [];
  const rows = await deps.saleRepo.findByIds(ids);
  return Promise.all(
    rows.map((r) => presentSaleImages(deps.mediaUrlResolver, r, deps.mediaAssetEnricher)),
  );
}
