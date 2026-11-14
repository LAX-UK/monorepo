import "server-only";

import {
  getPublicCategories,
  getPublicRelatedSales,
  getPublicSaleLotsPage,
  getPublicSaleShell,
} from "@/lib/data/http/public-catalogue.server";
import type { GetSaleLotsPageParams, SaleLotsPage, SaleShell } from "@/lib/data/http/sales.types";
import type { SaleroomCatalogSort } from "@/lib/marketing/saleroom-catalog-sort";
import type { SaleroomCatalogStatusFilter } from "@/lib/marketing/saleroom-page.query";
import type { Category, Lot, Sale } from "@auction/types";

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

/** What the sale page shows besides the sale and its lots; the same for everyone. */
export type SaleroomPublicSecondaryData = {
  relatedSales: Awaited<ReturnType<typeof getPublicRelatedSales>>;
};

/**
 * Where the page reads the sale and its catalogue. `public` is the session-free, tagged read
 * every visitor gets. `staffPreview` is only used for a sale the public cannot see (the API
 * answered 404 to a signed-out read) and a staff member may preview: those reads carry the
 * person's session and are never cached.
 */
export type SaleroomReads = {
  shell(saleId: string): Promise<SaleShell | null>;
  lotsPage(params: GetSaleLotsPageParams): Promise<SaleLotsPage | null>;
};

export const PUBLIC_SALEROOM_READS: SaleroomReads = {
  shell: getPublicSaleShell,
  lotsPage: getPublicSaleLotsPage,
};

async function loadAllCatalogPages(
  reads: SaleroomReads,
  id: string,
  sort: SaleroomCatalogSort,
): Promise<SaleLotsPage> {
  const first = await reads.lotsPage({
    id,
    page: 1,
    pageSize: CATALOG_LOAD_ALL_BATCH,
    sort,
  });
  if (!first) throw new Error("notfound");
  const cap = Math.min(SALE_CATALOG_LOAD_ALL_CAP, first.total);
  const items = [...first.items];
  const totalPages = Math.ceil(cap / CATALOG_LOAD_ALL_BATCH);
  const rest =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            reads.lotsPage({
              id,
              page: i + 2,
              pageSize: CATALOG_LOAD_ALL_BATCH,
              sort,
            }),
          ),
        )
      : [];
  for (const page of rest) {
    if (page) items.push(...page.items);
  }
  const withdrawn = [...first.withdrawn];
  for (const page of rest) {
    if (page) withdrawn.push(...page.withdrawn);
  }
  return { ...first, items: items.slice(0, cap), withdrawn, limit: cap, offset: 0 };
}

function emptyLotsPage(sort: SaleroomCatalogSort): SaleLotsPage {
  return { items: [], withdrawn: [], total: 0, limit: 0, offset: 0, sort };
}

/** Lots the hang may draw from when the sale has no featured lots: the best by price. */
const HANG_TOP_LOTS_PAGE_SIZE = 48;

export class SaleroomPageDataService {
  constructor(private readonly reads: SaleroomReads = PUBLIC_SALEROOM_READS) {}

  /** The same service over other reads (the staff preview of a sale the public cannot see). */
  withReads(reads: SaleroomReads): SaleroomPageDataService {
    return new SaleroomPageDataService(reads);
  }

  /**
   * The lots the hang chooses from. The catalogue page may hold only part of the sale, so the rest
   * is read here: every lot when staff featured some (they can be anywhere), else the top lots by
   * price. The hang is a highlight, so a failed read leaves it out and never fails the page.
   */
  async loadHangLots(saleId: string, sale: Sale, lotsPage: SaleLotsPage): Promise<Lot[]> {
    if (lotsPage.items.length >= lotsPage.total) return lotsPage.items;
    try {
      if ((sale.featuredLotIds?.length ?? 0) >= 2) {
        return (await loadAllCatalogPages(this.reads, saleId, "lot")).items;
      }
      const top = await this.reads.lotsPage({
        id: saleId,
        page: 1,
        pageSize: HANG_TOP_LOTS_PAGE_SIZE,
        sort: "priceDesc",
      });
      return top?.items ?? [];
    } catch {
      return [];
    }
  }

  async loadShell(input: {
    saleId: string;
    page: number;
    sort: SaleroomCatalogSort;
    loadAll: boolean;
    pageSize: number;
  }): Promise<SaleroomShellData | null> {
    const [shell, categories] = await Promise.all([
      this.reads.shell(input.saleId),
      getPublicCategories(),
    ]);
    if (!shell) return null;

    // A cancelled sale is a notice; its catalogue is not read.
    const lotsPage =
      shell.sale.status === "cancelled"
        ? emptyLotsPage(input.sort)
        : input.loadAll
          ? await loadAllCatalogPages(this.reads, input.saleId, input.sort)
          : await this.reads.lotsPage({
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

  /** Related sales: public, cached, and a failure only leaves the rail out. */
  async loadSecondary(saleId: string, sale: Sale): Promise<SaleroomPublicSecondaryData> {
    const relatedSales = await getPublicRelatedSales({
      id: saleId,
      categoryId: sale.categoryId ?? null,
      limit: 4,
    }).catch(() => []);
    return { relatedSales };
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
