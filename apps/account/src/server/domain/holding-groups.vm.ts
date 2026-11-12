import {
  type CurrencyTotal,
  type HoldingRowVm,
  type LaxPortfolioItemStatus,
  type LaxPortfolioItemV1,
  paidAmounts,
  sumByCurrency,
} from "@auction/lax-ecosystem";
import { STATUS_LABELS, mostUrgentStatus } from "./portfolio-labels";

/** The label shown on a group whose copies are not all in the same status. */
export const MIXED_STATUS_LABEL = "Mixed";

/**
 * Copies of one artwork in one product, listed as a single row that expands. A group of one
 * copy is not expanded: it stays an ordinary row.
 */
export type HoldingGroupVm = {
  key: string;
  /** The copies, numbered ones first in numeric order, then those without a number. */
  rows: HoldingRowVm[];
  /** The first copy: it names the artwork and gives its image, artist and product. */
  lead: HoldingRowVm;
  /** Everything paid across the copies, one subtotal per currency. */
  paid: CurrencyTotal[];
  /** What the copies awaiting payment still cost, one subtotal per currency. */
  due: CurrencyTotal[];
  documentsAvailable: number;
  documentsExpected: number;
  /** The most recent acquisition among the copies. */
  acquiredAt: string;
  /** The status shown on the row: the copies' shared status, or the most urgent one if they differ. */
  status: LaxPortfolioItemStatus;
  /** True when the copies are not all in the same status. */
  mixed: boolean;
};

const COPY_NUMBER = /\bNo\.\s*(\d+)\s+of\s+(\d+)/;

function copyNumber(item: LaxPortfolioItemV1): { number: number; label: string } | null {
  const match = COPY_NUMBER.exec(item.edition ?? "");
  return match ? { number: Number(match[1]), label: `No. ${match[1]} of ${match[2]}` } : null;
}

/** How a copy is named in a group: its number in the edition, or its status when it has none. */
export function copyLabel(item: LaxPortfolioItemV1): string {
  return copyNumber(item)?.label ?? STATUS_LABELS[item.status];
}

function byCopyNumber(a: HoldingRowVm, b: HoldingRowVm): number {
  const left = copyNumber(a.item)?.number;
  const right = copyNumber(b.item)?.number;
  if (left !== undefined && right !== undefined) return left - right;
  if (left !== undefined) return -1;
  return right !== undefined ? 1 : 0;
}

/** An artwork in a product. A work without a title is never merged with another. */
function artworkKey(row: HoldingRowVm): string | null {
  const { product, title, artist } = row.item;
  const name = title.trim().toLocaleLowerCase();
  if (!name) return null;
  return `${product}\u0000${name}\u0000${artist.trim().toLocaleLowerCase()}`;
}

function describeGroup(key: string, copies: HoldingRowVm[]): HoldingGroupVm {
  const rows = [...copies].sort(byCopyNumber);
  const [lead, ...rest] = rows;
  if (!lead) throw new Error("A holding group has at least one copy");
  const statuses = rows.map((row) => row.item.status) as [
    LaxPortfolioItemStatus,
    ...LaxPortfolioItemStatus[],
  ];
  return {
    key,
    rows,
    lead,
    paid: sumByCurrency(rows.flatMap((row) => paidAmounts(row.item))),
    due: sumByCurrency(rows.flatMap((row) => row.due)),
    documentsAvailable: rows.reduce((sum, row) => sum + row.documentsAvailable, 0),
    documentsExpected: rows.reduce((sum, row) => sum + row.documentsExpected, 0),
    acquiredAt: rows.map((row) => row.item.acquiredAt).reduce((a, b) => (b > a ? b : a)),
    status: mostUrgentStatus(statuses),
    mixed: rest.some((row) => row.item.status !== lead.item.status),
  };
}

/**
 * One group per artwork and product, in the order each first appears, so the list keeps the
 * order the person chose. Filtering has already happened by the time rows arrive, so a group
 * holds only the copies that matched.
 */
export function groupHoldingRows(rows: readonly HoldingRowVm[]): HoldingGroupVm[] {
  const order: string[] = [];
  const byKey = new Map<string, HoldingRowVm[]>();
  for (const row of rows) {
    const key = artworkKey(row) ?? `single\u0000${row.key}`;
    const copies = byKey.get(key);
    if (copies) copies.push(row);
    else {
      byKey.set(key, [row]);
      order.push(key);
    }
  }
  return order.map((key) => describeGroup(key, byKey.get(key) ?? []));
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * "28 works in 6 rows", or "Showing 3 of 28 works in 2 rows" under a filter. The rows are
 * only mentioned when copies were grouped, because otherwise every work is its own row.
 */
export function holdingsCountLine(shown: number, total: number, rowCount: number): string {
  const rows = rowCount < shown ? ` in ${plural(rowCount, "row")}` : "";
  return shown === total
    ? `${plural(shown, "work")}${rows}`
    : `Showing ${shown} of ${plural(total, "work")}${rows}`;
}
