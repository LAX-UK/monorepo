import "server-only";

import type { ArchiveLotVM } from "@/components/sections/archive/catalog-archive-views";
import {
  type ArchivePageQuery,
  buildArchivePageQuery,
  countActiveArchiveFilters,
} from "@/lib/archive/build-archive-params";
import { getServerArchiveMetricsReader, getServerLotReader } from "@/lib/catalog/catalog.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { type LoadResult, settle } from "@/lib/marketing/load-result";
import type { Category, Lot } from "@auction/types";

const PRIVATE_SELLER = "Private seller";

export type ResultsLotsPage = {
  query: ArchivePageQuery;
  items: ArchiveLotVM[];
  lots: Lot[];
  categories: Category[];
  totalCount: number;
  totalPages: number;
  hasActiveFilters: boolean;
  currentUserId: string | null;
};

type SellerNames = ReadonlyMap<string, string>;

async function loadSellerNames(lots: readonly Lot[]): Promise<SellerNames> {
  const publicReader = await getServerPublicUserReader();
  const sellerIds = [
    ...new Set(
      lots
        .map((lot) => lot.sellerId ?? lot.sellerLegalEntityId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const entries = await Promise.all(
    sellerIds.map(async (id) => {
      const user = await publicReader.getById(id).catch(() => null);
      return [id, user?.name ?? PRIVATE_SELLER] as const;
    }),
  );
  return new Map(entries);
}

/** Sold works for the Lots view, filtered and sorted from the URL. A failed read is not "no lots". */
export async function loadResultsLots(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<LoadResult<ResultsLotsPage>> {
  const query = buildArchivePageQuery(searchParams);
  return settle("results lots", async () => {
    const [categoryReader, metricsReader, lotReader, session] = await Promise.all([
      getServerCategoryReader(),
      getServerArchiveMetricsReader(),
      getServerLotReader(),
      getServerSessionUser(),
    ]);
    const [categories, totalCount, lots] = await Promise.all([
      categoryReader.listWithPublishedLots(),
      metricsReader.countEndedLots({
        ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
        ...(query.endYear !== undefined ? { endYear: query.endYear } : {}),
      }),
      lotReader.list(query.listParams),
    ]);
    const sellerNames = await loadSellerNames(lots);
    return {
      query,
      lots,
      items: lots.map((lot) => ({
        auction: lot,
        sellerName:
          sellerNames.get(lot.sellerId ?? lot.sellerLegalEntityId ?? "") ?? PRIVATE_SELLER,
      })),
      categories,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
      hasActiveFilters: countActiveArchiveFilters(query) > 0,
      currentUserId: session?.id ?? null,
    };
  });
}
