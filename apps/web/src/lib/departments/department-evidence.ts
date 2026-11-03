import { formatLondonDate } from "@/lib/datetime/london-time";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import type { SaleListRow } from "@/lib/sale-list-row";
import type { Category, Lot } from "@auction/types";

/** The most works a department page shows in either row. */
export const DEPARTMENT_ROW_LIMIT = 4;

export type DepartmentDeadline = {
  /** "15 Jan 2026". */
  date: string;
  saleTitle: string;
  saleId: string;
};

export type DepartmentSoldWork = {
  lot: Lot;
};

export type DepartmentEvidence = {
  categoryId: string;
  /** Link to every sold work in the department. */
  soldHref: string;
  /** Link to every work on sale in the department. */
  onSaleHref: string;
  sold: DepartmentSoldWork[];
  onSale: Lot[];
  deadline: DepartmentDeadline | null;
};

/** The department's category by its slug; archived categories are not departments. */
export function findDepartmentCategory(
  categories: readonly Category[],
  slug: string,
): Category | null {
  return categories.find((category) => category.slug === slug && !category.archived) ?? null;
}

/** Sold works only; the card reads the buyer's price from the lot's own total. */
export function soldWorks(
  lots: readonly Lot[],
  limit = DEPARTMENT_ROW_LIMIT,
): DepartmentSoldWork[] {
  return lots
    .filter((lot) => lot.status === "ended" && lotWasSold(lot))
    .slice(0, limit)
    .map((lot) => ({ lot }));
}

/** Works open for bidding or coming up, the next to close first. */
export function onSaleWorks(lots: readonly Lot[], limit = DEPARTMENT_ROW_LIMIT): Lot[] {
  return lots
    .filter((lot) => lot.status === "active" || lot.status === "scheduled")
    .slice(0, limit);
}

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The soonest consignment deadline still ahead on a sale that takes the department. A sale with
 * no categories is a general sale and takes every department.
 */
export function nextConsignmentDeadline(
  rows: readonly SaleListRow[],
  categoryId: string,
  now: Date,
): DepartmentDeadline | null {
  const candidates = rows
    .filter(({ sale }) => {
      const ids = sale.categoryIds?.length ? sale.categoryIds : [];
      return ids.length === 0 || ids.includes(categoryId);
    })
    .flatMap(({ sale }) => {
      const date = sale.consignmentDeadline ? toDate(sale.consignmentDeadline) : null;
      return date && date.getTime() > now.getTime() ? [{ date, sale }] : [];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = candidates[0];
  if (!next) return null;
  return {
    date: formatLondonDate(next.date),
    saleTitle: next.sale.title,
    saleId: next.sale.id,
  };
}

/** True when there is anything to show; a page with no evidence stays the plain text page. */
export function hasDepartmentEvidence(
  evidence: Pick<DepartmentEvidence, "sold" | "onSale" | "deadline">,
): boolean {
  return evidence.sold.length > 0 || evidence.onSale.length > 0 || evidence.deadline !== null;
}
