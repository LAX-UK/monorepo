import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import { getServerRelatedSales, getServerSaleFollowState } from "@/lib/data/http/saleroom.server";
import {
  type SaleLotsPage,
  type SaleShell,
  getServerSaleLotsPage,
  getServerSaleShell,
} from "@/lib/data/http/sales.server";
import { getServerTelephoneBookingForSale } from "@/lib/data/http/telephone-booking.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { isKycStatusUnavailableError } from "@/lib/kyc/kyc-status-unavailable-error";
import type { SaleroomCatalogSort } from "@/lib/marketing/saleroom-catalog-sort";
import type { SaleroomCatalogStatusFilter } from "@/lib/marketing/saleroom-page.query";
import type { Category, Lot, Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

const CATALOG_LOAD_ALL_BATCH = 48;
export const SALE_CATALOG_LOAD_ALL_CAP = 200;

function resolveSaleCategoryLabels(sale: Sale, categories: Category[]): string[] {
  const ids =
    sale.categoryIds && sale.categoryIds.length > 0
      ? sale.categoryIds
      : sale.categoryId
        ? [sale.categoryId]
        : [];
  if (ids.length === 0 || categories.length === 0) return [];
  return ids
    .map((id) => categories.find((c) => c.id === id)?.name ?? null)
    .filter((name): name is string => Boolean(name));
}

export type SaleroomShellData = {
  shell: SaleShell;
  lotsPage: SaleLotsPage;
  categories: Category[];
  categoryLabel: string | null;
  categoryLabels: string[];
};

export type SaleroomSecondaryData = {
  follow: { isFollowing: boolean };
  relatedSales: Awaited<ReturnType<typeof getServerRelatedSales>>;
  kycSummary: Awaited<ReturnType<typeof getServerKycStatusSummary>> | null;
  kycUnavailable: boolean;
  watchedLotIds: ReadonlySet<string>;
  telephoneBooking: Awaited<ReturnType<typeof getServerTelephoneBookingForSale>> | null;
};

async function loadAllCatalogPages(id: string, sort: SaleroomCatalogSort): Promise<SaleLotsPage> {
  const first = await getServerSaleLotsPage({
    id,
    page: 1,
    pageSize: CATALOG_LOAD_ALL_BATCH,
    sort,
  });
  if (!first) throw new Error("notfound");
  const cap = Math.min(SALE_CATALOG_LOAD_ALL_CAP, first.total);
  const items = [...first.items];
  const totalPages = Math.ceil(cap / CATALOG_LOAD_ALL_BATCH);
  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        getServerSaleLotsPage({
          id,
          page: i + 2,
          pageSize: CATALOG_LOAD_ALL_BATCH,
          sort,
        }),
      ),
    );
    for (const page of rest) {
      if (page) items.push(...page.items);
    }
  }
  return { ...first, items: items.slice(0, cap), limit: cap, offset: 0 };
}

export class SaleroomPageDataService {
  async loadShell(input: {
    saleId: string;
    page: number;
    sort: SaleroomCatalogSort;
    loadAll: boolean;
    pageSize: number;
  }): Promise<SaleroomShellData | null> {
    const [shell, categories] = await Promise.all([
      getServerSaleShell(input.saleId),
      getServerCategoryReader()
        .then((r) => r.list())
        .catch((): Category[] => []),
    ]);
    if (!shell) return null;

    const lotsPage = input.loadAll
      ? await loadAllCatalogPages(input.saleId, input.sort)
      : await getServerSaleLotsPage({
          id: input.saleId,
          page: input.page,
          pageSize: input.pageSize,
          sort: input.sort,
        });
    if (!lotsPage) return null;

    const categoryLabels = resolveSaleCategoryLabels(shell.sale, categories);
    const categoryLabel = categoryLabels[0] ?? null;

    return { shell, lotsPage, categories, categoryLabel, categoryLabels };
  }

  async loadSecondary(
    saleId: string,
    sale: Sale,
    session: SessionUser | null,
  ): Promise<SaleroomSecondaryData> {
    const categoryId = sale.categoryId ?? null;
    const [follow, relatedSales, kycLookup, watchedLotIds, telephoneBooking] = await Promise.all([
      session
        ? getServerSaleFollowState(saleId).catch(() => ({ isFollowing: false }))
        : Promise.resolve({ isFollowing: false }),
      getServerRelatedSales({ id: saleId, categoryId, limit: 4 }).catch(() => []),
      session
        ? getServerKycStatusSummary()
            .then((summary) => ({ summary, unavailable: false }))
            .catch((error) => {
              if (isKycStatusUnavailableError(error)) {
                return { summary: null, unavailable: true };
              }
              throw error;
            })
        : Promise.resolve({ summary: null, unavailable: false }),
      session ? getServerWatchedLotIdSet() : Promise.resolve(new Set<string>()),
      session && isSaleroomDeliveryMode(sale.deliveryMode)
        ? getServerTelephoneBookingForSale(saleId).catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      follow,
      relatedSales,
      kycSummary: kycLookup.summary,
      kycUnavailable: kycLookup.unavailable,
      watchedLotIds,
      telephoneBooking,
    };
  }

  filterCatalogLots(
    lots: Lot[],
    options: {
      statusFilter: SaleroomCatalogStatusFilter | null;
      catalogSearch: string;
    },
  ): Lot[] {
    const searchNeedle = options.catalogSearch.toLowerCase();
    const accumulatedLotIds = new Set<string>();
    return lots.filter((lot) => {
      if (accumulatedLotIds.has(lot.id)) return false;
      accumulatedLotIds.add(lot.id);
      if (options.statusFilter === "live" && lot.status !== "active") return false;
      if (options.statusFilter === "upcoming" && lot.status !== "scheduled") return false;
      if (options.statusFilter === "ended" && lot.status !== "ended") return false;
      if (searchNeedle && !lot.title.toLowerCase().includes(searchNeedle)) return false;
      return true;
    });
  }
}

export const saleroomPageDataService = new SaleroomPageDataService();
