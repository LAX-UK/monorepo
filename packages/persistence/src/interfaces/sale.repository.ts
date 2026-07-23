import type { CreateSaleInput, Sale, SaleStatus } from "@auction/types";
import type { ListSalesFilter } from "./filters.js";

export interface ISaleRepository {
  findById(id: string): Promise<Sale | null>;
  /** Batch fetch by ids — returns only the rows that exist (order not guaranteed). */
  findByIds(ids: string[]): Promise<Sale[]>;
  create(input: CreateSaleInput): Promise<Sale>;
  list(filter: ListSalesFilter): Promise<Sale[]>;
  countMatching(filter: Omit<ListSalesFilter, "limit" | "offset" | "sort">): Promise<number>;
  /** Sales that may need status sync after lot transitions. */
  findWithStatuses(statuses: SaleStatus[]): Promise<Sale[]>;
  update(id: string, patch: Partial<CreateSaleInput>): Promise<Sale>;
  updateStatus(id: string, status: SaleStatus): Promise<void>;
  /** UTC day counts for admin KPI trends (created_at >= rangeStart, non-deleted sales). */
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
  /** Average non-deleted lots per non-deleted sale. */
  avgLotsPerSale(): Promise<number>;
}
