import { formatMoney } from "@/lib/ui/format";

export function minNextBidAmount(currentPrice: string, minBidIncrement: string): number {
  const cur = Number.parseFloat(currentPrice);
  const inc = Number.parseFloat(minBidIncrement);
  const safeCur = Number.isFinite(cur) ? cur : 0;
  const safeInc = Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  return safeCur + safeInc;
}

export function bidIncrementOptions(
  currentPrice: string,
  minBidIncrement: string,
  multipliers: readonly number[] = [1, 2, 5],
): number[] {
  const inc = Number.parseFloat(minBidIncrement);
  const safeInc = Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  const base = minNextBidAmount(currentPrice, minBidIncrement);
  return multipliers.map((m) => {
    const amount = base + safeInc * (m - 1);
    return Math.round(amount * 100) / 100;
  });
}

export function validateBidAmount(
  parsedAmount: number,
  liveCurrentPrice: string,
  minBidIncrement: string,
): string | null {
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return "Enter a valid bid amount";
  }
  const minNext = minNextBidAmount(liveCurrentPrice, minBidIncrement);
  if (parsedAmount + 1e-9 < minNext) {
    return `Bid must be at least ${formatMoney(minNext.toFixed(2))} (current ${formatMoney(liveCurrentPrice)} + increment)`;
  }
  return null;
}

export function validatePaddleNumber(paddleNumber: string): string | null {
  const parsed = Number.parseInt(paddleNumber, 10);
  if (!Number.isInteger(parsed) || parsed < 100) {
    return "Enter a valid paddle number (≥100)";
  }
  return null;
}
