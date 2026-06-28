import type {
  PressArchiveEntry,
  PressArchiveSaleRef,
  PressDayMediaSaleSummary,
  PressSitemapSaleFreshness,
  Sale,
  SalePressRef,
} from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import type {
  IPressArchiveRepository,
  ListPressArchiveFilter,
  PressCoveragePageResult,
} from "../services/interfaces/press-archive.repository.js";
import type { ISaleRepository } from "../services/interfaces/repositories.js";

const SALES_PAGE_SIZE = 200;

function toSaleRef(sale: Sale): PressArchiveSaleRef {
  return {
    id: sale.id,
    title: sale.title,
    status: sale.status,
    deliveryMode: sale.deliveryMode,
    endTime: sale.endTime,
    updatedAt: sale.updatedAt,
  };
}

function entrySortKey(entry: PressArchiveEntry): number {
  const published = entry.item.publishedAt;
  if (published) {
    const t = Date.parse(`${published}T12:00:00Z`);
    if (Number.isFinite(t)) return t;
  }
  return entry.sale.endTime?.getTime() ?? entry.sale.updatedAt.getTime();
}

function matchesYear(item: SalePressRef, year: number): boolean {
  if (!item.publishedAt) return false;
  const y = Number.parseInt(item.publishedAt.slice(0, 4), 10);
  return y === year;
}

function matchesQuery(entry: PressArchiveEntry, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${entry.sale.title} ${entry.item.headline} ${entry.item.outletName}`
    .toLowerCase()
    .includes(needle);
}

function flattenSales(sales: Sale[]): PressArchiveEntry[] {
  const out: PressArchiveEntry[] = [];
  for (const sale of sales) {
    const items = sale.pressCoverage ?? [];
    if (items.length === 0) continue;
    const saleRef = toSaleRef(sale);
    for (const item of items) {
      out.push({ sale: saleRef, item });
    }
  }
  return out;
}

function filterEntries(
  entries: PressArchiveEntry[],
  filter: Omit<ListPressArchiveFilter, "limit" | "offset" | "statuses">,
): PressArchiveEntry[] {
  return entries.filter((entry) => {
    if (filter.year != null && !matchesYear(entry.item, filter.year)) return false;
    if (filter.q && !matchesQuery(entry, filter.q)) return false;
    return true;
  });
}

function maxDate(dates: Array<Date | null | undefined>): Date | null {
  let max: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!max || d.getTime() > max.getTime()) max = d;
  }
  return max;
}

function computeAvailableYears(entries: PressArchiveEntry[]): number[] {
  const years = new Set<number>();
  for (const entry of entries) {
    const publishedAt = entry.item.publishedAt;
    if (!publishedAt) continue;
    const y = Number.parseInt(publishedAt.slice(0, 4), 10);
    if (Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

function computeFreshness(entries: PressArchiveEntry[]): Date | null {
  const dates: Date[] = [];
  for (const entry of entries) {
    if (entry.item.publishedAt) {
      const t = Date.parse(`${entry.item.publishedAt}T12:00:00Z`);
      if (Number.isFinite(t)) dates.push(new Date(t));
    }
    if (entry.sale.endTime) dates.push(entry.sale.endTime);
    dates.push(entry.sale.updatedAt);
  }
  return maxDate(dates);
}

export class SalePressArchiveRepository implements IPressArchiveRepository {
  constructor(private readonly saleRepo: ISaleRepository) {}

  private async loadEndedSales(statuses: ListPressArchiveFilter["statuses"]): Promise<Sale[]> {
    const all: Sale[] = [];
    let offset = 0;
    while (true) {
      const batch = await this.saleRepo.list({
        statuses,
        limit: SALES_PAGE_SIZE,
        offset,
        sort: "startAsc",
      });
      all.push(...batch);
      if (batch.length < SALES_PAGE_SIZE) break;
      offset += SALES_PAGE_SIZE;
    }
    return all;
  }

  async listCoveragePage(filter: ListPressArchiveFilter): Promise<PressCoveragePageResult> {
    const sales = await this.loadEndedSales(filter.statuses);
    const allEntries = flattenSales(sales).sort((a, b) => entrySortKey(b) - entrySortKey(a));
    const availableYears = computeAvailableYears(allEntries);
    const filtered = filterEntries(allEntries, filter);
    return {
      data: filtered.slice(filter.offset, filter.offset + filter.limit),
      total: filtered.length,
      lastUpdated: computeFreshness(filtered),
      availableYears,
    };
  }

  async listDayMediaSales(params: {
    statuses: ListPressArchiveFilter["statuses"];
    limit: number;
  }): Promise<PressDayMediaSaleSummary[]> {
    const sales = await this.loadEndedSales(params.statuses);
    return sales
      .filter(
        (s) =>
          isSaleroomDeliveryMode(s.deliveryMode) &&
          (s.dayImages?.length ?? s.dayImageAssets?.length ?? 0) > 0,
      )
      .sort((a, b) => (b.endTime?.getTime() ?? 0) - (a.endTime?.getTime() ?? 0))
      .slice(0, params.limit)
      .map((s) => ({
        id: s.id,
        title: s.title,
        deliveryMode: s.deliveryMode,
        endTime: s.endTime,
        coverImages: s.coverImages,
        dayImageCount: s.dayImageAssets?.length ?? s.dayImages?.length ?? 0,
      }));
  }

  async listSitemapFreshness(params: {
    statuses: ListPressArchiveFilter["statuses"];
  }): Promise<PressSitemapSaleFreshness[]> {
    const sales = await this.loadEndedSales(params.statuses);
    return sales
      .filter((s) => (s.pressCoverage?.length ?? 0) > 0 || (s.dayImages?.length ?? 0) > 0)
      .map((s) => {
        const pressDates =
          s.pressCoverage
            ?.map((item) => (item.publishedAt ? new Date(`${item.publishedAt}T12:00:00Z`) : null))
            .filter((d): d is Date => d instanceof Date && Number.isFinite(d.getTime())) ?? [];
        const lastModified = maxDate([s.updatedAt, s.endTime, ...pressDates]) ?? s.updatedAt;
        const previewImageSrc =
          s.dayImageAssets?.[0]?.src ?? s.dayImages?.[0]?.key ?? s.coverImages[0] ?? null;
        return {
          saleId: s.id,
          title: s.title,
          lastModified,
          previewImageSrc,
        };
      });
  }
}
