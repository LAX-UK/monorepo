import type { ExportColumn, ExportEntityType, ExportRow } from "../types.js";

export type ExportAuthContext = {
  userId: string;
  userRole: string;
  userStaffRole?: string | null;
};

export type ExportProvider<TFilters extends Record<string, unknown> = Record<string, unknown>> = {
  entityType: ExportEntityType;
  authorize(ctx: ExportAuthContext, filters: TFilters): void | Promise<void>;
  columns(ctx: ExportAuthContext, filters: TFilters): ExportColumn[];
  estimateCount(ctx: ExportAuthContext, filters: TFilters): Promise<number>;
  streamRows(ctx: ExportAuthContext, filters: TFilters): AsyncGenerator<ExportRow>;
  filterSummary(_ctx: ExportAuthContext, filters: TFilters): string;
};

export async function* batchedRows<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  mapRow: (row: T) => ExportRow,
  pageSize = 1000,
): AsyncGenerator<ExportRow> {
  let offset = 0;
  while (true) {
    const page = await fetchPage(offset, pageSize);
    if (page.length === 0) break;
    for (const row of page) yield mapRow(row);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
}
