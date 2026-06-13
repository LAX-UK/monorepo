import type { Lot, LotSummary, Sale } from "@auction/types";
import {
  isPublicCatalogLot,
  isPublicCatalogSale,
  resolvePublicSaleListFilter,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import { mapLotToSummary } from "../lib/mappers.js";
import { presentSalesWithLotsImages } from "../lib/media-presenters.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";

const PREVIEW_LOTS_PER_SALE = 4;

export type SaleListItem = {
  sale: Sale;
  lotCount: number;
  previewLots: LotSummary[];
};

export interface ISaleListReadService {
  listForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: SaleListItem[] }>;
}

export class SaleListReadService implements ISaleListReadService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly catalogueMediaUrlResolver: MediaUrlResolver,
    private readonly mediaAssetEnricher: MediaAssetEnricher,
  ) {}

  async listForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: SaleListItem[] }> {
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

    const sales = await this.saleRepo.list(queryFilter);
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

    const data = presented
      .filter(({ sale }) => canPreview || isPublicCatalogSale(sale))
      .map(({ sale, lots }) => {
        const visibleLots = canPreview ? lots : lots.filter((lot) => isPublicCatalogLot(lot, sale));
        return {
          sale,
          lotCount: lotCounts.get(sale.id) ?? visibleLots.length,
          previewLots: visibleLots.map(mapLotToSummary),
        };
      });

    return { data };
  }
}
