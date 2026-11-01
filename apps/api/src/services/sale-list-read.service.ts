import type { SaleResultsSummary } from "@auction/domain";
import type {
  ILotRepository,
  ISaleChannelReader,
  ISaleRepository,
} from "@auction/persistence/interfaces";
import type { Lot, LotSummary, Sale, StaffRoles } from "@auction/types";
import {
  isPublicCatalogLot,
  isPublicCatalogSale,
  resolvePublicSaleListFilter,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import { mapLotToSummary } from "../lib/mappers.js";
import { presentSalesWithLotsImages } from "../lib/media-presenters.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { ISaleResultsSummaryService } from "./sale-results-summary.service.js";
import { withSellingPlatforms } from "./sale-selling-platform.js";

const PREVIEW_LOTS_PER_SALE = 4;

export type SaleListItem = {
  sale: Sale;
  lotCount: number;
  previewLots: LotSummary[];
  /** Results once the sale has ended (or is finalising); `null` before that. */
  resultsSummary: SaleResultsSummary | null;
};

export interface ISaleListReadService {
  listForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
  ): Promise<{ data: SaleListItem[] }>;
}

export class SaleListReadService implements ISaleListReadService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly catalogueMediaUrlResolver: MediaUrlResolver,
    private readonly mediaAssetEnricher: MediaAssetEnricher,
    private readonly saleChannelReader: Pick<ISaleChannelReader, "getSaleOwnerships"> | null = null,
    private readonly resultsSummaries: ISaleResultsSummaryService | null = null,
  ) {}

  async listForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined },
  ): Promise<{ data: SaleListItem[] }> {
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

    const sales = await withSellingPlatforms(
      this.saleChannelReader,
      await this.saleRepo.list(queryFilter),
    );
    if (sales.length === 0) return { data: [] };

    const saleIds = sales.map((s) => s.id);
    const visibilityOpts = canPreview ? undefined : { publicOnly: true as const };
    const [lotCounts, previewLots] = await Promise.all([
      this.lotRepo.countLotsBySaleIds(saleIds, visibilityOpts),
      this.lotRepo.findPreviewLotsBySaleIds(saleIds, PREVIEW_LOTS_PER_SALE, visibilityOpts),
    ]);

    const previewsBySale = new Map<string, Lot[]>();
    for (const lot of previewLots) {
      if (!lot.saleId) continue;
      const arr = previewsBySale.get(lot.saleId) ?? [];
      arr.push(lot);
      previewsBySale.set(lot.saleId, arr);
    }

    const rows = sales.map((sale) => ({
      sale,
      lots: previewsBySale.get(sale.id) ?? [],
    }));

    const presented = await presentSalesWithLotsImages(
      this.catalogueMediaUrlResolver,
      rows,
      this.mediaAssetEnricher,
    );

    const visible = presented.filter(({ sale }) => canPreview || isPublicCatalogSale(sale));
    const summaries = await (this.resultsSummaries?.summarise(visible.map(({ sale }) => sale)) ??
      new Map<string, SaleResultsSummary>());
    const data = visible.map(({ sale, lots }) => {
      const visibleLots = canPreview ? lots : lots.filter((lot) => isPublicCatalogLot(lot, sale));
      return {
        sale,
        lotCount: lotCounts.get(sale.id) ?? visibleLots.length,
        previewLots: visibleLots.map(mapLotToSummary),
        resultsSummary: summaries.get(sale.id) ?? null,
      };
    });

    return { data };
  }
}
