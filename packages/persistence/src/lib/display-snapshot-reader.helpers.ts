import type { LotMarketingDetails } from "@auction/types";
import type { SaleroomDisplayLotEstimate } from "@auction/types";

export type CatalogLotRow = {
  id: string;
  lotNumber: number | null;
  title: string;
  images: string[] | null;
  marketingDetails: Record<string, unknown> | LotMarketingDetails | null;
};

export function parseDisplayLotEstimate(
  marketingDetails: Record<string, unknown> | LotMarketingDetails | null | undefined,
): SaleroomDisplayLotEstimate | null {
  if (!marketingDetails || typeof marketingDetails !== "object") {
    return null;
  }
  const raw = (marketingDetails as LotMarketingDetails).estimate;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const { low, high, currency } = raw as { low?: unknown; high?: unknown; currency?: unknown };
  if (typeof low !== "string" || typeof high !== "string" || typeof currency !== "string") {
    return null;
  }
  if (!low.trim() || !high.trim() || !currency.trim()) {
    return null;
  }
  return { low, high, currency };
}

export function computeLotQueue(
  rows: CatalogLotRow[],
  currentLotId: string | null,
): {
  saleProgress: { position: number; total: number } | null;
  nextLotRow: CatalogLotRow | null;
} {
  const total = rows.length;
  if (total === 0) {
    return { saleProgress: null, nextLotRow: null };
  }

  if (currentLotId) {
    const currentIndex = rows.findIndex((row) => row.id === currentLotId);
    if (currentIndex < 0) {
      return { saleProgress: null, nextLotRow: rows[0] ?? null };
    }
    const nextLotRow = currentIndex + 1 < total ? (rows[currentIndex + 1] ?? null) : null;
    return {
      saleProgress: { position: currentIndex + 1, total },
      nextLotRow,
    };
  }

  return { saleProgress: null, nextLotRow: rows[0] ?? null };
}

export function addMoneyStrings(a: string, b: string): string | null {
  const left = Number.parseFloat(a);
  const right = Number.parseFloat(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }
  return (left + right).toFixed(2);
}
